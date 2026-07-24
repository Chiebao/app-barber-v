import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { hashPassword } from "@/app/lib/auth";

/**
 * Reset de senha SUPER-ADMIN (uso do dono da plataforma).
 * Protegido pela senha-mestra em ADMIN_SECRET.
 * Redefine a senha de qualquer conta (dono e/ou barbeiro) pelo telefone.
 */
export async function POST(req: NextRequest) {
  try {
    const ADMIN_SECRET = process.env.ADMIN_SECRET;
    if (!ADMIN_SECRET) {
      return NextResponse.json({ error: "Reset não configurado no servidor" }, { status: 500 });
    }

    const { secret, phone, newPassword } = await req.json();

    if (secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Senha-mestra incorreta" }, { status: 401 });
    }
    const cleanPhone = String(phone || "").replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: "Telefone inválido" }, { status: 400 });
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json({ error: "Nova senha deve ter no mínimo 6 caracteres" }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);

    // Atualiza dono (se existir com esse telefone) e todos os barbeiros com esse telefone.
    // Cobre tanto o caso "dono esqueceu" quanto "funcionário esqueceu".
    const [ownerResult, barberResult] = await Promise.all([
      prisma.owner.updateMany({ where: { phone: cleanPhone }, data: { passwordHash } }),
      prisma.barber.updateMany({ where: { phone: cleanPhone }, data: { passwordHash } }),
    ]);

    const total = ownerResult.count + barberResult.count;
    if (total === 0) {
      return NextResponse.json({ error: "Nenhuma conta encontrada com esse telefone" }, { status: 404 });
    }

    // Descobre o nome pra confirmar visualmente que é a pessoa certa
    const owner = await prisma.owner.findUnique({ where: { phone: cleanPhone }, select: { name: true } });
    const barber = owner ? null : await prisma.barber.findFirst({ where: { phone: cleanPhone }, select: { name: true } });
    const name = owner?.name || barber?.name || null;

    return NextResponse.json({
      ok: true,
      name,
      accountsUpdated: total,
      role: owner ? "dono" : "barbeiro",
    });
  } catch (error) {
    console.error("Admin reset error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
