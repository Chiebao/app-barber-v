import { NextRequest, NextResponse } from "next/server";
import { perdoarFaltasDaPessoa } from "@/app/lib/faltas";
import { prisma } from "@/app/lib/prisma";
import { consultarPagamento, tokenDaBarbearia } from "@/app/lib/mercadopago";
import { sendWebPush, notifyTargets } from "@/app/lib/webpush";
import { enviarWhatsApp } from "@/app/lib/whatsapp-send";

/**
 * Aviso de pagamento do Mercado Pago.
 *
 * É aqui que o anti-falta deixa de depender do barbeiro: assim que o Pix cai,
 * o MP avisa e o agendamento se confirma sozinho, em segundos.
 *
 * Nunca confiamos no corpo da notificação — ela só diz "olhe o pagamento X".
 * Consultamos o status na API com o token da própria barbearia antes de
 * confirmar qualquer coisa.
 */
export async function POST(req: NextRequest) {
  try {
    const corpo = await req.json().catch(() => ({}));

    // O MP manda o id em formatos diferentes conforme o tipo de evento
    const paymentId =
      corpo?.data?.id ??
      corpo?.id ??
      new URL(req.url).searchParams.get("data.id") ??
      null;

    const tipo = corpo?.type ?? corpo?.topic ?? "";
    if (!paymentId || (tipo && !String(tipo).includes("payment"))) {
      return NextResponse.json({ ok: true, ignorado: true });
    }

    const agendamento = await prisma.appointment.findFirst({
      where: { mpPaymentId: String(paymentId) },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        shop: { select: { id: true, name: true } },
        services: { include: { service: { select: { name: true } } } },
      },
    });

    // Pagamento que não conhecemos (ou já processado e removido) — responde 200
    // mesmo assim, senão o MP fica reenviando para sempre
    if (!agendamento) return NextResponse.json({ ok: true, desconhecido: true });
    if (agendamento.status !== "pending_payment") {
      return NextResponse.json({ ok: true, jaTratado: true });
    }

    const token = await tokenDaBarbearia(agendamento.shopId);
    if (!token) return NextResponse.json({ ok: true, semToken: true });

    const pagamento = await consultarPagamento(token, String(paymentId));
    if (!pagamento) return NextResponse.json({ ok: true, naoConsultado: true });

    // Só "approved" confirma. Pendente/recusado não mexe em nada.
    if (pagamento.status !== "approved") {
      return NextResponse.json({ ok: true, status: pagamento.status });
    }

    // Pagou: confirma o agendamento e zera o histórico de faltas do cliente
    await prisma.$transaction([
      prisma.appointment.update({
        where: { id: agendamento.id },
        data: { status: "confirmed", pendingExpiresAt: null },
      }),
    ]);

    // Perdao por PESSOA, igual a confirmacao manual: quem dividia o
    // telefone nao entra de carona no Pix do outro.
    await perdoarFaltasDaPessoa(
      prisma,
      agendamento.clientId,
      agendamento.clientName ?? agendamento.client.name,
    );

    const servicos = agendamento.services.map((s) => s.service.name).join(", ");

    // Avisa o barbeiro que o dinheiro caiu — ele não precisa conferir nada
    notifyTargets(agendamento.shopId, agendamento.barberId)
      .then((ids) =>
        sendWebPush(ids, {
          title: "Pix recebido ✅",
          body: `${agendamento.client.name} pagou e o horário das ${agendamento.startTime} está confirmado.`,
          url: "/admin/painel",
          tag: "pix-recebido",
        }),
      )
      .catch(console.error);

    // E tranquiliza o cliente
    enviarWhatsApp(
      agendamento.client.phone,
      `*Pagamento confirmado!* ✅\n\n` +
        `Seu horário na *${agendamento.shop.name}* está garantido:\n\n` +
        `📆 ${agendamento.startTime}\n` +
        `💇‍♂️ ${servicos}\n\n` +
        `Até lá! Deus abençoe 🙏`,
    ).catch(console.error);

    return NextResponse.json({ ok: true, confirmado: true });
  } catch (error) {
    console.error("webhook MP error:", error);
    // Responde 200 para o MP não ficar reenviando indefinidamente
    return NextResponse.json({ ok: true, erro: true });
  }
}

/** O Mercado Pago valida a URL com um GET antes de enviar avisos. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
