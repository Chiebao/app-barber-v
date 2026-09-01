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
export default defineConfig({
  testDir: "./tests/unit",
  fullyParallel: true,
  reporter: [["list"]],
  timeout: 10_000,
});
