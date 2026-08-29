/**
 * Cobrança da assinatura do BarberPro pela InfinitePay.
 *
 * ATENÇÃO — não confundir com o Pix do Mercado Pago, que existe no projeto
 * para outra coisa: lá a barbearia cobra o CLIENTE dela e o dinheiro cai na
 * conta da barbearia. Aqui a plataforma cobra a BARBEARIA e o dinheiro cai
 * na conta do BarberPro. São dois fluxos separados de propósito.
 *
 * Modelo escolhido: link de checkout, não a assinatura nativa da InfinitePay.
 * A recorrência deles cobra sozinha, mas só existe no painel — sem API, o
 * BarberPro não ficaria sabendo que a barbearia pagou e bloquearia quem está
 * em dia. Com o link, geramos a cobrança e o webhook confirma sozinho.
 */

const API = "https://api.checkout.infinitepay.io";

function env(nome: string, padrao = ""): string {
  return (process.env[nome] || padrao).trim().replace(/\\n$/, "").trim();
}

/**
 * InfiniteTag da conta que recebe — o "@" do app, sem o `$`.
 * Não é segredo (é um nome de usuário público), mas fica em variável para
 * poder trocar de conta sem alterar código.
 */
export function handleDaPlataforma(): string {
  return env("INFINITEPAY_HANDLE", "cgcellrepair");
}

export function infinitePayConfigurado(): boolean {
  return !!handleDaPlataforma();
}

export interface LinkCobranca {
  url: string;
  orderNsu: string;
}
export interface FalhaCobranca {
  erro: string;
}

export function cobrancaOk(r: LinkCobranca | FalhaCobranca): r is LinkCobranca {
  return (r as LinkCobranca).url !== undefined;
}

/** Reais para centavos, que é o que a API espera. */
export function emCentavos(valor: number): number {
  return Math.round(valor * 100);
}

/**
 * Cria o link de pagamento de uma cobrança.
 *
 * `orderNsu` é o id da nossa fatura — é por ele que o webhook reencontra a
 * assinatura. Mandar o nosso id, e não deixar a InfinitePay gerar um, é o
 * que torna a confirmação rastreável dos dois lados.
 */
export async function criarLinkCobranca(params: {
  orderNsu: string;
  valor: number;
  descricao: string;
  baseUrl: string;
  cliente?: { nome?: string; email?: string; telefone?: string };
}): Promise<LinkCobranca | FalhaCobranca> {
  const handle = handleDaPlataforma();
  if (!handle) return { erro: "InfinitePay não configurada (INFINITEPAY_HANDLE)" };

  const corpo: Record<string, unknown> = {
    handle,
    order_nsu: params.orderNsu,
    items: [
      {
        quantity: 1,
        price: emCentavos(params.valor),
        description: params.descricao,
      },
    ],
    redirect_url: `${params.baseUrl}/admin/painel?assinatura=paga`,
    webhook_url: `${params.baseUrl}/api/webhooks/infinitepay`,
  };

  if (params.cliente?.nome || params.cliente?.telefone) {
    corpo.customer = {
      ...(params.cliente.nome ? { name: params.cliente.nome } : {}),
      ...(params.cliente.email ? { email: params.cliente.email } : {}),
      // A API pede o telefone em formato internacional
      ...(params.cliente.telefone
        ? { phone_number: "+55" + params.cliente.telefone.replace(/\D/g, "") }
        : {}),
    };
  }

  try {
    const res = await fetch(`${API}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });

    const cru = await res.text();
    if (!res.ok) {
      console.error("[InfinitePay] falha ao criar link:", res.status, cru.slice(0, 400));
      return { erro: `HTTP ${res.status}` };
    }

    let dados: Record<string, unknown> = {};
    try { dados = JSON.parse(cru); } catch { /* resposta não-JSON */ }

    // A API já variou o nome do campo entre versões; aceitamos os conhecidos
    const url = (dados.url || dados.link || dados.payment_url || dados.checkout_url) as string | undefined;
    if (!url) {
      console.error("[InfinitePay] link criado sem url:", cru.slice(0, 300));
      return { erro: "Resposta sem link de pagamento" };
    }

    return { url, orderNsu: params.orderNsu };
  } catch (err) {
    console.error("[InfinitePay] erro ao criar link:", err);
    return { erro: String(err).slice(0, 200) };
  }
}

export interface ConferenciaPagamento {
  pago: boolean;
  valorPago: number | null;
  metodo: string | null;
}

/**
 * Confere o pagamento direto na InfinitePay.
 *
 * O webhook deles não vem assinado, então qualquer um que descubra a URL
 * poderia postar "pagou". Nunca confiamos no corpo recebido: ele só diz
 * QUAL cobrança olhar, e a verdade vem desta consulta.
 */
export async function conferirPagamento(params: {
  orderNsu: string;
  transactionNsu: string;
  slug: string;
}): Promise<ConferenciaPagamento | null> {
  const handle = handleDaPlataforma();
  if (!handle) return null;

  try {
    const res = await fetch(`${API}/payment_check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle,
        order_nsu: params.orderNsu,
        transaction_nsu: params.transactionNsu,
        slug: params.slug,
      }),
    });

    if (!res.ok) {
      console.error("[InfinitePay] payment_check falhou:", res.status);
      return null;
    }

    const d = await res.json();
    if (d?.success !== true) return { pago: false, valorPago: null, metodo: null };

    return {
      pago: d.paid === true,
      valorPago: typeof d.paid_amount === "number" ? d.paid_amount / 100 : null,
      metodo: d.capture_method ?? null,
    };
  } catch (err) {
    console.error("[InfinitePay] erro no payment_check:", err);
    return null;
  }
}
