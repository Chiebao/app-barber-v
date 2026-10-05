import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { num } from "@/app/lib/money";
import { PLANOS, type PlanoId, valorDoCiclo, situacaoDe } from "@/app/lib/assinatura";
import { criarLinkCobranca, cobrancaOk } from "@/app/lib/infinitepay";

/**
 * Pagina de pagamento da assinatura, sem login.
 *
 * O link chega pelo WhatsApp e leva direto ao pagamento. Pedir senha no meio
 * do caminho seria o ponto exato onde o dono desiste — e quem esqueceu a
 * senha nunca pagaria.
 *
 * O id da fatura e a chave: um cuid, impossivel de adivinhar, que so o dono
 * recebeu. O que ele destrava e pouco e inofensivo — ver o nome da loja e
 * PAGAR. Pagar pelos outros nao prejudica ninguem, e escolher plano aqui so
 * muda o que vai ser cobrado: a assinatura so muda quando o dinheiro cai
 * (webhook da InfinitePay).
 */

/** Cobranca aberta e recente e reaproveitada — o link da InfinitePay vale uns dias. */
const VALIDADE_LINK_MS = 3 * 86_400_000;

/** Antecedencia em que ja faz sentido pagar o proximo ciclo. Igual ao cron. */
const ANTECEDENCIA_MS = 5 * 86_400_000;

async function carregar(faturaId: string) {
  return prisma.subscriptionInvoice.findUnique({
    where: { id: faturaId },
    include: {
      subscription: {
        include: { shop: { select: { name: true, owner: { select: { name: true, phone: true } } } } },
      },
    },
  });
}

function catalogo() {
  return (Object.keys(PLANOS) as PlanoId[]).map((id) => ({
    id,
    rotulo: PLANOS[id].rotulo,
    mensal: PLANOS[id].mensal,
    meses: PLANOS[id].mesesCobranca,
    total: valorDoCiclo(id),
  }));
}

/** Nada a pagar agora: cortesia, ou em dia e longe do vencimento. */
function emDia(sub: Parameters<typeof situacaoDe>[0], agora: Date) {
  const s = situacaoDe(sub, agora);
  if (s.estado === "cortesia") return true;
  return s.estado === "ativa" && sub!.periodoFim.getTime() - agora.getTime() > ANTECEDENCIA_MS;
}

export async function GET(_req: NextRequest, { params }: { params: { faturaId: string } }) {
  const fatura = await carregar(params.faturaId);
  if (!fatura) return NextResponse.json({ error: "Link de pagamento não encontrado." }, { status: 404 });

  const sub = fatura.subscription;
  const agora = new Date();
  return NextResponse.json({
    loja: sub.shop.name,
    dono: sub.shop.owner.name.trim().split(/\s+/)[0],
    // Mesmo criterio do cron: `trialEndsAt` so e limpo no primeiro pagamento.
    saiuDoTeste: !!sub.trialEndsAt && sub.trialEndsAt <= agora,
    emDia: emDia(sub, agora),
    planoAtual: fatura.plano in PLANOS ? fatura.plano : "mensal",
    planos: catalogo(),
  });
}

export async function POST(req: NextRequest, { params }: { params: { faturaId: string } }) {
  try {
    const { plano } = await req.json().catch(() => ({ plano: null }));
    if (typeof plano !== "string" || !(plano in PLANOS)) {
      return NextResponse.json({ error: "Escolha um dos planos." }, { status: 400 });
    }
    const escolhido = plano as PlanoId;

    const fatura = await carregar(params.faturaId);
    if (!fatura) return NextResponse.json({ error: "Link de pagamento não encontrado." }, { status: 404 });

    const sub = fatura.subscription;
    const agora = new Date();
    if (emDia(sub, agora)) {
      return NextResponse.json({ error: "Sua assinatura já está em dia." }, { status: 409 });
    }

    const valor = valorDoCiclo(escolhido);

    // Mesmo plano, link recente: reaproveita. Sem isto, cada toque no botao
    // gerava uma cobranca nova na InfinitePay e uma fatura a mais no painel.
    const aberta = await prisma.subscriptionInvoice.findFirst({
      where: {
        subscriptionId: sub.id,
        status: "pendente",
        plano: escolhido,
        linkPagamento: { not: null },
        createdAt: { gte: new Date(agora.getTime() - VALIDADE_LINK_MS) },
      },
      orderBy: { createdAt: "desc" },
    });
    // O preco pode ter mudado desde que a fatura foi gerada — e a fatura e um
    // contrato pelo valor dela. So reaproveita se ainda bate com o catalogo.
    if (aberta && Math.abs(num(aberta.valor) - valor) < 0.01) {
      return NextResponse.json({ url: aberta.linkPagamento });
    }

    const nova = await prisma.subscriptionInvoice.create({
      data: {
        subscriptionId: sub.id,
        valor,
        plano: escolhido,
        status: "pendente",
        vencimento: sub.periodoFim > agora ? sub.periodoFim : agora,
        provedor: "infinitepay",
      },
    });

    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://barberpro-mauve.vercel.app").replace(/\/+$/, "");
    const link = await criarLinkCobranca({
      orderNsu: nova.id,
      valor,
      descricao: `BarberPro ${PLANOS[escolhido].rotulo} — ${sub.shop.name}`,
      baseUrl,
      cliente: { nome: sub.shop.owner.name, telefone: sub.shop.owner.phone },
    });

    if (!cobrancaOk(link)) {
      // Fatura sem link nao serve para nada.
      await prisma.subscriptionInvoice.delete({ where: { id: nova.id } }).catch(() => {});
      console.error("[pagar] InfinitePay recusou:", link.erro);
      return NextResponse.json(
        { error: "Não consegui gerar o pagamento agora. Tente de novo em alguns minutos." },
        { status: 502 },
      );
    }

    await prisma.subscriptionInvoice.update({ where: { id: nova.id }, data: { linkPagamento: link.url } });
    return NextResponse.json({ url: link.url });
  } catch (error) {
    console.error("[pagar] erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
