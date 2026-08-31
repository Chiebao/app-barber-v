import { test, expect } from "@playwright/test";
import {
  BASE, criarLoja, apagarLoja, apagarClientes, fecharDb,
  semearAtendimento, segredoDoCron, db, type Loja,
} from "./_ajudantes";

/**
 * A conta do lucro.
 *
 * Existe porque o modelo de dados esconde duas armadilhas que dariam número
 * errado sem ninguém perceber:
 *
 *   1. `totalPrice` é SÓ SERVIÇO — produto vive em outra tabela;
 *   2. a comissão incide sobre serviço, não sobre produto.
 *
 * Errar qualquer uma não dá tela branca: dá um lucro plausível e falso, que o
 * dono usa para decidir preço.
 */

/** Hoje em São Paulo — o mês que a API considera corrente. */
function hojeSP() {
  return new Date(Date.now() - 3 * 3_600_000);
}

test.describe("Despesas e lucro", () => {
  let loja: Loja;
  let produtoId: string;
  const CLIENTES = ["11955550001", "11955550002"];

  test.beforeAll(async ({ request }) => {
    loja = await criarLoja(request);

    // O dono fica com 50% de comissão sobre o que ele mesmo atende.
    await db().barber.update({ where: { id: loja.barbeiroDonoId }, data: { commission: 50 } });

    // Produto que custa 20 e vende por 50.
    const p = await request.post(`${BASE}/api/me/products`, {
      headers: loja.auth,
      data: { name: "Pomada", price: 50, custo: 20 },
    });
    produtoId = (await p.json()).product.id;

    // Dois atendimentos pagos, hoje, para não cruzar a virada do mês.
    const a1 = await semearAtendimento(loja, {
      clienteNome: "Ana", clienteTelefone: CLIENTES[0], diasAtras: 0, preco: 100, pago: "pix",
    });
    await semearAtendimento(loja, {
      clienteNome: "Bruno", clienteTelefone: CLIENTES[1], diasAtras: 0, preco: 60, pago: "dinheiro",
    });

    // Uma pomada vendida no primeiro atendimento.
    await request.put(`${BASE}/api/me/products`, {
      headers: loja.auth,
      data: { appointmentId: a1.id, productId: produtoId, quantity: 1 },
    });
  });

  test.afterAll(async () => {
    await db().expense.deleteMany({ where: { shopId: loja.shopId } });
    await apagarLoja(loja);
    await apagarClientes(CLIENTES);
    await fecharDb();
  });

  const resultado = async (request: import("@playwright/test").APIRequestContext) => {
    const r = await request.get(`${BASE}/api/me/resultado`, { headers: loja.auth });
    expect(r.status()).toBe(200);
    return r.json();
  };

  test("serviço e produto entram separados, e a comissão só pega o serviço", async ({ request }) => {
    const d = await resultado(request);

    expect(d.servicos).toBe(160);
    // Se o produto não fosse somado, `entrou` seria 160 — o erro mais fácil
    // de cometer aqui, porque totalPrice parece o total.
    expect(d.produtos).toBe(50);
    expect(d.entrou).toBe(210);

    // 50% de 160, e NÃO de 210: o barbeiro não ganha comissão da pomada.
    expect(d.comissoes).toBe(80);
  });

  test("o custo do produto vira margem, e não desconta do lucro duas vezes", async ({ request }) => {
    const d = await resultado(request);

    expect(d.margemProdutos.vendeu).toBe(50);
    expect(d.margemProdutos.custou).toBe(20);
    expect(d.margemProdutos.margem).toBe(30);
    expect(d.margemProdutos.itensSemCusto).toBe(0);

    // A margem é informativa: o lucro é entrou − comissões − despesas, sem o
    // custo entrar de novo (a compra do produto já vira despesa lançada).
    expect(d.lucro).toBe(210 - 80 - d.despesas);
  });

  test("despesa lançada derruba o lucro no mesmo valor", async ({ request }) => {
    const antes = await resultado(request);

    const r = await request.post(`${BASE}/api/me/despesas`, {
      headers: loja.auth,
      data: { descricao: "Aluguel", valor: 30, categoria: "aluguel" },
    });
    expect(r.status()).toBe(200);

    const depois = await resultado(request);
    expect(depois.despesas).toBe(antes.despesas + 30);
    expect(depois.lucro).toBe(antes.lucro - 30);
    expect(depois.despesasPorCategoria.aluguel).toBe(30);
  });

  test("categoria inventada é recusada", async ({ request }) => {
    const r = await request.post(`${BASE}/api/me/despesas`, {
      headers: loja.auth,
      data: { descricao: "Qualquer", valor: 10, categoria: "cerveja" },
    });
    expect(r.status()).toBe(400);
  });

  test("valor zero ou negativo é recusado", async ({ request }) => {
    for (const valor of [0, -50]) {
      const r = await request.post(`${BASE}/api/me/despesas`, {
        headers: loja.auth,
        data: { descricao: "Erro", valor, categoria: "outros" },
      });
      expect(r.status()).toBe(400);
    }
  });

  test("barbeiro não vê as despesas do dono", async ({ request }) => {
    const nova = await request.post(`${BASE}/api/auth/add-barber`, {
      headers: loja.auth,
      data: { name: "Zé", phone: "11966660001", password: "senha123", commission: 30 },
    });
    expect(nova.status()).toBe(200);

    const login = await request.post(`${BASE}/api/auth/login`, {
      data: { phone: "11966660001", password: "senha123" },
    });
    const token = (await login.json()).token;

    const r = await request.get(`${BASE}/api/me/despesas`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Aluguel não é assunto de quem recebe comissão sobre o corte.
    expect(r.status()).toBe(401);

    const res = await request.get(`${BASE}/api/me/resultado`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(401);

    await db().barber.deleteMany({ where: { phone: "11966660001" } });
  });

  test("a despesa de outra barbearia não é editável", async ({ request }) => {
    const outra = await criarLoja(request);
    try {
      const criada = await request.post(`${BASE}/api/me/despesas`, {
        headers: outra.auth,
        data: { descricao: "Aluguel da outra", valor: 999, categoria: "aluguel" },
      });
      const id = (await criada.json()).despesa.id;

      const invasao = await request.patch(`${BASE}/api/me/despesas`, {
        headers: loja.auth,
        data: { id, valor: 1 },
      });
      expect(invasao.status()).toBe(404);

      const apagar = await request.delete(`${BASE}/api/me/despesas`, {
        headers: loja.auth,
        data: { id },
      });
      expect(apagar.status()).toBe(404);

      // E continua lá, intacta.
      const ainda = await db().expense.findUnique({ where: { id } });
      expect(Number(ainda?.valor)).toBe(999);
    } finally {
      await db().expense.deleteMany({ where: { shopId: outra.shopId } });
      await apagarLoja(outra);
    }
  });

  test("a despesa que repete é lançada uma vez por mês, não uma por rodada", async ({ request }) => {
    const hoje = hojeSP();
    // Molde no mês passado — o cron deve trazê-lo para o mês corrente.
    const molde = await db().expense.create({
      data: {
        shopId: loja.shopId,
        descricao: "Luz",
        valor: 45,
        categoria: "contas",
        data: new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 10, 12, 0, 0)),
        recorrente: true,
      },
    });

    const segredo = segredoDoCron();
    const headers: Record<string, string> = segredo ? { Authorization: `Bearer ${segredo}` } : {};

    const um = await request.get(`${BASE}/api/cron/despesas`, { headers });
    expect(um.status()).toBe(200);

    const copias = () => db().expense.count({ where: { origemId: molde.id } });
    expect(await copias()).toBe(1);

    // Rodar de novo no mesmo dia não pode duplicar: o cron é diário de
    // propósito, para que uma falha no dia 1º não custe o mês inteiro.
    await request.get(`${BASE}/api/cron/despesas`, { headers });
    await request.get(`${BASE}/api/cron/despesas`, { headers });
    expect(await copias()).toBe(1);

    // E a cópia entra na conta do mês.
    const d = await resultado(request);
    expect(d.despesasPorCategoria.contas).toBe(45);

    await db().expense.deleteMany({ where: { origemId: molde.id } });
    await db().expense.delete({ where: { id: molde.id } });
  });
});
