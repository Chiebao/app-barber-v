import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

/**
 * Taxa de ocupação da agenda (B18).
 *
 * É o indicador que decide o próximo passo do negócio e que o dono não tem:
 *   ocupação baixa  → o problema é trazer gente (divulgação)
 *   ocupação alta   → a agenda já está no limite, dá para subir preço
 *
 * Conta MINUTOS, não quantidade de agendamentos: 3 cortes de 1h ocupam muito
 * mais a cadeira do que 3 pezinhos de 10min.
 */

const SLOT_MIN = 30; // um horário bloqueado equivale a meia hora

function minutosDe(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const dias = Math.min(Number(new URL(req.url).searchParams.get("dias") || 7), 60);

    // Janela: os últimos `dias` dias que já passaram (não conta o futuro,
    // senão a agenda de amanhã ainda vazia derruba o número artificialmente)
    const fim = new Date();
    fim.setHours(23, 59, 59, 999);
    const inicio = new Date(fim);
    inicio.setDate(inicio.getDate() - (dias - 1));
    inicio.setHours(0, 0, 0, 0);

    const [shop, barbeiros, agendamentos, bloqueios] = await Promise.all([
      prisma.shop.findUnique({
        where: { id: payload.shopId },
        select: { openTime: true, closeTime: true, workDays: true },
      }),
      prisma.barber.count({ where: { shopId: payload.shopId, active: true } }),
      prisma.appointment.findMany({
        where: {
          shopId: payload.shopId,
          date: { gte: inicio, lte: fim },
          status: { notIn: ["cancelled"] },
        },
        select: { date: true, totalDuration: true, startTime: true, endTime: true },
      }),
      prisma.blockedSlot.findMany({
        where: { shopId: payload.shopId, date: { gte: inicio, lte: fim } },
        select: { date: true, time: true },
      }),
    ]);

    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    const minutosPorDia = minutosDe(shop.closeTime) - minutosDe(shop.openTime);
    const workDays = shop.workDays?.length ? shop.workDays : [1, 2, 3, 4, 5, 6];
    const cadeiras = Math.max(1, barbeiros);

    // Capacidade: cada dia útil da janela × minutos de expediente × nº de barbeiros
    const diasUteis: string[] = [];
    const cursor = new Date(inicio);
    while (cursor <= fim) {
      if (workDays.includes(cursor.getDay())) {
        diasUteis.push(cursor.toISOString().split("T")[0]);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    // Tempo que o barbeiro bloqueou não conta como capacidade — ele não estava disponível
    let minutosBloqueados = 0;
    for (const b of bloqueios) {
      minutosBloqueados += b.time === null ? minutosPorDia : SLOT_MIN;
    }

    const capacidadeBruta = diasUteis.length * minutosPorDia * cadeiras;
    const capacidade = Math.max(0, capacidadeBruta - minutosBloqueados);

    const duracao = (a: { totalDuration: number; startTime: string; endTime: string }) =>
      a.totalDuration > 0
        ? a.totalDuration
        : Math.max(0, minutosDe(a.endTime) - minutosDe(a.startTime));

    const ocupados = agendamentos.reduce((s, a) => s + duracao(a), 0);
    const taxa = capacidade > 0 ? Math.round((ocupados / capacidade) * 1000) / 10 : 0;

    // Quebra por dia da semana — mostra onde a agenda respira
    const NOMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const porDiaSemana = NOMES.map((nome, idx) => {
      if (!workDays.includes(idx)) return { dia: nome, aberta: false, taxa: 0 };
      const datasDesteDia = diasUteis.filter(
        (d) => new Date(d + "T12:00:00").getDay() === idx,
      );
      const cap = datasDesteDia.length * minutosPorDia * cadeiras;
      const usado = agendamentos
        .filter((a) => a.date.getDay() === idx)
        .reduce((s, a) => s + duracao(a), 0);
      return {
        dia: nome,
        aberta: true,
        taxa: cap > 0 ? Math.round((usado / cap) * 1000) / 10 : 0,
      };
    });

    return NextResponse.json({
      dias,
      taxa,
      horasOcupadas: Math.round((ocupados / 60) * 10) / 10,
      horasDisponiveis: Math.round((capacidade / 60) * 10) / 10,
      atendimentos: agendamentos.length,
      barbeiros: cadeiras,
      diasUteis: diasUteis.length,
      porDiaSemana,
      semDados: agendamentos.length === 0,
    });
  } catch (error) {
    console.error("ocupacao error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
