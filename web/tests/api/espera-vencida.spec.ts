import { test, expect } from "@playwright/test";
import { criarLoja, apagarLoja, fecharDb, db, type Loja } from "./_ajudantes";
import { limparEsperaVencida, DIAS_SEM_DATA } from "../../src/app/lib/espera";

/**
 * Lista de espera que se limpa sozinha.
 *
 * A borda é o dia de HOJE: quem pediu vaga para hoje ainda pode conseguir às
 * 17h, e apagar de manhã tiraria da fila justamente quem ainda tinha chance.
 * Quem pediu para ontem não tem mais o que esperar.
 *
 * Chama a função direto em vez de bater na rota do cron porque o que está
 * sendo testado é a REGRA. A rota já tem o próprio teste, e passar por ela
 * traria o CRON_SECRET e o limitador por IP para dentro de uma pergunta que
 * não é sobre nenhum dos dois.
 */

const diaRelativo = (dias: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

test.describe("Expiração da lista de espera", () => {
  let loja: Loja;

  test.beforeAll(async ({ request }) => {
    loja = await criarLoja(request);
  });

  test.afterAll(async () => {
    await db().waitlist.deleteMany({ where: { shopId: loja.shopId } });
    await apagarLoja(loja);
    await fecharDb();
  });

  const entrar = (nome: string, preferredDate: string | null, createdAt?: Date) =>
    db().waitlist.create({
      data: {
        shopId: loja.shopId,
        clientName: nome,
        clientPhone: "11" + String(Date.now()).slice(-9),
        serviceIds: [],
        preferredDate,
        ...(createdAt ? { createdAt } : {}),
      },
      select: { id: true },
    });

  test("quem pediu para ontem sai; quem pediu para hoje fica", async () => {
    const ontem = await entrar("Vencida", diaRelativo(-1));
    const hoje = await entrar("De hoje", diaRelativo(0));
    const amanha = await entrar("De amanhã", diaRelativo(1));

    await limparEsperaVencida();

    const sobrou = await db().waitlist.findMany({
      where: { shopId: loja.shopId },
      select: { id: true },
    });
    const ids = sobrou.map((e) => e.id);

    expect(ids, "quem pediu ontem tinha que sair").not.toContain(ontem.id);
    // Esta é a que importa: apagar cedo demais tira da fila quem ainda
    // podia ser chamado no fim da tarde.
    expect(ids, "quem pediu HOJE tinha que ficar").toContain(hoje.id);
    expect(ids, "quem pediu amanhã tinha que ficar").toContain(amanha.id);
  });

  test("sem data preferida, o que vence é a idade do pedido", async () => {
    const velho = new Date(Date.now() - (DIAS_SEM_DATA + 1) * 24 * 60 * 60 * 1000);
    const novo = new Date(Date.now() - (DIAS_SEM_DATA - 1) * 24 * 60 * 60 * 1000);

    const antigo = await entrar("Pedido antigo", null, velho);
    const recente = await entrar("Pedido recente", null, novo);

    await limparEsperaVencida();

    const ids = (await db().waitlist.findMany({
      where: { shopId: loja.shopId }, select: { id: true },
    })).map((e) => e.id);

    expect(ids, `sem data e com mais de ${DIAS_SEM_DATA} dias tinha que sair`).not.toContain(antigo.id);
    expect(ids, "sem data mas ainda dentro do prazo tinha que ficar").toContain(recente.id);
  });

  test("a limpeza conta o que removeu", async () => {
    await db().waitlist.deleteMany({ where: { shopId: loja.shopId } });
    await entrar("Uma", diaRelativo(-3));
    await entrar("Outra", diaRelativo(-2));

    const r = await limparEsperaVencida();

    // Não dá para exigir igualdade: outra loja pode ter linha vencida no
    // mesmo banco. O que precisa valer é que estas duas contaram.
    expect(r.removidos).toBeGreaterThanOrEqual(2);
    const restou = await db().waitlist.count({ where: { shopId: loja.shopId } });
    expect(restou).toBe(0);
  });
});
