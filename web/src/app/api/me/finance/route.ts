import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { num, money, sumMoney, multiplyMoney } from "@/app/lib/money";

// Confirmar pagamento
export async function PATCH(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { appointmentId, paymentMethod, removedServiceIds, customPrice, deferredPaymentDate } = await req.json();
    if (!["pix", "dinheiro", "cartao", "adiado"].includes(paymentMethod)) return NextResponse.json({ error: "Forma de pagamento inválida" }, { status: 400 });

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, shopId: payload.shopId },
      include: { services: { include: { service: true } } },
    });
    if (!appointment) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    // Pagamento adiado — apenas salva a data prometida, sem confirmar
    if (paymentMethod === "adiado") {
      if (!deferredPaymentDate) return NextResponse.json({ error: "Data obrigatória para pagamento adiado" }, { status: 400 });
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { paymentMethod: "adiado", deferredPaymentDate: new Date(deferredPaymentDate) },
      });
      return NextResponse.json({ ok: true, loyalty: null });
    }

    // Remove selected services from appointment
    if (Array.isArray(removedServiceIds) && removedServiceIds.length > 0) {
      await prisma.appointmentService.deleteMany({
        where: { appointmentId, serviceId: { in: removedServiceIds } },
      });
    }

    // Recalculate price from remaining services or use customPrice
    let finalPrice: number;
    if (typeof customPrice === "number" && customPrice >= 0) {
      finalPrice = money(customPrice);
    } else {
      const remaining = appointment.services.filter(
        (as) => !Array.isArray(removedServiceIds) || !removedServiceIds.includes(as.serviceId)
      );
      finalPrice = sumMoney(remaining.map((as) => as.service.price));
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { paymentMethod, paidAt: new Date(), status: "completed", totalPrice: finalPrice, deferredPaymentDate: null },
    });

    // Fidelidade
    await prisma.loyaltyCount.upsert({
      where: { shopId_clientId: { shopId: payload.shopId, clientId: appointment.clientId } },
      create: { shopId: payload.shopId, clientId: appointment.clientId, barberId: appointment.barberId, count: 1 },
      update: { count: { increment: 1 }, barberId: appointment.barberId },
    });

    const loyalty = await prisma.loyaltyCount.findUnique({
      where: { shopId_clientId: { shopId: payload.shopId, clientId: appointment.clientId } },
      include: { client: true },
    });

    const reachedReward = loyalty && loyalty.count % 10 === 0;

    return NextResponse.json({
      ok: true,
      loyalty: loyalty ? { clientName: loyalty.client.name, clientPhone: loyalty.client.phone, count: loyalty.count, reachedReward } : null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// Relatorio financeiro
export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const barberId = searchParams.get("barberId");

    if (!start || !end) return NextResponse.json({ error: "start e end obrigatórios" }, { status: 400 });

    const where: Record<string, unknown> = {
      shopId: payload.shopId,
      date: { gte: new Date(start + "T00:00:00.000Z"), lte: new Date(end + "T23:59:59.999Z") },
      status: { not: "cancelled" },
    };

    if (payload.role === "barber") where.barberId = payload.userId;
    else if (barberId) where.barberId = barberId;

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        client: { select: { name: true, phone: true } },
        barber: { select: { id: true, name: true, commission: true } },
        services: { include: { service: true } },
        rating: { select: { score: true } },
        comandaItems: { include: { product: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const paid = appointments.filter(a => a.paidAt);
    const unpaid = appointments.filter(a => !a.paidAt);
    const totalPaid = sumMoney(paid.map(a => a.totalPrice));
    const totalUnpaid = sumMoney(unpaid.map(a => a.totalPrice));
    const comandaTotal = money(appointments.reduce(
      (s, a) => s + a.comandaItems.reduce((cs, ci) => cs + multiplyMoney(ci.price, ci.quantity), 0),
      0,
    ));

    const serviceCounts: Record<string, number> = {};
    for (const apt of appointments)
      for (const as of apt.services)
        serviceCounts[as.service.category] = (serviceCounts[as.service.category] || 0) + 1;

    const paymentCounts: Record<string, { count: number; total: number }> = {};
    for (const apt of paid) {
      const m = apt.paymentMethod || "indefinido";
      if (!paymentCounts[m]) paymentCounts[m] = { count: 0, total: 0 };
      paymentCounts[m].count++;
      paymentCounts[m].total = money(paymentCounts[m].total + num(apt.totalPrice));
    }

    // Por barbeiro: faturado no periodo e quanto disso e comissao.
    // So conta o que foi PAGO — comissao sobre atendimento nao recebido
    // seria prometer dinheiro que ainda nao entrou.
    const porBarbeiro = new Map<string, { id: string; name: string; count: number; revenue: number; commission: number }>();
    for (const apt of paid) {
      const b = apt.barber;
      const atual = porBarbeiro.get(b.id) || { id: b.id, name: b.name, count: 0, revenue: 0, commission: b.commission };
      atual.count++;
      atual.revenue = money(atual.revenue + num(apt.totalPrice));
      porBarbeiro.set(b.id, atual);
    }
    const barberBreakdown = [...porBarbeiro.values()]
      .map(b => ({ ...b, commissionValue: money((b.revenue * b.commission) / 100) }))
      .sort((a, b) => b.revenue - a.revenue);

    const avgRating = paid.filter(a => a.rating).reduce((s, a) => s + (a.rating?.score || 0), 0) / (paid.filter(a => a.rating).length || 1);

    return NextResponse.json({
      summary: {
        totalAppointments: appointments.length,
        totalPaid, totalUnpaid, paidCount: paid.length, unpaidCount: unpaid.length,
        comandaTotal, totalRevenue: money(totalPaid + comandaTotal),
        serviceCounts, paymentCounts, barberBreakdown,
        avgRating: isNaN(avgRating) ? null : parseFloat(avgRating.toFixed(1)),
      },
      appointments: appointments.map(a => ({
        id: a.id,
        date: a.date.toISOString().split("T")[0],
        startTime: a.startTime,
        totalPrice: num(a.totalPrice),
        status: a.status,
        paymentMethod: a.paymentMethod,
        paidAt: a.paidAt,
        deferredPaymentDate: a.deferredPaymentDate,
        barberName: a.barber.name,
        barberId: a.barber.id,
        client: a.client,
        services: a.services.map(as => ({ name: as.service.name, category: as.service.category, price: num(as.service.price) })),
        rating: a.rating?.score || null,
        comandaTotal: money(a.comandaItems.reduce((s, ci) => s + multiplyMoney(ci.price, ci.quantity), 0)),
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
