/**
 * Conserta o endereço que veio de um botão de modelo do WhatsApp mal cadastrado.
 *
 * O botão dinâmico da Meta já põe o {{1}} depois do campo de URL. Com outro
 * {{1}} escrito dentro do campo, ele fica gravado codificado e o cliente abre
 * `/%7B%7B1%7D%7Ddubarber`: "Barbearia não encontrada" na lista de espera e
 * "Link de pagamento não encontrado" na cobrança.
 *
 * Corrigir o modelo na Meta não resolve sozinho: a revisão demora, e mensagem
 * já entregue guarda o link antigo para sempre. Por isso o endereço é
 * consertado aqui. Slug e id de fatura nunca têm chaves, então a marca não
 * tem como ser parte de um endereço de verdade.
 */
const MARCA_DO_MODELO = /(?:%7B%7B|\{\{)1(?:%7D%7D|\}\})/gi;

/** O caminho sem a marca do modelo, ou `null` se não há nada a consertar. */
export function caminhoSemMarcaDoModelo(caminho: string): string | null {
  const limpo = caminho.replace(MARCA_DO_MODELO, "");
  return limpo === caminho ? null : limpo;
}
