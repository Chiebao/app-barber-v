import { format, parse, addMinutes, isBefore, isEqual } from "date-fns";

/**
 * Horários que a agenda oferece num dia.
 *
 * Dois números diferentes governam isso, e confundir os dois é fácil:
 *
 *   durationMinutes — quanto o atendimento ocupa. Decide se ainda cabe antes
 *                     de fechar, e quais horários batem com o que já está
 *                     marcado.
 *
 *   stepMinutes     — de quanto em quanto tempo a agenda oferece horário. É a
 *                     divisão do dia. Uma barbearia que atende 1h por cliente
 *                     quer 08:00, 09:00, 10:00 — não 08:00, 08:30, 09:00.
 *
 * O passo era fixo em 30 no código. Agora vem do `slotInterval` da barbearia.
 */
export function generateTimeSlots(
  openTime: string,
  closeTime: string,
  durationMinutes: number,
  bookedSlots: { startTime: string; endTime: string }[],
  stepMinutes = 30,
): string[] {
  const slots: string[] = [];
  const baseDate = new Date(2000, 0, 1);
  const start = parse(openTime, "HH:mm", baseDate);
  const end = parse(closeTime, "HH:mm", baseDate);

  // Passo inválido derrubaria o laço para sempre — 30 é o padrão histórico
  const passo = Number.isFinite(stepMinutes) && stepMinutes > 0 ? stepMinutes : 30;

  let current = start;

  while (
    isBefore(addMinutes(current, durationMinutes), end) ||
    isEqual(addMinutes(current, durationMinutes), end)
  ) {
    const slotStart = format(current, "HH:mm");
    const slotEnd = format(addMinutes(current, durationMinutes), "HH:mm");

    const isBooked = bookedSlots.some((booked) => {
      return slotStart < booked.endTime && slotEnd > booked.startTime;
    });

    if (!isBooked) {
      slots.push(slotStart);
    }

    current = addMinutes(current, passo);
  }

  return slots;
}
