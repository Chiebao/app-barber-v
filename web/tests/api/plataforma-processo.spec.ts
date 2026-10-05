import { test, expect } from "@playwright/test";
import { BASE, criarLoja, apagarLoja, fecharDb, db, type Loja } from "./_ajudantes";

/**
 * O painel da plataforma acompanha a cobranca passo a passo.
 *
 * Precisa do ADMIN_SECRET no processo do teste E no servidor — rode o dev
 * server com o mesmo valor. Sem ele o teste e pulado, nao reprovado: a
 * senha-mestra nao mora no .env local.
 *
 * NAO chama o cron de cobranca (global: mandaria WhatsApp de verdade para
 * barbearia real em fim de teste). As faturas sao semeadas como o cron as
 * deixaria.
 */

const SEGREDO = process.env.ADMIN_SECRET || "";
const horasAtras = (h: number) => new Date(Date.now() - h * 3_600_000);

test.describe("Cobranca passo a passo no painel da plataforma", () => {
  test.skip(!SEGREDO, "ADMIN_SECRET nao definido no processo do teste");

  let loja: Loja;

  test.beforeAll(async ({ request }) => {
    loja = await criarLoja(request);
    const sub = await db().subscription.update({
      where: { shopId: loja.shopId },
      data: { status: "trial", trialEndsAt: horasAtras(30), periodoFim: horasAtras(30), plano: "mensal", valorCiclo: 45.9 },
    });
    // Como o cron deixa: fatura do sistema, WhatsApp de fim de teste saiu.
    await db().subscriptionInvoice.create({
      data: {
        subscriptionId: sub.id, valor: 45.9, plano: "mensal", status: "pendente", vencimento: horasAtras(6),
        provedor: "infinitepay", origem: "cron", avisadaEm: horasAtras(6), avisoWhatsapp: "fim_do_teste",
        createdAt: horasAtras(6),
      },
    });
  });

  test.afterAll(async () => {
    await apagarLoja(loja);
    await fecharDb();
  });

  test("mostra em que passo o dono parou e o link para chamar ele", async ({ request }) => {
    const r = await request.post(`${BASE}/api/admin/plataforma`, { data: { secret: SEGREDO } });
    expect(r.status(), await r.text()).toBe(200);
    const { barbearias } = await r.json();
    const b = barbearias.find((x: { id: string }) => x.id === loja.shopId);
    expect(b, "a loja de teste tinha que estar na lista").toBeTruthy();

    expect(b.dono.nome).toBe("Dono");
    expect(b.assinatura.estado).toBe("carencia");
    const passos = b.processo.etapas.map((e: { chave: string; feito: boolean }) => `${e.chave}:${e.feito}`);
    expect(passos).toEqual(["fatura:true", "aviso:true", "aberta:false", "paga:false"]);
    expect(b.processo.faturaAberta).toBeTruthy();
    // Com fatura aberta e recente, o cron nao gera outra antes de 3 dias.
    expect(new Date(b.processo.proximaFatura).getTime()).toBeGreaterThan(Date.now() + 2 * 86_400_000);
  });

  test("abrir o link acende o terceiro passo", async ({ request }) => {
    const fatura = await db().subscriptionInvoice.findFirstOrThrow({ where: { subscription: { shopId: loja.shopId } } });
    expect((await request.get(`${BASE}/api/pagar/${fatura.id}`)).status()).toBe(200);

    const { barbearias } = await (await request.post(`${BASE}/api/admin/plataforma`, { data: { secret: SEGREDO } })).json();
    const b = barbearias.find((x: { id: string }) => x.id === loja.shopId);
    expect(b.processo.etapas[2].feito).toBe(true);
    expect(b.processo.etapas[3].feito).toBe(false);
  });
});
