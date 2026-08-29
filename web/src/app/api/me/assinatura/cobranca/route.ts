import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { verifyToken } from "@/app/lib/auth";
import { num } from "@/app/lib/money";
import { PLANOS, type PlanoId, valorDoCiclo, situacaoDe } from "@/app/lib/assinatura";
import { criarLinkCobranca, cobrancaOk } from "@/app/lib/infinitepay";

/**
 * Gera (ou reaproveita) a cobrança do ciclo da assinatura.
 *
 * Reaproveitar importa: o dono que toca duas vezes em "gerar" não pode
 * acabar com duas faturas abertas do mesmo mês. Enquanto houver uma
 * pendente e ainda válida, devolvemos ela.
 */

/** Uma cobrança pendente vale por 3 dias antes de valer a pena gerar outra. */
const VALIDADE_DIAS = 3;

export async function POST(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") {
      return NextResponse.json({ error: "Só o dono paga a assinatura" }, { status: 401 });
    }

    const assinatura = await prisma.subscription.findUnique({
      where: { shopId: payload.shopId },
      include: { shop: { select: { name: true, phone: true, owner: { select: { name: true, phone: true } } } } },
    });
    if (!assinatura) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });

    const situacao = situacaoDe(assinatura);
    if (situacao.estado === "cortesia") {
      return NextResponse.json({ error: "Esta barbearia não tem cobrança." }, { status: 400 });
    }

    const plano = (assinatura.plano in PLANOS ? assinatura.plano : "mensal") as PlanoId;
    const valor = valorDoCiclo(plano);

    // Reaproveita a cobrança aberta — mas só se ela for do MESMO plano.
    // Quem trocou de plano depois de gerar precisa de uma cobrança nova, com
    // o valor certo; devolver a antiga cobraria um preço e entregaria outro.
    const limite = new Date(Date.now() - VALIDADE_DIAS * 86_400_000);
    const aberta = await prisma.subscriptionInvoice.findFirst({
      where: {
        subscriptionId: assinatura.id,
        status: "pendente",
        plano,
        createdAt: { gte: limite },
      },
      orderBy: { createdAt: "desc" },
    });
    if (aberta?.linkPagamento) {
      return NextResponse.json({
        cobranca: {
          id: aberta.id,
          valor: num(aberta.valor),
          link: aberta.linkPagamento,
          vencimento: aberta.vencimento,
          reaproveitada: true,
        },
      });
    }

    // A fatura nasce antes do link: o id dela é o order_nsu que a InfinitePay
    // devolve no webhook, e é por ele que reencontramos a assinatura.
    const fatura = await prisma.subscriptionInvoice.create({
      data: {
        subscriptionId: assinatura.id,
        valor,
        plano,
        status: "pendente",
        vencimento: assinatura.periodoFim > new Date() ? assinatura.periodoFim : new Date(),
        provedor: "infinitepay",
      },
    });

    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://barberpro-mauve.vercel.app").replace(/\/+$/, "");
    const link = await criarLinkCobranca({
      orderNsu: fatura.id,
      valor,
      descricao: `BarberPro ${PLANOS[plano].rotulo} — ${assinatura.shop.name}`,
      baseUrl,
      cliente: {
        nome: assinatura.shop.owner.name,
        telefone: assinatura.shop.owner.phone,
      },
    });

    if (!cobrancaOk(link)) {
      // Sem link a fatura não serve para nada e só polui o histórico
      await prisma.subscriptionInvoice.delete({ where: { id: fatura.id } }).catch(() => {});
      return NextResponse.json(
        { error: "Não foi possível gerar a cobrança agora. Tente novamente em instantes.", detalhe: link.erro },
        { status: 502 },
      );
    }

    const atualizada = await prisma.subscriptionInvoice.update({
      where: { id: fatura.id },
      data: { linkPagamento: link.url },
    });

    return NextResponse.json({
      cobranca: {
        id: atualizada.id,
        valor: num(atualizada.valor),
        link: link.url,
        vencimento: atualizada.vencimento,
        reaproveitada: false,
      },
    });
  } catch (error) {
    console.error("cobranca error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
