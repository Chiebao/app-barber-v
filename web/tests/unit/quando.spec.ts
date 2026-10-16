import { test, expect } from "@playwright/test";
import { quandoFala, ehHoje } from "../../src/app/lib/quando";

/**
 * O dia nas notificações ao barbeiro. Antes vinha só "às 14:00" e o cliente
 * marcado para hoje aparecia de surpresa.
 */

// 16/10/2026, 10h em Brasília (13h UTC)
const AGORA = new Date("2026-10-16T13:00:00.000Z");

test("hoje e amanhã vêm escritos", () => {
  expect(quandoFala("2026-10-16", "14:00", AGORA)).toBe("hoje às 14:00");
  expect(quandoFala("2026-10-17", "09:00", AGORA)).toBe("amanhã às 09:00");
});

test("outros dias levam o dia da semana e a data", () => {
  expect(quandoFala("2026-10-20", "10:30", AGORA)).toBe("ter, 20/10 às 10:30");
});

test("aceita a data que vem do banco (meia-noite UTC)", () => {
  expect(quandoFala(new Date("2026-10-16T00:00:00.000Z").toISOString(), "18:00", AGORA)).toBe("hoje às 18:00");
});

test("o hoje é o de Brasília: 22h do dia 16 ainda é dia 16", () => {
  const noite = new Date("2026-10-17T01:00:00.000Z"); // 22h do dia 16 em Brasília
  expect(quandoFala("2026-10-16", "08:00", noite)).toBe("hoje às 08:00");
  expect(ehHoje("2026-10-16", noite)).toBe(true);
  expect(ehHoje("2026-10-17", noite)).toBe(false);
});
