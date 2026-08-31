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
 *
 * NÃO existe modelo para avisar o barbeiro de um novo agendamento: isso já
 * chega por push (Expo no app, Web Push no painel) e seria a mensagem de
 * maior volume do sistema, paga por envio, repetindo o que é de graça.
 */

export type NomeModelo =
  | "lembrete_agendamento"
  | "vaga_disponivel"
  | "codigo_recuperacao"
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

  // Texto deliberadamente seco. A primeira versao ("corre que e por ordem de
  // chegada") foi classificada como Marketing pela Meta e seria rejeitada:
  // urgencia e convite viram "oferta" para o classificador. Enquadrar como
  // resposta a uma solicitacao que o cliente ja fez e o que mantem em Utilidade.
  vaga_disponivel: {
    nome: "vaga_disponivel",
    idioma: "pt_BR",
    variaveis: 4,
    textoAprovado:
      "Olá, {{1}}. Sobre sua solicitação de lista de espera na {{2}}: " +
      "abriu um horário em {{3}} às {{4}}. Acesse seu link de agendamento para confirmar.",
  },

  // Categoria Autenticacao: a Meta escreve o corpo, nao nos. So aceita UMA
  // variavel, o proprio codigo — o prazo de expiracao e a linha de seguranca
  // sao opcoes do formulario, nao variaveis. Por isso este modelo tem 1.
  //
  // Cadastrado com entrega "Copiar codigo": as opcoes de preenchimento
  // automatico exigem pacote Android e hash de assinatura, e a recuperacao
  // de senha acontece no navegador — nao ha app para receber o codigo.
  //
  // Os 10 minutos do formulario precisam continuar batendo com o
  // VALIDADE_MINUTOS de api/auth/forgot.
  codigo_recuperacao: {
    nome: "codigo_recuperacao",
    idioma: "pt_BR",
    variaveis: 1,
    // Texto gerado pela Meta, reproduzido aqui so para conferencia.
    textoAprovado:
      "{{1}} é seu código de verificação. Por segurança, não compartilhe esse código. " +
      "Esse código expira em 10 minutos.",
  },


  // Tambem reprovado como Marketing na primeira versao. O gatilho aqui foi
  // outro: nome do produto ("assinatura do BarberPro") junto com o preco
  // ("O valor e R$ ...") le como oferta. Aviso de fatura precisa parecer
  // fatura — sem marca, sem preco anunciado, so o dado da cobranca.
  cobranca_assinatura: {
    nome: "cobranca_assinatura",
    idioma: "pt_BR",
    variaveis: 3,
    textoAprovado:
      "Olá, {{1}}. Sua assinatura vence em {{2}}. A fatura de {{3}} já está " +
      "disponível no seu painel, em Configurações.",
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
