import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { limitesDoMes, mesParaTexto } from "@/app/lib/despesas";

/**
 * Lança as despesas que se repetem todo mês.
 *
 * É o que decide se a tela de despesas vive ou morre. Aluguel, água e luz são
 * a maior parte do que uma barbearia gasta e não mudam; se dependessem de
 * alguém lembrar de digitar, em dois meses os números parariam de fechar e a
 * tela viraria enfeite.
 *
 * O molde é a despesa com `recorrente = true`. Todo mês este cron cria uma
 * cópia dela com `origemId` apontando de volta.
 *
 * Idempotente: rodar dez vezes no mesmo dia não duplica nada, porque a
 * existência de uma cópia daquele molde NAQUELE mês é a condição de parada.
 * Isso importa — ele roda junto do cron diário.
 */

/** Teto por execução, para uma rodada grande não estourar o tempo da função. */
const MAX_POR_RODADA = 200;

export async function GET(req: NextRequest) {
  const segredo = (process.env.CRON_SECRET || "").trim();
  if (segredo) {
    const auth = req.headers.get("authorization") || "";
    const legado = req.headers.get("x-cron-secret") || "";
    if (auth !== `Bearer ${segredo}` && legado !== segredo) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  const resultado = { moldes: 0, criadas: 0, puladas: 0, detalhes: [] as string[] };

  try {
    // Mês corrente no fuso de São Paulo — o servidor roda em UTC.
    const agoraSP = new Date(Date.now() - 3 * 3600_000);
    const ano = agoraSP.getUTCFullYear();
    const mes = agoraSP.getUTCMonth() + 1;
    const { inicio, fim } = limitesDoMes(ano, mes);

    const moldes = await prisma.expense.findMany({
      where: { recorrente: true },
      select: { id: true, shopId: true, descricao: true, valor: true, categoria: true, data: true },
      take: MAX_POR_RODADA,
    });
    resultado.moldes = moldes.length;

    for (const molde of moldes) {
      // O próprio molde já é a despesa do mês em que foi criado — não se
      // copia por cima de si mesmo.
      if (molde.data >= inicio && molde.data < fim) {
        resultado.puladas++;
        continue;
      }

      const jaTem = await prisma.expense.findFirst({
        where: { origemId: molde.id, data: { gte: inicio, lt: fim } },
        select: { id: true },
      });
      if (jaTem) {
        resultado.puladas++;
        continue;
      }

      // Mantém o dia do mês do molde. Dia 31 em mês de 30 cairia no mês
      // seguinte, então o mínimo entre o dia do molde e o último dia do mês.
      const diaMolde = molde.data.getUTCDate();
      const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
      const dia = Math.min(diaMolde, ultimoDia);

      await prisma.expense.create({
        data: {
          shopId: molde.shopId,
          descricao: molde.descricao,
          valor: molde.valor,
          categoria: molde.categoria,
          data: new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0)),
          recorrente: false,
          origemId: molde.id,
        },
      });

      resultado.criadas++;
      resultado.detalhes.push(`${molde.descricao} (${mesParaTexto(ano, mes)})`);
    }

    return NextResponse.json(resultado);
  } catch (error) {
    console.error("[cron despesas] erro:", error);
    return NextResponse.json({ ...resultado, erro: "Erro interno" }, { status: 500 });
  }
}
