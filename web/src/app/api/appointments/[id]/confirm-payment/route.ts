import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

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

    await prisma.$transaction([
      prisma.appointment.update({
        where: { id: params.id },
        data: { status: "confirmed" },
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
