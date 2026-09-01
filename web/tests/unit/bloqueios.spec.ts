import { test, expect } from "@playwright/test";
import { diaDaSemana, invadeBloqueio, emTexto, emMinutos } from "../../src/app/lib/bloqueios";

/**
 * A regra do bloqueio recorrente.
 *
 * O erro que estes testes existem para pegar não dá exceção: dá almoço
 * aparecendo no dia errado, ou corte marcado por cima dele.
 */

test.describe("Dia da semana", () => {
  test("não escorrega para o dia anterior por causa do fuso", () => {
    // new Date("2026-09-01") é meia-noite UTC = 21h de 31/08 em São Paulo.
    // Sem o meio-dia, o almoço de terça apareceria na segunda.
    expect(diaDaSemana("2026-09-01")).toBe(2); // terça
    expect(diaDaSemana("2026-09-06")).toBe(0); // domingo
    expect(diaDaSemana("2026-08-31")).toBe(1); // segunda
  });
});

test.describe("Invasão de bloqueio", () => {
  const almoco = [{ startTime: "12:00", endTime: "13:00" }];

  test("corte que começa dentro é barrado", () => {
    expect(invadeBloqueio("12:30", "13:00", almoco)).toBe(true);
  });

  test("corte que ATRAVESSA é barrado", () => {
    // O buraco antigo: começava antes do almoço e passava por cima dele.
    expect(invadeBloqueio("11:15", "12:15", almoco)).toBe(true);
  });

  test("corte que engole o bloqueio inteiro é barrado", () => {
    expect(invadeBloqueio("11:00", "14:00", almoco)).toBe(true);
  });

  test("encostar no fim do bloqueio é permitido", () => {
    // 12:00–13:00 fechado libera as 13:00 — fim exclusivo.
    expect(invadeBloqueio("13:00", "13:30", almoco)).toBe(false);
  });

  test("encostar no início do bloqueio é permitido", () => {
    expect(invadeBloqueio("11:00", "12:00", almoco)).toBe(false);
  });

  test("sem bloqueio nenhum, nada é barrado", () => {
    expect(invadeBloqueio("12:30", "13:00", [])).toBe(false);
  });

  test("bloqueio malformado não barra o dia inteiro por engano", () => {
    expect(invadeBloqueio("12:30", "13:00", [{ startTime: "", endTime: "xx" }])).toBe(false);
  });
});

test.describe("Conversão de horário", () => {
  test("ida e volta preserva o valor", () => {
    for (const h of ["00:00", "08:05", "12:00", "23:59"]) {
      expect(emTexto(emMinutos(h))).toBe(h);
    }
  });

  test("entrada inválida vira NaN em vez de zero", () => {
    // Zero seria meia-noite — um bloqueio silencioso no começo do dia.
    expect(Number.isNaN(emMinutos("banana"))).toBe(true);
    expect(Number.isNaN(emMinutos(""))).toBe(true);
  });
});
