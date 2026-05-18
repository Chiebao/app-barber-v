import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { score, comment } = await req.json();
    if (!score || score < 1 || score > 5) return NextResponse.json({ error: "Nota invalida (1-5)" }, { status: 400 });

    const appointment = await prisma.appointment.findUnique({ where: { id: params.id } });
    if (!appointment) return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });

    const existing = await prisma.rating.findUnique({ where: { appointmentId: params.id } });
    if (existing) return NextResponse.json({ error: "Ja avaliado" }, { status: 400 });

    await prisma.rating.create({
      data: {
        appointmentId: params.id,
        clientId: appointment.clientId,
        shopId: appointment.shopId,
        barberId: appointment.barberId,
        score,
        comment: comment || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
