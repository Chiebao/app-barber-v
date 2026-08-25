import { prisma } from "@/app/lib/prisma";

/**
 * Integração com o Mercado Pago (Pix automático).
 *
 * Modelo escolhido: cada barbearia CONECTA a própria conta. O dinheiro cai
 * direto na conta dela — o BarberPro nunca toca no valor, só cria a cobrança
 * em nome da barbearia e escuta o aviso de pagamento.
 *
 * Isso muda o jogo do anti-falta: hoje o barbeiro precisa olhar o extrato e
 * confirmar na mão; com isso o sistema confirma sozinho em segundos.
 *
 * Barbearia que não conectar continua no Pix manual — nada quebra.
 */

const MP_API = "https://api.mercadopago.com";

function env(name: string): string {
  return (process.env[name] || "").trim().replace(/\\n$/, "").trim();
}

export function mercadoPagoConfigurado(): boolean {
  return !!(env("MP_CLIENT_ID") && env("MP_CLIENT_SECRET"));
}

/** Para onde o Mercado Pago devolve o usuário depois de autorizar. */
export function redirectUri(): string {
  const base = env("NEXT_PUBLIC_BASE_URL") || "https://barberpro-mauve.vercel.app";
  return `${base}/api/mercadopago/callback`;
}

/** URL para a barbearia autorizar o BarberPro a criar cobranças em nome dela. */
export function urlDeAutorizacao(state: string): string {
  const params = new URLSearchParams({
    client_id: env("MP_CLIENT_ID"),
    response_type: "code",
    platform_id: "mp",
    state,
    redirect_uri: redirectUri(),
  });
  return `https://auth.mercadopago.com.br/authorization?${params.toString()}`;
}

interface TokensMP {
  access_token: string;
  refresh_token: string;
  user_id: number | string;
  expires_in: number;
}

/** Troca o `code` devolvido na autorização pelos tokens de acesso. */
export async function trocarCodePorToken(code: string): Promise<TokensMP | null> {
  try {
    const res = await fetch(`${MP_API}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: env("MP_CLIENT_ID"),
        client_secret: env("MP_CLIENT_SECRET"),
        code,
        redirect_uri: redirectUri(),
      }),
    });
    if (!res.ok) {
      console.error("[MP] falha ao trocar code:", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    return (await res.json()) as TokensMP;
  } catch (err) {
    console.error("[MP] erro ao trocar code:", err);
    return null;
  }
}

/** Renova o acesso quando o token da barbearia expira (validade de ~180 dias). */
export async function renovarToken(refreshToken: string): Promise<TokensMP | null> {
  try {
    const res = await fetch(`${MP_API}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: env("MP_CLIENT_ID"),
        client_secret: env("MP_CLIENT_SECRET"),
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as TokensMP;
  } catch {
    return null;
  }
}

export interface CobrancaPix {
  paymentId: string;
  copiaECola: string;
  qrCodeBase64: string | null;
  valor: number;
  expiraEm: string | null;
}

/** Quando falha, carrega o motivo — sem isso o erro fica invisivel em producao. */
export interface FalhaCobranca {
  erro: string;
}

/**
 * Cria uma cobrança Pix na conta da barbearia.
 * `referencia` é o id do agendamento — é por ele que o webhook reencontra tudo.
 */
export async function criarCobrancaPix(params: {
  accessToken: string;
  valor: number;
  descricao: string;
  referencia: string;
  emailPagador?: string;
  nomePagador?: string;
  expiraEm: Date;
}): Promise<CobrancaPix | FalhaCobranca> {
  try {
    const base = env("NEXT_PUBLIC_BASE_URL") || "https://barberpro-mauve.vercel.app";
    const [primeiro, ...resto] = (params.nomePagador || "Cliente").trim().split(" ");

    // O Mercado Pago recusa vencimento no passado (ou perto demais). Se o
    // prazo do agendamento ja passou, damos uma janela minima de 30 minutos
    // — melhor cobrar com prazo curto do que nao conseguir cobrar.
    const minimo = new Date(Date.now() + 30 * 60 * 1000);
    const vencimento = params.expiraEm > minimo ? params.expiraEm : minimo;

    const res = await fetch(`${MP_API}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
        // Evita cobrança duplicada se a requisição for repetida
        "X-Idempotency-Key": params.referencia,
      },
      body: JSON.stringify({
        transaction_amount: Number(params.valor.toFixed(2)),
        description: params.descricao,
        payment_method_id: "pix",
        external_reference: params.referencia,
        notification_url: `${base}/api/webhooks/mercadopago`,
        date_of_expiration: vencimento.toISOString(),
        payer: {
          email: params.emailPagador || `cliente-${params.referencia}@barberpro.app`,
          first_name: primeiro || "Cliente",
          last_name: resto.join(" ") || "BarberPro",
        },
      }),
    });

    if (!res.ok) {
      const cru = await res.text().catch(() => "");
      console.error("[MP] falha ao criar cobrança:", res.status, cru.slice(0, 500));
      let motivo = `HTTP ${res.status}`;
      try {
        const j = JSON.parse(cru);
        motivo = j?.message || j?.error || motivo;
        if (Array.isArray(j?.cause) && j.cause.length) {
          motivo += ` — ${j.cause.map((c: { description?: string; code?: string }) => c.description || c.code).join("; ")}`;
        }
      } catch { /* resposta nao-JSON */ }
      return { erro: motivo };
    }

    const j = await res.json();
    const dados = j?.point_of_interaction?.transaction_data;
    if (!dados?.qr_code) {
      console.error("[MP] cobrança criada sem QR code:", JSON.stringify(j).slice(0, 300));
      return { erro: `Pagamento criado sem QR (status ${j?.status ?? "?"})` };
    }

    return {
      paymentId: String(j.id),
      copiaECola: dados.qr_code,
      qrCodeBase64: dados.qr_code_base64 || null,
      valor: Number(j.transaction_amount),
      expiraEm: j.date_of_expiration || null,
    };
  } catch (err) {
    console.error("[MP] erro ao criar cobrança:", err);
    return { erro: String(err).slice(0, 200) };
  }
}

/** Ajuda a distinguir sucesso de falha no retorno de `criarCobrancaPix`. */
export function cobrancaOk(r: CobrancaPix | FalhaCobranca): r is CobrancaPix {
  return (r as CobrancaPix).paymentId !== undefined;
}

/** Consulta uma cobrança — usado pelo webhook para confirmar de fato o status. */
export async function consultarPagamento(
  accessToken: string,
  paymentId: string,
): Promise<{ status: string; externalReference: string | null } | null> {
  try {
    const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const j = await res.json();
    return { status: j.status, externalReference: j.external_reference ?? null };
  } catch {
    return null;
  }
}

/**
 * Token de acesso válido da barbearia, renovando se necessário.
 * Devolve null quando a barbearia não conectou o Mercado Pago.
 */
export async function tokenDaBarbearia(shopId: string): Promise<string | null> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { mpAccessToken: true, mpRefreshToken: true, mpConnectedAt: true },
  });
  if (!shop?.mpAccessToken) return null;

  // Renova preventivamente perto do fim da validade (~180 dias)
  const conectadoHa = shop.mpConnectedAt
    ? (Date.now() - shop.mpConnectedAt.getTime()) / 86400000
    : 0;

  if (conectadoHa > 150 && shop.mpRefreshToken) {
    const novos = await renovarToken(shop.mpRefreshToken);
    if (novos?.access_token) {
      await prisma.shop.update({
        where: { id: shopId },
        data: {
          mpAccessToken: novos.access_token,
          mpRefreshToken: novos.refresh_token,
          mpConnectedAt: new Date(),
        },
      });
      return novos.access_token;
    }
  }

  return shop.mpAccessToken;
}
