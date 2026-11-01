// Servidor para testar o robô comercial com o número de TESTE da Meta.
//
// Lê tudo de `web/.env.robo-teste.local` e deixa em branco o resto dos .env: o `.env`
// deste projeto é o banco de produção, com o token da linha de verdade, e o Next
// não sobrescreve variável que já veio do processo. Se o banco não for local, para.
//
//   DATABASE_URL=postgresql://postgres:SENHA@127.0.0.1:5432/barber_teste
//   WHATSAPP_API_TOKEN=token temporário da página "API Setup" da Meta
//   WHATSAPP_PHONE_ID=id do número de teste
//   WHATSAPP_VERIFY_TOKEN=uma palavra que você inventa
//   WHATSAPP_APP_SECRET=segredo do app na Meta
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORTA = process.env.PORT || "3300";

function lerEnv(arquivo) {
  const valores = {};
  if (!existsSync(path.join(raiz, arquivo))) return valores;
  for (const linha of readFileSync(path.join(raiz, arquivo), "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) valores[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return valores;
}

const teste = lerEnv(".env.robo-teste.local");
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(teste.DATABASE_URL || "")) {
  console.error("Parei: DATABASE_URL de web/.env.robo-teste.local precisa apontar para um banco local.");
  process.exit(1);
}

const emBranco = {};
for (const arquivo of [".env", ".env.local", ".env.development", ".env.development.local"]) {
  for (const nome of Object.keys(lerEnv(arquivo))) emBranco[nome] = "";
}

const filho = spawn(`npx next dev -p ${PORTA}`, {
  cwd: raiz,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    ...emBranco,
    JWT_SECRET: "so-para-testar-o-robo-no-banco-local",
    NEXT_PUBLIC_BASE_URL: `http://localhost:${PORTA}`,
    DIRECT_URL: teste.DATABASE_URL,
    ...teste,
  },
});

filho.on("exit", (codigo) => process.exit(codigo ?? 0));
