import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { num, money, sumMoney, percentOf } from "@/app/lib/money";

export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const now = new Date();
    const firstOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const todayStart = new Date(now.toISOString().split("T")[0] + "T00:00:00.000Z");
    const todayEnd   = new Date(now.toISOString().split("T")[0] + "T23:59:59.999Z");

    const [monthApts, prevMonthApts, todayApts, barbers, ratings, totalClients, cancelledThisMonth] = await Promise.all([
      // Mês atual — todos (não cancelados)
      prisma.appointment.findMany({
        where: { shopId: payload.shopId, date: { gte: firstOfMonth, lt: firstOfNextMonth }, status: { not: "cancelled" } },
        include: { barber: { select: { name: true } } },
      }),
      // Mês anterior — para comparação
      prisma.appointment.findMany({
        where: { shopId: payload.shopId, date: { gte: firstOfPrevMonth, lt: firstOfMonth }, status: { not: "cancelled" } },
        select: { paidAt: true, totalPrice: true },
      }),
      // Hoje
      prisma.appointment.findMany({
        where: { shopId: payload.shopId, date: { gte: todayStart, lte: todayEnd }, status: { not: "cancelled" } },
        select: { paidAt: true, totalPrice: true },
      }),
      // Barbeiros ativos
      prisma.barber.findMany({
        where: { shopId: payload.shopId, active: true },
        select: { id: true, name: true, commission: true },
      }),
      // Avaliações
      // Média no banco: trazer TODA avaliação de sempre para dividir em
      // JavaScript cresce sem teto — a consulta fica mais lenta a cada mês
      // de uso, e o resultado é um número só.
      prisma.rating.aggregate({ where: { shopId: payload.shopId }, _avg: { score: true }, _count: true }),
      // Clientes reais (únicos que agendaram nesta shop)
      prisma.client.count({
        where: { appointments: { some: { shopId: payload.shopId } } },
      }),
      // Cancelados no mês atual
      prisma.appointment.count({
        where: { shopId: payload.shopId, date: { gte: firstOfMonth, lt: firstOfNextMonth }, status: "cancelled" },
      }),
    ]);

    // ── Hoje ──────────────────────────────────────────────────────────────────
    const todayReceived = sumMoney(todayApts.filter(a => a.paidAt).map(a => a.totalPrice));
    const todayExpected = sumMoney(todayApts.filter(a => !a.paidAt).map(a => a.totalPrice));

    // ── Mês atual ─────────────────────────────────────────────────────────────
    const paidThisMonth      = monthApts.filter(a => a.paidAt);
    const unpaidThisMonth    = monthApts.filter(a => !a.paidAt);
    const monthRevenue       = sumMoney(paidThisMonth.map(a => a.totalPrice));
    const monthToReceive     = sumMoney(unpaidThisMonth.map(a => a.totalPrice));
    // Ticket médio correto: receita recebida / total de atendimentos (não cancelados)
    const avgTicket = monthApts.length > 0 ? money(monthRevenue / monthApts.length) : 0;
    // Taxa de cancelamento
    const totalBookings = monthApts.length + cancelledThisMonth;
    const cancelRate = totalBookings > 0 ? Math.round((cancelledThisMonth / totalBookings) * 100) : 0;

    // ── Mês anterior ──────────────────────────────────────────────────────────
    const prevMonthRevenue = sumMoney(prevMonthApts.filter(a => a.paidAt).map(a => a.totalPrice));
    const prevMonthAptCount = prevMonthApts.length;
    const revenueGrowth = prevMonthRevenue > 0
      ? Math.round(((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
      : null;
    const aptGrowth = prevMonthAptCount > 0
      ? Math.round(((monthApts.length - prevMonthAptCount) / prevMonthAptCount) * 100)
      : null;

    // ── Avaliação ─────────────────────────────────────────────────────────────
    // A média vem pronta do banco. Antes eram todas as avaliações de sempre
    // trazidas para dividir aqui — consulta que fica mais lenta a cada mês de
    // uso, para produzir um número só.
    const avgRating = ratings._count
      ? parseFloat((ratings._avg.score ?? 0).toFixed(1))
      : null;

    // ── Ranking de barbeiros ──────────────────────────────────────────────────
    const barberCommMap: Record<string, number> = {};
    for (const b of barbers) barberCommMap[b.id] = b.commission ?? 0;

    const barberMap: Record<string, { name: string; count: number; revenue: number; commission: number; commissionValue: number }> = {};
    for (const apt of monthApts) {
      if (!barberMap[apt.barberId]) {
        barberMap[apt.barberId] = {
          name: apt.barber.name, count: 0, revenue: 0,
          commission: barberCommMap[apt.barberId] || 0,
          commissionValue: 0,
        };
      }
      barberMap[apt.barberId].count++;
      if (apt.paidAt) {
        const rev = num(apt.totalPrice);
        const pct = barberCommMap[apt.barberId] || 0;
        barberMap[apt.barberId].revenue = money(barberMap[apt.barberId].revenue + rev);
        barberMap[apt.barberId].commissionValue = money(barberMap[apt.barberId].commissionValue + percentOf(rev, pct));
      }
    }
    const barberStats = Object.values(barberMap).sort((a, b) => b.revenue - a.revenue);
    const maxRevenue = barberStats[0]?.revenue || 1; // para calcular % da barra

    // ── Horário de pico ───────────────────────────────────────────────────────
    const hourCounts: Record<number, number> = {};
    for (const apt of monthApts) {
      const h = parseInt(apt.startTime.split(":")[0]);
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }
    const peakEntry = Object.entries(hourCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    const peakHour = peakEntry ? `${peakEntry[0]}h – ${parseInt(peakEntry[0]) + 1}h` : null;

    return NextResponse.json({
      today: {
        appointments: todayApts.length,
        received: todayReceived,
        expected: todayExpected,
      },
      month: {
        appointments: monthApts.length,
        revenue: monthRevenue,
        toReceive: monthToReceive,
        avgTicket,
        cancelRate,
        revenueGrowth,
        aptGrowth,
        prevRevenue: prevMonthRevenue,
        prevApts: prevMonthAptCount,
      },
      barbers: barbers.length,
      totalClients,
      avgRating,
      peakHour,
      barberStats: barberStats.map(b => ({ ...b, revenueShare: maxRevenue > 0 ? b.revenue / maxRevenue : 0 })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
