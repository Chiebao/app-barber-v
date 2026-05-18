import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

// GET — dono/barbeiro vê a lista de espera da barbearia
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const payload = verifyToken(auth);
  if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  try {
    const entries = await prisma.waitlist.findMany({
      where: { shopId: payload.shopId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        clientName: true,
        clientPhone: true,
        serviceIds: true,
        preferredDate: true,
        createdAt: true,
        barber: { select: { name: true } },
      },
    });

    return NextResponse.json({ waitlist: entries });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
