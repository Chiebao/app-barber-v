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
        comoPaga: PLANOS[id].comoPaga,
        compromisso: PLANOS[id].compromisso,
        mesesCobranca: PLANOS[id].mesesCobranca,
        mensal: PLANOS[id].mensal,
        // O que sai em CADA cobrança
        porCobranca: valorDoCiclo(id),
        // O que o compromisso inteiro custa — para comparar honestamente
        totalCompromisso: Math.round(PLANOS[id].mensal * PLANOS[id].compromisso * 100) / 100,
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

      // Se ele sai antes de cumprir um compromisso pago mês a mês, o desconto
      // adiantado fica em aberto. Dizemos agora, e não na reativação: ninguém
      // deve descobrir uma pendência meses depois.
      const planoAtual = (s.plano in PLANOS ? s.plano : "mensal") as PlanoId;
      const p = PLANOS[planoAtual];
      const emAberto =
        p.compromisso > 1 && p.mesesCobranca === 1 && s.ciclosPagos > 0 && s.ciclosPagos < p.compromisso
          ? Math.round((PLANOS.mensal.mensal - p.mensal) * s.ciclosPagos * 100) / 100
          : 0;

      return NextResponse.json({
        ok: true,
        mensagem:
          `Assinatura cancelada. Você continua com acesso até ${s.periodoFim.toLocaleDateString("pt-BR")}.` +
          (emAberto > 0
            ? ` Você usou ${s.ciclosPagos} de ${p.compromisso} meses do plano ${p.rotulo}; se voltar, a diferença do desconto (R$ ${emAberto.toFixed(2).replace(".", ",")}) entra na primeira cobrança.`
            : ""),
        descontoAAcertar: emAberto,
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
      //
      // Cobrança aberta do plano anterior é cancelada junto: ela foi gerada
      // com outro preço, e deixar viva significaria oferecer um link antigo
      // que entrega o plano novo.
      await prisma.$transaction([
        prisma.subscription.update({
          where: { shopId: payload.shopId },
          // ciclosPagos zera: o compromisso antigo deixou de existir, e
          // contar meses de um plano dentro de outro daria um número que
          // não corresponde a combinado nenhum.
          data: { plano, valorCiclo: valorDoCiclo(plano as PlanoId), ciclosPagos: 0 },
        }),
        prisma.subscriptionInvoice.updateMany({
          where: { subscriptionId: atual.id, status: "pendente", plano: { not: plano } },
          data: { status: "cancelada" },
        }),
      ]);
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
