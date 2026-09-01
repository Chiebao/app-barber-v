import { formatInTimeZone } from "date-fns-tz";

import { SHOP_TIMEZONE } from "./pending-deadline";

/**
 * Horários que a agenda oferece num dia.
 *
 * Três números diferentes governam isso, e confundir dois deles é fácil:
 *
 *   durationMinutes — quanto o atendimento ocupa. Decide se ainda cabe antes
 *                     de fechar, e quais horários batem com o que já está
 *                     marcado.
 *
 *   stepMinutes     — de quanto em quanto tempo a agenda divide o dia VAZIO.
 *                     Uma barbearia que atende 1h por cliente quer 08:00,
 *                     09:00, 10:00 — não 08:00, 08:30, 09:00.
 *
 *   o fim de cada ocupação — vira um começo possível. É o "encaixe".
 *
 * POR QUE O ENCAIXE EXISTE
 * A régua fixa sozinha vaza o dia. Com passo de 1h e um corte de 1h15 às
 * 10:00, as 11:00 estão comprometidas e a próxima marca é meio-dia: os 45
 * minutos entre 11:15 e 12:00 não eram oferecidos a ninguém, nunca. Num dia
 * cheio isso passa de dois cortes perdidos — foi a conta do próprio barbeiro.
 *
 * Agora os candidatos são a régua MAIS o fim de cada atendimento e de cada
 * bloqueio. Com passo de 1h, o exemplo acima ganha exatamente uma opção nova
 * (11:15), não uma lista bagunçada.
 *
 * O preço disso é horário quebrado — 11:15, 14:40, 16:05. Foi decisão
 * deliberada do dono: prefere a agenda apertada e escolhe por dia se aceita
 * ou não.
 *
 * IMPORTANTE: bloqueio precisa chegar aqui dentro de `bookedSlots`, como
 * intervalo. Filtrar bloqueio por igualdade de horário depois não funciona —
 * um corte que COMEÇA antes e atravessa o bloqueio passaria batido.
 */

/** "09:30" → 570. Devolve NaN para entrada inválida, de propósito. */
function paraMinutos(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 570 → "09:30" */
function paraTexto(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function generateTimeSlots(
  openTime: string,
  closeTime: string,
  durationMinutes: number,
  bookedSlots: { startTime: string; endTime: string }[],
  stepMinutes = 30,
): string[] {
  const abre = paraMinutos(openTime);
  const fecha = paraMinutos(closeTime);
  if (!Number.isFinite(abre) || !Number.isFinite(fecha) || fecha <= abre) return [];

  // Passo inválido derrubaria o laço para sempre — 30 é o padrão histórico.
  const passo = Number.isFinite(stepMinutes) && stepMinutes > 0 ? stepMinutes : 30;
  const duracao = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 0;

  const ocupados = bookedSlots
    .map((b) => ({ inicio: paraMinutos(b.startTime), fim: paraMinutos(b.endTime) }))
    .filter((o) => Number.isFinite(o.inicio) && Number.isFinite(o.fim) && o.fim > o.inicio);

  // Set porque um encaixe costuma cair em cima de uma marca da régua — e uma
  // lista com 12:00 repetido é bug visível na tela do cliente.
  const candidatos = new Set<number>();
  for (let t = abre; t + duracao <= fecha; t += passo) candidatos.add(t);
  for (const o of ocupados) {
    if (o.fim >= abre && o.fim + duracao <= fecha) candidatos.add(o.fim);
  }

  return [...candidatos]
    .sort((a, b) => a - b)
    .filter((t) => !ocupados.some((o) => t < o.fim && t + duracao > o.inicio))
    .map(paraTexto);
}

/**
 * Que dia e que horas são AGORA, do ponto de vista da barbearia.
 *
 * Quem decide se um horário já passou é a barbearia, não o relógio de quem
 * está olhando. O servidor roda em UTC e o cliente pode estar em qualquer
 * fuso — os dois dariam respostas diferentes para a mesma pergunta.
 *
 * O erro concreto que isso evita: `new Date().toISOString()` devolve a data em
 * UTC, então às 22h de Brasília ele já responde o dia seguinte. A agenda
 * passava a oferecer só a partir de amanhã, e o dia de hoje sumia da lista.
 *
 * @param agora instante de referência (default: agora). Injetável para teste.
 * @returns `dia` no formato YYYY-MM-DD e `hora` no formato HH:mm.
 */
export function agoraNaBarbearia(agora: Date = new Date()): { dia: string; hora: string } {
  return {
    dia: formatInTimeZone(agora, SHOP_TIMEZONE, "yyyy-MM-dd"),
    hora: formatInTimeZone(agora, SHOP_TIMEZONE, "HH:mm"),
  };
}
