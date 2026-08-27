import { test, expect } from "@playwright/test";
import {
  BASE, criarLoja, apagarLoja, apagarClientes, fecharDb,
  envelhecerAssinatura, emDias, diaISO, type Loja,
} from "./_ajudantes";

/**
 * Ciclo de vida da assinatura e o que ela libera ou tranca.
 *
 * A parte perigosa não é bloquear — é bloquear DEMAIS. Um barbeiro que perde
 * o acesso à própria agenda no meio do expediente, com cliente na cadeira,
 * cancela a assinatura no mesmo dia. Estes testes existem para garantir que
 * o bloqueio pare exatamente onde deve parar.
 */

test.describe("Assinatura", () => {
  let loja: Loja;

  test.beforeEach(async ({ request }) => {
    loja = await criarLoja(request);
  });

  test.afterEach(async () => {
    await apagarLoja(loja);
    await fecharDb();
  });

  const situacao = async (request: import("@playwright/test").APIRequestContext) => {
    const r = await request.get(`${BASE}/api/me/assinatura`, { headers: loja.auth });
    expect(r.ok()).toBeTruthy();
    return (await r.json()).situacao;
  };

  const criarServico = (request: import("@playwright/test").APIRequestContext) =>
    request.post(`${BASE}/api/me/services`, {
      headers: loja.auth,
      data: { name: "Teste " + Date.now(), duration: 30, price: 50, category: "corte" },
    });

  test("barbearia nova nasce em teste grátis de 14 dias", async ({ request }) => {
    const s = await situacao(request);
    expect(s.estado).toBe("trial");
    expect(s.diasRestantes).toBeGreaterThanOrEqual(13);
    expect(s.diasRestantes).toBeLessThanOrEqual(14);
    expect(s.podeEscrever).toBe(true);
    expect(s.aceitaAgendamento).toBe(true);
  });

  test("vencido ainda funciona durante a carência", async ({ request }) => {
    await envelhecerAssinatura(loja, { trialEndsAt: emDias(-20), periodoFim: emDias(-2) });
    const s = await situacao(request);
    expect(s.estado).toBe("carencia");
    expect(s.podeEscrever).toBe(true);
    expect(s.aceitaAgendamento).toBe(true);
    expect((await criarServico(request)).status()).toBe(200);
  });

  test("passada a carência, escrever devolve 402", async ({ request }) => {
    await envelhecerAssinatura(loja, { trialEndsAt: emDias(-30), periodoFim: emDias(-10) });
    const s = await situacao(request);
    expect(s.estado).toBe("bloqueada");
    expect(s.podeEscrever).toBe(false);

    const r = await criarServico(request);
    // 402 e não 401: é falta de pagamento, não de permissão — o painel
    // usa essa diferença para abrir a assinatura em vez do login.
    expect(r.status()).toBe(402);

    const prod = await request.post(`${BASE}/api/me/products`, {
      headers: loja.auth, data: { name: "X", price: 9 },
    });
    expect(prod.status()).toBe(402);
  });

  test("bloqueada ainda deixa ver a agenda e confirmar pagamento", async ({ request }) => {
    await envelhecerAssinatura(loja, { trialEndsAt: emDias(-30), periodoFim: emDias(-10) });

    const agenda = await request.get(`${BASE}/api/me/appointments`, { headers: loja.auth });
    expect(agenda.ok()).toBeTruthy();

    const rel = await request.get(`${BASE}/api/me/finance?start=${diaISO(-30)}&end=${diaISO(0)}`, { headers: loja.auth });
    expect(rel.ok()).toBeTruthy();

    const receber = await request.get(`${BASE}/api/me/a-receber`, { headers: loja.auth });
    expect(receber.ok()).toBeTruthy();
  });

  test("bloqueada fecha o link público sem expor o motivo", async ({ request }) => {
    await envelhecerAssinatura(loja, { trialEndsAt: emDias(-30), periodoFim: emDias(-10) });

    const publica = await request.get(`${BASE}/api/shops/${loja.slug}`);
    const { shop } = await publica.json();
    expect(shop.aceitaAgendamento).toBe(false);

    const tentativa = await request.post(`${BASE}/api/appointments`, {
      data: {
        shopId: loja.shopId, barberId: loja.barbeiroDonoId,
        clientName: "Cliente", clientPhone: "11922220001",
        serviceIds: [loja.servicoId], date: diaISO(1), startTime: "10:00",
      },
    });
    expect(tentativa.status()).toBe(503);
    const corpo = await tentativa.json();
    // O cliente não pode ficar sabendo que o dono deixou de pagar
    expect(corpo.error.toLowerCase()).not.toContain("assinatura");
    expect(corpo.error.toLowerCase()).not.toContain("pagamento");
    await apagarClientes(["11922220001"]);
  });

  test("voltar a pagar destrava na hora", async ({ request }) => {
    await envelhecerAssinatura(loja, { trialEndsAt: emDias(-30), periodoFim: emDias(-10) });
    expect((await criarServico(request)).status()).toBe(402);

    await envelhecerAssinatura(loja, { periodoFim: emDias(30), status: "ativa", canceladaEm: null });
    const s = await situacao(request);
    expect(s.estado).toBe("ativa");
    expect((await criarServico(request)).status()).toBe(200);
  });

  test("trocar de plano recalcula o valor do ciclo", async ({ request }) => {
    const r = await request.patch(`${BASE}/api/me/assinatura`, {
      headers: loja.auth, data: { plano: "anual" },
    });
    expect(r.ok()).toBeTruthy();
    const s = await situacao(request);
    expect(s.plano).toBe("anual");
    // 49,90 x 12
    expect(s.valorCiclo).toBeCloseTo(598.8, 2);
  });

  test("cancelar não corta o acesso já pago", async ({ request }) => {
    await envelhecerAssinatura(loja, { trialEndsAt: emDias(-1), periodoFim: emDias(20) });
    const r = await request.patch(`${BASE}/api/me/assinatura`, {
      headers: loja.auth, data: { cancelar: true },
    });
    expect(r.ok()).toBeTruthy();

    const s = await situacao(request);
    expect(s.podeEscrever).toBe(true);
    expect((await criarServico(request)).status()).toBe(200);
  });

  test("barbeiro contratado não mexe na assinatura", async ({ request }) => {
    await request.post(`${BASE}/api/auth/add-barber`, {
      headers: loja.auth,
      data: { name: "Func", phone: "11944441001", password: "senha123" },
    });
    const login = await request.post(`${BASE}/api/auth/login`, {
      data: { phone: "11944441001", password: "senha123" },
    });
    const { token } = await login.json();

    const r = await request.patch(`${BASE}/api/me/assinatura`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      data: { plano: "anual" },
    });
    expect(r.status()).toBe(401);
  });
});
