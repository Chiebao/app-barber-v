import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { num } from "@/app/lib/money";
import { PLANOS, type PlanoId, valorDoCiclo, situacaoDe } from "@/app/lib/assinatura";
import { criarLinkCobranca, cobrancaOk } from "@/app/lib/infinitepay";

/**
 * Gera as cobranças que estão para vencer.
 *
 * Roda uma vez por dia. A ideia é que o dono ENCONTRE a cobrança pronta na
 * tela de assinatura em vez de precisar pedir — quanto menos passos entre
 * "quero pagar" e "paguei", menos gente esquece.
 *
 * Idempotente de propósito: rodar duas vezes no mesmo dia não gera duas
 * faturas, porque quem já tem cobrança aberta e recente é pulado.
 */

/** Quantos dias antes do vencimento a cobrança já fica disponível. */
const ANTECEDENCIA_DIAS = 5;

/** Uma cobrança aberta e recente é reaproveitada em vez de duplicada. */
const VALIDADE_DIAS = 3;

/** Teto por execução — evita uma rodada gigante travar a função. */
const MAX_POR_RODADA = 40;

export async function GET(req: NextRequest) {
  // Mesma proteção do cron de lembretes
  const segredo = (process.env.CRON_SECRET || "").trim();
  if (segredo) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${segredo}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  const agora = new Date();
  const limiteVencimento = new Date(agora.getTime() + ANTECEDENCIA_DIAS * 86_400_000);
  const limiteFatura = new Date(agora.getTime() - VALIDADE_DIAS * 86_400_000);
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://barberpro-mauve.vercel.app").replace(/\/+$/, "");

  const resultado = { verificadas: 0, geradas: 0, puladas: 0, falhas: 0, detalhes: [] as string[] };

  try {
    const candidatas = await prisma.subscription.findMany({
      where: {
        // Cortesia não paga nada; cancelada não deve ser cobrada de novo
        status: { notIn: ["cortesia"] },
        canceladaEm: null,
        periodoFim: { lte: limiteVencimento },
      },
      include: {
        shop: { select: { name: true, owner: { select: { name: true, phone: true } } } },
        cobrancas: {
          where: { status: "pendente", createdAt: { gte: limiteFatura } },
          select: { id: true },
        },
      },
      take: MAX_POR_RODADA,
    });

    resultado.verificadas = candidatas.length;

    for (const a of candidatas) {
      if (a.cobrancas.length > 0) {
        resultado.puladas++;
        continue;
      }

      // Confere pelo estado derivado: uma assinatura em trial que ainda tem
      // muitos dias não precisa de cobrança agora.
      const situacao = situacaoDe(a, agora);
      if (situacao.estado === "cortesia") { resultado.puladas++; continue; }

      const plano = (a.plano in PLANOS ? a.plano : "mensal") as PlanoId;
      const valor = valorDoCiclo(plano);

      const fatura = await prisma.subscriptionInvoice.create({
        data: {
          subscriptionId: a.id,
          valor,
          plano,
          status: "pendente",
          vencimento: a.periodoFim > agora ? a.periodoFim : agora,
          provedor: "infinitepay",
        },
      });

      const link = await criarLinkCobranca({
        orderNsu: fatura.id,
        valor,
        descricao: `BarberPro ${PLANOS[plano].rotulo} — ${a.shop.name}`,
        baseUrl,
        cliente: { nome: a.shop.owner.name, telefone: a.shop.owner.phone },
      });

      if (!cobrancaOk(link)) {
        // Fatura sem link não serve para nada — some, e tentamos amanhã
        await prisma.subscriptionInvoice.delete({ where: { id: fatura.id } }).catch(() => {});
        resultado.falhas++;
        resultado.detalhes.push(`${a.shop.name}: ${link.erro}`);
        continue;
      }

      await prisma.subscriptionInvoice.update({
        where: { id: fatura.id },
        data: { linkPagamento: link.url },
      });

      resultado.geradas++;
      resultado.detalhes.push(`${a.shop.name}: R$ ${num(fatura.valor).toFixed(2)} (${situacao.estado})`);
    }

    // TODO(chip): quando o número definitivo do WhatsApp estiver ativo, avisar
    // o dono aqui. Hoje ele encontra a cobrança pronta ao abrir o painel.

    return NextResponse.json(resultado);
  } catch (error) {
    console.error("[cron cobrancas] erro:", error);
    return NextResponse.json({ ...resultado, erro: "Erro interno" }, { status: 500 });
  }
}
