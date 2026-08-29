import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { num } from "@/app/lib/money";
import { PLANOS, type PlanoId, situacaoDe } from "@/app/lib/assinatura";

/**
 * Visão do dono da PLATAFORMA (não do dono da barbearia).
 *
 * Responde: quantas barbearias existem, quais estão vivas, quais pararam de
 * usar (churn) e quanto o produto está movimentando no total. Hoje essa visão
 * não existe em lugar nenhum — o Elias enxerga cada barbearia, mas não o
 * próprio negócio.
 *
 * Protegido pela mesma senha-mestra da página de reset.
 */
export async function POST(req: NextRequest) {
  try {
    const ADMIN_SECRET = process.env.ADMIN_SECRET;
    if (!ADMIN_SECRET) return NextResponse.json({ error: "Não configurado" }, { status: 500 });

    const { secret } = await req.json();
    if (secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Senha-mestra incorreta" }, { status: 401 });
    }

    const agora = new Date();
    const trintaDias = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const seteDias = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    const [shops, totalClientes, agsMes, agsSemana] = await Promise.all([
      prisma.shop.findMany({
        select: {
          id: true, name: true, slug: true, createdAt: true,
          _count: { select: { barbers: true, appointments: true } },
          subscription: {
            select: {
              status: true, plano: true, valorCiclo: true, trialEndsAt: true,
              periodoFim: true, canceladaEm: true, metodo: true,
              cobrancas: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { status: true, valor: true, vencimento: true, pagaEm: true, linkPagamento: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.client.count(),
      prisma.appointment.findMany({
        where: { date: { gte: inicioMes }, status: { not: "cancelled" } },
        select: { shopId: true, totalPrice: true, paidAt: true },
      }),
      prisma.appointment.findMany({
        where: { createdAt: { gte: seteDias } },
        select: { shopId: true },
      }),
    ]);

    // Último agendamento criado por barbearia — define "ativa" e "sumida"
    const ultimos = await prisma.appointment.groupBy({
      by: ["shopId"],
      _max: { createdAt: true },
    });
    const ultimoPorShop = new Map(ultimos.map((u) => [u.shopId, u._max.createdAt]));

    const ativasSemana = new Set(agsSemana.map((a) => a.shopId));
    const receitaPorShop = new Map<string, number>();
    for (const a of agsMes) {
      if (!a.paidAt) continue;
      receitaPorShop.set(a.shopId, (receitaPorShop.get(a.shopId) || 0) + num(a.totalPrice));
    }

    const barbearias = shops.map((s) => {
      const ultimo = ultimoPorShop.get(s.id) || null;
      const diasParado = ultimo
        ? Math.floor((agora.getTime() - new Date(ultimo).getTime()) / 86400000)
        : null;
      // O estado da assinatura é derivado das datas, igual no painel do dono —
      // não dá para confiar na coluna, que não sabe que o tempo passou.
      const assin = situacaoDe(s.subscription ?? null, agora);
      const ultimaCobranca = s.subscription?.cobrancas?.[0] ?? null;

      return {
        id: s.id,
        nome: s.name,
        slug: s.slug,
        criadaEm: s.createdAt,
        assinatura: {
          estado: assin.estado,
          plano: assin.plano,
          valorCiclo: assin.valorCiclo,
          diasRestantes: assin.diasRestantes,
          venceEm: assin.periodoFim,
          metodo: s.subscription?.metodo ?? null,
          ultimaCobranca: ultimaCobranca
            ? {
                status: ultimaCobranca.status,
                valor: num(ultimaCobranca.valor),
                vencimento: ultimaCobranca.vencimento,
                pagaEm: ultimaCobranca.pagaEm,
                link: ultimaCobranca.linkPagamento,
              }
            : null,
        },
        barbeiros: s._count.barbers,
        agendamentosTotal: s._count.appointments,
        receitaMes: Math.round((receitaPorShop.get(s.id) || 0) * 100) / 100,
        ultimoAgendamento: ultimo,
        diasParado,
        // Nunca agendou = ainda não ativou. Parado há 30+ dias = risco de churn.
        situacao: !ultimo ? "sem_uso" : diasParado !== null && diasParado > 30 ? "em_risco" : "ativa",
      };
    });

    // MRR: o que entra por mês, normalizado. Semestral e anual são cobrados
    // de uma vez, mas o que interessa para medir o negócio é a fatia mensal.
    const pagantes = barbearias.filter(
      (b) => b.assinatura.estado === "ativa" || b.assinatura.estado === "carencia",
    );
    const mrr = Math.round(
      pagantes.reduce((soma, b) => {
        const p = (b.assinatura.plano in PLANOS ? b.assinatura.plano : "mensal") as PlanoId;
        return soma + PLANOS[p].mensal;
      }, 0) * 100,
    ) / 100;

    const porEstado = barbearias.reduce((acc, b) => {
      acc[b.assinatura.estado] = (acc[b.assinatura.estado] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Cobranças pendentes: dinheiro gerado e ainda não recebido
    const aReceber = await prisma.subscriptionInvoice.aggregate({
      where: { status: "pendente" },
      _sum: { valor: true },
      _count: true,
    });

    const ativas = barbearias.filter((b) => b.situacao === "ativa").length;
    const emRisco = barbearias.filter((b) => b.situacao === "em_risco").length;
    const semUso = barbearias.filter((b) => b.situacao === "sem_uso").length;

    return NextResponse.json({
      resumo: {
        barbearias: shops.length,
        ativas,
        emRisco,
        semUso,
        ativasNaSemana: ativasSemana.size,
        clientesTotal: totalClientes,
        agendamentosMes: agsMes.length,
        receitaMes: Math.round(
          [...receitaPorShop.values()].reduce((s, v) => s + v, 0) * 100,
        ) / 100,
        novasEm30Dias: shops.filter((s) => s.createdAt >= trintaDias).length,
      },
      assinaturas: {
        mrr,
        pagantes: pagantes.length,
        porEstado,
        cobrancasPendentes: aReceber._count,
        valorPendente: aReceber._sum.valor ? num(aReceber._sum.valor) : 0,
      },
      barbearias,
    });
  } catch (error) {
    console.error("plataforma error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
