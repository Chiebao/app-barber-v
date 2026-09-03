import type { Prisma } from "@prisma/client";
import { diaDaSemana, emMinutos, type Intervalo } from "@/app/lib/bloqueios";

/**
 * A que horas a barbearia abre NAQUELE dia.
 *
 * Antes a pergunta era "a que horas você abre?" e a resposta era uma só, igual
 * para a semana inteira. Quem abre 13h na terça e 08h na sexta escolhia a
 * janela mais larga e bloqueava o resto à mão, todo dia.
 *
 * COMPATIBILIDADE é o ponto delicado: barbearia sem `WorkDay` configurado
 * continua valendo pelo `openTime`/`closeTime`/`workDays` da loja. Sem esse
 * caminho de volta, migrar viraria requisito e toda barbearia que já existe
 * amanheceria fechada.
 *
 * O almoço sai daqui como INTERVALO, do mesmo formato dos bloqueios, para
 * atravessar o resto do sistema sem ninguém precisar saber que ele veio do
 * expediente e não de uma regra que o barbeiro criou.
 */

export interface LojaBase {
  id: string;
  openTime: string;
  closeTime: string;
  workDays: number[];
}

export interface ExpedienteDoDia {
  /** A barbearia atende neste dia? */
  aberto: boolean;
  abre: string;
  fecha: string;
  /** Almoço como intervalo ocupado. Vazio quando o dia não tem parada. */
  pausas: Intervalo[];
}

/** Só o que precisamos do WorkDay — aceita o registro do banco direto. */
export interface LinhaExpediente {
  dia: number;
  aberto: boolean;
  abre: string;
  fecha: string;
  almocoInicio: string | null;
  almocoFim: string | null;
}

/**
 * Resolve o expediente sem ir ao banco, a partir das linhas já carregadas.
 *
 * Separado da busca porque a agenda monta vários dias de uma vez e ir ao banco
 * por dia seria sete consultas para desenhar uma semana.
 */
export function expedienteDe(
  loja: LojaBase,
  linhas: LinhaExpediente[],
  dataISO: string,
): ExpedienteDoDia {
  const dia = diaDaSemana(dataISO);
  const linha = linhas.find((l) => l.dia === dia);

  // Sem linha configurada: vale o horário único da loja, como sempre valeu.
  if (!linha) {
    return {
      aberto: loja.workDays.includes(dia),
      abre: loja.openTime,
      fecha: loja.closeTime,
      pausas: [],
    };
  }

  if (!linha.aberto) {
    return { aberto: false, abre: linha.abre, fecha: linha.fecha, pausas: [] };
  }

  const pausas: Intervalo[] = [];
  const i = linha.almocoInicio;
  const f = linha.almocoFim;
  // Almoço só conta quando os dois lados existem e fazem sentido — meio
  // preenchido é dado pela metade, não é um intervalo.
  if (i && f && Number.isFinite(emMinutos(i)) && Number.isFinite(emMinutos(f)) && emMinutos(f) > emMinutos(i)) {
    pausas.push({ startTime: i, endTime: f });
  }

  return { aberto: true, abre: linha.abre, fecha: linha.fecha, pausas };
}

/** Busca as linhas de expediente de uma barbearia. */
export async function linhasDoExpediente(
  prisma: Prisma.TransactionClient,
  shopId: string,
): Promise<LinhaExpediente[]> {
  return prisma.workDay.findMany({
    where: { shopId },
    select: { dia: true, aberto: true, abre: true, fecha: true, almocoInicio: true, almocoFim: true },
  });
}

/** O caminho curto: uma data, uma resposta. */
export async function expedienteDoDia(
  prisma: Prisma.TransactionClient,
  loja: LojaBase,
  dataISO: string,
): Promise<ExpedienteDoDia> {
  return expedienteDe(loja, await linhasDoExpediente(prisma, loja.id), dataISO);
}
