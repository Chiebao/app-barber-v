import { test, expect } from "@playwright/test";
import { BASE, criarLoja, apagarLoja, fecharDb, db, type Loja } from "./_ajudantes";
import { faltasDaPessoa, perdoarFaltasDaPessoa } from "../../src/app/lib/faltas";
import { chaveDaPessoa } from "../../src/app/lib/pessoa";

/**
 * Duas pessoas, um telefone.
 *
 * `Client` e global e a chave e o telefone. Numa barbearia isso e rotina:
 * pai marca para o filho, marido para a esposa. Antes os dois dividiam o
 * contador de faltas e a cartela de fidelidade — a falta do filho cobrava
 * Pix do pai, e os cortes de um enchiam a cartela do outro.
 */

const emDias = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

test.describe("Pai e filho no mesmo telefone", () => {
  let loja: Loja;
  let token: string;
  let servicoId: string;
  let barberId: string;
  const TEL = "1594" + String(Date.now()).slice(-7);
  const PAI = "Roberto Pai";
  const FILHO = "Roberto Filho";

  test.beforeAll(async ({ request }) => {
    loja = await criarLoja(request, { dias: [0, 1, 2, 3, 4, 5, 6] });
    const r = await request.post(`${BASE}/api/auth/login`, {
      data: { phone: loja.telefone, password: loja.senha },
    });
    token = (await r.json()).token;
    servicoId = (await db().service.findFirst({ where: { shopId: loja.shopId } }))!.id;
    barberId = (await db().barber.findFirst({ where: { shopId: loja.shopId } }))!.id;
  });

  test.afterAll(async () => {
    await apagarLoja(loja);
    await fecharDb();
  });

  const marcar = (request: import("@playwright/test").APIRequestContext, nome: string, dia: string, hora: string) =>
    request.post(`${BASE}/api/me/agendamentos`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { clientName: nome, clientPhone: TEL, serviceIds: [servicoId], date: dia, startTime: hora },
    });

  test("a falta do filho nao conta para o pai", async ({ request }) => {
    await marcar(request, FILHO, emDias(2), "09:00");
    await marcar(request, PAI, emDias(2), "10:00");

    const doFilho = await db().appointment.findFirst({
      where: { shopId: loja.shopId, clientName: FILHO },
    });
    // O barbeiro marca a falta do agendamento DO FILHO.
    const r = await request.patch(`${BASE}/api/appointments/${doFilho!.id}/no-show`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.status()).toBe(200);

    const cliente = await db().client.findUnique({ where: { phone: TEL } });
    expect(await faltasDaPessoa(db(), cliente!.id, FILHO)).toBe(1);
    expect(await faltasDaPessoa(db(), cliente!.id, PAI), "o pai nao faltou").toBe(0);
  });

  test("o Pix do pai nao limpa a ficha do filho", async () => {
    const cliente = await db().client.findUnique({ where: { phone: TEL } });

    // Perdoa as faltas do PAI (que nao tem nenhuma) — nada pode acontecer
    // com as do filho.
    await perdoarFaltasDaPessoa(db(), cliente!.id, PAI);
    expect(await faltasDaPessoa(db(), cliente!.id, FILHO), "a falta do filho continua").toBe(1);

    // Agora o perdao certo.
    const perdoadas = await perdoarFaltasDaPessoa(db(), cliente!.id, FILHO);
    expect(perdoadas).toBe(1);
    expect(await faltasDaPessoa(db(), cliente!.id, FILHO)).toBe(0);
  });

  test("a fidelidade e por pessoa, nao por telefone", async ({ request }) => {
    const cliente = await db().client.findUnique({ where: { phone: TEL } });

    // Um pago para cada um.
    for (const [nome, hora] of [[FILHO, "11:00"], [PAI, "12:00"]] as const) {
      await marcar(request, nome, emDias(3), hora);
      const a = await db().appointment.findFirst({
        where: { shopId: loja.shopId, clientName: nome, startTime: hora },
      });
      const r = await request.patch(`${BASE}/api/me/finance`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { appointmentId: a!.id, paymentMethod: "dinheiro" },
      });
      expect(r.status(), await r.text()).toBe(200);
    }

    const cartelas = await db().loyaltyCount.findMany({
      where: { shopId: loja.shopId, clientId: cliente!.id },
      select: { pessoa: true, count: true },
    });
    // Duas cartelas separadas, uma para cada um — nao uma com dois.
    expect(cartelas).toHaveLength(2);
    expect(cartelas.find((c) => c.pessoa === chaveDaPessoa(PAI))!.count).toBe(1);
    expect(cartelas.find((c) => c.pessoa === chaveDaPessoa(FILHO))!.count).toBe(1);
  });

  test("a lista de clientes mostra os dois separados", async ({ request }) => {
    const r = await request.get(`${BASE}/api/me/clients`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { clients } = await r.json();
    const doTelefone = clients.filter((c: { phone: string }) => c.phone === TEL);
    expect(doTelefone.map((c: { name: string }) => c.name).sort()).toEqual([PAI, FILHO].sort());
  });
});
