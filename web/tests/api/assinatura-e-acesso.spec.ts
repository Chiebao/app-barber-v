// A versao vem do app, nao de uma constante copiada: o teste ja quebrou uma
// vez porque os termos subiram para 2.1 e ele continuou exigindo 2.0.
import { VERSAO_TERMOS } from "../../src/app/lib/termos";
import { test, expect } from "@playwright/test";
import {
  BASE, criarLoja, apagarLoja, apagarClientes, fecharDb,
  envelhecerAssinatura, emDias, diaISO, telefoneDeTeste, type Loja,
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
    // 29,90 x 12
    expect(s.valorCiclo).toBeCloseTo(358.8, 2);
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

test.describe("Aceite dos termos", () => {
  const telefones: string[] = [];

  test.afterAll(async () => {
    const { db } = await import("./_ajudantes");
    if (telefones.length) await db().owner.deleteMany({ where: { phone: { in: telefones } } });
    await fecharDb();
  });

  test("cadastro sem aceitar os termos é recusado", async ({ request }) => {
    const tel = telefoneDeTeste();
    const r = await request.post(`${BASE}/api/auth/register`, {
      data: {
        ownerName: "Sem Aceite", shopName: "Sem Aceite " + Date.now(),
        phone: tel, password: "teste123456",
        openTime: "08:00", closeTime: "18:00", workDays: [1, 2, 3, 4, 5],
        avgServiceTime: 30,
        services: [{ name: "Corte", duration: 30, price: 40, category: "corte" }],
        // aceitouTermos ausente de propósito
      },
    });
    expect(r.status()).toBe(400);

    const { db } = await import("./_ajudantes");
    expect(await db().owner.findUnique({ where: { phone: tel } })).toBeNull();
  });

  test("aceitar false também é recusado", async ({ request }) => {
    const tel = telefoneDeTeste();
    const r = await request.post(`${BASE}/api/auth/register`, {
      data: {
        ownerName: "Recusou", shopName: "Recusou " + Date.now(),
        phone: tel, password: "teste123456",
        openTime: "08:00", closeTime: "18:00", workDays: [1, 2, 3, 4, 5],
        avgServiceTime: 30, aceitouTermos: false,
        services: [{ name: "Corte", duration: 30, price: 40, category: "corte" }],
      },
    });
    expect(r.status()).toBe(400);
  });

  test("aceite fica gravado com data e versão", async ({ request }) => {
    const loja = await criarLoja(request);
    const { db } = await import("./_ajudantes");
    const shop = await db().shop.findUniqueOrThrow({
      where: { id: loja.shopId },
      select: { owner: { select: { termsAcceptedAt: true, termsVersion: true } } },
    });
    // Checkbox sem registro não prova nada — o que vale é quando e qual versão
    expect(shop.owner.termsAcceptedAt).toBeTruthy();
    expect(shop.owner.termsVersion).toBe(VERSAO_TERMOS);
    await apagarLoja(loja);
  });
});

test.describe("Re-aceite dos termos", () => {
  let loja: Loja;

  test.beforeEach(async ({ request }) => { loja = await criarLoja(request); });
  test.afterEach(async () => { await apagarLoja(loja); await fecharDb(); });

  test("quem acabou de se cadastrar não precisa aceitar de novo", async ({ request }) => {
    const r = await request.get(`${BASE}/api/me/aceite`, { headers: loja.auth });
    const d = await r.json();
    expect(d.precisaAceitar).toBe(false);
    expect(d.versaoAceita).toBe(d.versaoVigente);
  });

  test("conta sem aceite é sinalizada como primeira vez", async ({ request }) => {
    const { db } = await import("./_ajudantes");
    const shop = await db().shop.findUniqueOrThrow({ where: { id: loja.shopId }, select: { ownerId: true } });
    await db().owner.update({
      where: { id: shop.ownerId },
      data: { termsAcceptedAt: null, termsVersion: null },
    });

    const d = await (await request.get(`${BASE}/api/me/aceite`, { headers: loja.auth })).json();
    expect(d.precisaAceitar).toBe(true);
    expect(d.primeiraVez).toBe(true);
  });

  test("versão antiga pede aceite novo, sem marcar como primeira vez", async ({ request }) => {
    const { db } = await import("./_ajudantes");
    const shop = await db().shop.findUniqueOrThrow({ where: { id: loja.shopId }, select: { ownerId: true } });
    await db().owner.update({
      where: { id: shop.ownerId },
      data: { termsVersion: "1.0", termsAcceptedAt: new Date("2026-05-20") },
    });

    const d = await (await request.get(`${BASE}/api/me/aceite`, { headers: loja.auth })).json();
    expect(d.precisaAceitar).toBe(true);
    expect(d.primeiraVez).toBe(false);
    expect(d.versaoAceita).toBe("1.0");
  });

  test("aceitar grava data e versão vigente", async ({ request }) => {
    const { db } = await import("./_ajudantes");
    const shop = await db().shop.findUniqueOrThrow({ where: { id: loja.shopId }, select: { ownerId: true } });
    await db().owner.update({ where: { id: shop.ownerId }, data: { termsAcceptedAt: null, termsVersion: null } });

    const r = await request.post(`${BASE}/api/me/aceite`, { headers: loja.auth, data: { versao: VERSAO_TERMOS } });
    expect(r.ok()).toBeTruthy();

    const dono = await db().owner.findUniqueOrThrow({ where: { id: shop.ownerId } });
    expect(dono.termsVersion).toBe(VERSAO_TERMOS);
    expect(dono.termsAcceptedAt).toBeTruthy();
  });

  test("aceitar uma versão que não é a vigente é recusado", async ({ request }) => {
    // Se o texto que a pessoa leu não é o que está no ar, o aceite não vale
    const r = await request.post(`${BASE}/api/me/aceite`, { headers: loja.auth, data: { versao: "1.0" } });
    expect(r.status()).toBe(409);
  });

  test("barbeiro contratado não precisa aceitar nem consegue", async ({ request }) => {
    await request.post(`${BASE}/api/auth/add-barber`, {
      headers: loja.auth,
      data: { name: "Func", phone: "11944443001", password: "senha123" },
    });
    const login = await request.post(`${BASE}/api/auth/login`, {
      data: { phone: "11944443001", password: "senha123" },
    });
    const { token } = await login.json();
    const auth = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    const consulta = await (await request.get(`${BASE}/api/me/aceite`, { headers: auth })).json();
    expect(consulta.precisaAceitar).toBe(false);

    const tentativa = await request.post(`${BASE}/api/me/aceite`, { headers: auth, data: { versao: "2.0" } });
    expect(tentativa.status()).toBe(401);
  });
});

test.describe("Intervalo da agenda", () => {
  test("60 minutos oferece hora cheia, 30 oferece meia em meia", async ({ request }) => {
    const loja = await criarLoja(request, { abre: "08:00", fecha: "12:00" });
    const { db } = await import("./_ajudantes");

    const slots = async () => {
      const r = await request.get(`${BASE}/api/shops/${loja.slug}/slots?date=${diaISO(1)}&duration=30`);
      return (await r.json()).slots as string[];
    };

    // Padrão: de 30 em 30
    expect(await slots()).toEqual(["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);

    const r = await request.patch(`${BASE}/api/me/shop`, { headers: loja.auth, data: { slotInterval: 60 } });
    expect(r.ok()).toBeTruthy();

    // Agora só hora cheia — é o que a barbearia de 1h por cliente quer
    expect(await slots()).toEqual(["08:00", "09:00", "10:00", "11:00"]);

    await db().$disconnect;
    await apagarLoja(loja);
    await fecharDb();
  });

  test("intervalo fora da lista é recusado", async ({ request }) => {
    const loja = await criarLoja(request);
    const r = await request.patch(`${BASE}/api/me/shop`, { headers: loja.auth, data: { slotInterval: 7 } });
    expect(r.status()).toBe(400);
    await apagarLoja(loja);
    await fecharDb();
  });
});

test.describe("Fatura é um contrato pelo plano dela", () => {
  let loja: Loja;

  test.beforeEach(async ({ request }) => { loja = await criarLoja(request); });
  test.afterEach(async () => { await apagarLoja(loja); await fecharDb(); });

  test("trocar de plano cancela a cobrança aberta do plano antigo", async ({ request }) => {
    const { db } = await import("./_ajudantes");

    // Gera no mensal
    const r1 = await request.post(`${BASE}/api/me/assinatura/cobranca`, { headers: loja.auth });
    expect(r1.ok()).toBeTruthy();
    const c1 = (await r1.json()).cobranca;
    expect(c1.valor).toBeCloseTo(45.9, 2);

    // Troca para anual
    const troca = await request.patch(`${BASE}/api/me/assinatura`, {
      headers: loja.auth, data: { plano: "anual" },
    });
    expect(troca.ok()).toBeTruthy();

    // A cobrança antiga não pode continuar viva: ela vale R$45,90 e o plano
    // agora entrega 12 meses
    const antiga = await db().subscriptionInvoice.findUniqueOrThrow({ where: { id: c1.id } });
    expect(antiga.status).toBe("cancelada");
  });

  test("a nova cobrança sai com o valor do plano novo", async ({ request }) => {
    await request.post(`${BASE}/api/me/assinatura/cobranca`, { headers: loja.auth });
    await request.patch(`${BASE}/api/me/assinatura`, { headers: loja.auth, data: { plano: "anual" } });

    const r = await request.post(`${BASE}/api/me/assinatura/cobranca`, { headers: loja.auth });
    expect(r.ok()).toBeTruthy();
    const c = (await r.json()).cobranca;
    // 29,90 x 12
    expect(c.valor).toBeCloseTo(358.8, 2);
    expect(c.reaproveitada).toBe(false);
  });

  test("pagar uma fatura do mensal avança um mês, mesmo com o plano já em anual", async ({ request }) => {
    const { db } = await import("./_ajudantes");

    const r1 = await request.post(`${BASE}/api/me/assinatura/cobranca`, { headers: loja.auth });
    const c1 = (await r1.json()).cobranca;
    const fatura = await db().subscriptionInvoice.findUniqueOrThrow({ where: { id: c1.id } });
    expect(fatura.plano).toBe("mensal");

    // Troca o plano DEPOIS de a fatura existir
    await request.patch(`${BASE}/api/me/assinatura`, { headers: loja.auth, data: { plano: "anual" } });

    // A fatura guarda o plano que ela cobrou — é isso que impede pagar
    // R$45,90 e receber doze meses
    const depois = await db().subscriptionInvoice.findUniqueOrThrow({ where: { id: c1.id } });
    expect(depois.plano).toBe("mensal");
    expect(Number(depois.valor)).toBeCloseTo(45.9, 2);
  });
});

test.describe("Desconto adiantado de plano com compromisso", () => {
  let loja: Loja;

  test.beforeEach(async ({ request }) => { loja = await criarLoja(request); });
  test.afterEach(async () => { await apagarLoja(loja); await fecharDb(); });

  const situacao = async (request: import("@playwright/test").APIRequestContext) =>
    (await (await request.get(`${BASE}/api/me/assinatura`, { headers: loja.auth })).json()).situacao;

  test("plano à vista não gera diferença — já pagou tudo adiantado", async ({ request }) => {
    const { db } = await import("./_ajudantes");
    await request.patch(`${BASE}/api/me/assinatura`, { headers: loja.auth, data: { plano: "anual" } });
    await db().subscription.update({
      where: { shopId: loja.shopId },
      data: { ciclosPagos: 1, trialEndsAt: emDias(-40), periodoFim: emDias(-20) },
    });
    const s = await situacao(request);
    expect(s.descontoAAcertar).toBe(0);
  });

  test("mensal puro nunca deve diferença", async ({ request }) => {
    const { db } = await import("./_ajudantes");
    await db().subscription.update({
      where: { shopId: loja.shopId },
      data: { ciclosPagos: 5, trialEndsAt: emDias(-40), periodoFim: emDias(-20) },
    });
    const s = await situacao(request);
    expect(s.estado).toBe("bloqueada");
    expect(s.descontoAAcertar).toBe(0);
  });

  test("NENHUM plano do catálogo pode gerar diferença", async ({ request }) => {
    // Esta é a guarda da decisão de out/2026: os quatro planos sao cobrados
    // pelo ciclo inteiro, entao ninguem leva desconto adiantado e ninguem
    // deve nada ao sair. `descontoAAcertar` continua no codigo so para o
    // caso de voltar um plano com `mesesCobranca: 1` e `compromisso > 1`.
    //
    // Se alguem adicionar um plano assim sem pensar, este teste cai — que e
    // exatamente o aviso que se quer.
    const { db } = await import("./_ajudantes");
    for (const plano of ["mensal", "trimestral", "semestral", "anual"]) {
      await request.patch(`${BASE}/api/me/assinatura`, { headers: loja.auth, data: { plano } });
      await db().subscription.update({
        where: { shopId: loja.shopId },
        // Saiu no meio do compromisso: o pior caso para a regra antiga.
        data: { ciclosPagos: 2, trialEndsAt: emDias(-400), periodoFim: emDias(-20) },
      });
      const s = await situacao(request);
      expect(s.descontoAAcertar, `${plano} nao pode dever diferenca`).toBe(0);
    }
  });

  test("a cobrança da volta é a mensalidade do plano, e só", async ({ request }) => {
    const { db } = await import("./_ajudantes");
    await request.patch(`${BASE}/api/me/assinatura`, { headers: loja.auth, data: { plano: "anual" } });
    await db().subscription.update({
      where: { shopId: loja.shopId },
      data: { ciclosPagos: 2, trialEndsAt: emDias(-40), periodoFim: emDias(-20) },
    });

    const r = await request.post(`${BASE}/api/me/assinatura/cobranca`, { headers: loja.auth });
    expect(r.ok()).toBeTruthy();
    const c = (await r.json()).cobranca;
    // Anual = 29,90 x 12 cobrado de uma vez.
    expect(c.mensalidade).toBeCloseTo(358.8, 2);
    expect(c.descontoAAcertar).toBe(0);
    expect(c.valor).toBeCloseTo(358.8, 2);
  });

  test("trocar de plano reinicia a contagem do compromisso", async ({ request }) => {
    const { db } = await import("./_ajudantes");
    await request.patch(`${BASE}/api/me/assinatura`, { headers: loja.auth, data: { plano: "anual" } });
    await db().subscription.update({ where: { shopId: loja.shopId }, data: { ciclosPagos: 6 } });

    await request.patch(`${BASE}/api/me/assinatura`, { headers: loja.auth, data: { plano: "mensal" } });
    const a = await db().subscription.findUniqueOrThrow({ where: { shopId: loja.shopId } });
    expect(a.ciclosPagos).toBe(0);
  });
});
