/**
 * Tudo o que o robô comercial escreve. Mora num arquivo só de propósito.
 *
 * Os textos e os botões foram aprovados pelo dono em 01/11/2026
 * (`venda_app_barber/chatbot/fluxo.md`). Não reescrever aqui sem passar por ele:
 * o robô só diz o que está escrito, e é isso que impede inventar preço ou promessa.
 *
 * Limites da Meta: até 3 botões por mensagem, 20 caracteres por botão e 1.024
 * no texto de quem leva botão. Um teste confere todos.
 */

export interface Botao {
  id: IdDoBotao;
  titulo: string;
}

export interface Mensagem {
  texto: string;
  botoes?: Botao[];
}

export type IdDoBotao =
  | "sou_dono" | "sou_barbeiro" | "sou_cliente"
  | "so_eu" | "dois_ou_tres" | "quatro_ou_mais"
  | "caderno" | "whatsapp" | "outro_app"
  | "quero_testar" | "ver_precos" | "tenho_duvida" | "falar_com_pessoa";

export const BOTOES: Record<IdDoBotao, Botao> = {
  sou_dono: { id: "sou_dono", titulo: "Sou dono" },
  sou_barbeiro: { id: "sou_barbeiro", titulo: "Sou barbeiro" },
  sou_cliente: { id: "sou_cliente", titulo: "Sou cliente" },
  so_eu: { id: "so_eu", titulo: "Só eu" },
  dois_ou_tres: { id: "dois_ou_tres", titulo: "2 ou 3" },
  quatro_ou_mais: { id: "quatro_ou_mais", titulo: "4 ou mais" },
  caderno: { id: "caderno", titulo: "Caderno" },
  whatsapp: { id: "whatsapp", titulo: "WhatsApp" },
  outro_app: { id: "outro_app", titulo: "Outro app" },
  quero_testar: { id: "quero_testar", titulo: "Quero testar" },
  ver_precos: { id: "ver_precos", titulo: "Ver os preços" },
  tenho_duvida: { id: "tenho_duvida", titulo: "Tenho uma dúvida" },
  falar_com_pessoa: { id: "falar_com_pessoa", titulo: "Falar com pessoa" },
};

/** Só uma pessoa resolve o que chega aqui. A linha do robô não tem caixa de entrada. */
const SUPORTE = "5515997767794";
const LINK_DO_SUPORTE = `https://wa.me/${SUPORTE}`;

/** A mensagem pronta do link da bio do Instagram. */
export const MENSAGEM_DO_INSTAGRAM = "Oi, vim do Instagram e quero conhecer o BarberPro";
/** Tem de ser igual ao `CONVITE` de `web/src/app/page.tsx`. */
export const MENSAGEM_DO_SITE = "Oi! Quero saber mais sobre o BarberPro";

const ABERTURA_INSTAGRAM = "Fala! Vi que você veio do Instagram. Aqui é o atendimento automático do BarberPro, a agenda online para barbearia.";
const ABERTURA = "Fala! Aqui é o atendimento automático do BarberPro, a agenda online para barbearia.";
const QUAL_O_CASO = "Qual é o seu caso?";

const BOTOES_P1 = [BOTOES.sou_dono, BOTOES.sou_barbeiro, BOTOES.sou_cliente];

export function boasVindas(veioDoInstagram: boolean): Mensagem {
  return {
    texto:
      `${veioDoInstagram ? ABERTURA_INSTAGRAM : ABERTURA}\n\n` +
      "Se você trabalha em barbearia, são 3 perguntas rápidas e eu te mostro o app funcionando. Para falar com uma pessoa, escreve ATENDENTE. Para eu parar de te escrever, escreve PARAR.\n\n" +
      QUAL_O_CASO,
    botoes: BOTOES_P1,
  };
}

/** A P1 repetida depois de uma pergunta solta, sem a apresentação. */
export const P1: Mensagem = { texto: QUAL_O_CASO, botoes: BOTOES_P1 };

export const P2: Mensagem = {
  texto: "Quantos barbeiros atendem aí, contando com você?",
  botoes: [BOTOES.so_eu, BOTOES.dois_ou_tres, BOTOES.quatro_ou_mais],
};

export const P3: Mensagem = {
  texto: "E como a agenda funciona hoje?",
  botoes: [BOTOES.caderno, BOTOES.whatsapp, BOTOES.outro_app],
};

const ABERTURA_DA_DEMONSTRACAO: Record<string, string> = {
  caderno: "Entendi, tudo no caderno.",
  whatsapp: "Entendi, tudo por mensagem.",
  outro_app: "Beleza, assim você consegue comparar.",
};

/** Sem resposta da P3, não tem abertura. */
export function demonstracao(agenda: string | null): Mensagem {
  const abertura = agenda ? ABERTURA_DA_DEMONSTRACAO[agenda] : null;
  return {
    texto:
      (abertura ? `${abertura}\n\n` : "") +
      "Olha a tela que o seu cliente vê, nesta barbearia de demonstração:\n" +
      "https://barberpro-mauve.vercel.app/henrbarber\n\n" +
      "Você manda o link, e ele marca o horário sozinho. No dia do corte, o BarberPro lembra o cliente no WhatsApp.",
  };
}

export const OFERTA: Mensagem = {
  texto: "Dá para testar na sua barbearia por 14 dias, de graça e sem pagar nada na entrada. O que você prefere?",
  botoes: [BOTOES.quero_testar, BOTOES.ver_precos, BOTOES.tenho_duvida],
};

export const DUVIDA: Mensagem = {
  texto: "Manda sua dúvida em poucas palavras. Se eu não souber responder, te mando o contato de uma pessoa. Para falar com uma pessoa agora, escreve ATENDENTE.",
};

export const TESTE: Mensagem = {
  texto:
    "Fechado. É só cadastrar a barbearia aqui:\n" +
    "https://barberpro-mauve.vercel.app/admin\n\n" +
    "Quando o teste acaba, você escolhe um plano para continuar usando a agenda. Se quiser ajuda para montar, escreve ATENDENTE.",
};

export const PRECOS: Mensagem = {
  texto:
    "É uma assinatura por barbearia, com barbeiros à vontade:\n\n" +
    "Mensal: R$ 45,90 por mês, sem fidelidade\n" +
    "Trimestral: R$ 39,90 por mês (R$ 119,70 a cada 3 meses)\n" +
    "Semestral: R$ 34,90 por mês (R$ 209,40 a cada 6 meses)\n" +
    "Anual: R$ 29,90 por mês (R$ 358,80 por ano)\n\n" +
    "E os 14 dias de teste são de graça.",
  botoes: [BOTOES.quero_testar, BOTOES.tenho_duvida],
};

const PAPEL_NO_RESUMO: Record<string, string> = {
  sou_dono: "Sou dono",
  sou_barbeiro: "Sou barbeiro",
};
const BARBEIROS_NO_RESUMO: Record<string, string> = {
  so_eu: "só eu de barbeiro",
  dois_ou_tres: "2 ou 3 barbeiros",
  quatro_ou_mais: "4 ou mais barbeiros",
};
const AGENDA_NO_RESUMO: Record<string, string> = {
  caderno: "agenda no caderno",
  whatsapp: "agenda no WhatsApp",
  outro_app: "agenda em outro app",
};

/** O que vem escrito no link, para a pessoa não ter de repetir o que já respondeu. */
export function resumoParaAtendente(r: { papel: string | null; barbeiros: string | null; agenda: string | null }): string {
  const partes = [
    r.papel && PAPEL_NO_RESUMO[r.papel],
    r.barbeiros && BARBEIROS_NO_RESUMO[r.barbeiros],
    r.agenda && AGENDA_NO_RESUMO[r.agenda],
  ].filter(Boolean);
  if (partes.length === 0) return "Oi, vim do atendimento automático e quero falar sobre o BarberPro.";
  return `Oi, vim do atendimento automático. ${partes.join(", ")}.`;
}

export function atendente(r: { papel: string | null; barbeiros: string | null; agenda: string | null }): Mensagem {
  return {
    texto:
      "Por aqui é só o robô. Toca neste link e manda a mensagem que já vem escrita, que quem responde é uma pessoa:\n" +
      `${LINK_DO_SUPORTE}?text=${encodeURIComponent(resumoParaAtendente(r))}`,
  };
}

export const CLIENTE: Mensagem = {
  texto:
    "Este número não marca horário. Para marcar ou remarcar, fala direto com a sua barbearia.\n\n" +
    "Se um dia quiser conhecer o BarberPro para a sua barbearia, escreve BARBERPRO.",
};

export const CONTA: Mensagem = {
  texto: `Vi que este número já tem cadastro no BarberPro. Por aqui é só o robô. Para falar com o suporte, toca neste link:\n${LINK_DO_SUPORTE}`,
};

export const PARAR_CONTA: Mensagem = {
  texto:
    `Combinado, você não vai mais receber lembretes nem avisos de vaga como cliente. Os avisos da sua conta, como a agenda do dia e a cobrança, continuam chegando. Para mudar isso, fala com o suporte: ${LINK_DO_SUPORTE}\n\n` +
    "Para voltar a receber os lembretes, escreve VOLTAR.",
};

export function pararCliente(linkDaBarbearia: string): Mensagem {
  return {
    texto:
      `Combinado, você não vai mais receber lembretes nem avisos de vaga por este número. Para falar com a sua barbearia, é por aqui: ${linkDaBarbearia}\n\n` +
      "Para voltar a receber, escreve VOLTAR.",
  };
}

export const PARAR_DEMAIS: Mensagem = {
  texto: "Combinado, não vou mais te escrever por aqui. Se mudar de ideia, escreve VOLTAR.",
};

export const VOLTAR_COM_CADASTRO: Mensagem = {
  texto: "Pronto, você voltou a receber os lembretes e avisos de vaga por este número.",
};

export const VOLTAR_DEMAIS: Mensagem = {
  texto: "Pronto, pedido desfeito. Se quiser conhecer o BarberPro, escreve BARBERPRO.",
};

export const LEMBRETE: Mensagem = {
  texto: "No dia do corte, o cliente recebe uma mensagem automática no WhatsApp com o horário e o serviço. Se precisar remarcar, ele responde e a mensagem aparece no seu painel.",
};

export const FALTA: Mensagem = {
  texto: "Quando o cliente tem 2 faltas marcadas pelo barbeiro, o app pede Pix antes de aceitar um novo horário, se a barbearia tiver Mercado Pago conectado ou chave Pix cadastrada.",
};

export const BAIXAR: Mensagem = {
  texto: "Seu cliente não precisa baixar nada: ele marca pelo link.",
};

export const NAO_ENTENDI: Mensagem = {
  texto: "Essa eu não sei responder por aqui, e não quero te falar nada errado. Como posso ajudar?",
  botoes: [BOTOES.quero_testar, BOTOES.ver_precos, BOTOES.falar_com_pessoa],
};

export const MIDIA: Mensagem = {
  texto: "Por aqui eu só leio texto. Escreve em poucas palavras ou escreve ATENDENTE para falar com uma pessoa.",
};

export interface BarbeariaDoCliente {
  name: string;
  phone: string | null;
  slug: string;
}

function baseDoSite(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || "https://barberpro-mauve.vercel.app").replace(/\/+$/, "");
}

function whatsappDaBarbearia(shop: BarbeariaDoCliente): string | null {
  if (!shop.phone) return null;
  const tel = shop.phone.replace(/\D/g, "");
  return `https://wa.me/${tel.startsWith("55") ? tel : `55${tel}`}`;
}

/** O WhatsApp da barbearia. Sem telefone cadastrado, a página Meus agendamentos. */
export function linkDaBarbearia(shop: BarbeariaDoCliente): string {
  return whatsappDaBarbearia(shop) ?? `${baseDoSite()}/${shop.slug}/meus-agendamentos`;
}

/**
 * A resposta a quem é cliente de barbearia. Veio do webhook como estava: o robô
 * não muda nada para esse público, nem oferece nada a ele.
 */
export function respostaAoCliente(
  shop: BarbeariaDoCliente,
  quando: { date: Date; startTime: string } | null,
): Mensagem {
  const linhas = [`Oi! 👋`, ``, `Esta linha é automática e não é lida por ninguém. 😅`, ``];

  const whatsapp = whatsappDaBarbearia(shop);
  if (whatsapp) {
    linhas.push(`Para falar com a *${shop.name}*, é por aqui:`, whatsapp, ``);
  } else {
    // Sem telefone cadastrado, não inventamos um número — mandamos para onde
    // ele consegue se resolver sozinho.
    linhas.push(`Para remarcar ou cancelar, é por aqui:`, linkDaBarbearia(shop), ``);
  }

  if (quando) {
    const dia = quando.date.toISOString().slice(0, 10).split("-").reverse().slice(0, 2).join("/");
    linhas.push(`📆 Seu horário: ${dia} às ${quando.startTime}`);
  }

  return { texto: linhas.join("\n") };
}
