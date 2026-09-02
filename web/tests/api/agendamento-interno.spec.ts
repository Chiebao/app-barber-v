import { test, expect } from "@playwright/test";
import { BASE, criarLoja, apagarLoja, apagarClientes, fecharDb, db, type Loja } from "./_ajudantes";

/**
 * Agendamento criado pelo barbeiro, no balcão.
 *
 * A rota é separada da pública porque dispensa o pré-pagamento por Pix — não
 * se cobra sinal de quem já está na cadeira. O risco dessa dispensa é achar
 * que ela dispensa tudo: conflito e bloqueio continuam valendo, e é isso que
 * estes testes seguram. O barbeiro pode furar a fila, não a física.
 */

/** Amanhã, no formato da API. */
function amanha(): string {
  const d = new Date(Date.now() + 86_400_000 - 3 * 3_600_000);
  return d.toISOString().slice(0, 10);
}

test.describe("Agendamento interno", () => {
  let loja: Loja;
  const CLIENTES = ["11977770001", "11977770002"];

  test.beforeAll(async ({ request }) => {
    loja = await criarLoja(request);
  });

  test.afterAll(async () => {
    await db().recurringBlock.deleteMany({ where: { shopId: loja.shopId } });
    await apagarLoja(loja);
    await apagarClientes(CLIENTES);
    await fecharDb();
  });

  const marcar = (request: import("@playwright/test").APIRequestContext, extra: Record<string, unknown>) =>
    request.post(`${BASE}/api/me/agendamentos`, {
      headers: loja.auth,
      data: {
        clientName: "Marcos",
        clientPhone: CLIENTES[0],
        serviceIds: [loja.servicoId],
        date: amanha(),
        startTime: "15:00",
        ...extra,
      },
    });

  test("o barbeiro marca direto, sem passar pelo link", async ({ request }) => {
    const r = await marcar(request, {});
    expect(r.status()).toBe(200);
    const d = await r.json();
    expect(d.agendamento.startTime).toBe("15:00");
    // O fim sai da duração dos serviços, não de um palpite do formulário.
    expect(d.agendamento.endTime).toBe("15:30");
  });

  test("não marca por cima de um atendimento que já existe", async ({ request }) => {
    const r = await marcar(request, { clientPhone: CLIENTES[1], clientName: "Outro", startTime: "15:15" });
    expect(r.status()).toBe(409);
  });

  test("não fura o próprio bloqueio recorrente", async ({ request }) => {
    const regra = await request.post(`${BASE}/api/me/blocked-slots/recorrentes`, {
      headers: loja.auth,
      data: { horaInicio: "12:00", horaFim: "13:00", diasSemana: [0, 1, 2, 3, 4, 5, 6] },
    });
    expect(regra.status()).toBe(200);

    // 11:45 + 30 min = 12:15, ATRAVESSANDO o almoço — o caso que passava
    // batido quando o bloqueio era comparado só com o início da vaga.
    const r = await marcar(request, {
      clientPhone: CLIENTES[1], clientName: "Outro", startTime: "11:45",
    });
    expect(r.status()).toBe(409);
  });

  test("encostar no começo do bloqueio continua valendo", async ({ request }) => {
    // 11:30 + 30 min = 12:00 exatos. Barrar isto seria perder um corte por dia
    // em toda barbearia que fecha para almoço.
    const r = await marcar(request, {
      clientPhone: CLIENTES[1], clientName: "Encosta", startTime: "11:30",
    });
    expect(r.status()).toBe(200);
  });

  test("serviço de outra barbearia é recusado", async ({ request }) => {
    const outra = await criarLoja(request);
    try {
      const r = await marcar(request, {
        clientPhone: CLIENTES[1], clientName: "Outro",
        startTime: "16:00", serviceIds: [outra.servicoId],
      });
      expect(r.status()).toBe(400);
    } finally {
      await apagarLoja(outra);
    }
  });

  test("sem token não marca nada", async ({ request }) => {
    const r = await request.post(`${BASE}/api/me/agendamentos`, {
      data: {
        clientName: "Invasor", clientPhone: "11999990000",
        serviceIds: [loja.servicoId], date: amanha(), startTime: "17:00",
      },
    });
    expect([401, 402]).toContain(r.status());
  });

  test("dados incompletos voltam com a mensagem, não com 500", async ({ request }) => {
    const r = await marcar(request, { serviceIds: [] });
    expect(r.status()).toBe(400);
    expect((await r.json()).error).toContain("serviço");
  });
});
