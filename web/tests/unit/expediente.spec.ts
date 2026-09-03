import { test, expect } from "@playwright/test";
import { expedienteDe, type LinhaExpediente } from "../../src/app/lib/expediente";

/**
 * Horário por dia.
 *
 * O que estes testes seguram, em ordem de dano:
 *
 *   - barbearia SEM expediente configurado precisa continuar funcionando pelo
 *     horário único que ela já usava. Errar isso amanhece toda barbearia
 *     existente fechada.
 *   - almoço pela metade não pode virar um intervalo, senão bloqueia da
 *     meia-noite até uma hora qualquer.
 */

const LOJA = {
  id: "loja1",
  openTime: "09:00",
  closeTime: "19:00",
  workDays: [1, 2, 3, 4, 5],
};

// 2026-09-01 é uma terça (dia 2); 2026-09-06 é domingo (dia 0).
const TERCA = "2026-09-01";
const DOMINGO = "2026-09-06";

function linha(p: Partial<LinhaExpediente> & { dia: number }): LinhaExpediente {
  return {
    aberto: true, abre: "09:00", fecha: "19:00",
    almocoInicio: null, almocoFim: null,
    ...p,
  };
}

test.describe("Sem expediente configurado", () => {
  test("vale o horário único da loja", () => {
    const e = expedienteDe(LOJA, [], TERCA);
    expect(e.aberto).toBe(true);
    expect(e.abre).toBe("09:00");
    expect(e.fecha).toBe("19:00");
    expect(e.pausas).toHaveLength(0);
  });

  test("dia fora de workDays continua fechado", () => {
    // Sem este caminho de volta, migrar viraria requisito e toda barbearia
    // que já existe amanheceria com a agenda quebrada.
    expect(expedienteDe(LOJA, [], DOMINGO).aberto).toBe(false);
  });
});

test.describe("Com expediente configurado", () => {
  test("o horário do dia vence o da loja", () => {
    const e = expedienteDe(LOJA, [linha({ dia: 2, abre: "13:00", fecha: "21:00" })], TERCA);
    expect(e.abre).toBe("13:00");
    expect(e.fecha).toBe("21:00");
  });

  test("dia fechado no expediente fecha, mesmo estando em workDays", () => {
    const e = expedienteDe(LOJA, [linha({ dia: 2, aberto: false })], TERCA);
    expect(e.aberto).toBe(false);
  });

  test("dia aberto no expediente abre, mesmo fora de workDays", () => {
    // Domingo não está em workDays, mas o dono ligou a chave do domingo.
    const e = expedienteDe(LOJA, [linha({ dia: 0, abre: "10:00", fecha: "14:00" })], DOMINGO);
    expect(e.aberto).toBe(true);
    expect(e.abre).toBe("10:00");
  });

  test("configurar um dia não afeta os outros", () => {
    const linhas = [linha({ dia: 2, abre: "13:00", fecha: "21:00" })];
    // Quarta (dia 3) não tem linha — segue a loja.
    const quarta = expedienteDe(LOJA, linhas, "2026-09-02");
    expect(quarta.abre).toBe("09:00");
  });
});

test.describe("Almoço", () => {
  test("vira intervalo quando os dois lados existem", () => {
    const e = expedienteDe(LOJA, [linha({ dia: 2, almocoInicio: "12:00", almocoFim: "13:00" })], TERCA);
    expect(e.pausas).toEqual([{ startTime: "12:00", endTime: "13:00" }]);
  });

  test("pela metade NÃO vira intervalo", () => {
    // Um lado só produziria um bloqueio de origem ou fim indefinido — e um
    // intervalo mal formado fecha a agenda em silêncio.
    for (const meio of [
      { almocoInicio: "12:00", almocoFim: null },
      { almocoInicio: null, almocoFim: "13:00" },
    ]) {
      const e = expedienteDe(LOJA, [linha({ dia: 2, ...meio })], TERCA);
      expect(e.pausas).toHaveLength(0);
    }
  });

  test("invertido é ignorado em vez de virar intervalo negativo", () => {
    const e = expedienteDe(LOJA, [linha({ dia: 2, almocoInicio: "14:00", almocoFim: "13:00" })], TERCA);
    expect(e.pausas).toHaveLength(0);
  });

  test("dia fechado não devolve almoço", () => {
    const e = expedienteDe(LOJA, [linha({ dia: 2, aberto: false, almocoInicio: "12:00", almocoFim: "13:00" })], TERCA);
    expect(e.pausas).toHaveLength(0);
  });
});
