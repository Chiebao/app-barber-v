import { test, expect } from "@playwright/test";
import crypto from "crypto";
import { BASE, criarLoja, apagarLoja, apagarClientes, fecharDb, semearAtendimento, db, type Loja } from "./_ajudantes";

/**
 * A resposta do cliente.
 *
 * Antes disto ela era descartada: número da Cloud API não tem caixa de
 * entrada, e o que não cai num webhook some. O app pedia "é só responder por
 * aqui" e jogava a resposta fora.
 *
 * O que estes testes seguram, em ordem de dano:
 *   - reenvio da Meta não pode gerar duas respostas automáticas
 *   - corpo forjado não pode nos fazer enviar WhatsApp a terceiros
 *   - mensagem de uma barbearia não pode aparecer para outra
 */

const SEGREDO = process.env.WHATSAPP_APP_SECRET || "";

function assinar(corpo: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (SEGREDO) {
    h["x-hub-signature-256"] =
      "sha256=" + crypto.createHmac("sha256", SEGREDO).update(corpo, "utf8").digest("hex");
  }
  return h;
}

function corpoDeMensagem(id: string, telefone: string, texto: string) {
  return JSON.stringify({
    entry: [{
      changes: [{
        value: {
          contacts: [{ profile: { name: "Cliente Teste" }, wa_id: telefone }],
          messages: [{ id, from: telefone, type: "text", text: { body: texto } }],
        },
      }],
    }],
  });
}

test.describe("Mensagem recebida do cliente", () => {
  let loja: Loja;
  const TEL = "11922220001";
  const COM_DDI = `55${TEL}`;

  test.beforeAll(async ({ request }) => {
    loja = await criarLoja(request);
    await semearAtendimento(loja, {
      clienteNome: "Cliente Teste", clienteTelefone: TEL, diasAtras: 0, preco: 40, pago: false,
    });
  });

  test.afterAll(async () => {
    await db().inboundMessage.deleteMany({ where: { clientPhone: { in: [COM_DDI, TEL] } } });
    await apagarLoja(loja);
    await apagarClientes([TEL]);
    await fecharDb();
  });

  test("a verificação da Meta responde o desafio", async ({ request }) => {
    const token = process.env.WHATSAPP_VERIFY_TOKEN;
    test.skip(!token, "defina WHATSAPP_VERIFY_TOKEN para testar o handshake");

    const r = await request.get(
      `${BASE}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=abc123`,
    );
    expect(r.status()).toBe(200);
    expect(await r.text()).toBe("abc123");
  });

  test("token de verificação errado é recusado", async ({ request }) => {
    const r = await request.get(
      `${BASE}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=chutando&hub.challenge=abc`,
    );
    expect(r.status()).toBe(403);
  });

  test("a mensagem é guardada e ligada à barbearia certa", async ({ request }) => {
    const corpo = corpoDeMensagem("wamid.teste1", COM_DDI, "Não vou poder ir amanhã");
    const r = await request.post(`${BASE}/api/webhooks/whatsapp`, {
      headers: assinar(corpo), data: corpo,
    });
    expect(r.status()).toBe(200);

    const salva = await db().inboundMessage.findUnique({ where: { waMessageId: "wamid.teste1" } });
    expect(salva).toBeTruthy();
    expect(salva?.texto).toBe("Não vou poder ir amanhã");
    // Descoberta pelo agendamento — é o que faz a mensagem chegar no painel certo.
    expect(salva?.shopId).toBe(loja.shopId);
  });

  test("reenvio da Meta não duplica", async ({ request }) => {
    // A Meta reenvia quando não recebe 200 rápido. Sem a trava, o mesmo "oi"
    // vira duas respostas automáticas para o cliente.
    const corpo = corpoDeMensagem("wamid.teste1", COM_DDI, "Não vou poder ir amanhã");
    const r = await request.post(`${BASE}/api/webhooks/whatsapp`, {
      headers: assinar(corpo), data: corpo,
    });
    expect(r.status()).toBe(200);

    const quantas = await db().inboundMessage.count({ where: { waMessageId: "wamid.teste1" } });
    expect(quantas).toBe(1);
  });

  test("corpo sem assinatura é recusado quando há segredo", async ({ request }) => {
    test.skip(!SEGREDO, "sem WHATSAPP_APP_SECRET não há assinatura a conferir");

    // Este endpoint faz o app ENVIAR WhatsApp. Sem a conferência, qualquer um
    // nos usa para mandar mensagem a terceiros, às nossas custas.
    const corpo = corpoDeMensagem("wamid.forjado", "5511999998888", "oi");
    const r = await request.post(`${BASE}/api/webhooks/whatsapp`, {
      headers: { "Content-Type": "application/json" }, data: corpo,
    });
    expect(r.status()).toBe(401);
    expect(await db().inboundMessage.count({ where: { waMessageId: "wamid.forjado" } })).toBe(0);
  });

  test("recibo de entrega não vira mensagem", async ({ request }) => {
    // Confirmações de entrega chegam no mesmo webhook, sem `messages`.
    const corpo = JSON.stringify({
      entry: [{ changes: [{ value: { statuses: [{ id: "wamid.x", status: "delivered" }] } }] }],
    });
    const r = await request.post(`${BASE}/api/webhooks/whatsapp`, {
      headers: assinar(corpo), data: corpo,
    });
    expect(r.status()).toBe(200);
    expect(await db().inboundMessage.count({ where: { waMessageId: "wamid.x" } })).toBe(0);
  });

  test("o painel lista a mensagem, e só a da própria barbearia", async ({ request }) => {
    const r = await request.get(`${BASE}/api/me/mensagens`, { headers: loja.auth });
    expect(r.status()).toBe(200);
    const d = await r.json();
    expect(d.mensagens.some((m: { texto: string }) => m.texto === "Não vou poder ir amanhã")).toBe(true);

    const outra = await criarLoja(request);
    try {
      const r2 = await request.get(`${BASE}/api/me/mensagens`, { headers: outra.auth });
      expect((await r2.json()).mensagens).toHaveLength(0);
    } finally {
      await apagarLoja(outra);
    }
  });

  test("responder mensagem de outra barbearia é recusado", async ({ request }) => {
    const msg = await db().inboundMessage.findUnique({ where: { waMessageId: "wamid.teste1" } });
    const outra = await criarLoja(request);
    try {
      const r = await request.post(`${BASE}/api/me/mensagens`, {
        headers: outra.auth,
        data: { id: msg!.id, texto: "invasao" },
      });
      expect(r.status()).toBe(404);
    } finally {
      await apagarLoja(outra);
    }
  });

  test("passadas 24h, responder por aqui é recusado com explicação", async ({ request }) => {
    const msg = await db().inboundMessage.findUnique({ where: { waMessageId: "wamid.teste1" } });
    await db().inboundMessage.update({
      where: { id: msg!.id },
      data: { recebidaEm: new Date(Date.now() - 25 * 3_600_000) },
    });

    const r = await request.post(`${BASE}/api/me/mensagens`, {
      headers: loja.auth,
      data: { id: msg!.id, texto: "oi" },
    });
    // A Meta só entrega modelo depois da janela, e modelo não serve para
    // conversa — melhor dizer isso do que deixar sumir.
    expect(r.status()).toBe(409);
    expect((await r.json()).error).toContain("24h");
  });
});
