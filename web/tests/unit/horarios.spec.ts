import { test, expect } from "@playwright/test";
import { generateTimeSlots } from "../../src/app/lib/time-slots";

/**
 * A conta dos horários oferecidos.
 *
 * Quebra em silêncio: não dá erro, dá horário errado na tela do cliente — ou
 * horário nenhum, que é o bug que originou o encaixe.
 */

const ABRE = "08:00";
const FECHA = "18:00";

test.describe("Encaixe", () => {
  test("o horário nasce onde o corte anterior termina", () => {
    // O caso do Eduardo: passo de 1h, corte de 1h15 às 10:00.
    const slots = generateTimeSlots(
      "10:00", "18:00", 30,
      [{ startTime: "10:00", endTime: "11:15" }],
      60,
    );

    // Antes do encaixe a régua só oferecia 12:00 e o pedaço até lá sumia.
    expect(slots).toContain("11:15");
    expect(slots.indexOf("11:15")).toBeLessThan(slots.indexOf("12:00"));
  });

  test("não repete o encaixe quando ele cai em cima da régua", () => {
    const slots = generateTimeSlots(
      ABRE, FECHA, 30,
      [{ startTime: "09:00", endTime: "10:00" }],
      60,
    );
    expect(slots.filter((s) => s === "10:00")).toHaveLength(1);
  });

  test("o encaixe não invade o atendimento seguinte", () => {
    // Buraco de 30 min entre 10:30 e 11:00; um corte de 45 não cabe.
    const slots = generateTimeSlots(
      ABRE, FECHA, 45,
      [
        { startTime: "09:00", endTime: "10:30" },
        { startTime: "11:00", endTime: "12:00" },
      ],
      60,
    );
    expect(slots).not.toContain("10:30");
    expect(slots).toContain("12:00");
  });

  test("o encaixe cabe quando o buraco é exatamente do tamanho do corte", () => {
    const slots = generateTimeSlots(
      ABRE, FECHA, 30,
      [
        { startTime: "09:00", endTime: "10:30" },
        { startTime: "11:00", endTime: "12:00" },
      ],
      60,
    );
    expect(slots).toContain("10:30");
  });

  test("encaixe que estoura o fechamento não é oferecido", () => {
    const slots = generateTimeSlots(
      ABRE, "18:00", 60,
      [{ startTime: "16:00", endTime: "17:30" }],
      60,
    );
    // 17:30 + 1h = 18:30, depois de fechar.
    expect(slots).not.toContain("17:30");
  });

  test("dia vazio continua redondo", () => {
    const slots = generateTimeSlots("08:00", "12:00", 30, [], 60);
    expect(slots).toEqual(["08:00", "09:00", "10:00", "11:00"]);
  });

  test("os horários saem em ordem", () => {
    const slots = generateTimeSlots(
      ABRE, FECHA, 30,
      [
        { startTime: "14:00", endTime: "15:15" },
        { startTime: "09:00", endTime: "09:40" },
      ],
      60,
    );
    expect([...slots].sort()).toEqual(slots);
  });
});

test.describe("Bloqueio", () => {
  test("bloqueio impede o corte que ATRAVESSA ele, não só o que começa nele", () => {
    // O defeito antigo: bloqueio era filtrado por igualdade de horário, então
    // 11:15 + 1h passava por cima do almoço das 12:00 sem ninguém notar.
    const slots = generateTimeSlots(
      "10:00", "18:00", 60,
      [
        { startTime: "10:00", endTime: "11:15" },
        { startTime: "12:00", endTime: "13:00" }, // almoço
      ],
      60,
    );
    expect(slots).not.toContain("11:15");
    expect(slots).toContain("13:00");
  });

  test("o fim do bloqueio também vira encaixe", () => {
    const slots = generateTimeSlots(
      "10:00", "18:00", 30,
      [{ startTime: "12:00", endTime: "12:40" }],
      60,
    );
    expect(slots).toContain("12:40");
  });
});

test.describe("Entradas ruins não derrubam a agenda", () => {
  test("passo zero cai no padrão em vez de travar", () => {
    const slots = generateTimeSlots("08:00", "10:00", 30, [], 0);
    expect(slots).toEqual(["08:00", "08:30", "09:00", "09:30"]);
  });

  test("horário inválido devolve lista vazia, não exceção", () => {
    expect(generateTimeSlots("banana", "18:00", 30, [], 60)).toEqual([]);
    expect(generateTimeSlots("18:00", "08:00", 30, [], 60)).toEqual([]);
  });

  test("ocupação malformada é ignorada e não some com o dia", () => {
    const slots = generateTimeSlots(
      "08:00", "12:00", 30,
      [{ startTime: "", endTime: "x" }],
      60,
    );
    expect(slots).toEqual(["08:00", "09:00", "10:00", "11:00"]);
  });
});
