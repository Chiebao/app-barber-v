import { test, expect } from "@playwright/test";
import {
  BASE, criarLoja, apagarLoja, apagarClientes, fecharDb,
  diaISO, db, type Loja,
} from "./_ajudantes";

/**
 * Isolamento entre barbearias e banimento de cliente.
 *
 * Isolamento é a regra que, quando falha, não dá erro: dá acesso. O dono de
 * uma barbearia editando o catálogo de outra não vê mensagem nenhuma — só
 * funciona. Por isso cada rota que escreve precisa de um teste que tente o
 * ataque de propósito.
 */

test.describe("Isolamento entre barbearias", () => {
  let lojaA: Loja;
  let lojaB: Loja;

  test.beforeAll(async ({ request }) => {
    lojaA = await criarLoja(request);
    lojaB = await criarLoja(request);
  });

  test.afterAll(async () => {
    await apagarLoja(lojaA);
    await apagarLoja(lojaB);
    await fecharDb();
  });

  test("não edita serviço de outra barbearia", async ({ request }) => {
    const r = await request.patch(`${BASE}/api/me/services`, {
      headers: lojaA.auth,
      data: { id: lojaB.servicoId, name: "INVADIDO", price: 1 },
    });
    expect(r.status()).toBe(404);

    const intacto = await db().service.findUniqueOrThrow({ where: { id: lojaB.servicoId } });
    expect(intacto.name).toBe("Corte");
    expect(Number(intacto.price)).toBeCloseTo(40, 2);
  });

  test("não apaga serviço de outra barbearia", async ({ request }) => {
    const r = await request.delete(`${BASE}/api/me/services`, {
      headers: lojaA.auth,
      data: { id: lojaB.servicoId },
    });
    expect(r.status()).toBe(404);
    expect(await db().service.findUnique({ where: { id: lojaB.servicoId } })).toBeTruthy();
  });

  test("não move produto entre barbearias mandando shopId", async ({ request }) => {
    const criado = await request.post(`${BASE}/api/me/products`, {
      headers: lojaA.auth, data: { name: "Pomada", price: 30 },
    });
    const { product } = await criado.json();

    await request.patch(`${BASE}/api/me/products`, {
      headers: lojaA.auth,
      data: { id: product.id, shopId: lojaB.shopId },
    });

    const depois = await db().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(depois.shopId).toBe(lojaA.shopId);
  });

  test("não edita barbeiro de outra barbearia", async ({ request }) => {
    const r = await request.patch(`${BASE}/api/auth/add-barber`, {
      headers: lojaA.auth,
      data: { barberId: lojaB.barbeiroDonoId, name: "INVADIDO", imageUrl: "hack" },
    });
    expect(r.status()).toBe(404);

    const intacto = await db().barber.findUniqueOrThrow({ where: { id: lojaB.barbeiroDonoId } });
    expect(intacto.name).not.toBe("INVADIDO");
    expect(intacto.imageUrl).toBeNull();
  });

  test("o dono não consegue desativar o próprio perfil de barbeiro", async ({ request }) => {
    const r = await request.patch(`${BASE}/api/auth/add-barber`, {
      headers: lojaA.auth,
      data: { barberId: lojaA.barbeiroDonoId, active: false },
    });
    // Desativar tiraria ele da própria agenda e da tela do cliente
    expect(r.status()).toBe(400);
    const ainda = await db().barber.findUniqueOrThrow({ where: { id: lojaA.barbeiroDonoId } });
    expect(ainda.active).toBe(true);
  });
});

test.describe("Banimento de cliente", () => {
  let lojaA: Loja;
  let lojaB: Loja;
  const CLIENTE = "11955550001";

  test.beforeAll(async ({ request }) => {
    lojaA = await criarLoja(request);
    lojaB = await criarLoja(request);
  });

  test.afterAll(async () => {
    await apagarLoja(lojaA);
    await apagarLoja(lojaB);
    await apagarClientes([CLIENTE]);
    await fecharDb();
  });

  const agendar = (
    request: import("@playwright/test").APIRequestContext,
    loja: Loja,
    hora: string,
  ) =>
    request.post(`${BASE}/api/appointments`, {
      data: {
        shopId: loja.shopId, barberId: loja.barbeiroDonoId,
        clientName: "Cliente Chato", clientPhone: CLIENTE,
        serviceIds: [loja.servicoId], date: diaISO(1), startTime: hora,
      },
    });

  test("agenda normalmente antes do banimento", async ({ request }) => {
    const r = await agendar(request, lojaA, "09:00");
    expect(r.ok()).toBeTruthy();
  });

  test("banir cancela o futuro e preserva o passado", async ({ request }) => {
    const r = await request.post(`${BASE}/api/me/banned-clients`, {
      headers: lojaA.auth, data: { phone: CLIENTE, reason: "não pagou" },
    });
    expect(r.ok()).toBeTruthy();
    const d = await r.json();
    expect(d.agendamentosCancelados).toBeGreaterThan(0);

    // O atendimento continua existindo, só mudou de status — senão o
    // faturamento do mês mudaria sozinho ao banir alguém.
    const total = await db().appointment.count({ where: { shopId: lojaA.shopId, client: { phone: CLIENTE } } });
    expect(total).toBeGreaterThan(0);
  });

  test("banido não agenda nem entra na lista de espera", async ({ request }) => {
    const ag = await agendar(request, lojaA, "11:00");
    expect(ag.status()).toBe(403);

    const espera = await request.post(`${BASE}/api/waitlist`, {
      data: {
        shopId: lojaA.shopId, clientName: "Cliente Chato", clientPhone: CLIENTE,
        serviceIds: [lojaA.servicoId], preferredDate: diaISO(1),
      },
    });
    // Sem isto o banido entrava pela porta dos fundos e ainda era avisado
    // quando abrisse vaga
    expect(espera.status()).toBe(403);
  });

  test("banimento vale só na barbearia que baniu", async ({ request }) => {
    const r = await agendar(request, lojaB, "09:00");
    expect(r.ok()).toBeTruthy();

    const naOutra = await db().bannedClient.findFirst({
      where: { shopId: lojaB.shopId, phone: CLIENTE },
    });
    expect(naOutra).toBeNull();
  });

  test("barbeiro contratado não bane", async ({ request }) => {
    await request.post(`${BASE}/api/auth/add-barber`, {
      headers: lojaA.auth,
      data: { name: "Func", phone: "11944442001", password: "senha123" },
    });
    const login = await request.post(`${BASE}/api/auth/login`, {
      data: { phone: "11944442001", password: "senha123" },
    });
    const { token } = await login.json();

    const r = await request.post(`${BASE}/api/me/banned-clients`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      data: { phone: "11999990000" },
    });
    expect(r.status()).toBe(401);
  });

  test("liberar devolve o direito de agendar", async ({ request }) => {
    const r = await request.delete(`${BASE}/api/me/banned-clients`, {
      headers: lojaA.auth, data: { phone: CLIENTE },
    });
    expect(r.ok()).toBeTruthy();

    const ag = await agendar(request, lojaA, "14:00");
    expect(ag.ok()).toBeTruthy();
  });
});

test.describe("Integridade do histórico", () => {
  let loja: Loja;
  const CLIENTE = "11955551001";

  test.beforeAll(async ({ request }) => { loja = await criarLoja(request); });
  test.afterAll(async () => {
    await apagarLoja(loja);
    await apagarClientes([CLIENTE]);
    await fecharDb();
  });

  test("serviço nunca usado pode ser apagado", async ({ request }) => {
    const criado = await request.post(`${BASE}/api/me/services`, {
      headers: loja.auth, data: { name: "Nunca usado", duration: 15, price: 10, category: "corte" },
    });
    const { service } = await criado.json();

    const r = await request.delete(`${BASE}/api/me/services`, {
      headers: loja.auth, data: { id: service.id },
    });
    expect(r.ok()).toBeTruthy();
    expect(await db().service.findUnique({ where: { id: service.id } })).toBeNull();
  });

  test("serviço já usado é recusado com 409 e o histórico fica intacto", async ({ request }) => {
    const ag = await request.post(`${BASE}/api/appointments`, {
      data: {
        shopId: loja.shopId, barberId: loja.barbeiroDonoId,
        clientName: "Cliente", clientPhone: CLIENTE,
        serviceIds: [loja.servicoId], date: diaISO(2), startTime: "15:00",
      },
    });
    expect(ag.ok()).toBeTruthy();

    const r = await request.delete(`${BASE}/api/me/services`, {
      headers: loja.auth, data: { id: loja.servicoId },
    });
    expect(r.status()).toBe(409);

    const corpo = await r.json();
    expect(corpo.podeDesativar).toBe(true);
    // A relação cascateia: se o delete passasse, o atendimento ficaria com
    // um total e nenhum serviço dentro.
    expect(await db().appointmentService.count({ where: { serviceId: loja.servicoId } })).toBeGreaterThan(0);
  });

  test("produto já vendido também é protegido", async ({ request }) => {
    const criado = await request.post(`${BASE}/api/me/products`, {
      headers: loja.auth, data: { name: "Pomada", price: 25 },
    });
    const { product } = await criado.json();

    const apt = await db().appointment.findFirstOrThrow({ where: { shopId: loja.shopId } });
    await db().comandaItem.create({
      data: { appointmentId: apt.id, productId: product.id, quantity: 1, price: 25 },
    });

    const r = await request.delete(`${BASE}/api/me/products`, {
      headers: loja.auth, data: { id: product.id },
    });
    expect(r.status()).toBe(409);
    expect(await db().product.findUnique({ where: { id: product.id } })).toBeTruthy();
  });
});
