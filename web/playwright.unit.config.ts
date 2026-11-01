import { defineConfig } from "@playwright/test";

/**
 * Testes de função pura — sem servidor, sem banco, sem rede.
 *
 * Rodam em segundos. Existem porque a matemática dos horários é o tipo de
 * código que quebra em silêncio: não dá erro, dá horário errado na tela do
 * cliente. Esperar dois minutos de suíte de API para checar uma conta de
 * minutos faz ninguém checar.
 *
 *   npm run test:unit
 */

// O `.env` deste projeto é o banco de produção, e o Prisma o carrega sozinho.
// Teste de função pura que tocar no banco por engano tem de cair aqui, com
// conexão recusada, e não lá. O Prisma não sobrescreve o que já está definido.
process.env.DATABASE_URL = "postgresql://sem-banco@127.0.0.1:1/teste-de-unidade";
process.env.DIRECT_URL = process.env.DATABASE_URL;

export default defineConfig({
  testDir: "./tests/unit",
  fullyParallel: true,
  reporter: [["list"]],
  timeout: 10_000,
});
