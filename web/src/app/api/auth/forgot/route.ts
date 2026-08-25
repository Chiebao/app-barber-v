import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";
import { enviarWhatsApp, whatsappConfigurado } from "@/app/lib/whatsapp-send";
import { z } from "zod";

/**
 * Passo 1 do "esqueci minha senha": envia um código por WhatsApp.
 *
 * A resposta é SEMPRE a mesma, exista ou não uma conta com aquele telefone.
 * Isso impede que alguém use essa rota para descobrir quais números estão
 * cadastrados na plataforma.
 */

const schema = z.object({ phone: z.string().min(10) });

/** Quanto tempo o código vale. Curto o bastante para não ficar circulando por aí. */
const VALIDADE_MINUTOS = 10;

function gerarCodigo(): string {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
}

export async function POST(req: NextRequest) {
  try {
    const { phone } = schema.parse(await req.json());
    const telefone = phone.replace(/\D/g, "");

    // Resposta neutra, usada em todos os caminhos
    const respostaPadrao = NextResponse.json({
      ok: true,
      canal: whatsappConfigurado() ? "whatsapp" : "indisponivel",
      mensagem: "Se houver uma conta com esse telefone, o código chegará no WhatsApp.",
    });

    const dono = await prisma.owner.findUnique({ where: { phone: telefone }, select: { id: true } });
    const barbeiro = dono
      ? null
      : await prisma.barber.findFirst({ where: { phone: telefone, active: true }, select: { id: true } });

    // Telefone não cadastrado: devolve igual, mas não manda nada
    if (!dono && !barbeiro) return respostaPadrao;
    if (!whatsappConfigurado()) return respostaPadrao;

    const codigo = gerarCodigo();
    const codeHash = await bcrypt.hash(codigo, 10);
    const expiresAt = new Date(Date.now() + VALIDADE_MINUTOS * 60 * 1000);

    // Pedir um código novo invalida os anteriores
    await prisma.passwordReset.updateMany({
      where: { phone: telefone, usedAt: null },
      data: { usedAt: new Date() },
    });

    await prisma.passwordReset.create({ data: { phone: telefone, codeHash, expiresAt } });

    await enviarWhatsApp(
      telefone,
      `*BarberPro* — recuperação de senha\n\n` +
        `Seu código é: *${codigo}*\n\n` +
        `Ele vale por ${VALIDADE_MINUTOS} minutos.\n` +
        `Se não foi você quem pediu, ignore esta mensagem — sua senha continua a mesma.`,
    );

    return respostaPadrao;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Telefone inválido" }, { status: 400 });
    }
    console.error("forgot error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
