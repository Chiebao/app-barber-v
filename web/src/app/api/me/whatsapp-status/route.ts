import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/app/lib/auth";
import { MODELOS } from "@/app/lib/whatsapp-templates";

/**
 * O canal de WhatsApp está vivo?
 *
 * Existe porque o diagnóstico anterior morava atrás do `CRON_SECRET`, e pedir
 * o segredo de produção pra alguém conferir o próprio canal é troca ruim: o
 * segredo passa por print, por conversa, por histórico de terminal — e trocar
 * ele depois custa Vercel, GitHub Secrets e o agendador externo.
 *
 * Aqui a autorização é o login do dono, que ele já tem no navegador.
 *
 * O que isto pega e nada mais pegava: o token temporário da Meta vence em 24h
 * e o envio é fire-and-forget — sem esta tela, o lembrete simplesmente para de
 * sair e ninguém fica sabendo até um cliente faltar.
 */

function envClean(name: string): string {
  return (process.env[name] || "").trim().replace(/\n$/, "").trim();
}

export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    if (payload.role !== "owner") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const token = envClean("WHATSAPP_API_TOKEN");
    const phoneId = envClean("WHATSAPP_PHONE_ID");
    if (!token || !phoneId) {
      return NextResponse.json({
        configurado: false,
        tokenVivo: false,
        problema: "Faltam WHATSAPP_API_TOKEN e/ou WHATSAPP_PHONE_ID no ambiente.",
        modelos: [],
      });
    }

    const h = { Authorization: `Bearer ${token}` };

    // Uma leitura barata contra a própria linha: se o token venceu, é aqui que
    // a Meta diz. Não manda mensagem nenhuma.
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,quality_rating`,
      { headers: h, cache: "no-store" },
    );
    const corpo = await r.json().catch(() => ({}));

    if (!r.ok) {
      const msg: string = corpo?.error?.message || "Erro desconhecido";
      // "user logged out" é a assinatura do token TEMPORÁRIO de 24h, que é o
      // erro provável de quem colou o token do painel do app em vez de criar
      // um de usuário do sistema. Dizer isso aqui evita a caça ao erro errado.
      const temporario = /logged out|session (has )?expired|Session has expired/i.test(msg);
      return NextResponse.json({
        configurado: true,
        tokenVivo: false,
        problema: temporario
          ? "O token venceu. Esse é o token temporário de 24h da Meta — " +
            "para produção é preciso um token de Usuário do Sistema, que não expira."
          : msg,
        modelos: [],
      });
    }

    // Token vivo: conferir se o que a Meta aprovou bate com o que o app espera.
    let modelos: Array<{ nome: string; status: string; usadoPeloApp: boolean; variaveis: number | null }> = [];
    let avisoModelos: string | null = null;

    const wabaId = envClean("WHATSAPP_WABA_ID");
    if (wabaId) {
      const t = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates` +
          `?fields=name,language,status,components&limit=100`,
        { headers: h, cache: "no-store" },
      );
      const tc = await t.json().catch(() => ({}));
      if (t.ok && Array.isArray(tc.data)) {
        // O botão de copiar código carrega {{1}} na URL, então ele conta como
        // variável — foi exatamente isso que fez o primeiro envio ser recusado.
        const contarVars = (comps: unknown[]) => {
          let max = 0;
          for (const c of (comps || []) as Array<Record<string, unknown>>) {
            const botoes = (c.buttons || []) as Array<Record<string, unknown>>;
            const alvos = [c.text, ...botoes.flatMap((b) => [b.text, b.url])].filter(Boolean);
            for (const alvo of alvos)
              for (const m of String(alvo).matchAll(/\{\{(\d+)\}\}/g))
                max = Math.max(max, Number(m[1]));
          }
          return max;
        };
        const naMeta = new Map(
          (tc.data as Array<Record<string, unknown>>).map((t) => [
            String(t.name),
            { status: String(t.status), vars: contarVars(t.components as unknown[]) },
          ]),
        );
        modelos = Object.values(MODELOS).map((m) => {
          const achado = naMeta.get(m.nome);
          return {
            nome: m.nome,
            status: achado?.status ?? "NÃO CADASTRADO",
            usadoPeloApp: true,
            variaveis: achado ? achado.vars : null,
          };
        });
        // Variável a mais ou a menos é envio recusado em silêncio, então vale
        // gritar antes de o cliente deixar de receber.
        const divergentes = modelos.filter((m) => {
          const esperado = MODELOS[m.nome as keyof typeof MODELOS]?.variaveis;
          return m.variaveis !== null && esperado !== undefined && m.variaveis !== esperado;
        });
        if (divergentes.length) {
          avisoModelos =
            "Modelos com número de variáveis diferente do que o app envia: " +
            divergentes.map((d) => d.nome).join(", ");
        }
      } else {
        avisoModelos = tc?.error?.message || "Não foi possível ler os modelos.";
      }
    } else {
      avisoModelos = "Defina WHATSAPP_WABA_ID para conferir os modelos aprovados.";
    }

    return NextResponse.json({
      configurado: true,
      tokenVivo: true,
      numero: corpo.display_phone_number ?? null,
      nomeVerificado: corpo.verified_name ?? null,
      qualidade: corpo.quality_rating ?? null,
      problema: null,
      avisoModelos,
      modelos,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
