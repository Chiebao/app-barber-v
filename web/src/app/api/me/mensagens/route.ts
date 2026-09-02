import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { exigirEscrita } from "@/app/lib/exigir-assinatura";
import { enviarWhatsApp } from "@/app/lib/whatsapp-send";

/**
 * Caixa de entrada do WhatsApp.
 *
 * O barbeiro responde daqui enquanto a janela de 24h estiver aberta. Depois
 * dela a Meta só entrega modelo aprovado, e um modelo não serve para
 * conversa — por isso a tela mostra o prazo em vez de deixar ele escrever e
 * descobrir no envio que não saiu.
 */

/** Quanto tempo a Meta dá para responder em texto livre. */
const JANELA_HORAS = 24;

export async function GET(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const mensagens = await prisma.inboundMessage.findMany({
      where: { shopId: payload.shopId },
      orderBy: { recebidaEm: "desc" },
      take: 100,
    });

    const agora = Date.now();
    return NextResponse.json({
      naoLidas: mensagens.filter((m) => !m.lida).length,
      mensagens: mensagens.map((m) => {
        const horas = (agora - m.recebidaEm.getTime()) / 3_600_000;
        return {
          id: m.id,
          telefone: m.clientPhone,
          nome: m.clientName,
          texto: m.texto,
          tipo: m.tipo,
          recebidaEm: m.recebidaEm.toISOString(),
          lida: m.lida,
          respondida: !!m.respondidaEm,
          // Passada a janela, responder por aqui não entrega — o botão vira
          // "abrir no WhatsApp", que sempre funciona.
          podeResponder: horas < JANELA_HORAS,
          horasRestantes: Math.max(0, Math.floor(JANELA_HORAS - horas)),
        };
      }),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

const respostaSchema = z.object({
  id: z.string(),
  texto: z.string().trim().min(1, "Escreva a resposta").max(1000),
});

export async function POST(req: NextRequest) {
  try {
    const guarda = await exigirEscrita(req);
    if (!guarda.ok) return guarda.resposta;
    const payload = guarda.payload;

    const dados = respostaSchema.parse(await req.json());

    // Escopado pela loja do token: sem isto, o id de outra barbearia daria a
    // quem adivinhasse o poder de mandar WhatsApp em nome dela.
    const msg = await prisma.inboundMessage.findFirst({
      where: { id: dados.id, shopId: payload.shopId },
    });
    if (!msg) return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 });

    const horas = (Date.now() - msg.recebidaEm.getTime()) / 3_600_000;
    if (horas >= JANELA_HORAS) {
      return NextResponse.json(
        { error: "Passaram 24h desde a mensagem do cliente. Fale com ele pelo seu WhatsApp." },
        { status: 409 },
      );
    }

    const enviado = await enviarWhatsApp(msg.clientPhone, dados.texto);
    if (!enviado) {
      return NextResponse.json({ error: "Não consegui enviar agora" }, { status: 502 });
    }

    await prisma.inboundMessage.update({
      where: { id: msg.id },
      data: { respondidaEm: new Date(), lida: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.errors[0]?.message || "Dados inválidos" }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/** Marcar como lida — some o contador sem obrigar a responder. */
export async function PATCH(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { id, todas } = await req.json();
    if (todas) {
      await prisma.inboundMessage.updateMany({
        where: { shopId: payload.shopId, lida: false },
        data: { lida: true },
      });
      return NextResponse.json({ ok: true });
    }

    if (!id) return NextResponse.json({ error: "Informe a mensagem" }, { status: 400 });
    const r = await prisma.inboundMessage.updateMany({
      where: { id, shopId: payload.shopId },
      data: { lida: true },
    });
    if (r.count === 0) return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
