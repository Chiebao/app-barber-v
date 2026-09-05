import { test, expect } from "@playwright/test";
import {
  ultimoDiaAberto, dentroDaJanela, ehOpcaoValida, OPCOES_DIAS,
} from "../../src/app/lib/janela-agenda";

/**
 * Até onde o cliente enxerga a agenda.
 *
 * A janela conta HOJE inclusive, que é como o barbeiro descreve: "travar por
 * uma semana" numa segunda quer dizer até a segunda seguinte.
 */

// Uma segunda-feira às 10h de Brasília (13h UTC), longe da virada do dia.
const SEGUNDA = new Date("2026-09-07T13:00:00.000Z");

test("sete dias numa segunda vai até a segunda seguinte", () => {
  expect(ultimoDiaAberto(7, SEGUNDA)).toBe("2026-09-14");
});

test("as três opções dão os três limites", () => {
  expect(ultimoDiaAberto(7, SEGUNDA)).toBe("2026-09-14");
  expect(ultimoDiaAberto(15, SEGUNDA)).toBe("2026-09-22");
  expect(ultimoDiaAberto(30, SEGUNDA)).toBe("2026-10-07");
});

test("o último dia da janela ainda cabe; o seguinte não", () => {
  // A borda é o caso que quebra em produção: errar por um dia aqui tira do
  // cliente justamente o dia que o barbeiro quis deixar aberto.
  expect(dentroDaJanela(7, "2026-09-14", SEGUNDA)).toBe(true);
  expect(dentroDaJanela(7, "2026-09-15", SEGUNDA)).toBe(false);
});

test("hoje cabe, ontem não", () => {
  expect(dentroDaJanela(7, "2026-09-07", SEGUNDA)).toBe(true);
  // O passado já é cortado na lista de horários, mas quem POSTA direto na
  // API nunca viu lista nenhuma.
  expect(dentroDaJanela(7, "2026-09-06", SEGUNDA)).toBe(false);
});

test("a janela usa o dia da BARBEARIA, não o do servidor", () => {
  // 02:00 UTC de terça é ainda 23:00 de segunda em Brasília. Se a conta
  // usasse o relógio do servidor, a agenda viraria de dia às 21h e o cliente
  // perderia o último dia durante o expediente.
  const tardeDaSegunda = new Date("2026-09-08T02:00:00.000Z");
  expect(ultimoDiaAberto(7, tardeDaSegunda)).toBe("2026-09-14");
});

test("a virada de mês não confunde a conta", () => {
  const fimDeSetembro = new Date("2026-09-28T13:00:00.000Z");
  expect(ultimoDiaAberto(7, fimDeSetembro)).toBe("2026-10-05");
  expect(dentroDaJanela(7, "2026-10-05", fimDeSetembro)).toBe(true);
  expect(dentroDaJanela(7, "2026-10-06", fimDeSetembro)).toBe(false);
});

test("só 7, 15 e 30 são aceitos", () => {
  for (const n of OPCOES_DIAS) expect(ehOpcaoValida(n)).toBe(true);
  // Lista fechada: 0 fecharia a agenda e 400 abriria o ano inteiro, os dois
  // sem ninguém perceber até o cliente reclamar.
  for (const n of [0, 1, 14, 31, 365, -7]) expect(ehOpcaoValida(n)).toBe(false);
  expect(ehOpcaoValida("7")).toBe(false);
  expect(ehOpcaoValida(null)).toBe(false);
});
