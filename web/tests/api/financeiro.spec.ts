import { test, expect } from "@playwright/test";
import {
  BASE, criarLoja, apagarLoja, apagarClientes, fecharDb,
  semearAtendimento, diaISO, db, type Loja,
} from "./_ajudantes";

/**
 * Regras de dinheiro.
 *
 * São as que mais doem quando quebram: um erro aqui não dá tela branca, dá
 * número errado — e o barbeiro só descobre quando paga comissão a mais ou
 * cobra um cliente que já tinha pago.
 */

test.describe("Relatório financeiro", () => {
  let loja: Loja;
  let carlosId: string;
  const CLIENTES = ["11933330001", "11933330002", "11933330003", "11933330004"];

  test.beforeAll(async ({ request }) => {
    loja = await criarLoja(request);

    // Carlos ganha 40% de comissão
    const r = await request.post(`${BASE}/api/auth/add-barber`, {
      headers: loja.auth,
      data: { name: "Carlos", phone: "11944440001", password: "senha123", commission: 40 },
    });
    carlosId = (await r.json()).barber.id;

    // Cenário: dono faturou 80 pago, Carlos 90 pago + 60 em aberto
    await semearAtendimento(loja, { clienteNome: "Ana", clienteTelefone: CLIENTES[0], diasAtras: 1, preco: 40, pago: "pix" });
    await semearAtendimento(loja, { clienteNome: "Duda", clienteTelefone: CLIENTES[1], diasAtras: 2, preco: 40, pago: "cartao" });
    await semearAtendimento(loja, { clienteNome: "Bruno", clienteTelefone: CLIENTES[2], diasAtras: 3, preco: 40, pago: "pix", barbeiroId: carlosId });
    await semearAtendimento(loja, { clienteNome: "Caio", clienteTelefone: CLIENTES[3], diasAtras: 4, preco: 50, pago: "dinheiro", barbeiroId: carlosId });
    await semearAtendimento(loja, { clienteNome: "Elis", clienteTelefone: CLIENTES[0], diasAtras: 5, preco: 60, pago: false, barbeiroId: carlosId });
  });

  test.afterAll(async () => {
    await apagarLoja(loja);
    await apagarClientes([...CLIENTES, "11944440001"]);
    await fecharDb();
  });

  const relatorio = async (request: import("@playwright/test").APIRequestContext, extra = "") => {
    const r = await request.get(`${BASE}/api/me/finance?start=${diaISO(-30)}&end=${diaISO(0)}${extra}`, { headers: loja.auth });
    expect(r.ok()).toBeTruthy();
    return r.json();
  };

  test("formas de pagamento somam exatamente o total recebido", async ({ request }) => {
    const { summary } = await relatorio(request);
    const soma = Object.values(summary.paymentCounts as Record<string, { total: number }>)
      .reduce((t, v) => t + v.total, 0);
    expect(soma).toBeCloseTo(summary.totalPaid, 2);
    expect(summary.totalPaid).toBeCloseTo(170, 2);
  });

  test("o total é serviços mais produtos, sem contar o que não foi pago", async ({ request }) => {
    const { summary } = await relatorio(request);
    expect(summary.totalRevenue).toBeCloseTo(summary.totalPaid + summary.comandaTotal, 2);
    // Os 60 da Elis estão em aberto e não podem entrar no faturamento
    expect(summary.totalUnpaid).toBeCloseTo(60, 2);
    expect(summary.totalRevenue).toBeCloseTo(170, 2);
  });

  test("comissão incide só sobre atendimento já pago", async ({ request }) => {
    const { summary } = await relatorio(request);
    const carlos = summary.barberBreakdown.find((b: { name: string }) => b.name === "Carlos");
    expect(carlos).toBeTruthy();
    // 40 + 50 pagos = 90. Os 60 em aberto ficam de fora.
    expect(carlos.revenue).toBeCloseTo(90, 2);
    expect(carlos.commissionValue).toBeCloseTo(36, 2);
  });

  test("filtro por barbeiro devolve só os atendimentos dele", async ({ request }) => {
    const { summary } = await relatorio(request, `&barberId=${carlosId}`);
    expect(summary.totalAppointments).toBe(3);
  });

  test("barbeiro contratado não enxerga o caixa da casa", async ({ request }) => {
    const login = await request.post(`${BASE}/api/auth/login`, {
      data: { phone: "11944440001", password: "senha123" },
    });
    const { token } = await login.json();
    const r = await request.get(`${BASE}/api/me/finance?start=${diaISO(-30)}&end=${diaISO(0)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { summary } = await r.json();
    // Vê os 3 dele, nunca os 5 da barbearia
    expect(summary.totalAppointments).toBe(3);
  });

  test("período sem movimento devolve zero em vez de quebrar", async ({ request }) => {
    const r = await request.get(`${BASE}/api/me/finance?start=2019-01-01&end=2019-01-31`, { headers: loja.auth });
    expect(r.ok()).toBeTruthy();
    const { summary } = await r.json();
    expect(summary.totalAppointments).toBe(0);
    expect(summary.totalRevenue).toBe(0);
  });
});

test.describe("A receber", () => {
  let loja: Loja;
  const CLIENTES = ["11933331001", "11933331002", "11933331003", "11933331004"];

  test.beforeAll(async ({ request }) => {
    loja = await criarLoja(request);
    // Zeca deve três, um com promessa já vencida
    await semearAtendimento(loja, { clienteNome: "Zeca", clienteTelefone: CLIENTES[0], diasAtras: 90, preco: 40, prometidoEmDias: -60 });
    await semearAtendimento(loja, { clienteNome: "Zeca", clienteTelefone: CLIENTES[0], diasAtras: 45, preco: 40 });
    await semearAtendimento(loja, { clienteNome: "Zeca", clienteTelefone: CLIENTES[0], diasAtras: 10, preco: 50 });
    await semearAtendimento(loja, { clienteNome: "Ana", clienteTelefone: CLIENTES[1], diasAtras: 5, preco: 40 });
    await semearAtendimento(loja, { clienteNome: "Pagou", clienteTelefone: CLIENTES[2], diasAtras: 3, preco: 40, pago: true });
    await semearAtendimento(loja, { clienteNome: "Cancelou", clienteTelefone: CLIENTES[3], diasAtras: 7, preco: 40, status: "cancelled" });
    await semearAtendimento(loja, { clienteNome: "Faltou", clienteTelefone: CLIENTES[3], diasAtras: 8, preco: 40, status: "no_show" });
  });

  test.afterAll(async () => {
    await apagarLoja(loja);
    await apagarClientes(CLIENTES);
    await fecharDb();
  });

  test("soma só o que é dívida de verdade", async ({ request }) => {
    const r = await request.get(`${BASE}/api/me/a-receber`, { headers: loja.auth });
    const d = await r.json();
    // 40 + 40 + 50 + 40 = 170. Pago, cancelado e falta ficam fora.
    expect(d.total).toBeCloseTo(170, 2);
    expect(d.quantidade).toBe(4);
  });

  test("cancelado e falta não são dívida", async ({ request }) => {
    const r = await request.get(`${BASE}/api/me/a-receber`, { headers: loja.auth });
    const d = await r.json();
    const nomes = d.itens.map((i: { client: { name: string } }) => i.client.name);
    expect(nomes).not.toContain("Cancelou");
    expect(nomes).not.toContain("Faltou");
    expect(nomes).not.toContain("Pagou");
  });

  test("agenda futura não conta como dívida", async ({ request }) => {
    // Um horário marcado para daqui a dias não é dinheiro devido
    await db().appointment.create({
      data: {
        shopId: loja.shopId, barberId: loja.barbeiroDonoId,
        clientId: (await db().client.findFirstOrThrow({ where: { phone: CLIENTES[1] } })).id,
        date: new Date(diaISO(7) + "T00:00:00Z"), startTime: "10:00", endTime: "10:30",
        totalDuration: 30, totalPrice: 999, status: "confirmed",
      },
    });
    const r = await request.get(`${BASE}/api/me/a-receber`, { headers: loja.auth });
    const d = await r.json();
    expect(d.total).toBeCloseTo(170, 2);
  });

  test("agrupa por cliente e põe promessa furada na frente", async ({ request }) => {
    const r = await request.get(`${BASE}/api/me/a-receber`, { headers: loja.auth });
    const d = await r.json();
    const zeca = d.clientes.find((c: { name: string }) => c.name === "Zeca");
    expect(zeca.qtd).toBe(3);
    expect(zeca.total).toBeCloseTo(130, 2);
    expect(d.clientes[0].name).toBe("Zeca");
    expect(d.clientes[0].temPromessaVencida).toBe(true);
  });

  test("dar baixa tira o valor da lista", async ({ request }) => {
    const antes = await (await request.get(`${BASE}/api/me/a-receber`, { headers: loja.auth })).json();
    const alvo = antes.itens[0];

    const pago = await request.patch(`${BASE}/api/me/finance`, {
      headers: loja.auth,
      data: { appointmentId: alvo.id, paymentMethod: "dinheiro" },
    });
    expect(pago.ok()).toBeTruthy();

    const depois = await (await request.get(`${BASE}/api/me/a-receber`, { headers: loja.auth })).json();
    expect(depois.total).toBeCloseTo(antes.total - alvo.total, 2);
  });
});
