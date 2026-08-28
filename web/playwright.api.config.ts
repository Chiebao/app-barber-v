import { defineConfig } from "@playwright/test";

/**
 * Testes de regra de negócio, pela API.
 *
 * Separados dos testes de navegador de propósito: rodam em segundos, não
 * dependem de layout, e cobrem justamente o que quebra caro — dinheiro,
 * comissão, bloqueio de assinatura e isolamento entre barbearias.
 *
 * Cada teste cria a própria barbearia descartável e a apaga no fim, então
 * pode rodar contra o banco de desenvolvimento sem sujar nada.
 *
 * Para apontar para produção:
 *   TEST_BASE_URL=https://barberpro-mauve.vercel.app npm run test:api
 */
export default defineConfig({
  testDir: "./tests/api",
  // Sem paralelismo: os testes criam e apagam lojas, e uma limpeza
  // atropelando a outra dá falha por motivo errado.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Espera pelo limite de cadastro (5/min) sem estourar
  timeout: 180_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:3000",
    trace: "off",
  },
  // Sobe o servidor só quando estiver testando local
  ...(process.env.TEST_BASE_URL
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: "http://localhost:3000",
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
