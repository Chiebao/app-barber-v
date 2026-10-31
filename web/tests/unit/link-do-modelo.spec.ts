import { test, expect } from "@playwright/test";
import { caminhoSemMarcaDoModelo } from "../../src/app/lib/link-do-modelo";

/**
 * Botão de modelo do WhatsApp cadastrado com o {{1}} dentro da URL: o cliente
 * abria `/%7B%7B1%7D%7Ddubarber` e via "Barbearia não encontrada".
 */

test("o link da barbearia volta para o slug", () => {
  expect(caminhoSemMarcaDoModelo("/%7B%7B1%7D%7Ddubarber")).toBe("/dubarber");
});

test("o link de pagamento volta para a fatura", () => {
  expect(caminhoSemMarcaDoModelo("/pagar/%7B%7B1%7D%7Dcmgabc123xyz")).toBe("/pagar/cmgabc123xyz");
});

test("vale em minúsculas e sem codificar", () => {
  expect(caminhoSemMarcaDoModelo("/%7b%7b1%7d%7ddubarber")).toBe("/dubarber");
  expect(caminhoSemMarcaDoModelo("/{{1}}dubarber")).toBe("/dubarber");
});

test("endereço normal não é tocado", () => {
  // `null` e não o próprio caminho: é o que impede redirecionar para si mesmo.
  expect(caminhoSemMarcaDoModelo("/dubarber")).toBeNull();
  expect(caminhoSemMarcaDoModelo("/pagar/cmgabc123xyz")).toBeNull();
  expect(caminhoSemMarcaDoModelo("/")).toBeNull();
});
