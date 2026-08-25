import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { hashPassword } from "@/app/lib/auth";
import { verifyRecoveryCode } from "@/app/lib/recovery-code";
import { z } from "zod";

/**
 * Redefinição de senha SEM depender do suporte (self-service).
 *
 * O usuário informa telefone + código de recuperação + nova senha.
 * O código é de uso único: ao ser usado, é apagado — a pessoa gera outro
 * no painel depois de entrar.
 *
 * Mensagens de erro são propositalmente genéricas para não revelar quais
 * telefones existem nem se o código estava certo.
 */
const schema = z.object({
  phone: z.string().min(10),
  code: z.string().min(6),
  newPassword: z.string().min(6, "A senha precisa ter no mínimo 6 caracteres"),
});

const GENERIC_ERROR = "Telefone ou código de recuperação inválido.";

export async function POST(req: NextRequest) {
  try {
    const data = schema.parse(await req.json());
    const phone = data.phone.replace(/\D/g, "");

    // Procura primeiro como dono, depois como barbeiro
    const owner = await prisma.owner.findUnique({
      where: { phone },
      select: { id: true, recoveryCodeHash: true },
    });

    const barber = owner
      ? null
      : await prisma.barber.findFirst({
          where: { phone, active: true },
          select: { id: true, recoveryCodeHash: true },
        });

    const account = owner || barber;
    if (!account || !account.recoveryCodeHash) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const valid = await verifyRecoveryCode(data.code, account.recoveryCodeHash);
    if (!valid) return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });

    const passwordHash = await hashPassword(data.newPassword);

    // Troca a senha e queima o código (uso único)
    if (owner) {
      await prisma.owner.update({
        where: { id: owner.id },
        data: { passwordHash, recoveryCodeHash: null },
      });
    } else if (barber) {
      await prisma.barber.update({
        where: { id: barber.id },
        data: { passwordHash, recoveryCodeHash: null },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Dados inválidos" }, { status: 400 });
    }
    console.error("recover error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
