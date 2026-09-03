import { test, expect } from "@playwright/test";

/**
 * O cache da agenda no aparelho.
 *
 * O que preocupa aqui não é guardar — é a PODA, que apaga. Errar a conta da
 * data joga fora a agenda de hoje justamente no dia em que a internet caiu,
 * que é o único dia em que esse arquivo importa.
 */

// localStorage não existe no node; o módulo é escrito contra a API do
// navegador, então o teste fornece uma.
class Memoria implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  [name: string]: unknown;
}
(globalThis as { localStorage?: Storage }).localStorage = new Memoria();

import { salvarAgenda, lerAgenda, limparAgendas } from "@/app/lib/agenda-offline";

test.beforeEach(() => limparAgendas());

test("guarda e devolve com a hora da cópia", () => {
  salvarAgenda("2026-09-04", [{ id: "a" }], "2026-09-04");
  const c = lerAgenda<{ id: string }>("2026-09-04");
  expect(c?.agendamentos).toEqual([{ id: "a" }]);
  expect(typeof c?.salvoEm).toBe("number");
});

test("dia sem cópia devolve null, e não uma lista vazia", () => {
  // A diferença é a tela inteira: null vira "não deu para carregar",
  // lista vazia viraria "nenhum agendamento".
  expect(lerAgenda("2026-09-04")).toBeNull();
});

test("a poda NÃO apaga hoje", () => {
  salvarAgenda("2026-09-04", [{ id: "hoje" }], "2026-09-04");
  salvarAgenda("2026-09-05", [{ id: "amanha" }], "2026-09-04");
  expect(lerAgenda("2026-09-04")).not.toBeNull();
  expect(lerAgenda("2026-09-05")).not.toBeNull();
});

test("a poda apaga o que já passou", () => {
  salvarAgenda("2026-08-20", [{ id: "velho" }], "2026-08-20");
  salvarAgenda("2026-09-04", [{ id: "hoje" }], "2026-09-04");
  expect(lerAgenda("2026-08-20")).toBeNull();
  expect(lerAgenda("2026-09-04")).not.toBeNull();
});

test("ontem sobrevive — o barbeiro ainda confere o dia anterior", () => {
  salvarAgenda("2026-09-03", [{ id: "ontem" }], "2026-09-03");
  salvarAgenda("2026-09-04", [{ id: "hoje" }], "2026-09-04");
  expect(lerAgenda("2026-09-03")).not.toBeNull();
});

test("a poda atravessa a virada do mês", () => {
  // 01/09 tem que preservar 31/08: comparação de texto ingênua diria que
  // "2026-08-31" < "2026-09-01" e jogaria fora.
  salvarAgenda("2026-08-31", [{ id: "ontem" }], "2026-08-31");
  salvarAgenda("2026-09-01", [{ id: "hoje" }], "2026-09-01");
  expect(lerAgenda("2026-08-31")).not.toBeNull();
});

test("o logout leva tudo — o aparelho pode ser de outra pessoa", () => {
  salvarAgenda("2026-09-04", [{ id: "cliente com nome e telefone" }], "2026-09-04");
  limparAgendas();
  expect(lerAgenda("2026-09-04")).toBeNull();
});

test("pacote corrompido não derruba a tela", () => {
  localStorage.setItem("agenda_offline:2026-09-04", "{isso não é json");
  expect(lerAgenda("2026-09-04")).toBeNull();
});
