import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { generateRecoveryCode, hashRecoveryCode } from "@/app/lib/recovery-code";

/**
 * Gera um código de recuperação para a conta logada.
 * O código em texto é devolvido UMA ÚNICA VEZ — depois só fica o hash.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const code = generateRecoveryCode();
    const recoveryCodeHash = await hashRecoveryCode(code);

    // O token pode ser de um Owner ou de um Barber — atualiza quem for
    const owner = await prisma.owner.findUnique({ where: { id: payload.userId }, select: { id: true } });
    if (owner) {
      await prisma.owner.update({ where: { id: owner.id }, data: { recoveryCodeHash } });
    } else {
      const barber = await prisma.barber.findFirst({
        where: { id: payload.userId, shopId: payload.shopId },
        select: { id: true },
      });
      if (!barber) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
      await prisma.barber.update({ where: { id: barber.id }, data: { recoveryCodeHash } });
    }

    return NextResponse.json({ code });
  } catch (error) {
    console.error("recovery-code POST:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/** Informa se a conta já tem um código guardado (sem revelar qual). */
export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const owner = await prisma.owner.findUnique({
      where: { id: payload.userId },
      select: { recoveryCodeHash: true },
    });
    if (owner) return NextResponse.json({ hasCode: !!owner.recoveryCodeHash });

    const barber = await prisma.barber.findFirst({
      where: { id: payload.userId, shopId: payload.shopId },
      select: { recoveryCodeHash: true },
    });
    return NextResponse.json({ hasCode: !!barber?.recoveryCodeHash });
  } catch {
    return NextResponse.json({ hasCode: false });
  }
}
