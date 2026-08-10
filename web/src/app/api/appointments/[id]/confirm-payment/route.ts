import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { occupiesSlotWhere } from "@/app/lib/pending-deadline";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const appointment = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: { client: true },
    });

    if (!appointment) return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    if (appointment.shopId !== payload.shopId) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    if (appointment.status !== "pending_payment") {
      return NextResponse.json({ error: "Agendamento não está aguardando pagamento" }, { status: 400 });
    }

    // Se o prazo venceu, o horário pode ter sido tomado por outro cliente.
    // O barbeiro ainda pode confirmar (o Pix pode ter caído atrasado), mas só
    // se a vaga continuar livre — senão avisamos para ele resolver com o cliente.
    const startOfDay = new Date(appointment.date); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(appointment.date); endOfDay.setHours(23, 59, 59, 999);

    const conflicts = await prisma.appointment.findMany({
      where: {
        barberId: appointment.barberId,
        date: { gte: startOfDay, lte: endOfDay },
        id: { not: params.id },
        ...occupiesSlotWhere(),
      },
      select: { startTime: true, endTime: true },
    });

    const taken = conflicts.some(
      (a) => appointment.startTime < a.endTime && appointment.endTime > a.startTime,
    );
    if (taken) {
      return NextResponse.json({
        error: "Esse horário já foi preenchido por outro cliente. Combine um novo horário ou devolva o valor.",
        slotTaken: true,
      }, { status: 409 });
    }

    await prisma.$transaction([
      prisma.appointment.update({
        where: { id: params.id },
        // Confirmado: some o prazo, o agendamento vira definitivo
        data: { status: "confirmed", pendingExpiresAt: null },
      }),
      prisma.client.update({
        where: { id: appointment.clientId },
        data: { noShowCount: { set: 0 } },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
