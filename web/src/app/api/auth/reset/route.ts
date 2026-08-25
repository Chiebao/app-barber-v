import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { hashPassword } from "@/app/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

/**
 * Passo 2 do "esqueci minha senha": confere o código e grava a senha nova.
 *
 * Protegido contra tentativa às cegas: cada código aceita no máximo
 * MAX_TENTATIVAS palpites e vale por poucos minutos. Ao acertar, o código
 * é queimado na mesma transação em que a senha muda.
 */

const schema = z.object({
  phone: z.string().min(10),
  code: z.string().min(4),
  newPassword: z.string().min(6, "A senha precisa ter no mínimo 6 caracteres"),
});

const MAX_TENTATIVAS = 5;
const ERRO_GENERICO = "Código inválido ou expirado. Peça um novo.";

export async function POST(req: NextRequest) {
  try {
    const data = schema.parse(await req.json());
    const telefone = data.phone.replace(/\D/g, "");

    const pedido = await prisma.passwordReset.findFirst({
      where: { phone: telefone, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!pedido) return NextResponse.json({ error: ERRO_GENERICO }, { status: 401 });

    // Chute demais: queima o código e obriga a pedir outro
    if (pedido.attempts >= MAX_TENTATIVAS) {
      await prisma.passwordReset.update({
        where: { id: pedido.id },
        data: { usedAt: new Date() },
      });
      return NextResponse.json(
        { error: "Muitas tentativas. Peça um novo código." },
        { status: 429 },
      );
    }

    const confere = await bcrypt.compare(data.code.trim(), pedido.codeHash);
    if (!confere) {
      await prisma.passwordReset.update({
        where: { id: pedido.id },
        data: { attempts: { increment: 1 } },
      });
      return NextResponse.json(
        { error: ERRO_GENERICO, tentativasRestantes: MAX_TENTATIVAS - (pedido.attempts + 1) },
        { status: 401 },
      );
    }

    const dono = await prisma.owner.findUnique({ where: { phone: telefone }, select: { id: true } });
    const barbeiro = dono
      ? null
      : await prisma.barber.findFirst({ where: { phone: telefone, active: true }, select: { id: true } });

    if (!dono && !barbeiro) return NextResponse.json({ error: ERRO_GENERICO }, { status: 401 });

    const passwordHash = await hashPassword(data.newPassword);

    // Senha nova e código queimado juntos — não existe estado pela metade
    await prisma.$transaction([
      dono
        ? prisma.owner.update({ where: { id: dono.id }, data: { passwordHash } })
        : prisma.barber.update({ where: { id: barbeiro!.id }, data: { passwordHash } }),
      prisma.passwordReset.update({ where: { id: pedido.id }, data: { usedAt: new Date() } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Dados inválidos" }, { status: 400 });
    }
    console.error("reset error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
