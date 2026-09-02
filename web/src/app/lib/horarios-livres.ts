import type { Prisma } from "@prisma/client";
import { generateTimeSlots, agoraNaBarbearia } from "@/app/lib/time-slots";
import { occupiesSlotWhere } from "@/app/lib/pending-deadline";
import { materializarRecorrentes } from "@/app/lib/recurrence";
import { bloqueiosDoDia } from "@/app/lib/bloqueios";

/**
 * Os horários que sobram num dia.
 *
 * Extraído da rota pública porque o painel passou a precisar da MESMA lista:
 * quando o barbeiro marca alguém no balcão, os horários oferecidos a ele têm
 * que ser os mesmos que o cliente veria. Deixar duas cópias da conta é como o
 * bloqueio já se perdeu uma vez — a lista escondia, a criação aceitava.
 *
 * A conta inteira mora aqui: cortes fixos materializados, tempo já ocupado,
 * bloqueios (pontuais e recorrentes), encaixe no fim de cada atendimento, e o
 * corte do que já passou.
 */

export interface LojaParaHorarios {
  id: string;
  openTime: string;
  closeTime: string;
  workDays: number[];
  slotInterval: number;
}

export interface HorariosDoDia {
  slots: string[];
  /** Por que a lista veio vazia — o vazio sozinho não distingue os casos. */
  motivo?: string;
}

export async function horariosLivres(
  prisma: Prisma.TransactionClient,
  opcoes: {
    shop: LojaParaHorarios;
    date: string;
    /** Soma da duração dos serviços escolhidos, em minutos. */
    duration: number;
    barberId?: string | null;
    /** Barbeiro marcando no balcão pode usar o que resta de hoje. */
    incluirPassado?: boolean;
  },
): Promise<HorariosDoDia> {
  const { shop, date, duration, barberId } = opcoes;

  const diaDaSemana = new Date(date + "T12:00:00").getDay();
  if (!shop.workDays.includes(diaDaSemana)) {
    return { slots: [], motivo: "Dia nao disponivel" };
  }

  // Cortes fixos viram agendamento de verdade ANTES de contar o que está
  // ocupado. Sem isso o horário de quem vem toda terça apareceria livre.
  await materializarRecorrentes(shop.id, date, date);

  const inicioDoDia = new Date(date + "T00:00:00");
  const fimDoDia = new Date(date + "T23:59:59");

  const where: Record<string, unknown> = {
    shopId: shop.id,
    date: { gte: inicioDoDia, lte: fimDoDia },
    ...occupiesSlotWhere(),
  };
  if (barberId) where.barberId = barberId;

  const ocupados = await prisma.appointment.findMany({
    where,
    select: { startTime: true, endTime: true, totalDuration: true },
  });

  // Capacidade do dia por TEMPO REAL ocupado, não por número de agendamentos.
  // O contador antigo comparava a quantidade com uma estimativa pelo tempo
  // médio, e fechava a agenda cedo quando os serviços eram mais curtos.
  const [abreH, abreM] = shop.openTime.split(":").map(Number);
  const [fechaH, fechaM] = shop.closeTime.split(":").map(Number);
  const minutosDoDia = (fechaH * 60 + fechaM) - (abreH * 60 + abreM);

  const minutosOcupados = ocupados.reduce((soma, a) => {
    if (a.totalDuration && a.totalDuration > 0) return soma + a.totalDuration;
    const [sh, sm] = a.startTime.split(":").map(Number);
    const [eh, em] = a.endTime.split(":").map(Number);
    return soma + Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  }, 0);

  if (minutosDoDia - minutosOcupados < duration) {
    return { slots: [], motivo: "Agenda cheia para este dia" };
  }

  // Bloqueios entram como INTERVALO OCUPADO, junto com os agendamentos.
  // Descontá-los depois, comparando com o começo da vaga, deixava passar o
  // corte que COMEÇA antes do bloqueio e atravessa ele.
  let bloqueios: { startTime: string; endTime: string }[] = [];
  if (barberId) {
    const b = await bloqueiosDoDia(prisma, barberId, date, shop.slotInterval);
    if (b.diaTodo) return { slots: [], motivo: "Barbeiro indisponivel neste dia" };
    bloqueios = b.intervalos;
  }

  // Duração é a soma dos serviços; passo é a divisão do dia. Coisas
  // diferentes de propósito.
  let slots = generateTimeSlots(
    shop.openTime, shop.closeTime, duration, [...ocupados, ...bloqueios], shop.slotInterval,
  );

  // HOJE: tirar o que já passou. O corte é do SERVIDOR de propósito — quem
  // decide que horas são é a barbearia, não o relógio de quem está olhando.
  const { dia: hojeNaLoja, hora: agoraNaLoja } = agoraNaBarbearia();
  let expedienteAcabou = false;
  if (date === hojeNaLoja && !opcoes.incluirPassado) {
    const restantes = slots.filter((s) => s > agoraNaLoja);
    expedienteAcabou = restantes.length === 0 && slots.length > 0;
    slots = restantes;
  }

  // Mensagem própria para "o dia acabou": sem ela a tela mostra o mesmo vazio
  // de "agenda cheia", e ninguém distingue lotado de encerrado.
  if (slots.length === 0 && expedienteAcabou) {
    return { slots: [], motivo: "Os horários de hoje já passaram" };
  }

  return { slots };
}
