import { test, expect } from "@playwright/test";
import { MODELOS } from "../../src/app/lib/whatsapp-templates";
import { enviarModelo, trocarConsultaDeParar } from "../../src/app/lib/whatsapp-send";

/**
 * Modelos com botão de URL dinâmica.
 *
 * O valor do botão fica FORA de `variaveis` porque `variaveis` vai inteira
 * para o componente `body`. Enfiar o link ali mandaria um parâmetro a mais
 * para um texto que não tem onde colocá-lo, e a Meta recusa o envio inteiro
 * — em silêncio, do ponto de vista de quem esperava a mensagem.
 */

test("o corpo do espera_sem_vaga não termina em variável", () => {
  // Regra da Meta: modelo cujo corpo termina em {{n}} é recusado na revisão,
  // porque não dá para validar o que vem depois. Foi o que tirou o link de
  // dentro do texto e botou no botão.
  const texto = MODELOS.espera_sem_vaga.textoAprovado.trim();
  expect(texto.endsWith("}}")).toBe(false);
});

test("quem tem botão com link declara isso no registro", () => {
  // Se o registro e o modelo cadastrado na Meta discordarem, o envio falha
  // por parâmetro faltando ou sobrando — nunca por algo legível.
  expect(MODELOS.espera_sem_vaga.botaoComLink).toBe(true);
  expect(MODELOS.espera_sem_vaga.variaveis).toBe(3);
});

test("sem o valor do botão, o envio para antes de sair", async () => {
  // Credenciais de mentira porque a checagem de credenciais vem ANTES da
  // do botão: sem elas o envio para no primeiro `if` e este teste passaria
  // mesmo que a guarda do botão não existisse. Elas nunca são usadas — a
  // guarda devolve false antes de qualquer chamada de rede.
  process.env.WHATSAPP_API_TOKEN = "token-de-teste";
  process.env.WHATSAPP_PHONE_ID = "000000";
  // Teste de unidade não tem banco: ninguém aqui pediu PARAR.
  trocarConsultaDeParar(async () => false);

  // `false` sozinho não prova nada: sem a guarda o envio iria para a rede,
  // levaria 401 do token de mentira e voltaria `false` igual. O que
  // distingue é o MOTIVO, então o teste lê o log.
  const erros: string[] = [];
  const original = console.error;
  console.error = (...a: unknown[]) => { erros.push(a.join(" ")); };

  let ok: boolean;
  try {
    ok = await enviarModelo("5511999999999", "espera_sem_vaga", [
      "Maria", "Barbearia do Zé", "4 de setembro",
    ]);
  } finally {
    console.error = original;
  }

  expect(ok).toBe(false);
  // Barrar aqui em vez de deixar a Meta recusar: o log fica com o nome do
  // modelo, que é o que permite descobrir qual chamada esqueceu o link.
  expect(erros.join(" | ")).toContain("precisa do valor do botao");
});

test("o exemplo do registro tem o mesmo tamanho que o corpo pede", () => {
  // O exemplo é o que vai no formulário da Meta. Divergir do número de
  // variáveis reprova o modelo na revisão, dias depois.
  for (const [nome, m] of Object.entries(MODELOS)) {
    expect(m.exemplo.length, `${nome}: exemplo com tamanho errado`).toBe(m.variaveis);
  }
});
