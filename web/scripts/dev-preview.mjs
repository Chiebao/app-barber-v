// Servidor de PRÉVIA para o painel do Claude (tela de celular ao lado do chat).
//
// - Banco: o pooler do `.env` (:6543). O `.env.local` aponta para um host
//   IPv6 que não responde daqui, e o Next daria preferência a ele.
// - O banco é o de PRODUÇÃO (só existe um). Por isso o WhatsApp vai DESLIGADO:
//   testar um agendamento na prévia não pode mandar mensagem para ninguém.
// - Porta 3100, para não brigar com o `npm run dev` da porta 3000.
//
// O Next não sobrescreve variável que já veio do processo, então o que é
// definido aqui ganha dos arquivos .env.
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORTA = process.env.PORT || "3100";

function lerEnv(arquivo) {
  const valores = {};
  for (const linha of readFileSync(path.join(raiz, arquivo), "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    valores[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return valores;
}

const env = lerEnv(".env");

const filho = spawn(`npx next dev -p ${PORTA}`, {
  cwd: raiz,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    DATABASE_URL: env.DATABASE_URL,
    DIRECT_URL: env.DIRECT_URL,
    NEXT_PUBLIC_BASE_URL: `http://localhost:${PORTA}`,
    WHATSAPP_API_TOKEN: "",
    WHATSAPP_PHONE_ID: "",
  },
});

filho.on("exit", (codigo) => process.exit(codigo ?? 0));
