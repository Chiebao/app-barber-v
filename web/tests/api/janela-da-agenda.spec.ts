import { test, expect } from "@playwright/test";
import { BASE, criarLoja, apagarLoja, fecharDb, db, type Loja } from "./_ajudantes";

/**
 * A trava da janela mora no SERVIDOR.
 *
 * A lista de datas na tela do cliente é conveniência. Quem posta direto na
 * API nunca viu lista nenhuma — e sem esta checagem marcaria para daqui a
 * seis meses numa barbearia que abriu só uma semana.
 */

const emDias = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

test.describe("Janela da agenda", () => {
  let loja: Loja;

  test.beforeAll(async ({ request }) => {
    loja = await criarLoja(request, { dias: [0, 1, 2, 3, 4, 5, 6] });
    await db().shop.update({ where: { id: loja.shopId }, data: { diasAbertos: 7 } });
  });

  test.afterAll(async () => {
    await apagarLoja(loja);
    await fecharDb();
  });

  test("horários somem depois do limite, com o motivo na resposta", async ({ request }) => {
    const dentro = await request.get(
      `${BASE}/api/shops/${loja.slug}/slots?date=${emDias(5)}&duration=30`);
    expect((await dentro.json()).slots.length).toBeGreaterThan(0);

    const fora = await request.get(
      `${BASE}/api/shops/${loja.slug}/slots?date=${emDias(20)}&duration=30`);
    const corpo = await fora.json();
    expect(corpo.slots).toEqual([]);
    // Sem o motivo o cliente vê "sem horário" e acha que a agenda encheu.
    expect(corpo.message).toContain("abre a agenda até");
  });

  test("agendar fora da janela é recusado, mesmo postando direto", async ({ request }) => {
    const servicos = await db().service.findMany({ where: { shopId: loja.shopId }, take: 1 });
    const barbeiro = await db().barber.findFirst({ where: { shopId: loja.shopId } });

    const res = await request.post(`${BASE}/api/appointments`, {
      data: {
        shopId: loja.shopId,
        barberId: barbeiro!.id,
        clientName: "Cliente Afobado",
        clientPhone: "11" + String(Date.now()).slice(-9),
        serviceIds: [servicos[0].id],
        date: emDias(20),
        startTime: "10:00",
      },
    });

    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain("abre a agenda até");

    const criados = await db().appointment.count({ where: { shopId: loja.shopId } });
    expect(criados, "não podia ter gravado nada").toBe(0);
  });

  test("dentro da janela continua agendando normalmente", async ({ request }) => {
    const servicos = await db().service.findMany({ where: { shopId: loja.shopId }, take: 1 });
    const barbeiro = await db().barber.findFirst({ where: { shopId: loja.shopId } });

    const res = await request.post(`${BASE}/api/appointments`, {
      data: {
        shopId: loja.shopId,
        barberId: barbeiro!.id,
        clientName: "Cliente Certo",
        clientPhone: "11" + String(Date.now()).slice(-9),
        serviceIds: [servicos[0].id],
        date: emDias(3),
        startTime: "10:00",
      },
    });

    expect(res.status(), await res.text()).toBe(200);
  });

  test("o dono muda a janela, e só para 7, 15 ou 30", async ({ request }) => {
    const dono = await request.post(`${BASE}/api/auth/login`, {
      data: { phone: loja.telefone, password: loja.senha },
    });
    const token = (await dono.json()).token;

    const ok = await request.patch(`${BASE}/api/me/shop`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { diasAbertos: 15 },
    });
    expect(ok.status()).toBe(200);
    expect((await db().shop.findUnique({ where: { id: loja.shopId } }))!.diasAbertos).toBe(15);

    // Número fora da lista fecharia ou escancararia a agenda em silêncio.
    const recusado = await request.patch(`${BASE}/api/me/shop`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { diasAbertos: 365 },
    });
    expect(recusado.status()).toBe(400);
    expect((await db().shop.findUnique({ where: { id: loja.shopId } }))!.diasAbertos).toBe(15);
  });
});
