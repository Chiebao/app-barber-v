import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { money, multiplyMoney, num, percentOf, sumMoney } from "@/app/lib/money";
import { limitesDoMes, mesAnterior, mesDeTexto, mesParaTexto } from "@/app/lib/despesas";

/**
 * Lucro do mês: o que entrou, menos comissão, menos despesa.
 *
 * DUAS ARMADILHAS que o modelo de dados esconde e que definem esta conta:
 *
 * 1. `Appointment.totalPrice` é SÓ SERVIÇO. Produto vive em `ComandaItem`,
 *    separado. Somar só o totalPrice esconderia toda a venda de produto.
 *
 * 2. A comissão do barbeiro incide sobre serviço, não sobre produto — é como
 *    o /api/me/finance já calcula. Aplicar a comissão sobre o total pagaria
 *    o barbeiro pela pomada que ele não vendeu.
 *
 * Só entra o que foi PAGO. Atendimento feito e não recebido é fiado, não
 * lucro — ele já aparece em "A receber", que é outra tela.
 */

export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    if (payload.role !== "owner") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { ano, mes } = mesDeTexto(req.nextUrl.searchParams.get("mes"));
    const anterior = mesAnterior(ano, mes);

    const atual = await calcular(payload.shopId, ano, mes);
    const passado = await calcular(payload.shopId, anterior.ano, anterior.mes);

    // Variação só faz sentido com base: sair de zero não é "infinito por
    // cento", é o primeiro mês.
    const variacao =
      passado.lucro > 0
        ? Math.round(((atual.lucro - passado.lucro) / passado.lucro) * 100)
        : null;

    return NextResponse.json({
      mes: mesParaTexto(ano, mes),
      ...atual,
      comparacao: {
        mes: mesParaTexto(anterior.ano, anterior.mes),
        lucro: passado.lucro,
        variacao,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

async function calcular(shopId: string, ano: number, mes: number) {
  const { inicio, fim } = limitesDoMes(ano, mes);

  const pagos = await prisma.appointment.findMany({
    where: {
      shopId,
      paidAt: { not: null },
      date: { gte: inicio, lt: fim },
      status: { notIn: ["cancelled", "no_show"] },
    },
    select: {
      totalPrice: true,
      barber: { select: { id: true, name: true, commission: true } },
      comandaItems: { select: { quantity: true, price: true, custo: true } },
    },
  });

  const servicos = sumMoney(pagos.map((a) => a.totalPrice));

  let produtos = 0;
  let custoProdutos = 0;
  let itensSemCusto = 0;
  for (const a of pagos) {
    for (const ci of a.comandaItems) {
      produtos = money(produtos + multiplyMoney(ci.price, ci.quantity));
      if (ci.custo === null || ci.custo === undefined) itensSemCusto++;
      else custoProdutos = money(custoProdutos + multiplyMoney(ci.custo, ci.quantity));
    }
  }

  // Comissão por barbeiro, sobre o serviço dele.
  const porBarbeiro = new Map<string, { id: string; nome: string; servicos: number; percentual: number }>();
  for (const a of pagos) {
    const b = a.barber;
    const atual = porBarbeiro.get(b.id) || { id: b.id, nome: b.name, servicos: 0, percentual: b.commission };
    atual.servicos = money(atual.servicos + num(a.totalPrice));
    porBarbeiro.set(b.id, atual);
  }
  const comissoesPorBarbeiro = [...porBarbeiro.values()]
    .map((b) => ({ ...b, comissao: percentOf(b.servicos, b.percentual) }))
    .sort((a, b) => b.comissao - a.comissao);
  const comissoes = sumMoney(comissoesPorBarbeiro.map((b) => b.comissao));

  const despesasDoMes = await prisma.expense.findMany({
    where: { shopId, data: { gte: inicio, lt: fim } },
    select: { valor: true, categoria: true },
  });
  const despesas = sumMoney(despesasDoMes.map((d) => d.valor));
  const despesasPorCategoria: Record<string, number> = {};
  for (const d of despesasDoMes) {
    despesasPorCategoria[d.categoria] = sumMoney([despesasPorCategoria[d.categoria], d.valor]);
  }

  const entrou = money(servicos + produtos);

  return {
    entrou,
    servicos,
    produtos,
    comissoes,
    comissoesPorBarbeiro,
    despesas,
    despesasPorCategoria,
    lucro: money(entrou - comissoes - despesas),
    atendimentos: pagos.length,
    // Margem de produto é informativa e NÃO entra na conta do lucro: o que
    // saiu do caixa para comprar produto já foi lançado como despesa. Contar
    // o custo aqui de novo seria descontar a mesma compra duas vezes.
    margemProdutos: {
      vendeu: produtos,
      custou: custoProdutos,
      margem: money(produtos - custoProdutos),
      itensSemCusto,
    },
  };
}
