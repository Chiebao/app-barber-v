/**
 * A decisão do robô comercial: quem escreveu, o que escreveu, o que responder.
 *
 * Função pura, sem banco e sem envio. A mesma linha recebe interessado, cliente
 * de barbearia e quem já tem conta, e errar a ordem aqui é mandar o preço do
 * BarberPro para quem perguntou quanto custa o corte. Por isso cada linha da
 * tabela de `fluxo.md` tem teste, e o teste não precisa de banco.
 *
 * A trava de mensagem repetida (ordem 1) fica no webhook, antes de qualquer
 * resposta. O limite de respostas por hora fica em `lib/robo.ts`.
 */

import * as T from "@/app/lib/robo-textos";
import type { BarbeariaDoCliente, IdDoBotao, Mensagem } from "@/app/lib/robo-textos";

const HORA = 60 * 60 * 1000;
/** Sem mensagem por 24h, a conversa acaba: é também o fim da janela da Meta. */
const JANELA_DA_CONVERSA = 24 * HORA;
const TEMPO_DE_SOU_CLIENTE = 30 * 24 * HORA;
const MAX_PERGUNTAS_GUARDADAS = 50;

export type Etapa = "p1" | "p2" | "p3" | "oferta" | "duvida";

export interface EstadoDaConversa {
  etapa: string;
  origem: string | null;
  papel: string | null;
  barbeiros: string | null;
  agenda: string | null;
  perguntasNaoEntendidas: string[];
  naoEntendidasSeguidas: number;
  souClienteEm: Date | null;
  iniciadaEm: Date;
  ultimaMensagemEm: Date;
  encerradaEm: Date | null;
}

export interface MensagemRecebida {
  tipo: "texto" | "botao" | "midia";
  texto: string;
  botaoId?: string;
}

export interface Contexto {
  mensagem: MensagemRecebida;
  agora: Date;
  pediuParar: boolean;
  conversa: EstadoDaConversa | null;
  /** Dono ou barbeiro com cadastro neste número. */
  conta: { criadaEm: Date } | null;
  /** Cliente com agendamento em alguma barbearia. */
  cliente: { barbearia: BarbeariaDoCliente; quando: { date: Date; startTime: string } | null } | null;
}

export interface Decisao {
  /** A linha da tabela de ordem que decidiu. */
  ordem: number;
  mensagens: Mensagem[];
  /** Só a ordem 7 e o PARAR de um cliente entram no painel da barbearia. */
  comBarbearia: boolean;
  parar?: "registrar" | "desfazer";
  /** Novo estado da conversa. Ausente = não mexe. */
  conversa?: EstadoDaConversa;
}

/** Minúsculas, sem acento e sem pontuação: "Não, QUERO parar!" vira "nao quero parar". */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Palavra inteira ou frase. "faltar" não casa com "falta". */
function contem(normalizado: string, termo: string): boolean {
  return ` ${normalizado} `.includes(` ${termo} `);
}

const contemAlgum = (normalizado: string, termos: string[]) => termos.some((t) => contem(normalizado, t));

const PARAR_SOZINHO = ["parar", "pare", "sair"];
const PARAR_FRASES = ["parar de receber", "nao quero mais receber", "sair da lista", "cancelar inscricao"];
const ATENDENTE = ["atendente", "pessoa", "humano"];

function pediuParada(n: string): boolean {
  return PARAR_SOZINHO.includes(n) || contemAlgum(n, PARAR_FRASES);
}

/** De onde veio a mensagem que abre a conversa. Nulo = não é abertura. */
function origemDaAbertura(n: string): string | null {
  if (n === normalizar(T.MENSAGEM_DO_INSTAGRAM)) return "instagram";
  if (n === normalizar(T.MENSAGEM_DO_SITE)) return "site";
  if (n === "barberpro") return "barberpro";
  return null;
}

function conversaAberta(c: Contexto): c is Contexto & { conversa: EstadoDaConversa } {
  const v = c.conversa;
  if (!v || v.encerradaEm) return false;
  if (c.agora.getTime() - v.ultimaMensagemEm.getTime() >= JANELA_DA_CONVERSA) return false;
  // Quem se cadastrou depois de começar a conversa já não é interessado.
  if (c.conta && c.conta.criadaEm > v.iniciadaEm) return false;
  return true;
}

function respondeuTudo(v: EstadoDaConversa | null): v is EstadoDaConversa {
  return !!(v?.papel && v.barbeiros && v.agenda);
}

function conversaNova(c: Contexto, origem: string): EstadoDaConversa {
  return {
    etapa: "p1",
    origem,
    papel: null,
    barbeiros: null,
    agenda: null,
    // O que não soubemos responder continua valendo para melhorar o fluxo.
    perguntasNaoEntendidas: c.conversa?.perguntasNaoEntendidas ?? [],
    naoEntendidasSeguidas: 0,
    souClienteEm: null,
    iniciadaEm: c.agora,
    ultimaMensagemEm: c.agora,
    encerradaEm: null,
  };
}

/** A pergunta em que a pessoa estava, ou os botões da Oferta. */
function repetirEtapa(etapa: string): Mensagem {
  if (etapa === "p1") return T.P1;
  if (etapa === "p2") return T.P2;
  if (etapa === "p3") return T.P3;
  return T.OFERTA;
}

const BOTOES_DA_ETAPA: Record<string, IdDoBotao[]> = {
  p1: ["sou_dono", "sou_barbeiro", "sou_cliente"],
  p2: ["so_eu", "dois_ou_tres", "quatro_ou_mais"],
  p3: ["caderno", "whatsapp", "outro_app"],
};
const BOTOES_DE_QUALQUER_ETAPA: IdDoBotao[] = ["quero_testar", "ver_precos", "tenho_duvida", "falar_com_pessoa"];

/**
 * O botão que a pessoa tocou. Quem digita o título do botão da etapa em que está
 * ("caderno") responde o mesmo que quem toca nele.
 */
function botaoDaMensagem(m: MensagemRecebida, etapa: string): IdDoBotao | null {
  if (m.botaoId && m.botaoId in T.BOTOES) return m.botaoId as IdDoBotao;
  const n = normalizar(m.texto);
  const candidatos = [...(BOTOES_DA_ETAPA[etapa] ?? []), ...BOTOES_DE_QUALQUER_ETAPA];
  return candidatos.find((id) => normalizar(T.BOTOES[id].titulo) === n) ?? null;
}

type Pergunta = "precos" | "teste" | "demonstracao" | "lembrete" | "falta" | "baixar";

/** Perguntas soltas, na ordem da tabela de `fluxo.md`. */
const PERGUNTAS: { termos: string[]; pergunta: Pergunta }[] = [
  { termos: ["preco", "precos", "valor", "valores", "quanto custa", "plano", "planos"], pergunta: "precos" },
  { termos: ["teste", "testar", "gratis"], pergunta: "teste" },
  { termos: ["demonstracao", "como funciona", "ver o app"], pergunta: "demonstracao" },
  { termos: ["lembrete", "lembretes"], pergunta: "lembrete" },
  { termos: ["falta", "faltas", "furo", "furos", "no show", "noshow"], pergunta: "falta" },
  { termos: ["baixar", "instalar"], pergunta: "baixar" },
];

function perguntaSolta(n: string): Pergunta | null {
  return PERGUNTAS.find((p) => contemAlgum(n, p.termos))?.pergunta ?? null;
}

function respostaDaPergunta(p: Pergunta, v: EstadoDaConversa): Mensagem {
  if (p === "precos") return T.PRECOS;
  if (p === "teste") return T.TESTE;
  if (p === "demonstracao") return T.demonstracao(v.agenda);
  if (p === "lembrete") return T.LEMBRETE;
  if (p === "falta") return T.FALTA;
  return T.BAIXAR;
}

function continuarConversa(c: Contexto & { conversa: EstadoDaConversa }, n: string): Decisao {
  const v: EstadoDaConversa = { ...c.conversa, ultimaMensagemEm: c.agora };
  const decisao = (mensagens: Mensagem[], conversa: EstadoDaConversa = v): Decisao => ({
    ordem: 5,
    mensagens,
    comBarbearia: false,
    conversa: { ...conversa, naoEntendidasSeguidas: 0 },
  });

  const botao = botaoDaMensagem(c.mensagem, v.etapa);

  if (botao === "falar_com_pessoa" || (!botao && contemAlgum(n, ATENDENTE))) {
    return decisao([T.atendente(v)]);
  }

  switch (botao) {
    case "sou_dono":
    case "sou_barbeiro":
      return decisao([T.P2], { ...v, papel: botao, etapa: "p2" });
    case "sou_cliente":
      return decisao([T.CLIENTE], { ...v, etapa: "p1", souClienteEm: c.agora, encerradaEm: c.agora });
    case "so_eu":
    case "dois_ou_tres":
    case "quatro_ou_mais":
      return decisao([T.P3], { ...v, barbeiros: botao, etapa: "p3" });
    case "caderno":
    case "whatsapp":
    case "outro_app":
      return decisao([T.demonstracao(botao), T.OFERTA], { ...v, agenda: botao, etapa: "oferta" });
    case "quero_testar":
      return decisao([T.TESTE]);
    case "ver_precos":
      return decisao([T.PRECOS]);
    case "tenho_duvida":
      return decisao([T.DUVIDA], { ...v, etapa: "duvida" });
  }

  if (c.mensagem.tipo === "midia") return decisao([T.MIDIA]);

  const pergunta = perguntaSolta(n);
  if (pergunta) {
    const resposta = respostaDaPergunta(pergunta, v);
    // PREÇOS já traz os botões: fora de uma pergunta, repetir a Oferta seria
    // mandar duas vezes o mesmo convite.
    const naPergunta = v.etapa === "p1" || v.etapa === "p2" || v.etapa === "p3";
    if (pergunta === "precos" && !naPergunta) return decisao([resposta]);
    return decisao([resposta, repetirEtapa(v.etapa)]);
  }

  const perguntas = [...v.perguntasNaoEntendidas, c.mensagem.texto.slice(0, 300)].slice(-MAX_PERGUNTAS_GUARDADAS);
  if (v.naoEntendidasSeguidas >= 1) {
    return decisao([T.atendente(v)], { ...v, perguntasNaoEntendidas: perguntas });
  }
  return {
    ordem: 5,
    mensagens: [T.NAO_ENTENDI],
    comBarbearia: false,
    conversa: { ...v, perguntasNaoEntendidas: perguntas, naoEntendidasSeguidas: 1 },
  };
}

/** A primeira linha da tabela de `fluxo.md` que combinar é a que vale. */
export function decidir(c: Contexto): Decisao {
  const n = normalizar(c.mensagem.texto);

  // 2. PARAR. O texto vai pelo cadastro: conversa aberta não muda essa escolha.
  if (pediuParada(n)) {
    let mensagem = T.PARAR_DEMAIS;
    if (c.conta) mensagem = T.PARAR_CONTA;
    else if (c.cliente) mensagem = T.pararCliente(T.linkDaBarbearia(c.cliente.barbearia));
    return {
      ordem: 2,
      mensagens: [mensagem],
      comBarbearia: !!c.cliente,
      parar: "registrar",
      conversa: c.conversa ? { ...c.conversa, ultimaMensagemEm: c.agora, encerradaEm: c.agora } : undefined,
    };
  }

  // 3. VOLTAR sem pedido registrado é mensagem comum, e segue a tabela.
  if (n === "voltar" && c.pediuParar) {
    return {
      ordem: 3,
      mensagens: [c.conta || c.cliente ? T.VOLTAR_COM_CADASTRO : T.VOLTAR_DEMAIS],
      comBarbearia: false,
      parar: "desfazer",
    };
  }

  // 4. Mensagem pronta do Instagram, do site, ou só BARBERPRO.
  const origem = origemDaAbertura(n);
  if (origem) {
    return {
      ordem: 4,
      mensagens: [T.boasVindas(origem === "instagram")],
      comBarbearia: false,
      // Pedir para conhecer desfaz o PARAR de quem só é interessado. De quem é
      // cliente ou tem conta, o PARAR fala de lembrete, e isto não é sobre isso.
      parar: c.pediuParar && !c.conta && !c.cliente ? "desfazer" : undefined,
      conversa: conversaNova(c, origem),
    };
  }

  // 5. Conversa aberta. Se o número também é cliente, só botão e palavra-chave
  // comercial ficam aqui: "vou faltar" é para a barbearia, não para o robô.
  if (conversaAberta(c)) {
    const comercial =
      !!botaoDaMensagem(c.mensagem, c.conversa.etapa) ||
      (c.mensagem.tipo === "texto" && (contemAlgum(n, ATENDENTE) || !!perguntaSolta(n)));
    if (!c.cliente || comercial) return continuarConversa(c, n);
    return respostaDeCliente(c.cliente);
  }

  // 6. Quem tem conta não é interessado nem cliente de quem atende.
  if (c.conta) return { ordem: 6, mensagens: [T.CONTA], comBarbearia: false };

  // 7. Cliente de barbearia: a resposta de sempre, sem oferta nenhuma.
  if (c.cliente) return respostaDeCliente(c.cliente);

  // 8. Desconhecido que já pediu PARAR: silêncio, menos para falar com uma pessoa.
  if (c.pediuParar) {
    if (contemAlgum(n, ATENDENTE) || c.mensagem.botaoId === "falar_com_pessoa") {
      return {
        ordem: 8,
        mensagens: [T.atendente(c.conversa ?? { papel: null, barbeiros: null, agenda: null })],
        comBarbearia: false,
      };
    }
    return { ordem: 8, mensagens: [], comBarbearia: false };
  }

  // 9. Disse que é cliente nos últimos 30 dias: não recomeça a apresentação.
  const sou = c.conversa?.souClienteEm;
  if (sou && c.agora.getTime() - sou.getTime() < TEMPO_DE_SOU_CLIENTE) {
    return { ordem: 9, mensagens: [T.CLIENTE], comBarbearia: false };
  }

  // 10. Já respondeu as 3 perguntas. Reabre a conversa: sem isso, o botão da
  // Oferta cairia aqui de novo e ela voltaria para sempre.
  if (respondeuTudo(c.conversa)) {
    return {
      ordem: 10,
      mensagens: [T.OFERTA],
      comBarbearia: false,
      conversa: {
        ...c.conversa,
        etapa: "oferta",
        naoEntendidasSeguidas: 0,
        iniciadaEm: c.agora,
        ultimaMensagemEm: c.agora,
        encerradaEm: null,
      },
    };
  }

  // 11. Qualquer outro número, seja qual for o texto. Quem é cliente se
  // identifica pelo botão.
  return {
    ordem: 11,
    mensagens: [T.boasVindas(false)],
    comBarbearia: false,
    conversa: conversaNova(c, "direto"),
  };
}

function respostaDeCliente(cliente: NonNullable<Contexto["cliente"]>): Decisao {
  return {
    ordem: 7,
    mensagens: [T.respostaAoCliente(cliente.barbearia, cliente.quando)],
    comBarbearia: true,
  };
}
