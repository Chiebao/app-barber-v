import { test, expect } from "@playwright/test";
import { BASE, criarLoja, apagarLoja, fecharDb, db, type Loja } from "./_ajudantes";

/**
 * Trava de força bruta que sobrevive ao serverless.
 *
 * O limitador do middleware é um `Map` em memória e cada instância tem o seu —
 * o limite de 10 logins por minuto vira 10 × o número de instâncias, que
 * cresce com a carga que o próprio ataque provoca. Este conta no banco.
 *
 * E conta por IDENTIDADE: quem ataca uma conta específica troca de IP de
 * graça, mas não troca o telefone do alvo.
 */

test.describe("Limite de tentativas de login", () => {
  let loja: Loja;

  test.beforeAll(async ({ request }) => {
    loja = await criarLoja(request);
  });

  test.afterAll(async () => {
    await db().rateLimit.deleteMany({ where: { chave: { contains: loja.telefone } } });
    await apagarLoja(loja);
    await fecharDb();
  });

  const tentar = (request: import("@playwright/test").APIRequestContext, senha: string) =>
    request.post(`${BASE}/api/auth/login`, { data: { phone: loja.telefone, password: senha } });

  test("senha errada demais trava a conta, e a trava é do banco", async ({ request }) => {
    // A política é 5 falhas na janela; a sexta bloqueia.
    for (let i = 0; i < 5; i++) {
      const r = await tentar(request, "senha_errada_" + i);
      expect(r.status(), `tentativa ${i + 1} ainda deve ser 401`).toBe(401);
    }

    const bloqueada = await tentar(request, "senha_errada_6");
    expect(bloqueada.status()).toBe(429);
    expect((await bloqueada.json()).error).toContain("Muitas tentativas");

    // O estado está no banco, não na memória da instância — é isso que faz a
    // trava valer para todas as instâncias ao mesmo tempo.
    const linha = await db().rateLimit.findUnique({ where: { chave: `login:${loja.telefone}` } });
    expect(linha?.bloqueadoAte).toBeTruthy();
    expect(linha!.bloqueadoAte!.getTime()).toBeGreaterThan(Date.now());
  });

  test("bloqueado, nem a senha CERTA entra", async ({ request }) => {
    // Se a senha certa passasse durante o castigo, a trava não seria trava:
    // bastaria continuar tentando até acertar.
    const r = await tentar(request, loja.senha);
    expect(r.status()).toBe(429);
  });

  test("a senha certa limpa o histórico", async ({ request }) => {
    // Tira o castigo à mão para simular o tempo passando.
    await db().rateLimit.deleteMany({ where: { chave: `login:${loja.telefone}` } });

    const ok = await tentar(request, loja.senha);
    expect(ok.status()).toBe(200);

    // Quem entrou não pode carregar contador — senão o dono legítimo que
    // errou duas vezes hoje começa amanhã já perto do bloqueio.
    const linha = await db().rateLimit.findUnique({ where: { chave: `login:${loja.telefone}` } });
    expect(linha).toBeNull();
  });
});
