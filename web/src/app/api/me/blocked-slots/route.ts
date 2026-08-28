import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { generateTimeSlots } from "@/app/lib/time-slots";
import { exigirEscrita } from "@/app/lib/exigir-assinatura";

// Resolve o barberId efetivo a partir do token + params
// - Barbeiro: usa payload.userId (deve existir em barbers)
// - Dono: usa query/body param barberId (deve pertencer à shop do dono)
async function resolveBarber(
  payload: { userId: string; role: string; shopId: string },
  barberId?: string | null
): Promise<string | null> {
  if (payload.role === "owner") {
    if (!barberId) return null;
    const b = await prisma.barber.findFirst({
      where: { id: barberId, shopId: payload.shopId },
      select: { id: true },
    });
    return b ? b.id : null;
  }
  // Barbeiro: verifica que userId existe em barbers
  const b = await prisma.barber.findUnique({ where: { id: payload.userId }, select: { id: true } });
  return b ? b.id : null;
}

// GET /api/me/blocked-slots?date=YYYY-MM-DD[&barberId=X]
export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    if (!date) return NextResponse.json({ error: "date obrigatorio" }, { status: 400 });

    const barberId = await resolveBarber(payload, searchParams.get("barberId"));
    if (!barberId) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 403 });

    const shop = await prisma.shop.findUnique({ where: { id: payload.shopId } });
    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    const dateStart = new Date(date + "T00:00:00");
    const dateEnd = new Date(date + "T23:59:59");

    const [blocked, appointments] = await Promise.all([
      prisma.blockedSlot.findMany({
        where: { barberId, date: { gte: dateStart, lte: dateEnd } },
      }),
      prisma.appointment.findMany({
        where: {
          barberId,
          date: { gte: dateStart, lte: dateEnd },
          status: { not: "cancelled" },
        },
        select: { startTime: true, endTime: true },
      }),
    ]);

    const allDay = blocked.some((b) => b.time === null);
    const blockedTimes = blocked.filter((b) => b.time !== null).map((b) => b.time as string);
    // Na grade do painel, duração e passo são o mesmo número: o barbeiro
    // bloqueia exatamente os blocos que a agenda oferece ao cliente.
    const allSlots = generateTimeSlots(
      shop.openTime, shop.closeTime, shop.slotInterval, [], shop.slotInterval,
    );
    const bookedTimes = appointments.map((a) => a.startTime);

    return NextResponse.json({
      allSlots,
      blocked: blockedTimes,
      allDay,
      booked: bookedTimes,
      shopHours: { openTime: shop.openTime, closeTime: shop.closeTime, slotInterval: shop.slotInterval },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST /api/me/blocked-slots — bloqueia horários
// Body: { date, times: ["09:00"] } ou { date, allDay: true } [, barberId para donos]
export async function POST(req: NextRequest) {
  try {
    const guarda = await exigirEscrita(req);
    if (!guarda.ok) return guarda.resposta;
    const payload = guarda.payload;

    const body = await req.json();
    const { date, times, allDay } = body;
    if (!date) return NextResponse.json({ error: "date obrigatorio" }, { status: 400 });

    const barberId = await resolveBarber(payload, body.barberId);
    if (!barberId) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 403 });

    const dateObj = new Date(date + "T12:00:00");

    if (allDay) {
      await prisma.blockedSlot.deleteMany({
        where: { barberId, date: { gte: new Date(date + "T00:00:00"), lte: new Date(date + "T23:59:59") } },
      });
      await prisma.blockedSlot.create({
        data: { barberId, shopId: payload.shopId, date: dateObj, time: null },
      });
    } else if (Array.isArray(times) && times.length > 0) {
      await Promise.all(
        times.map((time: string) =>
          prisma.blockedSlot.upsert({
            where: { barberId_date_time: { barberId, date: dateObj, time } },
            update: {},
            create: { barberId, shopId: payload.shopId, date: dateObj, time },
          })
        )
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE /api/me/blocked-slots — desbloqueia horários
// Body: { date, times: ["09:00"] } ou { date, allDay: true } [, barberId para donos]
export async function DELETE(req: NextRequest) {
  try {
    const guarda = await exigirEscrita(req);
    if (!guarda.ok) return guarda.resposta;
    const payload = guarda.payload;

    const body = await req.json();
    const { date, times, allDay } = body;
    if (!date) return NextResponse.json({ error: "date obrigatorio" }, { status: 400 });

    const barberId = await resolveBarber(payload, body.barberId);
    if (!barberId) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 403 });

    if (allDay || (Array.isArray(times) && times.length === 0)) {
      await prisma.blockedSlot.deleteMany({
        where: {
          barberId,
          date: { gte: new Date(date + "T00:00:00"), lte: new Date(date + "T23:59:59") },
        },
      });
    } else if (Array.isArray(times)) {
      const dateObj = new Date(date + "T12:00:00");
      await prisma.blockedSlot.deleteMany({
        where: { barberId, date: dateObj, time: { in: times } },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
