import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { num } from "@/app/lib/money";
import { PLANOS, type PlanoId, proximoVencimento } from "@/app/lib/assinatura";
import { conferirPagamento } from "@/app/lib/infinitepay";

/**
 * Confirmação de pagamento da assinatura, vinda da InfinitePay.
 *
 * O corpo recebido NÃO é a verdade. O webhook não vem assinado, então quem
 * descobrir esta URL poderia postar "fulano pagou" e ganhar um ano de graça.
 * O corpo só diz QUAL cobrança olhar — a confirmação vem de uma consulta de
 * volta à InfinitePay, e é ela que decide.
 *
 * Responder rápido também é regra da API deles: 200 quando entendemos, 400
 * quando queremos que tentem de novo.
 */
export async function POST(req: NextRequest) {
  try {
    const corpo = await req.json().catch(() => ({}));
    const orderNsu: string | undefined = corpo?.order_nsu;
    const transactionNsu: string | undefined = corpo?.transaction_nsu;
    const slug: string | undefined = corpo?.invoice_slug;

    if (!orderNsu) {
      // Sem identificação não há o que reprocessar — 200 evita retentativa infinita
      console.warn("[InfinitePay] webhook sem order_nsu");
      return NextResponse.json({ ok: true });
    }

    const fatura = await prisma.subscriptionInvoice.findUnique({
      where: { id: orderNsu },
      include: { subscription: true },
    });

    if (!fatura) {
      console.warn("[InfinitePay] webhook para fatura desconhecida:", orderNsu);
      return NextResponse.json({ ok: true });
    }

    // Já processada: responder 200 é o certo — reenvio do mesmo aviso não
    // pode empurrar o vencimento uma segunda vez.
    if (fatura.status === "paga") return NextResponse.json({ ok: true, jaProcessada: true });

    const conferido = await conferirPagamento({
      orderNsu,
      transactionNsu: transactionNsu || "",
      slug: slug || "",
    });

    if (!conferido) {
      // Não conseguimos confirmar agora — 400 pede retentativa
      console.error("[InfinitePay] nao foi possivel conferir:", orderNsu);
      return NextResponse.json({ error: "conferencia indisponivel" }, { status: 400 });
    }

    if (!conferido.pago) {
      console.warn("[InfinitePay] webhook dizia pago, consulta diz que nao:", orderNsu);
      return NextResponse.json({ ok: true, pago: false });
    }

    const esperado = num(fatura.valor);
    if (conferido.valorPago !== null && conferido.valorPago + 0.01 < esperado) {
      // Pagou menos do que a cobrança: não libera. Registra para você ver.
      console.error("[InfinitePay] valor pago menor que o cobrado:", orderNsu, conferido.valorPago, esperado);
      return NextResponse.json({ ok: true, valorInsuficiente: true });
    }

    const plano = (fatura.subscription.plano in PLANOS ? fatura.subscription.plano : "mensal") as PlanoId;
    const agora = new Date();

    // O novo período começa no fim do anterior quando ele ainda está em dia —
    // quem paga adiantado não perde os dias que já tinha. Quem paga atrasado
    // começa a contar de hoje.
    const base = fatura.subscription.periodoFim > agora ? fatura.subscription.periodoFim : agora;

    await prisma.$transaction([
      prisma.subscriptionInvoice.update({
        where: { id: fatura.id },
        data: {
          status: "paga",
          pagaEm: agora,
          metodo: conferido.metodo === "credit_card" ? "cartao" : conferido.metodo || "pix",
          mpPaymentId: transactionNsu || null,
        },
      }),
      prisma.subscription.update({
        where: { id: fatura.subscriptionId },
        data: {
          status: "ativa",
          periodoFim: proximoVencimento(base, plano),
          metodo: conferido.metodo === "credit_card" ? "cartao" : "pix",
          trialEndsAt: null,
          canceladaEm: null,
        },
      }),
    ]);

    console.log("[InfinitePay] assinatura renovada:", fatura.subscriptionId, "ate", proximoVencimento(base, plano));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[InfinitePay] erro no webhook:", error);
    // 400 para a InfinitePay tentar de novo — um erro nosso não pode custar
    // a confirmação de um pagamento que já aconteceu
    return NextResponse.json({ error: "erro interno" }, { status: 400 });
  }
}
