import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { generateTimeSlots } from "@/app/lib/time-slots";
import { occupiesSlotWhere } from "@/app/lib/pending-deadline";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const duration = searchParams.get("duration");
    const barberId = searchParams.get("barberId");

    if (!date || !duration) return NextResponse.json({ error: "date e duration obrigatorios" }, { status: 400 });

    const shop = await prisma.shop.findUnique({ where: { slug: params.slug } });
    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    const dayOfWeek = new Date(date + "T12:00:00").getDay();
    if (!shop.workDays.includes(dayOfWeek)) return NextResponse.json({ slots: [], message: "Dia nao disponivel" });

    const startOfDay = new Date(date + "T00:00:00");
    const endOfDay = new Date(date + "T23:59:59");

    // Pré-agendamentos vencidos não ocupam mais o horário
    const where: Record<string, unknown> = {
      shopId: shop.id,
      date: { gte: startOfDay, lte: endOfDay },
      ...occupiesSlotWhere(),
    };
    if (barberId) where.barberId = barberId;

    const booked = await prisma.appointment.findMany({
      where,
      select: { startTime: true, endTime: true, totalDuration: true },
    });

    // Capacidade do dia por TEMPO REAL ocupado (não por número de agendamentos).
    // O contador antigo comparava a quantidade de agendamentos com uma estimativa
    // baseada no tempo médio — o que fechava a agenda cedo quando os serviços eram
    // mais curtos que a média (vaga ociosa) e não refletia a ocupação real.
    const [openH, openM] = shop.openTime.split(":").map(Number);
    const [closeH, closeM] = shop.closeTime.split(":").map(Number);
    const totalMinutes = (closeH * 60 + closeM) - (openH * 60 + openM);

    const bookedMinutes = booked.reduce((sum, apt) => {
      if (apt.totalDuration && apt.totalDuration > 0) return sum + apt.totalDuration;
      // Fallback: calcula pela diferença startTime/endTime
      const [sh, sm] = apt.startTime.split(":").map(Number);
      const [eh, em] = apt.endTime.split(":").map(Number);
      return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
    }, 0);

    // Só declara "agenda cheia" quando não cabe mais o serviço pedido no tempo restante.
    if (totalMinutes - bookedMinutes < parseInt(duration)) {
      return NextResponse.json({ slots: [], message: "Agenda cheia para este dia" });
    }

    // A duração é a soma dos serviços escolhidos; o passo é a divisão do
    // dia definida pela barbearia. São coisas diferentes de propósito.
    let slots = generateTimeSlots(
      shop.openTime, shop.closeTime, parseInt(duration), booked, shop.slotInterval,
    );

    // Filtrar slots bloqueados pelo barbeiro nesse dia
    if (barberId) {
      const blocked = await prisma.blockedSlot.findMany({
        where: { barberId, date: { gte: startOfDay, lte: endOfDay } },
      });
      if (blocked.some((b) => b.time === null)) {
        return NextResponse.json({ slots: [], message: "Barbeiro indisponivel neste dia" });
      }
      const blockedTimes = blocked.filter((b) => b.time !== null).map((b) => b.time as string);
      if (blockedTimes.length > 0) {
        slots = slots.filter((s) => !blockedTimes.includes(s));
      }
    }

    return NextResponse.json({ slots });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
