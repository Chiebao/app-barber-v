import { test, expect } from "@playwright/test";
import { resumirAgenda } from "@/app/lib/agenda-do-dia";

/**
 * A lista da agenda cabendo numa variável de modelo do WhatsApp.
 *
 * A Meta recusa parâmetro com quebra de linha, então a lista não pode ser
 * uma lista — vira uma linha separada por " · ". E recusa parâmetro longo
 * demais, então precisa caber.
 */

const item = (startTime: string, cliente: string, servicos: string[] = ["Corte"]) =>
  ({ startTime, cliente, servicos });

test("junta na ordem, com horário, nome e serviço", () => {
  const t = resumirAgenda([
    item("09:00", "João"),
    item("10:15", "Pedro", ["Corte", "Barba"]),
  ]);
  expect(t).toBe("09:00 João (Corte) · 10:15 Pedro (Corte + Barba)");
});

test("nunca devolve quebra de linha — a Meta recusa o envio", () => {
  const t = resumirAgenda(Array.from({ length: 30 }, (_, i) => item(`0${i % 10}:00`, "Cliente " + i)));
  expect(t).not.toContain("\n");
  expect(t).not.toContain("\r");
});

test("corta quando passa do limite e diz quantos ficaram de fora", () => {
  const t = resumirAgenda(Array.from({ length: 40 }, (_, i) => item("09:00", "Cliente " + i)), 200);
  expect(t.length).toBeLessThan(260);
  expect(t).toMatch(/e mais \d+$/);
});

test("agenda que cabe não ganha 'e mais'", () => {
  const t = resumirAgenda([item("09:00", "João"), item("10:00", "Ana")]);
  expect(t).not.toContain("e mais");
});

test("sem serviço não sobra parêntese vazio", () => {
  expect(resumirAgenda([item("09:00", "João", [])])).toBe("09:00 João");
});

test("dia vazio vira texto vazio, não 'undefined'", () => {
  expect(resumirAgenda([])).toBe("");
});
