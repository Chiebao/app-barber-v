#!/usr/bin/env node
/**
 * Smoke test do BarberPro — roda contra produção (ou qualquer URL) depois de
 * cada deploy pra garantir que os fluxos críticos não quebraram.
 *
 * Uso:
 *   node scripts/smoke.mjs
 *   SMOKE_BASE=https://barberpro-mauve.vercel.app node scripts/smoke.mjs
 *
 * Opcional (testa login de verdade — sem isso, o teste de login é pulado):
 *   SMOKE_PHONE=15999999999 SMOKE_PASSWORD=suasenha node scripts/smoke.mjs
 *
 * É seguro rodar em produção: só faz leitura. O único POST é intencionalmente
 * inválido (prova que a rota /api/appointments responde 400 sem criar dados).
 *
 * Sai com código 1 se qualquer teste falhar (dá pra usar em CI depois).
 */

const BASE = (process.env.SMOKE_BASE || "https://barberpro-mauve.vercel.app").replace(/\/$/, "");
const SLUG = process.env.SMOKE_SLUG || "henrbarber";
const PHONE = process.env.SMOKE_PHONE || "";
const PASSWORD = process.env.SMOKE_PASSWORD || "";

const GREEN = "\x1b[32m", RED = "\x1b[31m", DIM = "\x1b[2m", YEL = "\x1b[33m", RESET = "\x1b[0m";

let passed = 0, failed = 0, skipped = 0;

async function check(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    const ms = Date.now() - t0;
    console.log(`${GREEN}✓${RESET} ${name} ${DIM}(${ms}ms)${RESET}`);
    passed++;
  } catch (err) {
    console.log(`${RED}✗ ${name}${RESET}`);
    console.log(`  ${RED}${err.message}${RESET}`);
    failed++;
  }
}

function skip(name, reason) {
  console.log(`${YEL}⊘${RESET} ${name} ${DIM}(pulado: ${reason})${RESET}`);
  skipped++;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  console.log(`\n🔍 Smoke test — ${BASE}\n`);

  // 1. Barbearia carrega e tem dados essenciais
  let shop = null;
  await check("Barbearia carrega (/api/shops/:slug)", async () => {
    const res = await fetch(`${BASE}/api/shops/${SLUG}`);
    assert(res.ok, `status ${res.status}`);
    const data = await res.json();
    shop = data.shop;
    assert(shop && shop.id, "resposta sem shop.id");
    assert(Array.isArray(shop.barbers) && shop.barbers.length > 0, "sem barbeiros");
    assert(Array.isArray(shop.services) && shop.services.length > 0, "sem serviços");
  });

  // 2. Lista de horários responde
  await check("Horários disponíveis (/api/shops/:slug/slots)", async () => {
    assert(shop, "shop não carregou no passo anterior");
    const barberId = shop.barbers[0].id;
    const date = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0]; // +3 dias
    const res = await fetch(`${BASE}/api/shops/${SLUG}/slots?date=${date}&duration=30&barberId=${barberId}`);
    assert(res.ok, `status ${res.status}`);
    const data = await res.json();
    assert("slots" in data, "resposta sem campo slots");
  });

  // 3. Endpoint de agendamento está vivo (POST inválido → 400, não cria nada)
  await check("Endpoint de agendamento responde (POST inválido → 400)", async () => {
    const res = await fetch(`${BASE}/api/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopId: "x" }), // faltam campos obrigatórios
    });
    assert(res.status === 400, `esperava 400, veio ${res.status}`);
  });

  // 4. Login do dono (só se credenciais foram fornecidas)
  if (PHONE && PASSWORD) {
    await check("Login do dono (/api/auth/login)", async () => {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: PHONE.replace(/\D/g, ""), password: PASSWORD }),
      });
      assert(res.ok, `status ${res.status}`);
      const data = await res.json();
      assert(data.token, "login sem token");
    });
  } else {
    skip("Login do dono", "defina SMOKE_PHONE e SMOKE_PASSWORD");
  }

  // 5. Credenciais erradas são rejeitadas (401)
  await check("Login rejeita senha errada (→ 401)", async () => {
    // Telefone diferente a cada rodada: a trava de força bruta conta por
    // identidade, e um número fixo acumularia falhas de um deploy para o
    // outro até o próprio smoke levar 429 e acusar erro que não existe.
    // O DDD 00 não existe, então nunca colide com cliente de verdade.
    const inexistente = "00" + String(Date.now()).slice(-9);
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: inexistente, password: "senha-invalida-xyz" }),
    });
    assert(res.status === 401, `esperava 401, veio ${res.status}`);
  });

  // 6. Páginas HTML abrem (não retornam 500)
  for (const [label, path] of [
    ["Home pública", `/${SLUG}`],
    ["Meus agendamentos", `/${SLUG}/meus-agendamentos`],
    ["Login/painel admin", `/admin`],
    ["Página de download", `/download`],
  ]) {
    await check(`Página "${label}" abre (${path})`, async () => {
      const res = await fetch(`${BASE}${path}`);
      assert(res.ok, `status ${res.status}`);
      const html = await res.text();
      assert(html.includes("<!DOCTYPE html>") || html.includes("<html"), "não parece HTML");
    });
  }

  // Resumo
  console.log(`\n${passed} ${GREEN}ok${RESET}, ${failed} ${failed ? RED : ""}falhou${RESET}, ${skipped} pulado\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(`${RED}Erro fatal:${RESET}`, err.message);
  process.exit(1);
});
