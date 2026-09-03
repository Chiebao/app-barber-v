import { test, expect } from "@playwright/test";
import { BASE, criarLoja, apagarLoja, apagarClientes, fecharDb, db, type Loja } from "./_ajudantes";

/**
 * Corte fixo contra o horário do DIA.
 *
 * O bug que originou este arquivo: a barbearia abre 09:00 na quarta e 10:00
 * no resto da semana. O dono configurou isso dia a dia, o banco gravou certo,
 * e mesmo assim marcar o corte fixo das 09:00 na quarta era recusado com
 * "não cabe no expediente (10:00–17:00)" — o horário único da loja, que
 * ninguém tinha trocado.
 *
 * A regra recorrente não tem data, tem "toda quarta", e era o único caminho
 * do sistema que continuava perguntando o horário à loja em vez de ao dia.
 */

/** Uma quarta-feira à frente, que é o dia que o teste configura diferente. */
function proximaQuarta(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((3 - d.getUTCDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

const QUARTA = 3;

test.describe("Corte fixo respeita o expediente do dia", () => {
  let loja: Loja;
  const CLIENTES = ["11966660001", "11966660002", "11966660003", "11966660004"];

  test.beforeAll(async ({ request }) => {
    // Loja com o horário geral 10:00–17:00, igual ao caso real.
    loja = await criarLoja(request, { abre: "10:00", fecha: "17:00" });

    // Quarta abre mais cedo e tem almoço; o resto segue o horário geral.
    const dias = [0, 1, 2, 3, 4, 5, 6].map((dia) =>
      dia === QUARTA
        ? { dia, aberto: true, abre: "09:00", fecha: "18:00", almocoInicio: "12:00", almocoFim: "13:00" }
        : { dia, aberto: true, abre: "10:00", fecha: "17:00", almocoInicio: null, almocoFim: null },
    );
    const r = await request.put(`${BASE}/api/me/expediente`, { headers: loja.auth, data: { dias } });
    expect(r.status(), "configurar o expediente").toBe(200);
  });

  test.afterAll(async () => {
    await db().recurringAppointment.deleteMany({ where: { shopId: loja.shopId } });
    await apagarLoja(loja);
    await apagarClientes(CLIENTES);
    await fecharDb();
  });

  const fixar = (
    request: import("@playwright/test").APIRequestContext,
    extra: Record<string, unknown>,
  ) =>
    request.post(`${BASE}/api/me/recurring`, {
      headers: loja.auth,
      data: {
        clientName: "Cliente Fixo",
        clientPhone: CLIENTES[0],
        serviceIds: [loja.servicoId],
        weekday: QUARTA,
        startTime: "09:00",
        startDate: proximaQuarta(),
        endDate: proximaQuarta(),
        ...extra,
      },
    });

  test("as 09:00 da quarta são aceitas, mesmo com a loja abrindo 10:00", async ({ request }) => {
    // Este é o teste do bug. Antes da correção vinha 400 com a mensagem
    // "não cabe no expediente (10:00–17:00)".
    const r = await fixar(request, {});
    expect(r.status(), await r.text()).toBe(200);
  });

  test("antes de abrir continua recusado, pelo horário da quarta", async ({ request }) => {
    const r = await fixar(request, { clientPhone: CLIENTES[1], startTime: "08:00" });
    expect(r.status()).toBe(400);
    // A mensagem tem que citar o horário do DIA, senão o dono vai procurar
    // o erro na configuração errada.
    expect((await r.json()).error).toContain("09:00");
  });

  test("o corte que atravessa o almoço é recusado", async ({ request }) => {
    // 11:45 + 30 min termina 12:15, dentro da parada das 12:00. O corte que
    // ATRAVESSA invade tanto quanto o que começa dentro.
    const r = await fixar(request, { clientPhone: CLIENTES[2], startTime: "11:45" });
    expect(r.status()).toBe(400);
    expect((await r.json()).error).toContain("intervalo");
  });

  test("o dia fechado recusa, mesmo com hora válida", async ({ request }) => {
    const dias = [{ dia: QUARTA, aberto: false, abre: "09:00", fecha: "18:00" }];
    const p = await request.put(`${BASE}/api/me/expediente`, { headers: loja.auth, data: { dias } });
    expect(p.status()).toBe(200);

    const r = await fixar(request, { clientPhone: CLIENTES[3], startTime: "09:00" });
    expect(r.status()).toBe(400);
    expect((await r.json()).error).toContain("não abre");
  });
});
