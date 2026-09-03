import { test, expect } from "@playwright/test";
import { BASE, criarLoja, apagarLoja, apagarClientes, fecharDb, db, type Loja } from "./_ajudantes";

/**
 * Cliente trocando os serviços do próprio agendamento.
 *
 * A troca muda a DURAÇÃO, e a rota não checava nada: recalculava o fim e
 * gravava. Um corte de 30 min virava um de 2h por cima do próximo cliente.
 *
 * A criação sempre rodou numa transação Serializable. Esta rota é anterior a
 * ela, e ninguém voltou aqui quando a trava foi construída — a porta da frente
 * trancada, a janela aberta.
 */

/** Amanhã, para o agendamento estar sempre no futuro. */
function amanha(): string {
  return new Date(Date.now() + 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10);
}

test.describe("Editar serviços do agendamento", () => {
  let loja: Loja;
  let curtoId: string;
  let longoId: string;
  const CLIENTES = ["11944440011", "11944440012"];

  test.beforeAll(async ({ request }) => {
    loja = await criarLoja(request);

    // Um serviço de 30 min (o que já existe) e um de 2h.
    const longo = await db().service.create({
      data: { shopId: loja.shopId, name: "Dia do noivo", duration: 120, price: 300, category: "combo" },
    });
    longoId = longo.id;
    curtoId = loja.servicoId;

    // João às 14:00 (30 min) e Pedro às 14:30 — encostados de propósito.
    for (const [tel, nome, hora, fim] of [
      [CLIENTES[0], "João", "14:00", "14:30"],
      [CLIENTES[1], "Pedro", "14:30", "15:00"],
    ] as const) {
      const r = await request.post(`${BASE}/api/me/agendamentos`, {
        headers: loja.auth,
        data: { clientName: nome, clientPhone: tel, serviceIds: [curtoId], date: amanha(), startTime: hora },
      });
      expect(r.status(), `${nome} precisa ser criado`).toBe(200);
      expect((await r.json()).agendamento.endTime).toBe(fim);
    }
  });

  test.afterAll(async () => {
    await apagarLoja(loja);
    await apagarClientes(CLIENTES);
    await fecharDb();
  });

  const doJoao = async () => {
    const a = await db().appointment.findFirst({
      where: { shopId: loja.shopId, startTime: "14:00" },
      select: { id: true, endTime: true, totalDuration: true },
    });
    return a!;
  };

  test("alongar por cima do próximo cliente é recusado", async ({ request }) => {
    const antes = await doJoao();

    const r = await request.patch(`${BASE}/api/appointments/${antes.id}/edit`, {
      data: { phone: CLIENTES[0], serviceIds: [longoId] },
    });

    // Este é O teste. Sem a correção, respondia 200 e João passava a ocupar
    // 14:00–16:00, com Pedro marcado às 14:30.
    expect(r.status()).toBe(409);
    expect((await r.json()).error).toContain("próximo cliente");

    // E nada mudou: a recusa não pode deixar o agendamento pela metade.
    const depois = await doJoao();
    expect(depois.endTime).toBe("14:30");
    expect(depois.totalDuration).toBe(30);
  });

  test("encurtar continua livre", async ({ request }) => {
    // Quem tira serviço libera espaço — checar isso faria o cliente levar 409
    // por uma agenda que apertou depois que ele marcou.
    const pedro = await db().appointment.findFirst({
      where: { shopId: loja.shopId, startTime: "14:30" },
      select: { id: true },
    });

    const r = await request.patch(`${BASE}/api/appointments/${pedro!.id}/edit`, {
      data: { phone: CLIENTES[1], serviceIds: [curtoId] },
    });
    expect(r.status()).toBe(200);
  });

  test("passar do fechamento é recusado com a razão certa", async ({ request }) => {
    // A barbearia de teste fecha às 20:00. Às 19:30 cabe um corte de 30 min
    // e termina exatamente no fechamento; o combo de 2h iria até 21:30.
    const criado = await request.post(`${BASE}/api/me/agendamentos`, {
      headers: loja.auth,
      data: { clientName: "Ultimo", clientPhone: CLIENTES[0], serviceIds: [curtoId], date: amanha(), startTime: "19:30" },
    });
    test.skip(criado.status() !== 200, "a barbearia de teste não tem 19:30 livre");
    const id = (await criado.json()).agendamento.id;

    const r = await request.patch(`${BASE}/api/appointments/${id}/edit`, {
      data: { phone: CLIENTES[0], serviceIds: [longoId] },
    });
    expect(r.status()).toBe(409);
    expect((await r.json()).error).toContain("fechamento");
  });

  test("agendamento de outro cliente não é editável", async ({ request }) => {
    const joao = await doJoao();
    const r = await request.patch(`${BASE}/api/appointments/${joao.id}/edit`, {
      data: { phone: CLIENTES[1], serviceIds: [longoId] },
    });
    expect(r.status()).toBe(404);
  });
});
