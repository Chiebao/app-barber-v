import { NextRequest, NextResponse } from "next/server";
import { verifyToken, type VerifiedToken } from "@/app/lib/auth";
import { situacaoDaLoja } from "@/app/lib/assinatura";

/**
 * Porteiro das rotas que ESCREVEM.
 *
 * Assinatura bloqueada deixa o painel em modo leitura: o barbeiro continua
 * vendo a agenda e confirmando pagamento do que já existe, mas não cria nem
 * edita mais nada. Trancar tudo puniria os clientes que já tinham horário
 * marcado — e eles não devem nada a ninguém.
 *
 * Devolve 402 (Payment Required), que é o código certo: não é falta de
 * permissão, é falta de pagamento. O painel usa isso para abrir a tela de
 * assinatura em vez de mandar o usuário para o login.
 */
export interface Autorizado {
  ok: true;
  payload: VerifiedToken;
}
export interface Barrado {
  ok: false;
  resposta: NextResponse;
}

export async function exigirEscrita(
  req: NextRequest,
  opcoes: { apenasDono?: boolean } = {},
): Promise<Autorizado | Barrado> {
  const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
  if (!payload) {
    return { ok: false, resposta: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  if (opcoes.apenasDono && payload.role !== "owner") {
    return { ok: false, resposta: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }

  const situacao = await situacaoDaLoja(payload.shopId);
  if (!situacao.podeEscrever) {
    return {
      ok: false,
      resposta: NextResponse.json(
        {
          error: situacao.aviso || "Assinatura bloqueada.",
          assinatura: { estado: situacao.estado, bloqueada: true },
        },
        { status: 402 },
      ),
    };
  }

  return { ok: true, payload };
}
