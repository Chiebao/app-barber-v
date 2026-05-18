import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { generateTimeSlots } from "@/app/lib/time-slots";

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

    const where: Record<string, unknown> = {
      shopId: shop.id,
      date: { gte: startOfDay, lte: endOfDay },
      status: { not: "cancelled" },
    };
    if (barberId) where.barberId = barberId;

    const booked = await prisma.appointment.findMany({
      where,
      select: { startTime: true, endTime: true },
    });

    // Limite diario: se atingiu o maximo de slots calculado pelo avgServiceTime
    const [openH, openM] = shop.openTime.split(":").map(Number);
    const [closeH, closeM] = shop.closeTime.split(":").map(Number);
    const totalMinutes = (closeH * 60 + closeM) - (openH * 60 + openM);
    const maxSlots = Math.floor(totalMinutes / shop.avgServiceTime);

    const dayBookings = await prisma.appointment.count({
      where: {
        shopId: shop.id,
        date: { gte: startOfDay, lte: endOfDay },
        status: { not: "cancelled" },
        ...(barberId ? { barberId } : {}),
      },
    });

    if (dayBookings >= maxSlots) {
      return NextResponse.json({ slots: [], message: "Agenda cheia para este dia" });
    }

    let slots = generateTimeSlots(shop.openTime, shop.closeTime, parseInt(duration), booked);

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
