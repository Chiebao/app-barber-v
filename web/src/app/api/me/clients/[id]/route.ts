import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const payload = verifyToken(auth);
  if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  try {
    const { notes } = await req.json();

    // Verifica que o cliente tem agendamento na shop do usuário autenticado
    const client = await prisma.client.findFirst({
      where: {
        id: params.id,
        appointments: { some: { shopId: payload.shopId } },
      },
    });

    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const updated = await prisma.client.update({
      where: { id: params.id },
      data: { notes: notes ?? null },
      select: { id: true, notes: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
