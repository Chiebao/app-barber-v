import { format, parse, addMinutes, isBefore, isEqual } from "date-fns";

export function generateTimeSlots(
  openTime: string,
  closeTime: string,
  durationMinutes: number,
  bookedSlots: { startTime: string; endTime: string }[]
): string[] {
  const slots: string[] = [];
  const baseDate = new Date(2000, 0, 1);
  const start = parse(openTime, "HH:mm", baseDate);
  const end = parse(closeTime, "HH:mm", baseDate);

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

    current = addMinutes(current, 30); // slots a cada 30 min
  }

  return slots;
}
