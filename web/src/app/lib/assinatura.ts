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

export const PLANOS = {
  mensal: { meses: 1, mensal: 79.9, rotulo: "Mensal" },
  semestral: { meses: 6, mensal: 64.9, rotulo: "Semestral" },
  anual: { meses: 12, mensal: 49.9, rotulo: "Anual" },
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
}

function diasEntre(de: Date, ate: Date): number {
  return Math.ceil((ate.getTime() - de.getTime()) / 86_400_000);
}

/** Valor cobrado num ciclo do plano (o semestral cobra os 6 meses de uma vez). */
export function valorDoCiclo(plano: PlanoId): number {
  const p = PLANOS[plano];
  return Math.round(p.mensal * p.meses * 100) / 100;
}

/** Soma os meses do plano a uma data, respeitando fim de mês. */
export function proximoVencimento(de: Date, plano: PlanoId): Date {
  const d = new Date(de);
  const diaOriginal = d.getDate();
  d.setMonth(d.getMonth() + PLANOS[plano].meses);
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
      aviso: `Pagamento em atraso. Você tem ${dias} dia${dias === 1 ? "" : "s"} antes da agenda ser bloqueada.` };
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
