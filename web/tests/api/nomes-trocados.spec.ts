import { test, expect } from "@playwright/test";
import { BASE, criarLoja, apagarLoja, fecharDb, db, type Loja } from "./_ajudantes";

/**
 * "O app troca o nome de um cliente pelo do outro."
 *
 * Relato do barbeiro: marca o Claudio na quinta às 10h, marca o Kleber na
 * sexta às 16h, e depois o nome do Kleber aparece no lugar do Claudio.
 *
 * `Client` é uma tabela GLOBAL com telefone único, e a criação faz upsert
 * com `update: { name }`. Então dois agendamentos com o MESMO telefone
 * apontam para a MESMA linha, e o segundo nome sobrescreve o primeiro —
 * em todos os agendamentos passados daquele cliente, de todas as lojas.
 */

const emDias = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

test.describe("Nome de um cliente no agendamento de outro", () => {
  let loja: Loja;
  let token: string;
  let servicoId: string;

  test.beforeAll(async ({ request }) => {
    loja = await criarLoja(request, { dias: [0, 1, 2, 3, 4, 5, 6] });
    const r = await request.post(`${BASE}/api/auth/login`, {
      data: { phone: loja.telefone, password: loja.senha },
    });
    token = (await r.json()).token;
    const s = await db().service.findFirst({ where: { shopId: loja.shopId } });
    servicoId = s!.id;
  });

  test.afterAll(async () => {
    await apagarLoja(loja);
    await fecharDb();
  });

  const marcar = (request: import("@playwright/test").APIRequestContext,
                  nome: string, telefone: string, dia: string, hora: string) =>
    request.post(`${BASE}/api/me/agendamentos`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { clientName: nome, clientPhone: telefone, serviceIds: [servicoId], date: dia, startTime: hora },
    });

  test("telefones DIFERENTES: cada agendamento fica com o seu dono", async ({ request }) => {
    const t1 = "1590" + String(Date.now()).slice(-7);
    const t2 = "1591" + String(Date.now()).slice(-7);

    expect((await marcar(request, "Claudio Teste", t1, emDias(2), "10:00")).status()).toBe(200);
    expect((await marcar(request, "Kleber Teste", t2, emDias(3), "16:00")).status()).toBe(200);

    const agendamentos = await db().appointment.findMany({
      where: { shopId: loja.shopId }, include: { client: true }, orderBy: { date: "asc" },
    });
    const nomes = agendamentos.map((a) => `${a.startTime} ${a.client.name}`);
    expect(nomes).toEqual(["10:00 Claudio Teste", "16:00 Kleber Teste"]);
  });

  test("telefone IGUAL (pai e filho): cada agendamento guarda o seu nome", async ({ request }) => {
    // O caminho que reproduziu a queixa. Num salao telefone repetido nao e
    // erro: pai marca para o filho, marido para a esposa.
    const mesmo = "1592" + String(Date.now()).slice(-7);

    expect((await marcar(request, "Primeiro Nome", mesmo, emDias(4), "09:00")).status()).toBe(200);
    expect((await marcar(request, "Segundo Nome", mesmo, emDias(5), "11:00")).status()).toBe(200);

    // Le pela API, que e o que o barbeiro enxerga — nao pela tabela `Client`,
    // que por definicao tem um nome so para os dois.
    const nomes: string[] = [];
    for (const dia of [emDias(4), emDias(5)]) {
      const r = await request.get(`${BASE}/api/me/appointments?date=${dia}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      for (const a of (await r.json()).appointments) nomes.push(`${a.startTime} ${a.client.name}`);
    }

    expect(nomes, "marcar o segundo nao pode renomear o primeiro")
      .toEqual(["09:00 Primeiro Nome", "11:00 Segundo Nome"]);
  });

  test("a linha do Client nao e renomeada por quem marca depois", async ({ request }) => {
    // A corrupcao antiga era aqui: o upsert com `update: { name }` reescrevia
    // o nome global, e todo agendamento passado daquele telefone mudava junto.
    const tel = "1593" + String(Date.now()).slice(-7);
    await marcar(request, "Nome Original", tel, emDias(6), "09:00");
    await marcar(request, "Nome Diferente", tel, emDias(7), "10:00");

    const c = await db().client.findUnique({ where: { phone: tel } });
    expect(c!.name).toBe("Nome Original");
  });
});
