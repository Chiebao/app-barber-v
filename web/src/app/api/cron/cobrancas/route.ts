import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { num } from "@/app/lib/money";
import { PLANOS, type PlanoId, valorDoCiclo, situacaoDe, REGUA_COBRANCA, primeiroNome } from "@/app/lib/assinatura";
import { criarLinkCobranca, cobrancaOk } from "@/app/lib/infinitepay";
import { enviarModelo } from "@/app/lib/whatsapp-send";
import { sendWebPush } from "@/app/lib/webpush";

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
const ANTECEDENCIA_DIAS = REGUA_COBRANCA.antecedenciaDias;

/** Uma cobrança aberta e recente é reaproveitada em vez de duplicada. */
const VALIDADE_DIAS = REGUA_COBRANCA.validadeDias;

/** Teto por execução — evita uma rodada gigante travar a função. */
const MAX_POR_RODADA = 40;

/**
 * Quantos avisos de WhatsApp uma mesma dívida gera, no máximo.
 *
 * A cobrança é regerada a cada VALIDADE_DIAS porque o link de pagamento
 * expira — isso é sobre o link, não sobre insistir. Sem este teto, quem
 * parou de pagar receberia mensagem paga a cada 3 dias para sempre.
 */
const MAX_AVISOS = 2;

/**
 * Quantas faturas em aberto uma assinatura acumula antes de pararmos.
 *
 * Passado disso, quem não pagou não vai pagar por link novo: os antigos
 * continuam no painel, e a loja já está em leitura apenas.
 */
const MAX_FATURAS_ABERTAS = REGUA_COBRANCA.maxFaturasAbertas;

/**
 * Prazo em português, para a mensagem do dono.
 *
 * Arredonda para cima porque "vence em 0 dias" não diz nada a ninguém —
 * o que falta hoje ainda é hoje.
 */
/** "06/10", no dia da barbearia — nao no do servidor, que ja virou as 21h. */
function diaCurto(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

function prazoEmTexto(vencimento: Date, agora: Date): string {
  const dias = Math.ceil((vencimento.getTime() - agora.getTime()) / 86_400_000);
  // O modelo aprovado diz "Sua assinatura vence em {{2}}" — e "vence em
  // hoje" nao e portugues. A data serve para os dois casos.
  if (dias <= 0) return diaCurto(vencimento);
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

/**
 * Avisa o dono de que ha cobranca — WhatsApp e, se ele tiver, push.
 *
 * O link nos dois leva a /pagar/{fatura}, onde ele escolhe o plano e paga
 * sem precisar entrar no painel. Antes a mensagem dizia "Painel, em
 * Configuracoes": tres passos entre o aviso e o pagamento, e cada passo e
 * onde alguem desiste.
 *
 * Devolve o modelo de WhatsApp que saiu, ou "falhou" — vai gravado na fatura
 * para o painel da plataforma mostrar se o dono chegou a ser avisado.
 */
async function avisarDono(
  a: { shopId: string; trialEndsAt: Date | null; shop: { name: string; owner: { name: string; phone: string } } },
  faturaId: string,
  vencimento: Date,
  valor: number,
  agora: Date,
): Promise<string> {
  const primeiro = primeiroNome(a.shop.owner.name);

  // Saiu do teste e nunca pagou: a conversa e "escolha um plano", nao "sua
  // assinatura vence". `trialEndsAt` so e limpo pelo webhook no primeiro
  // pagamento, entao preenchido e no passado quer dizer: nunca assinou.
  const saiuDoTeste = !!a.trialEndsAt && a.trialEndsAt <= agora;

  let enviado = false;
  let modelo = "falhou";
  if (saiuDoTeste) {
    enviado = await enviarModelo(
      a.shop.owner.phone, "fim_do_teste",
      [primeiro, a.shop.name, brl(valor), diaCurto(vencimento)],
      faturaId,
    );
    if (enviado) modelo = "fim_do_teste";
  }
  // Renovacao comum, ou o modelo novo ainda em revisao na Meta: cai no de
  // cobranca, que ja e aprovado. Mensagem generica e melhor que nenhuma.
  if (!enviado) {
    const foi = await enviarModelo(
      a.shop.owner.phone, "cobranca_assinatura",
      [primeiro, prazoEmTexto(vencimento, agora), brl(valor)],
      faturaId,
    );
    if (foi) modelo = "cobranca_assinatura";
  }

  // Push vai junto e de graca: chega mesmo se o WhatsApp falhar. So para o
  // DONO — cobranca da plataforma nao e assunto do barbeiro contratado.
  const dono = await prisma.barber.findFirst({
    where: { shopId: a.shopId, isOwnerProfile: true },
    select: { id: true },
  });
  if (dono) {
    await sendWebPush([dono.id], {
      title: saiuDoTeste ? "Seu teste grátis terminou" : "Sua assinatura vence em breve",
      body: saiuDoTeste
        ? "Escolha um plano para continuar recebendo agendamentos."
        : `Fatura de ${brl(valor)} pronta. Toque para pagar.`,
      url: `/pagar/${faturaId}`,
      tag: "assinatura",
    });
  }
  return modelo;
}

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
        // Todas as em aberto, não só as recentes: a data separa "o link
        // ainda serve" de "já avisamos vezes demais".
        cobrancas: {
          where: { status: "pendente" },
          select: { id: true, createdAt: true },
        },
      },
      take: MAX_POR_RODADA,
    });

    resultado.verificadas = candidatas.length;

    for (const a of candidatas) {
      // Link recente ainda serve — não há o que gerar.
      if (a.cobrancas.some((c) => c.createdAt >= limiteFatura)) {
        resultado.puladas++;
        continue;
      }
      if (a.cobrancas.length >= MAX_FATURAS_ABERTAS) {
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
          origem: "cron",
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

      // Avisa o dono que a cobrança está pronta. Sem isso ele só descobre
      // ao abrir o painel — e quem esquece de abrir é justamente quem
      // acaba bloqueado por não ter pago.
      //
      // Mas só nas primeiras vezes, e nunca depois de bloqueada: a essa
      // altura ele já foi avisado e já perdeu o acesso de escrita. Insistir
      // custa dinheiro nosso e irrita quem já decidiu sair.
      const avisosJaDados = a.cobrancas.length;
      const deveAvisar = avisosJaDados < MAX_AVISOS && situacao.estado !== "bloqueada";
      if (deveAvisar) {
        const aviso = await avisarDono(a, fatura.id, fatura.vencimento, num(fatura.valor), agora)
          .catch((err) => { console.error("[cron cobrancas] aviso falhou:", err); return "falhou"; });
        await prisma.subscriptionInvoice.update({
          where: { id: fatura.id },
          data: { avisadaEm: agora, avisoWhatsapp: aviso },
        }).catch((err) => console.error("[cron cobrancas] rastro do aviso:", err));
      }
    }


    return NextResponse.json(resultado);
  } catch (error) {
    console.error("[cron cobrancas] erro:", error);
    return NextResponse.json({ ...resultado, erro: "Erro interno" }, { status: 500 });
  }
}
