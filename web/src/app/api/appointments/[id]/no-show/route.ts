import { NextRequest, NextResponse } from "next/server";
import { faltasDaPessoa } from "@/app/lib/faltas";
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
    if (appointment.shopId !== payload.shopId) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    // Barbeiro contratado marca falta só de quem ele atendeu. A falta
    // conta contra o cliente em TODAS as barbearias (`Client` é global),
    // então marcar a de outro barbeiro mexe em coisa que não é sua.
    if (payload.role === "barber" && appointment.barberId !== payload.userId) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    if (appointment.status !== "confirmed") {
      return NextResponse.json({ error: "Agendamento não está confirmado" }, { status: 400 });
    }

    // So marca o agendamento. A falta pertence a PESSOA, e o contador que
    // existia era do telefone: a falta do filho cobrava Pix do pai. Agora a
    // conta e derivada dos proprios agendamentos (ver `lib/faltas.ts`).
    await prisma.appointment.update({
      where: { id: params.id },
      data: { status: "no_show" },
    });

    const nome = appointment.clientName ?? appointment.client.name;
    const faltas = await faltasDaPessoa(prisma, appointment.clientId, nome);
    return NextResponse.json({ ok: true, noShowCount: faltas });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
