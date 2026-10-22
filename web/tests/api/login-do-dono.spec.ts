import { test, expect } from "@playwright/test";
import bcrypt from "bcryptjs";
import { BASE, criarLoja, apagarLoja, fecharDb, db, type Loja } from "./_ajudantes";

/**
 * O dono existe em dois lugares (conta de dono + perfil de barbeiro dele).
 * Quando as senhas dos dois se separavam, entrar com a do perfil virava
 * login de BARBEIRO: sumiam endereço, produtos e despesas, e o Financeiro
 * quebrava. Aconteceu ao reinstalar o app na tela de início.
 */
test.describe("Login e senha do dono", () => {
  let loja: Loja;

  test.beforeAll(async ({ request }) => {
    loja = await criarLoja(request);
    // O estado que existia em produção: perfil do dono com outra senha.
    await db().barber.update({
      where: { id: loja.barbeiroDonoId },
      data: { passwordHash: await bcrypt.hash("senhaAntiga1", 10) },
    });
  });

  test.afterAll(async () => {
    await apagarLoja(loja);
    await fecharDb();
  });

  test("entrar com a senha do perfil de barbeiro do dono ainda é DONO", async ({ request }) => {
    const r = await request.post(`${BASE}/api/auth/login`, { data: { phone: loja.telefone, password: "senhaAntiga1" } });
    expect(r.status(), await r.text()).toBe(200);
    const j = await r.json();
    expect(j.role).toBe("owner");
    // E o token abre o que é só do dono.
    const fin = await request.get(`${BASE}/api/me/dashboard`, { headers: { Authorization: `Bearer ${j.token}` } });
    expect(fin.status()).toBe(200);
  });

  test("trocar a senha grava nas duas contas", async ({ request }) => {
    const r = await request.patch(`${BASE}/api/me/password`, {
      headers: loja.auth,
      data: { currentPassword: loja.senha, newPassword: "senhaNova99" },
    });
    expect(r.status(), await r.text()).toBe(200);

    const dono = await db().owner.findFirstOrThrow({ where: { phone: loja.telefone } });
    const perfil = await db().barber.findUniqueOrThrow({ where: { id: loja.barbeiroDonoId } });
    expect(await bcrypt.compare("senhaNova99", dono.passwordHash)).toBe(true);
    expect(await bcrypt.compare("senhaNova99", perfil.passwordHash), "o perfil do dono ficou com a senha velha").toBe(true);

    const login = await request.post(`${BASE}/api/auth/login`, { data: { phone: loja.telefone, password: "senhaNova99" } });
    expect((await login.json()).role).toBe("owner");
  });
});
