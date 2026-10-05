import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { num } from "@/app/lib/money";
import { aplicarPagamento } from "@/app/lib/assinatura";
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
      console.error("[InfinitePay] não foi possível conferir:", orderNsu);
      return NextResponse.json({ error: "conferencia indisponivel" }, { status: 400 });
    }

    if (!conferido.pago) {
      console.warn("[InfinitePay] webhook dizia pago, consulta diz que não:", orderNsu);
      return NextResponse.json({ ok: true, pago: false });
    }

    const esperado = num(fatura.valor);
    if (conferido.valorPago !== null && conferido.valorPago + 0.01 < esperado) {
      // Pagou menos do que a cobrança: não libera. Registra para você ver.
      console.error("[InfinitePay] valor pago menor que o cobrado:", orderNsu, conferido.valorPago, esperado);
      return NextResponse.json({ ok: true, valorInsuficiente: true });
    }

    // O efeito no banco mora em `aplicarPagamento` (lib/assinatura) para
    // poder ser testado: daqui so passa quem a InfinitePay confirmou, e
    // nenhum teste consegue chegar aqui sem dinheiro de verdade.
    const { plano, ate } = await aplicarPagamento(prisma, fatura, {
      metodo: conferido.metodo === "credit_card" ? "cartao" : conferido.metodo || "pix",
      transactionNsu: transactionNsu || null,
    });

    console.log("[InfinitePay] assinatura renovada:", fatura.subscriptionId, plano, "até", ate);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[InfinitePay] erro no webhook:", error);
    // 400 para a InfinitePay tentar de novo — um erro nosso não pode custar
    // a confirmação de um pagamento que já aconteceu
    return NextResponse.json({ error: "erro interno" }, { status: 400 });
  }
}
