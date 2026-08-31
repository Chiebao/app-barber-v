/**
 * Modelos de mensagem do WhatsApp (Cloud API).
 *
 * POR QUE ISTO EXISTE
 * Fora da janela de 24h aberta por uma mensagem DO cliente, a Meta só entrega
 * mensagem baseada em modelo aprovado. Todas as nossas mensagens são
 * iniciadas por nós — lembrete, vaga liberada, código de senha, aviso ao
 * barbeiro — então todas precisam de modelo. Texto livre só funcionava no
 * número de teste, que é permissivo.
 *
 * COMO MANTER
 * O que está aqui precisa bater EXATAMENTE com o que foi aprovado no
 * WhatsApp Manager: mesmo nome, mesmo idioma, mesma quantidade de variáveis
 * e na mesma ordem. Se divergir, a Meta recusa o envio com erro 132000 e a
 * mensagem some em silêncio.
 *
 * Ao alterar o texto de um modelo aprovado, a Meta exige nova aprovação —
 * então mudar aqui sem mudar lá (ou o contrário) quebra o envio.
 */

export type NomeModelo =
  | "lembrete_agendamento"
  | "vaga_disponivel"
  | "codigo_recuperacao"
  | "novo_agendamento"
  | "cobranca_assinatura";

export interface Modelo {
  /** Nome exato cadastrado no WhatsApp Manager. */
  nome: NomeModelo;
  /** Código de idioma cadastrado — para português do Brasil, "pt_BR". */
  idioma: string;
  /** Quantas variáveis {{1}}, {{2}}... o corpo tem. */
  variaveis: number;
  /** O texto aprovado, aqui só para conferência humana. */
  textoAprovado: string;
}

export const MODELOS: Record<NomeModelo, Modelo> = {
  lembrete_agendamento: {
    nome: "lembrete_agendamento",
    idioma: "pt_BR",
    variaveis: 4,
    textoAprovado:
      "Olá, {{1}}! Passando para lembrar do seu horário na {{2}} hoje às {{3}} com {{4}}. " +
      "Se precisar remarcar, é só responder por aqui.",
  },

  vaga_disponivel: {
    nome: "vaga_disponivel",
    idioma: "pt_BR",
    variaveis: 4,
    textoAprovado:
      "Oi, {{1}}! Abriu uma vaga na {{2}} para {{3}} às {{4}}. " +
      "Se ainda tiver interesse, corre que é por ordem de chegada!",
  },

  codigo_recuperacao: {
    nome: "codigo_recuperacao",
    idioma: "pt_BR",
    variaveis: 2,
    textoAprovado:
      "Seu código de acesso ao BarberPro é {{1}}. Ele vale por {{2}} minutos. " +
      "Se não foi você quem pediu, ignore esta mensagem.",
  },

  novo_agendamento: {
    nome: "novo_agendamento",
    idioma: "pt_BR",
    variaveis: 4,
    textoAprovado:
      "Novo agendamento na {{1}}: {{2}} marcou para {{3}} às {{4}}. " +
      "Confira os detalhes no seu painel.",
  },

  cobranca_assinatura: {
    nome: "cobranca_assinatura",
    idioma: "pt_BR",
    variaveis: 3,
    textoAprovado:
      "Olá, {{1}}! Sua assinatura do BarberPro vence em {{2}}. " +
      "O valor é {{3}} e a cobrança já está pronta no seu painel, em Configurações › Minha assinatura.",
  },
};

/**
 * Texto que a mensagem terá, com as variáveis já aplicadas.
 *
 * Usado no log e no modo sem credenciais, para o desenvolvedor conseguir ver
 * o que TERIA sido enviado sem precisar abrir o painel da Meta.
 */
export function preverTexto(nome: NomeModelo, variaveis: string[]): string {
  return MODELOS[nome].textoAprovado.replace(
    /\{\{(\d+)\}\}/g,
    (_, i) => variaveis[Number(i) - 1] ?? "",
  );
}
