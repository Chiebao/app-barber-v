import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

/**
 * Registro anônimo de uso do link público da barbearia.
 *
 * Serve para responder uma pergunta que hoje ninguém consegue responder:
 * "de cada 10 pessoas que abrem meu link, quantas realmente agendam?".
 *
 * Não guarda nada que identifique alguém — só um id de sessão aleatório
 * criado no navegador. Sem cookie, sem IP, sem nome. Por isso não muda nada
 * na Política de Privacidade.
 */
export async function POST(req: NextRequest) {
  try {
    const { shopId, type, sessionId } = await req.json();

    if (!shopId || !sessionId) return NextResponse.json({ ok: false }, { status: 400 });
    if (type !== "view" && type !== "book") return NextResponse.json({ ok: false }, { status: 400 });

    // Uma visita por sessão: recarregar a página não infla o número
    if (type === "view") {
      const jaContado = await prisma.shopEvent.findFirst({
        where: { shopId, type: "view", sessionId },
        select: { id: true },
      });
      if (jaContado) return NextResponse.json({ ok: true, duplicado: true });
    }

    await prisma.shopEvent.create({
      data: { shopId, type, sessionId: String(sessionId).slice(0, 64) },
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Medição nunca pode atrapalhar o agendamento — falha em silêncio
    return NextResponse.json({ ok: false });
  }
}
