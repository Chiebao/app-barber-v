import { test, expect } from "@playwright/test";
import { BASE, criarLoja, apagarLoja, fecharDb, db, type Loja } from "./_ajudantes";
import { aplicarPagamento } from "../../src/app/lib/assinatura";

/**
 * Do WhatsApp ao pagamento, sem login.
 *
 * O link da mensagem cai em /pagar/{fatura}: o dono escolhe o plano e vai
 * direto ao checkout. O id da fatura e a chave — sem senha no caminho,
 * porque quem esqueceu a senha nunca pagaria.
 *
 * NAO chama o cron de cobranca: ele e global, e com uma barbearia real em
 * fim de teste mandaria WhatsApp de verdade para o dono dela.
 */

const ontem = () => new Date(Date.now() - 86_400_000);

test.describe("Pagar a assinatura pelo link", () => {
  let loja: Loja;
  let subId: string;
  let faturaId: string;

  test.beforeAll(async ({ request }) => {
    loja = await criarLoja(request);
    // Teste gratis que acabou ontem: e exatamente o dono que recebe o link.
    const sub = await db().subscription.update({
      where: { shopId: loja.shopId },
      data: { status: "trial", trialEndsAt: ontem(), periodoFim: ontem(), plano: "mensal", valorCiclo: 45.9 },
    });
    subId = sub.id;
    const f = await db().subscriptionInvoice.create({
      data: { subscriptionId: subId, valor: 45.9, plano: "mensal", status: "pendente", vencimento: new Date(), provedor: "infinitepay" },
    });
    faturaId = f.id;
  });

  test.afterAll(async () => {
    await apagarLoja(loja);
    await fecharDb();
  });

  test("o link mostra os quatro planos e sabe que o teste acabou", async ({ request }) => {
    const r = await request.get(`${BASE}/api/pagar/${faturaId}`);
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.saiuDoTeste).toBe(true);
    expect(j.emDia).toBe(false);
    expect(j.planoAtual).toBe("mensal");
    expect(j.planos.map((p: { id: string }) => p.id)).toEqual(["mensal", "trimestral", "semestral", "anual"]);
  });

  test("link de fatura que nao existe da 404, sem vazar nada", async ({ request }) => {
    const r = await request.get(`${BASE}/api/pagar/naoexiste123`);
    expect(r.status()).toBe(404);
  });

  test("escolher o anual gera a cobranca do anual — e repetir reaproveita", async ({ request }) => {
    const r1 = await request.post(`${BASE}/api/pagar/${faturaId}`, { data: { plano: "anual" } });
    expect(r1.status(), await r1.text()).toBe(200);
    const { url } = await r1.json();
    expect(url).toMatch(/^https?:\/\//);

    const doAnual = await db().subscriptionInvoice.findMany({
      where: { subscriptionId: subId, plano: "anual", status: "pendente" },
    });
    expect(doAnual).toHaveLength(1);
    expect(Number(doAnual[0].valor)).toBeCloseTo(358.8, 2);

    // Segundo toque no botao: mesmo link, nenhuma fatura nova. Sem isso cada
    // toque gerava uma cobranca na InfinitePay e uma linha a mais no painel.
    const r2 = await request.post(`${BASE}/api/pagar/${faturaId}`, { data: { plano: "anual" } });
    expect((await r2.json()).url).toBe(url);
    expect(await db().subscriptionInvoice.count({ where: { subscriptionId: subId, plano: "anual" } })).toBe(1);
  });

  test("plano inventado e recusado", async ({ request }) => {
    const r = await request.post(`${BASE}/api/pagar/${faturaId}`, { data: { plano: "vitalicio" } });
    expect(r.status()).toBe(400);
  });

  test("pagar o anual grava o anual na assinatura e cancela as outras", async () => {
    const fatura = await db().subscriptionInvoice.findFirstOrThrow({
      where: { subscriptionId: subId, plano: "anual", status: "pendente" },
      include: { subscription: true },
    });

    await aplicarPagamento(db(), fatura, { metodo: "pix", transactionNsu: "teste-123" });

    const sub = await db().subscription.findUniqueOrThrow({ where: { id: subId } });
    // O que foi pago e o que ele tem: sem isso o proximo vencimento cobraria
    // o MENSAL de quem pagou um ano inteiro.
    expect(sub.plano).toBe("anual");
    expect(Number(sub.valorCiclo)).toBeCloseTo(358.8, 2);
    expect(sub.status).toBe("ativa");
    expect(sub.trialEndsAt).toBeNull();
    // Doze meses a partir de hoje (pagou atrasado, entao conta de hoje).
    const meses = (sub.periodoFim.getTime() - Date.now()) / (30 * 86_400_000);
    expect(meses).toBeGreaterThan(11.5);

    // A do mensal, que ele nao escolheu, nao pode ficar pendente para sempre.
    const pendentes = await db().subscriptionInvoice.count({ where: { subscriptionId: subId, status: "pendente" } });
    expect(pendentes).toBe(0);
  });

  test("depois de pago, o link diz que esta em dia e nao cobra de novo", async ({ request }) => {
    const g = await (await request.get(`${BASE}/api/pagar/${faturaId}`)).json();
    expect(g.emDia).toBe(true);

    const r = await request.post(`${BASE}/api/pagar/${faturaId}`, { data: { plano: "mensal" } });
    expect(r.status()).toBe(409);
  });
});
