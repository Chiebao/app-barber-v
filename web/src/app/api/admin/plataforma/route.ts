import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { num } from "@/app/lib/money";
import { PLANOS, type PlanoId, situacaoDe, primeiroNome, DIAS_CARENCIA } from "@/app/lib/assinatura";
import { rodadaAtual, etapasDa, proximaFaturaAutomatica } from "@/app/lib/processo-cobranca";
import { agoraNaBarbearia } from "@/app/lib/time-slots";

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
          owner: { select: { name: true, phone: true } },
          _count: { select: { barbers: true, appointments: true } },
          subscription: {
            select: {
              status: true, plano: true, valorCiclo: true, trialEndsAt: true,
              periodoFim: true, canceladaEm: true, metodo: true,
              // Uma rodada de cobranca raramente passa de 4 faturas (o cron
              // para em 4 abertas); 8 cobre a rodada e a paga anterior.
              cobrancas: {
                orderBy: { createdAt: "desc" },
                take: 8,
                select: {
                  id: true, createdAt: true, status: true, plano: true, valor: true, vencimento: true,
                  pagaEm: true, metodo: true, linkPagamento: true,
                  origem: true, avisadaEm: true, avisoWhatsapp: true, abertaEm: true,
                },
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

    // ─── Uso do produto ───
    //
    // A pergunta que isto responde nao e "quantas barbearias temos", e
    // "elas USAM?". Barbearia cadastrada que nao lanca comanda, nao bloqueia
    // horario e nao recebe agendamento pelo link e caderno digital, nao
    // produto. Estes numeros sao o que da para mostrar numa conversa.
    const hojeISO = agoraNaBarbearia(agora).dia;
    const inicioHoje = new Date(hojeISO + "T00:00:00.000Z");
    const fimHoje = new Date(hojeISO + "T23:59:59.999Z");

    const [
      agsHoje, agsSete, agsTrinta, agsTotal,
      noShows, cancelados, comandas, despesas, esperas, fixos,
      lembretes, avaliacoes, pagosTotal, porMes,
    ] = await Promise.all([
      prisma.appointment.count({ where: { date: { gte: inicioHoje, lte: fimHoje }, status: { not: "cancelled" } } }),
      prisma.appointment.count({ where: { createdAt: { gte: seteDias } } }),
      prisma.appointment.count({ where: { createdAt: { gte: trintaDias } } }),
      prisma.appointment.count(),
      prisma.appointment.count({ where: { status: "no_show" } }),
      prisma.appointment.count({ where: { status: "cancelled" } }),
      prisma.comandaItem.count(),
      prisma.expense.count(),
      prisma.waitlist.count(),
      prisma.recurringAppointment.count({ where: { active: true } }),
      prisma.appointment.count({ where: { reminderSentAt: { not: null } } }),
      prisma.rating.aggregate({ _count: true, _avg: { score: true } }),
      prisma.appointment.aggregate({ where: { paidAt: { not: null } }, _sum: { totalPrice: true }, _count: true }),
      // Serie mensal: e o grafico que responde "esta crescendo?". Em SQL
      // porque agrupar por mes em JS exigiria trazer tudo para a memoria.
      prisma.$queryRawUnsafe<Array<{ mes: string; n: bigint }>>(
        `SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS mes, count(*) AS n
           FROM appointments
          WHERE "createdAt" >= now() - interval '6 months'
          GROUP BY 1 ORDER BY 1`,
      ),
    ]);

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

      // Em que passo da cobranca o dono parou — o "acompanhar o processo".
      const faturas = (s.subscription?.cobrancas ?? []).map((c) => ({ ...c, valor: num(c.valor) }));
      const rodada = rodadaAtual(faturas);
      const pendentes = faturas.filter((f) => f.status === "pendente");
      const processo = s.subscription
        ? {
            etapas: etapasDa(rodada),
            rodada: rodada.map((f) => ({
              id: f.id, criadaEm: f.createdAt, status: f.status, plano: f.plano, valor: f.valor,
              pagaEm: f.pagaEm, metodo: f.metodo, origem: f.origem,
              avisoWhatsapp: f.avisoWhatsapp, abertaEm: f.abertaEm,
            })),
            // A mais nova em aberto: e o link que vai na mensagem de quem
            // for chamar o dono na mao.
            faturaAberta: [...pendentes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.id ?? null,
            proximaFatura: proximaFaturaAutomatica(s.subscription, pendentes, agora),
            trialEndsAt: s.subscription.trialEndsAt,
            bloqueiaEm: new Date(s.subscription.periodoFim.getTime() + DIAS_CARENCIA * 86_400_000),
          }
        : null;

      return {
        id: s.id,
        nome: s.name,
        slug: s.slug,
        criadaEm: s.createdAt,
        dono: { nome: primeiroNome(s.owner.name), telefone: s.owner.phone },
        processo,
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

    // Quem falou com o robô comercial. Sem esta lista, a conversa some: a linha
    // da Cloud API não tem caixa de entrada para consultar depois.
    const [interessados, totalInteressados, pediramParar] = await Promise.all([
      prisma.conversaComercial.findMany({ orderBy: { ultimaMensagemEm: "desc" }, take: 50 }),
      prisma.conversaComercial.count(),
      prisma.pedidoParar.count(),
    ]);

    return NextResponse.json({
      interessados: {
        total: totalInteressados,
        pediramParar,
        lista: interessados.map((i) => ({
          telefone: i.telefone,
          nome: i.nome,
          etapa: i.etapa,
          origem: i.origem,
          papel: i.papel,
          barbeiros: i.barbeiros,
          agenda: i.agenda,
          perguntasNaoEntendidas: i.perguntasNaoEntendidas,
          souCliente: !!i.souClienteEm,
          ultimaMensagemEm: i.ultimaMensagemEm,
        })),
      },
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
      uso: {
        agendamentos: { hoje: agsHoje, sete: agsSete, trinta: agsTrinta, total: agsTotal },
        porMes: porMes.map((m) => ({ mes: m.mes, n: Number(m.n) })),
        // Percentuais sobre o TOTAL: sao as taxas que o barbeiro sente.
        noShows, cancelados,
        taxaNoShow: agsTotal ? Math.round((noShows / agsTotal) * 1000) / 10 : 0,
        taxaCancelamento: agsTotal ? Math.round((cancelados / agsTotal) * 1000) / 10 : 0,
        // Cada um destes e uma funcao que so aparece se alguem usou de
        // verdade — e o que separa produto de agenda bonita.
        comandas, despesas, esperas, fixos, lembretes,
        avaliacoes: avaliacoes._count,
        notaMedia: avaliacoes._avg.score ? Math.round(avaliacoes._avg.score * 10) / 10 : null,
        atendimentosPagos: pagosTotal._count,
        volumeFinanceiro: pagosTotal._sum.totalPrice ? num(pagosTotal._sum.totalPrice) : 0,
      },
      barbearias,
    });
  } catch (error) {
    console.error("plataforma error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
