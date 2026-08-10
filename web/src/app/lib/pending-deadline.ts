import { toZonedTime, fromZonedTime } from "date-fns-tz";

/**
 * Prazo do pré-agendamento (Pix não confirmado).
 *
 * REGRA DE NEGÓCIO
 * O relógio só corre enquanto a barbearia está ABERTA. Se o cliente pré-agenda
 * às 22h, o relógio começa a contar na próxima abertura — assim o barbeiro
 * sempre tem um expediente inteiro para confirmar, em vez de o pré-agendado
 * morrer de madrugada enquanto ele dorme.
 *
 * Além disso, o prazo NUNCA passa da hora do corte: não faz sentido segurar
 * um horário que já aconteceu.
 *
 * Exemplos (barbearia 08:00–17:00, prazo de 6h):
 *   pré-agendou 22h  → relógio começa 08:00 do dia seguinte → vence 14:00
 *   pré-agendou 09h  → vence 15:00 do mesmo dia
 *   pré-agendou 15h  → 2h hoje + 4h amanhã → vence 12:00 de amanhã
 *   corte é amanhã 09h → vence 09:00 (trava na hora do corte)
 */

/** Fuso das barbearias. O servidor roda em UTC, então converter é obrigatório. */
export const SHOP_TIMEZONE = "America/Sao_Paulo";

/** Horas de barbearia aberta que o cliente tem para o barbeiro confirmar o Pix. */
export const PENDING_OPEN_HOURS = 6;

export interface ShopHours {
  openTime: string;   // "08:00"
  closeTime: string;  // "17:00"
  workDays: number[]; // [1,2,3,4,5,6] — 0 = domingo
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Monta um instante (UTC) a partir de uma data local da barbearia + "HH:mm". */
function shopTimeToUtc(localDay: Date, hhmm: string): Date {
  const y = localDay.getFullYear();
  const mo = String(localDay.getMonth() + 1).padStart(2, "0");
  const d = String(localDay.getDate()).padStart(2, "0");
  const [h, mi] = hhmm.split(":");
  return fromZonedTime(
    `${y}-${mo}-${d}T${h.padStart(2, "0")}:${(mi || "00").padStart(2, "0")}:00`,
    SHOP_TIMEZONE,
  );
}

/**
 * Calcula quando um pré-agendamento vence.
 *
 * @param createdAt        instante da criação (UTC)
 * @param shop             horários e dias de funcionamento da barbearia
 * @param appointmentStart instante do corte (UTC) — trava máxima do prazo
 * @param openHours        horas de expediente do prazo (padrão 6)
 * @returns instante do vencimento (UTC)
 */
export function computePendingDeadline(
  createdAt: Date,
  shop: ShopHours,
  appointmentStart: Date | null,
  openHours: number = PENDING_OPEN_HOURS,
): Date {
  const openMin = minutesOf(shop.openTime);
  const closeMin = minutesOf(shop.closeTime);
  const workDays = Array.isArray(shop.workDays) && shop.workDays.length > 0
    ? shop.workDays
    : [1, 2, 3, 4, 5, 6];

  // Barbearia com horário inválido (fecha antes de abrir): cai no prazo corrido
  if (closeMin <= openMin) {
    const fallback = new Date(createdAt.getTime() + openHours * 60 * 60 * 1000);
    return capAtAppointment(fallback, appointmentStart);
  }

  let remaining = openHours * 60; // minutos de expediente que faltam
  // "Hoje" no fuso da barbearia — é por aqui que caminhamos dia a dia
  const cursorLocal = toZonedTime(createdAt, SHOP_TIMEZONE);

  // Limite de segurança: no máximo 30 dias à frente (barbearia com poucos dias abertos)
  for (let i = 0; i < 30 && remaining > 0; i++) {
    const day = new Date(cursorLocal);
    day.setDate(day.getDate() + i);

    if (!workDays.includes(day.getDay())) continue; // fechado nesse dia

    const dayOpenUtc = shopTimeToUtc(day, shop.openTime);
    const dayCloseUtc = shopTimeToUtc(day, shop.closeTime);

    // A contagem começa na abertura, ou no momento da criação se já estava aberto
    const windowStart = i === 0 && createdAt > dayOpenUtc ? createdAt : dayOpenUtc;
    if (windowStart >= dayCloseUtc) continue; // já passou do fechamento

    const availableMin = Math.floor((dayCloseUtc.getTime() - windowStart.getTime()) / 60000);

    if (availableMin >= remaining) {
      const deadline = new Date(windowStart.getTime() + remaining * 60000);
      return capAtAppointment(deadline, appointmentStart);
    }
    remaining -= availableMin; // consome o dia inteiro e continua amanhã
  }

  // Não achou expediente suficiente em 30 dias — usa o fim do horizonte
  const fallback = new Date(createdAt.getTime() + openHours * 60 * 60 * 1000);
  return capAtAppointment(fallback, appointmentStart);
}

/** O prazo nunca pode passar da hora do corte. */
function capAtAppointment(deadline: Date, appointmentStart: Date | null): Date {
  if (appointmentStart && appointmentStart < deadline) return appointmentStart;
  return deadline;
}

/**
 * Instante (UTC) em que um agendamento começa, a partir da data + "HH:mm"
 * interpretados no fuso da barbearia.
 */
export function appointmentStartUtc(date: Date, startTime: string): Date {
  const local = toZonedTime(date, SHOP_TIMEZONE);
  return shopTimeToUtc(local, startTime);
}

/** Um pré-agendamento está vencido? */
export function isPendingExpired(
  status: string,
  pendingExpiresAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  return status === "pending_payment" && !!pendingExpiresAt && pendingExpiresAt <= now;
}

/**
 * Filtro Prisma dos agendamentos que realmente OCUPAM um horário.
 *
 * Exclui cancelados, faltas e — a regra nova — pré-agendamentos vencidos:
 * quem declarou o Pix mas não teve a confirmação do barbeiro dentro do prazo
 * deixa de segurar a vaga, liberando-a para qualquer cliente.
 */
export function occupiesSlotWhere(now: Date = new Date()) {
  return {
    status: { notIn: ["cancelled", "no_show"] },
    NOT: {
      AND: [
        { status: "pending_payment" },
        { pendingExpiresAt: { not: null } },
        { pendingExpiresAt: { lte: now } },
      ],
    },
  };
}
