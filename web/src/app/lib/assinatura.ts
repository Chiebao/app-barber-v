import { prisma } from "@/app/lib/prisma";
import { num } from "@/app/lib/money";

/**
 * Regras da assinatura do BarberPro.
 *
 * O status guardado no banco é só a intenção ("é cortesia?", "cancelou?").
 * O estado REAL é sempre derivado das datas, aqui. Assim uma assinatura não
 * fica presa em "ativa" porque nenhum cron rodou naquele dia — o acesso é
 * decidido no momento em que alguém pede, não no momento em que um job passou.
 */

/**
 * Planos.
 *
 * Dois números diferentes governam um plano, e confundir os dois é o que
 * gerava o mal-entendido:
 *
 *   mesesCobranca  — quanto tempo CADA cobrança compra. É por ele que o
 *                    vencimento avança e é ele que define o valor do link.
 *   compromisso    — o tamanho do plano. Serve para explicar e para dar
 *                    desconto; não afeta a cobrança.
 *
 * Hoje os dois andam juntos: cada plano e cobrado pelo ciclo inteiro, entao
 * `mesesCobranca === compromisso`. A escada e so o tamanho do compromisso,
 * e o desconto mora nele.
 *
 * Antes existiam variantes "pago todo mes" (compromisso 12, cobranca 1), com
 * preco um pouco maior e cobranca da diferenca para quem saisse antes. Foram
 * retiradas em out/2026 ao baixar os precos: seis degraus vendiam pior que
 * quatro, e a faixa antiga (79,90 a 49,90) estava afastando.
 *
 * `descontoAAcertar` continua no codigo e devolve 0 para todos estes planos.
 * Fica como guarda: se um dia voltar um plano com `mesesCobranca: 1` e
 * `compromisso > 1`, a regra volta a valer sozinha.
 */
export const PLANOS = {
  mensal: {
    mensal: 45.9, mesesCobranca: 1, compromisso: 1,
    rotulo: "Mensal", comoPaga: "todo mês",
  },
  trimestral: {
    mensal: 39.9, mesesCobranca: 3, compromisso: 3,
    rotulo: "Trimestral", comoPaga: "a cada 3 meses",
  },
  semestral: {
    mensal: 34.9, mesesCobranca: 6, compromisso: 6,
    rotulo: "Semestral", comoPaga: "a cada 6 meses",
  },
  anual: {
    mensal: 29.9, mesesCobranca: 12, compromisso: 12,
    rotulo: "Anual", comoPaga: "à vista",
  },
} as const;

export type PlanoId = keyof typeof PLANOS;

/** Dias de teste grátis, sem pedir pagamento na entrada. */
export const DIAS_TRIAL = 14;

/**
 * Dias de acesso total DEPOIS do vencimento.
 *
 * Existe porque a alternativa é cruel: um Pix que caiu no fim de semana, um
 * barbeiro que viajou, e a agenda da barbearia fecha na segunda de manhã com
 * cliente marcado. A carência custa uma semana e evita esse desastre.
 */
export const DIAS_CARENCIA = 7;

export type EstadoAssinatura =
  | "trial"
  | "ativa"
  | "carencia"
  | "bloqueada"
  | "cortesia"
  | "cancelada";

export interface SituacaoAssinatura {
  estado: EstadoAssinatura;
  /** Pode criar, editar, apagar? Falso = painel só leitura. */
  podeEscrever: boolean;
  /** A página pública aceita agendamento novo? */
  aceitaAgendamento: boolean;
  /** Dias até a próxima virada (fim do trial, vencimento ou fim da carência). */
  diasRestantes: number;
  /** Quando o acesso pago termina. */
  periodoFim: Date;
  plano: PlanoId;
  valorCiclo: number;
  /** Texto curto para o painel — a mesma frase em todo lugar. */
  aviso: string | null;
  /** Desconto adiantado que ficou em aberto ao sair antes do prazo. */
  descontoAAcertar: number;
  /** Quantos meses do compromisso já foram pagos. */
  ciclosPagos: number;
  /** Tamanho do compromisso do plano atual. */
  compromisso: number;
}

function diasEntre(de: Date, ate: Date): number {
  return Math.ceil((ate.getTime() - de.getTime()) / 86_400_000);
}

/** Quanto sai em CADA cobrança — não o total do compromisso. */
export function valorDoCiclo(plano: PlanoId): number {
  const p = PLANOS[plano];
  return Math.round(p.mensal * p.mesesCobranca * 100) / 100;
}

/** Soma à data o tempo que a cobrança comprou, respeitando fim de mês. */
export function proximoVencimento(de: Date, plano: PlanoId): Date {
  const d = new Date(de);
  const diaOriginal = d.getDate();
  d.setMonth(d.getMonth() + PLANOS[plano].mesesCobranca);
  // 31 de janeiro + 1 mês vira 3 de março se não corrigir
  if (d.getDate() !== diaOriginal) d.setDate(0);
  return d;
}

interface AssinaturaBruta {
  status: string;
  plano: string;
  valorCiclo: unknown;
  trialEndsAt: Date | null;
  periodoFim: Date;
  canceladaEm: Date | null;
  ciclosPagos?: number;
}

/**
 * Diferença de desconto usada sem cumprir o compromisso.
 *
 * Só existe nos planos de compromisso pagos mês a mês. Neles o barbeiro leva
 * o preço de anual (ou semestral) já na primeira cobrança — o desconto é
 * adiantado contra uma promessa de permanência. Quem sai antes ficou com a
 * parte boa sem a contrapartida.
 *
 * A conta é a diferença exata do que ele economizou, nunca uma multa
 * arbitrária: (preço mensal − preço do plano) × ciclos efetivamente pagos.
 * Assim o valor é sempre proporcional ao que foi realmente usufruído.
 *
 * Não é dívida enquanto ele estiver em dia ou em carência — só passa a
 * existir quando ele efetivamente sai (cancelou ou foi bloqueado). E não é
 * cobrança forçada: aparece na próxima reativação, que é o único momento em
 * que temos como condicionar alguma coisa.
 */
export function descontoAAcertar(
  a: AssinaturaBruta | null,
  estado: EstadoAssinatura,
): number {
  if (!a) return 0;
  if (estado !== "bloqueada" && estado !== "cancelada") return 0;

  const plano = (a.plano in PLANOS ? a.plano : "mensal") as PlanoId;
  const p = PLANOS[plano];

  // Plano à vista já pagou tudo adiantado; mensal puro não tem compromisso
  if (p.compromisso <= 1 || p.mesesCobranca !== 1) return 0;

  const pagos = a.ciclosPagos ?? 0;
  if (pagos <= 0 || pagos >= p.compromisso) return 0;

  const descontoPorMes = PLANOS.mensal.mensal - p.mensal;
  return Math.round(descontoPorMes * pagos * 100) / 100;
}

/**
 * Estado real da assinatura agora.
 *
 * Nunca chame o campo `status` direto — ele não sabe que o tempo passou.
 */
export function situacaoDe(
  a: AssinaturaBruta | null,
  agora: Date = new Date(),
): SituacaoAssinatura {
  const base0 = calcularSituacao(a, agora);
  const plano0 = (a && a.plano in PLANOS ? a.plano : "mensal") as PlanoId;
  return {
    ...base0,
    descontoAAcertar: descontoAAcertar(a, base0.estado),
    ciclosPagos: a?.ciclosPagos ?? 0,
    compromisso: PLANOS[plano0].compromisso,
  };
}

/** O cálculo puro do estado — sem os campos derivados de compromisso. */
function calcularSituacao(
  a: AssinaturaBruta | null,
  agora: Date,
): Omit<SituacaoAssinatura, "descontoAAcertar" | "ciclosPagos" | "compromisso"> {
  // Barbearia sem assinatura: trata como cortesia em vez de bloquear.
  // Se algum dia um cadastro escapar da criação da assinatura, o barbeiro
  // não pode ser trancado do lado de fora por um erro nosso.
  if (!a) {
    const longe = new Date(agora.getTime() + 365 * 86_400_000);
    return {
      estado: "cortesia", podeEscrever: true, aceitaAgendamento: true,
      diasRestantes: 365, periodoFim: longe, plano: "mensal",
      valorCiclo: 0, aviso: null,
    };
  }

  const plano = (a.plano in PLANOS ? a.plano : "mensal") as PlanoId;
  const valorCiclo = num(a.valorCiclo as never);
  const base = { plano, valorCiclo, periodoFim: a.periodoFim };

  if (a.status === "cortesia") {
    return { ...base, estado: "cortesia", podeEscrever: true, aceitaAgendamento: true, diasRestantes: 9999, aviso: null };
  }

  // Cancelamento não corta na hora: o que foi pago continua valendo
  if (a.canceladaEm && agora >= a.periodoFim) {
    return { ...base, estado: "cancelada", podeEscrever: false, aceitaAgendamento: false, diasRestantes: 0,
      aviso: "Sua assinatura foi encerrada. Reative para voltar a agendar." };
  }

  if (a.trialEndsAt && agora < a.trialEndsAt) {
    const dias = diasEntre(agora, a.trialEndsAt);
    return { ...base, estado: "trial", podeEscrever: true, aceitaAgendamento: true, diasRestantes: dias,
      aviso: dias <= 3
        ? `Seu teste grátis acaba em ${dias} dia${dias === 1 ? "" : "s"}. Escolha um plano para não perder a agenda.`
        : `Teste grátis — ${dias} dias restantes.` };
  }

  if (agora < a.periodoFim) {
    const dias = diasEntre(agora, a.periodoFim);
    return { ...base, estado: "ativa", podeEscrever: true, aceitaAgendamento: true, diasRestantes: dias,
      aviso: dias <= 5 ? `Sua assinatura vence em ${dias} dia${dias === 1 ? "" : "s"}.` : null };
  }

  const fimCarencia = new Date(a.periodoFim.getTime() + DIAS_CARENCIA * 86_400_000);
  if (agora < fimCarencia) {
    const dias = diasEntre(agora, fimCarencia);
    return { ...base, estado: "carencia", podeEscrever: true, aceitaAgendamento: true, diasRestantes: dias,
      // Quem saiu do teste nunca pagou nada — "pagamento em atraso" soaria
      // como cobranca indevida. `trialEndsAt` so e limpo no primeiro pagamento.
      aviso: a.trialEndsAt
        ? `Seu teste grátis terminou. Escolha um plano em até ${dias} dia${dias === 1 ? "" : "s"} para não perder a agenda.`
        : `Pagamento em atraso. Você tem ${dias} dia${dias === 1 ? "" : "s"} antes da agenda ser bloqueada.` };
  }

  // Bloqueada: ainda VÊ a agenda e confirma pagamento do que já existe —
  // trancar tudo puniria os clientes que já tinham horário marcado.
  return { ...base, estado: "bloqueada", podeEscrever: false, aceitaAgendamento: false, diasRestantes: 0,
    aviso: "Assinatura bloqueada. Regularize para voltar a agendar e editar." };
}

/** Situação da barbearia, já buscando no banco. */
export async function situacaoDaLoja(shopId: string): Promise<SituacaoAssinatura> {
  const a = await prisma.subscription.findUnique({
    where: { shopId },
    select: { status: true, plano: true, valorCiclo: true, trialEndsAt: true, periodoFim: true, canceladaEm: true },
  });
  return situacaoDe(a);
}

/** Cria a assinatura de uma barbearia nova, já em teste grátis. */
export async function iniciarTrial(shopId: string) {
  const fim = new Date(Date.now() + DIAS_TRIAL * 86_400_000);
  return prisma.subscription.create({
    data: {
      shopId,
      plano: "mensal",
      status: "trial",
      valorCiclo: valorDoCiclo("mensal"),
      trialEndsAt: fim,
      // Durante o teste o acesso vai até a mesma data
      periodoFim: fim,
    },
  });
}

/**
 * O que acontece no banco quando uma fatura e paga.
 *
 * Separado do webhook porque o webhook confere o pagamento DE VOLTA na
 * InfinitePay antes de aceitar — nenhum teste chega ate la sem dinheiro de
 * verdade, e o trecho que mexe na assinatura ficava sem cobertura nenhuma.
 */
export async function aplicarPagamento(
  db: import("@prisma/client").PrismaClient,
  fatura: { id: string; plano: string; subscriptionId: string; subscription: { periodoFim: Date } },
  pagamento: { metodo: string; transactionNsu: string | null },
  agora: Date = new Date(),
): Promise<{ plano: PlanoId; ate: Date }> {
  // O plano vem DA FATURA, nao da assinatura. A fatura e um contrato por um
  // valor E um periodo: gerar no mensal, trocar para anual e pagar o mensal
  // nao pode render doze meses.
  const plano = (fatura.plano in PLANOS ? fatura.plano : "mensal") as PlanoId;

  // Quem paga adiantado nao perde os dias que ja tinha; quem paga atrasado
  // comeca a contar de hoje.
  const base = fatura.subscription.periodoFim > agora ? fatura.subscription.periodoFim : agora;
  const ate = proximoVencimento(base, plano);
  const metodoAssinatura = pagamento.metodo === "cartao" ? "cartao" : "pix";

  await db.$transaction([
    db.subscriptionInvoice.update({
      where: { id: fatura.id },
      data: { status: "paga", pagaEm: agora, metodo: pagamento.metodo, mpPaymentId: pagamento.transactionNsu },
    }),
    db.subscription.update({
      where: { id: fatura.subscriptionId },
      data: {
        status: "ativa",
        periodoFim: ate,
        // O que foi pago e o que ele tem. Sem isto, quem escolhia anual pelo
        // link e pagava R$ 358,80 ganhava doze meses — e no vencimento o cron
        // cobrava o MENSAL, porque a assinatura continuava dizendo "mensal".
        plano,
        valorCiclo: valorDoCiclo(plano),
        metodo: metodoAssinatura,
        trialEndsAt: null,
        canceladaEm: null,
        ciclosPagos: { increment: 1 },
      },
    }),
    // As outras em aberto perderam o sentido. Sem isto ficavam no painel
    // como "pendente" para sempre — e quem trocou de plano na pagina de
    // pagamento deixava viva a fatura do plano que nao escolheu.
    db.subscriptionInvoice.updateMany({
      where: { subscriptionId: fatura.subscriptionId, status: "pendente", id: { not: fatura.id } },
      data: { status: "cancelada" },
    }),
  ]);

  return { plano, ate };
}
