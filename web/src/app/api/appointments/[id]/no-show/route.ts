import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    const appointment = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: { client: true },
    });

    if (!appointment) return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    if (appointment.status !== "confirmed") {
      return NextResponse.json({ error: "Agendamento não está confirmado" }, { status: 400 });
    }

    // Marca como no_show e incrementa contador do cliente
    await prisma.$transaction([
      prisma.appointment.update({
        where: { id: params.id },
        data: { status: "no_show" },
      }),
      prisma.client.update({
        where: { id: appointment.clientId },
        data: { noShowCount: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({ ok: true, noShowCount: appointment.client.noShowCount + 1 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
