import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

/**
 * O robô comercial de ponta a ponta: corpo da Meta entrando pelo webhook,
 * banco de verdade e `fetch` trocado, então nenhuma mensagem sai daqui.
 *
 * SÓ RODA COM BANCO LOCAL. O `.env` deste projeto é o banco de produção, e estes
 * testes gravam nele. Para rodar:
 *
 *   DATABASE_URL=postgresql://...@127.0.0.1:54329/barber_teste \
 *   DIRECT_URL=postgresql://...@127.0.0.1:54329/barber_teste \
 *   JWT_SECRET=teste-so-para-o-banco-local-com-32-chars \
 *   npx playwright test --config=playwright.api.config.ts robo-comercial
 */
const url = process.env.DATABASE_URL || "";
const bancoLocal = /@(127\.0\.0\.1|localhost)[:/]/.test(url);
const db = bancoLocal ? new PrismaClient() : (null as unknown as PrismaClient);

type Enviada = { para: string; tipo: string; texto: string; botoes: string[]; modelo?: string };
const ORIGINAL_FETCH = globalThis.fetch;
let enviadas: Enviada[] = [];

function fingirMeta() {
  enviadas = [];
  globalThis.fetch = (async (alvo: string, init: { body?: string }) => {
    if (!String(alvo).includes("graph.facebook.com")) throw new Error("rede fora da Meta no teste: " + alvo);
    const c = JSON.parse(init.body || "{}");
    enviadas.push({
      para: c.to,
      tipo: c.type,
      texto: c.text?.body ?? c.interactive?.body?.text ?? "",
      botoes: (c.interactive?.action?.buttons ?? []).map((b: { reply: { title: string } }) => b.reply.title),
      modelo: c.template?.name,
    });
    return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
  }) as unknown as typeof fetch;
}

let idDaMensagem = 0;
function corpo(telefone: string, mensagem: Record<string, unknown>) {
  return JSON.stringify({
    entry: [{ changes: [{ value: {
      contacts: [{ profile: { name: "Perfil Teste" }, wa_id: telefone }],
      messages: [{ id: `wamid.robo.${Date.now()}.${++idDaMensagem}`, from: telefone, ...mensagem }],
    } }] }],
  });
}

async function postar(cru: string) {
  const { POST } = require("../../src/app/api/webhooks/whatsapp/route") as typeof import("../../src/app/api/webhooks/whatsapp/route");
  const r = await POST(new NextRequest("http://teste.local/api/webhooks/whatsapp", { method: "POST", body: cru }));
  expect(r.status).toBe(200);
}

const escrever = (tel: string, texto: string) => postar(corpo(tel, { type: "text", text: { body: texto } }));
const tocar = (tel: string, id: string, titulo: string) =>
  postar(corpo(tel, { type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: titulo } } }));

/** Telefones únicos por teste: 9 + 8 dígitos, para valer como celular. */
let contador = 0;
const criados: string[] = [];
function telefoneNovo(): string {
  const n = String(Date.now()).slice(-6) + String(++contador).padStart(2, "0");
  const local = `1198${n.slice(-7)}`;
  criados.push(local);
  return `55${local}`;
}

async function criarBarbearia(telefoneDoDono: string, slug: string) {
  const owner = await db.owner.create({ data: { name: "Dono", phone: telefoneDoDono, passwordHash: "x" } });
  const shop = await db.shop.create({
    data: { ownerId: owner.id, name: `Barbearia ${slug}`, slug, openTime: "08:00", closeTime: "20:00", workDays: [0, 1, 2, 3, 4, 5, 6], phone: "15911112222" },
  });
  const barber = await db.barber.create({ data: { shopId: shop.id, name: "Dono", phone: telefoneDoDono, passwordHash: "x", isOwnerProfile: true, role: "owner" } });
  return { owner, shop, barber };
}

async function criarCliente(telefoneLocal: string, b: Awaited<ReturnType<typeof criarBarbearia>>, comecaEmMinutos = 60 * 24) {
  const client = await db.client.create({ data: { name: "Cliente Teste", phone: telefoneLocal } });
  // O dia e a hora vão em UTC, e o cron lê no fuso da barbearia (-03).
  const inicio = new Date(Date.now() + comecaEmMinutos * 60_000 - 3 * 3_600_000);
  const hora = inicio.toISOString().slice(11, 16);
  const appointment = await db.appointment.create({
    data: {
      shopId: b.shop.id, barberId: b.barber.id, clientId: client.id,
      date: new Date(inicio.toISOString().slice(0, 10) + "T00:00:00.000Z"),
      startTime: hora, endTime: hora, totalDuration: 30, totalPrice: 40, status: "confirmed",
    },
  });
  return { client, appointment };
}

test.describe("Robô comercial pelo webhook", () => {
  test.skip(!bancoLocal, "só roda com DATABASE_URL local: o .env deste projeto é o banco de produção");

  let henr: Awaited<ReturnType<typeof criarBarbearia>>;
  const slug = `henr-teste-${Date.now()}`;

  test.beforeAll(async () => {
    process.env.WHATSAPP_API_TOKEN = "token-de-teste";
    process.env.WHATSAPP_PHONE_ID = "000000";
    process.env.CRON_SECRET = "segredo-de-teste";
    delete process.env.WHATSAPP_APP_SECRET;
    henr = await criarBarbearia(telefoneNovo().slice(2), slug);
  });

  test.beforeEach(() => fingirMeta());

  test.afterAll(async () => {
    globalThis.fetch = ORIGINAL_FETCH;
    // Outro arquivo pode rodar neste mesmo processo, já sem a Meta simulada.
    delete process.env.WHATSAPP_API_TOKEN;
    delete process.env.WHATSAPP_PHONE_ID;
    await db.appointment.deleteMany({ where: { shopId: henr.shop.id } });
    await db.client.deleteMany({ where: { phone: { in: criados } } });
    await db.shop.deleteMany({ where: { id: henr.shop.id } });
    await db.owner.deleteMany({ where: { id: henr.owner.id } });
    await db.$disconnect();
  });

  test("o caminho completo pelo webhook, com botões de verdade", async () => {
    const tel = telefoneNovo();

    await escrever(tel, "Oi, vim do Instagram e quero conhecer o BarberPro");
    expect(enviadas[0].texto).toContain("Vi que você veio do Instagram");
    expect(enviadas[0].botoes).toEqual(["Sou dono", "Sou barbeiro", "Sou cliente"]);
    expect(enviadas[0].tipo).toBe("interactive");
    expect(enviadas[0].para).toBe(tel);

    enviadas = [];
    await tocar(tel, "sou_dono", "Sou dono");
    expect(enviadas[0].botoes).toEqual(["Só eu", "2 ou 3", "4 ou mais"]);

    enviadas = [];
    await tocar(tel, "dois_ou_tres", "2 ou 3");
    expect(enviadas[0].botoes).toEqual(["Caderno", "WhatsApp", "Outro app"]);

    enviadas = [];
    await tocar(tel, "caderno", "Caderno");
    expect(enviadas).toHaveLength(2);
    expect(enviadas[0].texto).toContain("Entendi, tudo no caderno.");
    expect(enviadas[0].tipo).toBe("text");
    expect(enviadas[1].botoes).toEqual(["Quero testar", "Ver os preços", "Tenho uma dúvida"]);

    enviadas = [];
    await tocar(tel, "ver_precos", "Ver os preços");
    expect(enviadas[0].texto).toContain("R$ 45,90");

    enviadas = [];
    await tocar(tel, "quero_testar", "Quero testar");
    expect(enviadas[0].texto).toContain("/admin");

    enviadas = [];
    await tocar(tel, "tenho_duvida", "Tenho uma dúvida");
    expect(enviadas[0].texto).toContain("Manda sua dúvida");

    const c = await db.conversaComercial.findUnique({ where: { telefone: tel } });
    expect([c?.origem, c?.papel, c?.barbeiros, c?.agenda, c?.etapa]).toEqual(["instagram", "sou_dono", "dois_ou_tres", "caderno", "duvida"]);

    // A resposta de botão fica legível, e não vira "mandou um arquivo".
    const salvas = await db.inboundMessage.findMany({ where: { clientPhone: tel, tipo: "interactive" } });
    expect(salvas.map((s) => s.texto)).toContain("Sou dono");
  });

  test("reenvio da Meta não responde duas vezes", async () => {
    const tel = telefoneNovo();
    const cru = corpo(tel, { type: "text", text: { body: "oi" } });
    await postar(cru);
    await postar(cru);
    expect(enviadas).toHaveLength(1);
  });

  test("cliente que pergunta do corte ou avisa da falta recebe a resposta atual, e a mensagem vai para o painel", async () => {
    const tel = telefoneNovo();
    await criarCliente(tel.slice(2), henr);

    for (const texto of ["quanto custa o corte?", "vou faltar"]) {
      enviadas = [];
      await escrever(tel, texto);
      expect(enviadas).toHaveLength(1);
      expect(enviadas[0].texto).toContain("Esta linha é automática e não é lida por ninguém");
      expect(enviadas[0].texto).toContain(`*Barbearia ${slug}*`);
      expect(enviadas[0].texto).not.toContain("R$");
      expect(enviadas[0].texto).not.toContain("Pix");
      expect(enviadas[0].botoes).toEqual([]);

      const salva = await db.inboundMessage.findFirst({ where: { clientPhone: tel, texto } });
      expect(salva?.shopId).toBe(henr.shop.id);
    }
    expect(await db.conversaComercial.findUnique({ where: { telefone: tel } })).toBeNull();
  });

  test("cliente na conversa comercial continua nela no botão, e o que escreve não entra no painel", async () => {
    const tel = telefoneNovo();
    await criarCliente(tel.slice(2), henr);

    await escrever(tel, "BARBERPRO");
    expect(enviadas[0].botoes).toEqual(["Sou dono", "Sou barbeiro", "Sou cliente"]);

    enviadas = [];
    await tocar(tel, "sou_dono", "Sou dono");
    expect(enviadas[0].botoes).toEqual(["Só eu", "2 ou 3", "4 ou mais"]);

    enviadas = [];
    await escrever(tel, "e o preço?");
    expect(enviadas[0].texto).toContain("R$ 45,90");

    const noPainel = await db.inboundMessage.findMany({ where: { shopId: henr.shop.id, clientPhone: tel } });
    expect(noPainel).toHaveLength(0);

    // O resto cai na resposta de cliente: "vou faltar" é para a barbearia.
    enviadas = [];
    await escrever(tel, "vou faltar");
    expect(enviadas[0].texto).toContain("Esta linha é automática");
    const agora = await db.inboundMessage.findMany({ where: { shopId: henr.shop.id, clientPhone: tel } });
    expect(agora.map((m) => m.texto)).toEqual(["vou faltar"]);
  });

  test("dono cadastrado sem o 9º dígito e sem 55 é reconhecido", async () => {
    const tel = telefoneNovo();
    const semNove = tel.slice(2, 4) + tel.slice(5);
    const b = await criarBarbearia(semNove, `${slug}-sem-nove`);
    try {
      await escrever(tel, "oi");
      expect(enviadas[0].texto).toContain("já tem cadastro no BarberPro");
      expect(enviadas[0].texto).toContain("https://wa.me/5515997767794");
    } finally {
      await db.shop.delete({ where: { id: b.shop.id } });
      await db.owner.delete({ where: { id: b.owner.id } });
    }
  });

  test("PARAR bloqueia os quatro modelos e nada mais", async () => {
    const { enviarModeloComResultado, enviarWhatsApp, MODELOS_QUE_RESPEITAM_PARAR } = require("../../src/app/lib/whatsapp-send") as typeof import("../../src/app/lib/whatsapp-send");
    const tel = telefoneNovo();
    await escrever(tel, "PARAR");
    expect(enviadas[0].texto).toContain("não vou mais te escrever");
    // O cadastro pode estar sem 55 e sem o 9º dígito: o pedido vale do mesmo jeito.
    const cadastrado = tel.slice(2, 4) + tel.slice(5);

    expect([...MODELOS_QUE_RESPEITAM_PARAR].sort()).toEqual(["agendamento_marcado", "espera_sem_vaga", "lembrete_agendamento", "vaga_disponivel"]);

    enviadas = [];
    expect(await enviarModeloComResultado(cadastrado, "lembrete_agendamento", ["A", "B", "10:00", "Corte"])).toBe("bloqueado");
    expect(await enviarModeloComResultado(cadastrado, "agendamento_marcado", ["A", "B", "2 de novembro", "10:00"])).toBe("bloqueado");
    expect(await enviarModeloComResultado(cadastrado, "vaga_disponivel", ["A", "B", "2 de novembro", "10:00"], "slug")).toBe("bloqueado");
    expect(await enviarModeloComResultado(cadastrado, "espera_sem_vaga", ["A", "B", "2 de novembro"], "slug")).toBe("bloqueado");
    expect(enviadas).toHaveLength(0);

    // Os modelos da conta e o recibo do Mercado Pago continuam saindo.
    expect(await enviarModeloComResultado(cadastrado, "codigo_recuperacao", ["123456"])).toBe("enviado");
    expect(await enviarModeloComResultado(cadastrado, "agenda_do_dia", ["A", "2 de novembro", "10:00 Fulano"])).toBe("enviado");
    expect(await enviarModeloComResultado(cadastrado, "cobranca_assinatura", ["A", "01/11", "R$ 45,90"], "fatura")).toBe("enviado");
    expect(await enviarModeloComResultado(cadastrado, "fim_do_teste", ["A", "Barbearia", "R$ 45,90", "01/11"], "fatura")).toBe("enviado");
    expect(await enviarWhatsApp(cadastrado, "Pagamento confirmado")).toBe(true);
    expect(enviadas.map((e) => e.modelo).filter(Boolean)).toEqual(["codigo_recuperacao", "agenda_do_dia", "cobranca_assinatura", "fim_do_teste"]);
  });

  test("o cron conta o bloqueado como pulado, grava o motivo e não tenta de novo; VOLTAR solta", async () => {
    const { GET } = require("../../src/app/api/cron/route") as typeof import("../../src/app/api/cron/route");
    const tel = telefoneNovo();
    const { appointment } = await criarCliente(tel.slice(2), henr, 60);
    await escrever(tel, "parar");
    expect(enviadas[0].texto).toContain("Combinado, você não vai mais receber lembretes");

    const rodar = async () => {
      const r = await GET(new NextRequest("http://teste.local/api/cron", { headers: { authorization: "Bearer segredo-de-teste" } }));
      expect(r.status).toBe(200);
      return r.json();
    };

    enviadas = [];
    const primeira = await rodar();
    expect(primeira.skipped).toBeGreaterThanOrEqual(1);
    expect(primeira.failedSend).toBe(0);
    expect(enviadas.filter((e) => e.para === tel)).toHaveLength(0);

    const pulado = await db.appointment.findUnique({ where: { id: appointment.id } });
    expect(pulado?.lembretePuladoMotivo).toBe("pediu_parar");
    expect(pulado?.reminderSentAt).toBeNull();

    // A segunda rodada nem olha para ele.
    const segunda = await rodar();
    expect(segunda.skipped).toBe(0);

    enviadas = [];
    await escrever(tel, "VOLTAR");
    expect(enviadas[0].texto).toContain("voltou a receber os lembretes");
    const solto = await db.appointment.findUnique({ where: { id: appointment.id } });
    expect(solto?.lembretePuladoMotivo).toBeNull();

    enviadas = [];
    await rodar();
    expect(enviadas.filter((e) => e.para === tel).map((e) => e.modelo)).toEqual(["lembrete_agendamento"]);
  });

  test("a lista de espera conta o bloqueado como pulado", async () => {
    const { limparEsperaVencida } = require("../../src/app/lib/espera") as typeof import("../../src/app/lib/espera");
    const tel = telefoneNovo();
    await escrever(tel, "parar");
    await db.waitlist.create({
      data: { shopId: henr.shop.id, clientName: "Fulano", clientPhone: tel.slice(2), serviceIds: [], preferredDate: "2020-01-01" },
    });
    enviadas = [];
    const r = await limparEsperaVencida();
    expect(r.pulados).toBe(1);
    expect(r.falhas).toBe(0);
    expect(r.removidos).toBe(1);
    expect(enviadas).toHaveLength(0);
  });

  test("o painel mostra ao barbeiro que o cliente pediu para não receber", async () => {
    const { signToken } = require("../../src/app/lib/auth") as typeof import("../../src/app/lib/auth");
    const { GET } = require("../../src/app/api/me/appointments/route") as typeof import("../../src/app/api/me/appointments/route");
    const tel = telefoneNovo();
    const { appointment } = await criarCliente(tel.slice(2), henr);
    await escrever(tel, "parar");

    const token = signToken({ userId: henr.barber.id, shopId: henr.shop.id, role: "owner" });
    const r = await GET(new NextRequest("http://teste.local/api/me/appointments", { headers: { authorization: `Bearer ${token}` } }));
    const { appointments } = await r.json();
    const linha = appointments.find((a: { id: string }) => a.id === appointment.id);
    expect(linha.client.pediuParar).toBe(true);
  });

  test("a 21ª resposta para o mesmo número dentro de uma hora não é enviada, mas a mensagem fica guardada", async () => {
    const tel = telefoneNovo();
    for (let i = 1; i <= 20; i++) await escrever(tel, `pergunta ${i}`);
    const ate20 = enviadas.length;
    expect(ate20).toBeGreaterThanOrEqual(20);

    await escrever(tel, "pergunta 21");
    expect(enviadas.length).toBe(ate20);
    expect(await db.inboundMessage.count({ where: { clientPhone: tel, texto: "pergunta 21" } })).toBe(1);

    // PARAR vale mesmo acima do limite: a obrigação não depende da resposta.
    await escrever(tel, "PARAR");
    expect(enviadas.length).toBe(ate20);
    expect(await db.pedidoParar.count({ where: { telefone: tel } })).toBe(1);
  });
});
