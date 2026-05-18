import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken, verifyPassword, hashPassword } from "@/app/lib/auth";

// PATCH /api/me/password — altera senha do usuário autenticado (dono ou barbeiro)
// Body: { currentPassword, newPassword }
export async function PATCH(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Campos obrigatorios" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Nova senha deve ter ao menos 6 caracteres" }, { status: 400 });
    }

    if (payload.role === "owner") {
      const owner = await prisma.owner.findUnique({ where: { id: payload.userId } });
      if (!owner) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

      const valid = await verifyPassword(currentPassword, owner.passwordHash);
      if (!valid) return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });

      await prisma.owner.update({
        where: { id: payload.userId },
        data: { passwordHash: await hashPassword(newPassword) },
      });
    } else {
      const barber = await prisma.barber.findUnique({ where: { id: payload.userId } });
      if (!barber) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

      const valid = await verifyPassword(currentPassword, barber.passwordHash);
      if (!valid) return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });

      await prisma.barber.update({
        where: { id: payload.userId },
        data: { passwordHash: await hashPassword(newPassword) },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
