import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

// DELETE — remove da lista de espera (owner/barber)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const payload = verifyToken(auth);
  if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  try {
    const entry = await prisma.waitlist.findUnique({ where: { id: params.id } });
    if (!entry || entry.shopId !== payload.shopId) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }

    await prisma.waitlist.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
