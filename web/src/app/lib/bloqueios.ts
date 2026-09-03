/**
 * Bloqueios de um barbeiro num dia — pontuais e recorrentes, no mesmo formato.
 *
 * Existe para que a regra valha nos TRÊS lugares que decidem horário:
 *
 *   1. a lista que o cliente vê        (api/shops/[slug]/slots)
 *   2. a criação do agendamento        (api/appointments)
 *   3. a agenda do barbeiro no painel  (api/me/blocked-slots)
 *
 * Já custou caro ter isso espalhado: o bloqueio sumia da lista mas não barrava
 * a criação, então bastava uma tela velha — ou o modo chat, que monta o pedido
 * por conta própria — para alguém marcar em cima do almoço.
 */

import type { Prisma } from "@prisma/client";

export interface Intervalo {
  startTime: string;
  endTime: string;
}

export interface BloqueiosDoDia {
  /** Dia inteiro fechado — nada a oferecer. */
  diaTodo: boolean;
  intervalos: Intervalo[];
}

/**
 * Aceita o cliente normal E o de dentro de uma transação.
 *
 * `TransactionClient` é o próprio PrismaClient sem `$transaction` e afins, e
 * os dois satisfazem o tipo — é o que permite a checagem rodar dentro da
 * transação de agendamento, onde ela precisa estar.
 */
type ClientePrisma = Prisma.TransactionClient;

export function emMinutos(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

export function emTexto(minutos: number): string {
  const h = Math.floor(minutos / 60);
  return `${String(h).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/**
 * Dia da semana de uma data ISO, no fuso da barbearia.
 *
 * O meio-dia é deliberado: `new Date("2026-09-01")` é meia-noite UTC, que em
 * São Paulo ainda é o dia 31 — e o almoço de segunda apareceria no domingo.
 */
export function diaDaSemana(dataISO: string): number {
  return new Date(dataISO + "T12:00:00").getDay();
}

export async function bloqueiosDoDia(
  prisma: ClientePrisma,
  barberId: string,
  dataISO: string,
  slotInterval: number,
): Promise<BloqueiosDoDia> {
  const inicioDoDia = new Date(dataISO + "T00:00:00.000Z");
  const fimDoDia = new Date(dataISO + "T23:59:59.999Z");

  const [pontuais, fixos] = await Promise.all([
    prisma.blockedSlot.findMany({
      where: { barberId, date: { gte: inicioDoDia, lte: fimDoDia } },
      select: { time: true },
    }),
    prisma.recurringBlock.findMany({
      where: { barberId, ativo: true },
      select: { horaInicio: true, horaFim: true, diasSemana: true },
    }),
  ]);

  if (pontuais.some((b) => b.time === null)) {
    return { diaTodo: true, intervalos: [] };
  }

  const intervalos: Intervalo[] = [];

  // Bloqueio pontual ocupa um bloco da grade — é assim que o painel os cria.
  for (const b of pontuais) {
    if (!b.time) continue;
    const inicio = emMinutos(b.time);
    if (!Number.isFinite(inicio)) continue;
    intervalos.push({ startTime: b.time, endTime: emTexto(inicio + slotInterval) });
  }

  // Recorrente vale só nos dias da semana escolhidos.
  const dia = diaDaSemana(dataISO);
  for (const f of fixos) {
    if (!Array.isArray(f.diasSemana) || !f.diasSemana.includes(dia)) continue;
    const inicio = emMinutos(f.horaInicio);
    const fim = emMinutos(f.horaFim);
    if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) continue;
    intervalos.push({ startTime: f.horaInicio, endTime: f.horaFim });
  }

  return { diaTodo: false, intervalos };
}

/** Um pedido de horário cai em cima de algum bloqueio? */
export function invadeBloqueio(
  inicioPedido: string,
  fimPedido: string,
  intervalos: Intervalo[],
): boolean {
  const ini = emMinutos(inicioPedido);
  const fim = emMinutos(fimPedido);
  if (!Number.isFinite(ini) || !Number.isFinite(fim)) return false;
  return intervalos.some((b) => {
    const bi = emMinutos(b.startTime);
    const bf = emMinutos(b.endTime);
    if (!Number.isFinite(bi) || !Number.isFinite(bf)) return false;
    return ini < bf && fim > bi;
  });
}
