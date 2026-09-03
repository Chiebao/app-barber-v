import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { situacao, registrarFalha, limpar, LOGIN } from "../../src/app/lib/limite";

/**
 * A contagem de tentativas, sem HTTP no meio.
 *
 * A versão por rota deste teste era instável e a causa é interessante: o
 * limitador por IP do middleware devolvia 429 antes de a rota rodar, então as
 * tentativas do teste não chegavam ao contador. Dois limitadores defendendo
 * de coisas diferentes, um escondendo o outro do teste.
 *
 * Que a rota usa a trava, o teste de API já prova. O que se testa aqui é a
 * REGRA: isolamento por chave e castigo que dobra.
 *
 * Fica na suíte de API, e não na rápida, por um motivo simples: ele fala com
 * o banco. Teste que atravessa a rede não é unitário, e colocá-lo na suíte
 * rápida tira dela justamente o que a torna útil — ser rápida.
 */

const p = new PrismaClient();

const A = "teste:limite:alvo";
const B = "teste:limite:vizinho";

test.afterAll(async () => {
  await p.rateLimit.deleteMany({ where: { chave: { startsWith: "teste:limite:" } } });
  await p.$disconnect();
});

test.beforeEach(async () => {
  await p.rateLimit.deleteMany({ where: { chave: { startsWith: "teste:limite:" } } });
});

test("dentro do limite não bloqueia", async () => {
  for (let i = 0; i < LOGIN.max; i++) {
    const r = await registrarFalha(A, LOGIN);
    expect(r.bloqueado, `tentativa ${i + 1} de ${LOGIN.max}`).toBe(false);
  }
});

test("passar do limite bloqueia", async () => {
  for (let i = 0; i < LOGIN.max; i++) await registrarFalha(A, LOGIN);
  const estouro = await registrarFalha(A, LOGIN);
  expect(estouro.bloqueado).toBe(true);
  expect(estouro.segundos).toBeGreaterThan(0);
  expect((await situacao(A)).bloqueado).toBe(true);
});

test("bloquear uma chave não encosta na outra", async () => {
  // É o ponto central do desenho: travar por IP derrubaria junto quem divide
  // a rede — a barbearia inteira num WiFi só.
  for (let i = 0; i <= LOGIN.max; i++) await registrarFalha(A, LOGIN);

  expect((await situacao(A)).bloqueado).toBe(true);
  expect((await situacao(B)).bloqueado).toBe(false);
});

test("o castigo dobra a cada rodada", async () => {
  const primeiro = await castigar();
  const segundo = await castigar();
  // Bloqueio fixo é fácil de esperar; quem insiste precisa esperar mais.
  expect(segundo).toBeGreaterThan(primeiro);

  async function castigar() {
    // Zera só a contagem da janela, preservando o histórico de castigos —
    // é ele que faz a rodada seguinte custar mais.
    await p.rateLimit.updateMany({
      where: { chave: A },
      data: { tentativas: 0, janelaAte: new Date(Date.now() + LOGIN.janelaMs) },
    });
    let ultimo = { bloqueado: false, segundos: 0 };
    for (let i = 0; i <= LOGIN.max; i++) ultimo = await registrarFalha(A, LOGIN);
    return ultimo.segundos;
  }
});

test("o castigo tem teto", async () => {
  // Sem teto, quem esquece a senha de manhã fica de fora o dia inteiro.
  for (let rodada = 0; rodada < 12; rodada++) {
    await p.rateLimit.updateMany({
      where: { chave: A },
      data: { tentativas: 0, janelaAte: new Date(Date.now() + LOGIN.janelaMs) },
    });
    for (let i = 0; i <= LOGIN.max; i++) await registrarFalha(A, LOGIN);
  }
  const s = await situacao(A);
  expect(s.segundos).toBeLessThanOrEqual(LOGIN.castigoMaxMs / 1000 + 1);
});

test("acertar limpa o histórico", async () => {
  // Quem entrou não pode carregar contador: o dono que errou duas vezes hoje
  // começaria amanhã já perto do bloqueio.
  for (let i = 0; i <= LOGIN.max; i++) await registrarFalha(A, LOGIN);
  await limpar(A);
  expect((await situacao(A)).bloqueado).toBe(false);
  expect(await p.rateLimit.findUnique({ where: { chave: A } })).toBeNull();
});
