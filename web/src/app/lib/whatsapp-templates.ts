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
  | "cobranca_assinatura"
  | "agendamento_marcado"
  | "agenda_do_dia"
  | "espera_sem_vaga";

export interface Modelo {
  /** Nome exato cadastrado no WhatsApp Manager. */
  nome: NomeModelo;
  /** Código de idioma cadastrado — para português do Brasil, "pt_BR". */
  idioma: string;
  /** Quantas variáveis {{1}}, {{2}}... o corpo tem. */
  variaveis: number;
  /** O texto aprovado, aqui só para conferência humana. */
  textoAprovado: string;
  /**
   * Valores de exemplo — os mesmos cadastrados como amostra na Meta.
   *
   * Servem para o diagnóstico disparar o modelo sem precisar forjar um
   * agendamento, uma lista de espera ou uma fatura só para ver se chega.
   */
  exemplo: string[];
  /**
   * Modelo de autenticação com botão "Copiar código".
   *
   * A Meta põe {{1}} dentro da URL do botão, então o mesmo código precisa
   * ser enviado DUAS vezes: no corpo e no botão. Mandar só o corpo faz o
   * envio ser recusado por parâmetro faltando — foi exatamente o que
   * aconteceu na primeira tentativa.
   */
  botaoComCodigo?: true;
}

export const MODELOS: Record<NomeModelo, Modelo> = {
  lembrete_agendamento: {
    nome: "lembrete_agendamento",
    idioma: "pt_BR",
    variaveis: 4,
    textoAprovado:
      "Olá, {{1}}! 🫡\n\n" +
      "Passando pra lembrar do seu horário na {{2}}:\n\n" +
      "📆 Hoje às {{3}}\n" +
      "💇 {{4}}\n\n" +
      "Se precisar remarcar, é só responder por aqui.",
    exemplo: ["João", "Barbearia do Zé", "14:30", "Corte + Barba"],
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
      "Olá, {{1}}! 📋\n\n" +
      "Sobre sua solicitação de lista de espera na {{2}}, abriu um horário:\n\n" +
      "📆 {{3}}\n" +
      "🕐 {{4}}\n\n" +
      "Acesse seu link de agendamento para confirmar.",
    exemplo: ["Maria", "Barbearia do Zé", "12 de setembro", "09:00"],
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
      "Seu código de verificação é *{{1}}*. Para sua segurança, não o compartilhe. " +
      "[rodapé] Expira em 10 minutos.",
    exemplo: ["123456"],
    botaoComCodigo: true,
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
      "Olá, {{1}}!\n\n" +
      "Sua assinatura vence em {{2}}.\n\n" +
      "💳 Fatura de {{3}}\n" +
      "📍 Painel, em Configurações\n\n" +
      "A cobrança já está pronta, é só abrir e pagar.",
    exemplo: ["Eduardo", "3 dias", "R$ 79,90"],
  },

  // A agenda do dia no WhatsApp do BARBEIRO, de manhã.
  //
  // Não é conveniência: é a cópia que sobrevive quando a internet da
  // barbearia cai (o que acontece muito mais que a Vercel cair). Se às 10h
  // nada carrega, a lista está no WhatsApp dele.
  //
  // A lista vai em UMA variável separada por " · " porque a Meta REJEITA
  // parâmetro com quebra de linha. Por isso ela não pode ser uma lista de
  // verdade, por mais que ficasse melhor.
  agenda_do_dia: {
    nome: "agenda_do_dia",
    idioma: "pt_BR",
    variaveis: 3,
    textoAprovado:
      "Bom dia, {{1}}! ☀️\n\n" +
      "Sua agenda de hoje na {{2}}:\n\n" +
      "📋 {{3}}\n\n" +
      "Guarde esta mensagem: se ficar sem internet, sua agenda está aqui.",
    exemplo: [
      "Eduardo",
      "Barbearia do Zé",
      "09:00 João (Corte) · 10:15 Pedro (Corte + Barba) · 14:00 Lucas (Corte)",
    ],
  },

  // Para o agendamento que o BARBEIRO cria no balcão e que acontece antes
  // de o cron de lembrete alcançá-lo. Não é lembrete: quem recebe isto
  // pode não saber ainda que tem horário marcado, e "passando pra lembrar"
  // pressupõe que ele já sabia.
  agendamento_marcado: {
    nome: "agendamento_marcado",
    idioma: "pt_BR",
    variaveis: 4,
    textoAprovado:
      "Olá, {{1}}! ✅\n\n" +
      "Seu horário na {{2}} ficou marcado:\n\n" +
      "📆 {{3}}\n" +
      "🕐 {{4}}\n\n" +
      "Se não puder vir, é só responder por aqui.",
    exemplo: ["João", "Barbearia do Zé", "12 de setembro", "14:30"],
  },

  // Para quem ficou na lista de espera e o dia passou sem abrir vaga.
  //
  // Sem isto o cliente some sem explicação: ele pediu para ser avisado, o
  // dia chegou, não abriu nada, e ninguém falou com ele. Do lado dele, a
  // barbearia ignorou o pedido.
  //
  // Enquadrado como resposta a uma solicitação que ELE fez — mesmo
  // enquadramento que manteve `vaga_disponivel` em Utilidade. Sem urgência
  // e sem convite, que é o que o classificador da Meta lê como Marketing.
  espera_sem_vaga: {
    nome: "espera_sem_vaga",
    idioma: "pt_BR",
    variaveis: 3,
    textoAprovado:
      "Olá, {{1}}! 📋\n\n" +
      "Sobre sua solicitação de lista de espera na {{2}}: não abriu horário para {{3}}.\n\n" +
      "Sua solicitação foi encerrada. Para escolher outro dia, é só acessar o link de agendamento.",
    exemplo: ["Maria", "Barbearia do Zé", "4 de setembro"],
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
