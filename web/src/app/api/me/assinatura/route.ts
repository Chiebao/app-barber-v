import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { num } from "@/app/lib/money";
import {
  PLANOS,
  type PlanoId,
  situacaoDe,
  valorDoCiclo,
  DIAS_CARENCIA,
} from "@/app/lib/assinatura";

/**
 * Assinatura da barbearia, do ponto de vista do dono.
 *
 * GET   — situação atual, planos disponíveis e histórico de cobranças
 * PATCH — troca de plano, ou cancelamento/reativação
 *
 * A cobrança em si (gerar Pix, receber webhook) vive em rotas próprias:
 * misturar "que plano eu tenho" com "como eu pago" é o que costuma
 * transformar tela de assinatura em labirinto.
 */

export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const assinatura = await prisma.subscription.findUnique({
      where: { shopId: payload.shopId },
      include: {
        cobrancas: {
          orderBy: { vencimento: "desc" },
          take: 12,
          select: {
            id: true, valor: true, status: true, vencimento: true,
            pagaEm: true, metodo: true,
          },
        },
      },
    });

    const situacao = situacaoDe(assinatura);

    return NextResponse.json({
      situacao: {
        ...situacao,
        // Só o dono decide plano; o barbeiro contratado apenas vê o aviso
        podeGerenciar: payload.role === "owner",
        diasCarencia: DIAS_CARENCIA,
        canceladaEm: assinatura?.canceladaEm ?? null,
        metodo: assinatura?.metodo ?? null,
      },
      planos: (Object.keys(PLANOS) as PlanoId[]).map((id) => ({
        id,
        rotulo: PLANOS[id].rotulo,
        meses: PLANOS[id].meses,
        mensal: PLANOS[id].mensal,
        total: valorDoCiclo(id),
        // Quanto se economiza por mês contra o plano mensal
        economiaMensal: Math.round((PLANOS.mensal.mensal - PLANOS[id].mensal) * 100) / 100,
      })),
      cobrancas: (assinatura?.cobrancas ?? []).map((c) => ({
        ...c,
        valor: num(c.valor),
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") {
      return NextResponse.json({ error: "Só o dono pode mexer na assinatura" }, { status: 401 });
    }

    const { plano, cancelar } = await req.json();

    const atual = await prisma.subscription.findUnique({ where: { shopId: payload.shopId } });
    if (!atual) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });

    if (cancelar === true) {
      // Cancelar não corta o acesso na hora: o que já foi pago continua
      // valendo até o fim do período. Cortar no ato seria vender um mês e
      // entregar meio.
      const s = await prisma.subscription.update({
        where: { shopId: payload.shopId },
        data: { canceladaEm: new Date() },
      });
      return NextResponse.json({
        ok: true,
        mensagem: `Assinatura cancelada. Você continua com acesso até ${s.periodoFim.toLocaleDateString("pt-BR")}.`,
      });
    }

    if (cancelar === false) {
      await prisma.subscription.update({
        where: { shopId: payload.shopId },
        data: { canceladaEm: null },
      });
      return NextResponse.json({ ok: true, mensagem: "Assinatura reativada." });
    }

    if (plano) {
      if (!(plano in PLANOS)) {
        return NextResponse.json({ error: "Plano inválido" }, { status: 400 });
      }
      // A troca vale a partir da próxima cobrança — o período já pago não
      // muda de preço no meio do caminho, para nenhum dos dois lados.
      await prisma.subscription.update({
        where: { shopId: payload.shopId },
        data: { plano, valorCiclo: valorDoCiclo(plano as PlanoId) },
      });
      return NextResponse.json({
        ok: true,
        mensagem: `Plano alterado para ${PLANOS[plano as PlanoId].rotulo}. Vale a partir da próxima cobrança.`,
      });
    }

    return NextResponse.json({ error: "Nada para alterar" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
