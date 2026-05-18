import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";

// PATCH /api/me/push-token — salva o Expo Push Token do barbeiro autenticado
// Body: { token: "ExponentPushToken[xxx]" }
export async function PATCH(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: "Token obrigatorio" }, { status: 400 });

    // Só barbeiros têm registro na tabela barbers
    const barber = await prisma.barber.findUnique({ where: { id: payload.userId } });
    if (!barber) {
      // Owner logado via owners table — não tem pushToken na tabela barbers
      // Salva no perfil de barbeiro do dono se existir
      const ownerBarber = await prisma.barber.findFirst({
        where: { shopId: payload.shopId, isOwnerProfile: true },
      });
      if (ownerBarber) {
        await (prisma.barber.update as Function)({
          where: { id: ownerBarber.id },
          data: { pushToken: token },
        });
      }
      return NextResponse.json({ ok: true });
    }

    await (prisma.barber.update as Function)({
      where: { id: payload.userId },
      data: { pushToken: token },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
