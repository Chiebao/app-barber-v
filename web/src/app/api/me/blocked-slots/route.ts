import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { generateTimeSlots } from "@/app/lib/time-slots";
import { exigirEscrita } from "@/app/lib/exigir-assinatura";
import { bloqueiosDoDia, emMinutos as minutosDe, emTexto as emTextoLocal } from "@/app/lib/bloqueios";

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
        select: {
          id: true,
          startTime: true,
          endTime: true,
          status: true,
          client: { select: { name: true } },
          services: { select: { service: { select: { name: true } } } },
        },
        orderBy: { startTime: "asc" },
      }),
    ]);

    const allDay = blocked.some((b) => b.time === null);
    const blockedTimes = blocked.filter((b) => b.time !== null).map((b) => b.time as string);

    // O painel precisa mostrar o almoço recorrente como bloqueado, senão o
    // barbeiro vê verde onde o cliente vê fechado.
    const { intervalos: todosIntervalos } = await bloqueiosDoDia(
      prisma, barberId, date, shop.slotInterval,
    );
    // O que veio de regra recorrente é o que NÃO corresponde a um bloqueio
    // pontual: o barbeiro precisa saber que aquilo não foi ele que clicou.
    const fixosIntervalos = todosIntervalos.filter(
      (b) => !blockedTimes.includes(b.startTime),
    );
    const bloqueiosDoBarbeiro = todosIntervalos;
    // Na grade do painel, duração e passo são o mesmo número: o barbeiro
    // bloqueia exatamente os blocos que a agenda oferece ao cliente.
    const allSlots = generateTimeSlots(
      shop.openTime, shop.closeTime, shop.slotInterval, [], shop.slotInterval,
    );
    // Um atendimento ocupa TODOS os blocos que ele atravessa, não só o de
    // início. Com passo de 30 min e um corte de 1h marcado às 08:00, o
    // barbeiro via 08:30 verde na própria agenda e podia encaixar alguém
    // por cima de si mesmo. A página do cliente já respeitava a duração —
    // era só o painel que mostrava errado.
    const emMinutos = (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const bookedTimes = allSlots.filter((slot) => {
      const inicio = emMinutos(slot);
      const fim = inicio + shop.slotInterval;
      return appointments.some((a) => {
        const aInicio = emMinutos(a.startTime);
        // endTime pode faltar em registro antigo — cai na duração do bloco
        const aFim = a.endTime ? emMinutos(a.endTime) : aInicio + shop.slotInterval;
        return inicio < aFim && fim > aInicio;
      });
    });

    // Os blocos cobertos por regra recorrente vêm separados: o barbeiro
    // precisa saber que aquilo veio de uma regra, e não foi ele que clicou.
    const fixos = allSlots.filter((slot) => {
      const inicio = minutosDe(slot);
      const fim = inicio + shop.slotInterval;
      return bloqueiosDoBarbeiro.some((b) => {
        const bi = minutosDe(b.startTime);
        const bf = minutosDe(b.endTime);
        return inicio < bf && fim > bi;
      });
    }).filter((slot) => !blockedTimes.includes(slot));

    // A régua do painel desenha por FRONTEIRA, não pela grade: um almoço de
    // 12:00 a 13:00 é um intervalo, e vira uma faixa só. A lista de blocos
    // acima continua saindo porque o app mobile ainda desenha a grade.
    const bloqueios = [
      ...blockedTimes.map((t) => ({
        startTime: t,
        endTime: emTextoLocal(minutosDe(t) + shop.slotInterval),
        tipo: "pontual" as const,
      })),
      ...fixosIntervalos.map((b) => ({ ...b, tipo: "fixo" as const })),
    ];

    return NextResponse.json({
      allSlots,
      blocked: blockedTimes,
      fixos,
      bloqueios,
      // A régua desenha o dia em escala, então precisa da duração real de
      // cada corte — não do bloco da grade que ele começa.
      agendamentos: appointments.map((a) => ({
        id: a.id,
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status,
        cliente: a.client?.name || "Cliente",
        servicos: a.services.map((s) => s.service.name),
      })),
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
