/**
 * Envio simples de mensagem por WhatsApp (Cloud API da Meta).
 *
 * Separado do `whatsapp.ts` (que só sabe montar avisos de agendamento) para
 * poder mandar qualquer texto — código de senha, por exemplo.
 *
 * Nunca lança: uma falha de envio não pode derrubar o fluxo que a chamou.
 */

import { MODELOS, preverTexto, type NomeModelo } from "@/app/lib/whatsapp-templates";
import { pediuParar } from "@/app/lib/parar";

/** Env vars já chegaram com quebra de linha colada e derrubaram tudo em silêncio. */
function envClean(name: string): string {
  return (process.env[name] || "").trim().replace(/\\n$/, "").trim();
}

export function whatsappConfigurado(): boolean {
  return !!(envClean("WHATSAPP_API_TOKEN") && envClean("WHATSAPP_PHONE_ID"));
}

/** Normaliza para o formato que a Meta espera (55 + DDD + número). */
export function paraFormatoWhatsApp(telefone: string): string {
  const digitos = String(telefone || "").replace(/\D/g, "");
  return digitos.startsWith("55") ? digitos : `55${digitos}`;
}

/**
 * Texto livre.
 *
 * Só chega se o destinatário tiver escrito para o número nas últimas 24h.
 * Para mensagem que NÓS iniciamos, use `enviarModelo`.
 */
export async function enviarWhatsApp(telefone: string, texto: string): Promise<boolean> {
  const token = envClean("WHATSAPP_API_TOKEN");
  const phoneId = envClean("WHATSAPP_PHONE_ID");
  if (!token || !phoneId) {
    console.log("[WhatsApp] sem credenciais — mensagem não enviada:", texto.slice(0, 60));
    return false;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: paraFormatoWhatsApp(telefone),
        type: "text",
        text: { body: texto },
      }),
    });

    if (!res.ok) {
      const detalhe = await res.text().catch(() => "");
      console.error("[WhatsApp] falha no envio:", res.status, detalhe.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[WhatsApp] erro no envio:", err);
    return false;
  }
}

/**
 * Texto livre com botões de resposta. Como o texto livre, só chega dentro da
 * janela de 24h.
 *
 * A Meta recusa a mensagem inteira se um limite estourar (3 botões, 20
 * caracteres por botão, 1.024 no texto), então barrar aqui deixa o motivo no log.
 */
export async function enviarBotoes(
  telefone: string,
  texto: string,
  botoes: { id: string; titulo: string }[],
): Promise<boolean> {
  const token = envClean("WHATSAPP_API_TOKEN");
  const phoneId = envClean("WHATSAPP_PHONE_ID");
  if (!token || !phoneId) {
    console.log("[WhatsApp] sem credenciais — mensagem não enviada:", texto.slice(0, 60));
    return false;
  }
  if (botoes.length < 1 || botoes.length > 3 || botoes.some((b) => b.titulo.length > 20) || texto.length > 1024) {
    console.error("[WhatsApp] botões fora do limite da Meta:", texto.slice(0, 60));
    return false;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: paraFormatoWhatsApp(telefone),
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: texto },
          action: {
            buttons: botoes.map((b) => ({ type: "reply", reply: { id: b.id, title: b.titulo } })),
          },
        },
      }),
    });

    if (!res.ok) {
      const detalhe = await res.text().catch(() => "");
      console.error("[WhatsApp] falha no envio com botões:", res.status, detalhe.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[WhatsApp] erro no envio com botões:", err);
    return false;
  }
}

/**
 * O que quem pediu PARAR deixa de receber. Os modelos da conta (código de
 * recuperação, agenda do dia, cobrança, fim do teste) ficam de fora: o dono que
 * pede PARAR como cliente continua precisando deles.
 */
export const MODELOS_QUE_RESPEITAM_PARAR: readonly NomeModelo[] = [
  "lembrete_agendamento",
  "agendamento_marcado",
  "vaga_disponivel",
  "espera_sem_vaga",
];

/**
 * "bloqueado" não é falha. Se fosse, o cron tentaria de novo a cada rodada, e o
 * painel diria que o WhatsApp está com problema quando foi o cliente que pediu.
 */
export type ResultadoDoEnvio = "enviado" | "bloqueado" | "falhou";

let consultaDeParar = pediuParar;

/** Só para teste de função pura, que não tem banco: troca a consulta por uma resposta pronta. */
export function trocarConsultaDeParar(consulta: (telefone: string) => Promise<boolean>) {
  consultaDeParar = consulta;
}

/** O mesmo envio, para quem não precisa saber por que não saiu. */
export async function enviarModelo(
  telefone: string,
  nome: NomeModelo,
  variaveis: string[],
  valorDoBotao?: string,
): Promise<boolean> {
  return (await enviarModeloComResultado(telefone, nome, variaveis, valorDoBotao)) === "enviado";
}

/**
 * Envio por MODELO aprovado — o caminho de produção.
 *
 * Fora da janela de 24h a Meta só entrega mensagem baseada em modelo, e
 * todas as nossas são iniciadas por nós. O texto livre continua existindo
 * abaixo, mas só serve para responder alguém que acabou de escrever.
 *
 * Se o modelo ainda não estiver aprovado, a Meta responde 132000/132001 e
 * a mensagem não sai. Registramos o texto previsto no log para o envio
 * falho não virar um silêncio sem explicação.
 */
export async function enviarModeloComResultado(
  telefone: string,
  nome: NomeModelo,
  variaveis: string[],
  /**
   * Sufixo da URL do botao, para os modelos com `botaoComLink`.
   *
   * Fica FORA de `variaveis` de proposito: `variaveis` sao os {{n}} do
   * corpo e vao inteiras para o componente `body`. Enfiar o link ali
   * mandaria um parametro a mais para um texto que nao tem onde po-lo, e
   * a Meta recusa o envio.
   */
  valorDoBotao?: string,
): Promise<ResultadoDoEnvio> {
  const token = envClean("WHATSAPP_API_TOKEN");
  const phoneId = envClean("WHATSAPP_PHONE_ID");
  const previsto = preverTexto(nome, variaveis);

  if (MODELOS_QUE_RESPEITAM_PARAR.includes(nome)) {
    try {
      if (await consultaDeParar(telefone)) return "bloqueado";
    } catch (err) {
      // Sem saber se a pessoa pediu para parar, não manda. "falhou" faz o cron
      // tentar de novo, e a resposta certa chega quando o banco voltar.
      console.error("[WhatsApp] não deu para conferir o pedido de PARAR:", err);
      return "falhou";
    }
  }

  if (!token || !phoneId) {
    console.log("[WhatsApp] sem credenciais — modelo não enviado:", nome, "|", previsto.slice(0, 80));
    return "falhou";
  }

  const modelo = MODELOS[nome];
  if (variaveis.length !== modelo.variaveis) {
    // Quantidade errada de variaveis e recusa certa da Meta — melhor
    // barrar aqui, onde da para ver o nome do modelo no log.
    console.error("[WhatsApp] modelo", nome, "espera", modelo.variaveis, "variaveis, recebeu", variaveis.length);
    return "falhou";
  }

  // O corpo sozinho, guardado à parte: é para ele que o envio volta se a
  // Meta ainda não tiver o botão cadastrado.
  const soCorpo: Record<string, unknown>[] = [
    { type: "body", parameters: variaveis.map((v) => ({ type: "text", text: v })) },
  ];

  // O botão de copiar código carrega o próprio código na URL, então ele
  // entra como um segundo componente com o mesmo valor do corpo.
  const componentes: Record<string, unknown>[] = [...soCorpo];
  if (modelo.botaoComCodigo) {
    componentes.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: variaveis[0] }],
    });
  }

  // Botao com variavel propria (o link da barbearia). Sem o valor a Meta
  // recusa por parametro faltando, entao barrar aqui poupa a viagem e
  // deixa o nome do modelo no log.
  if (modelo.botaoComLink) {
    if (!valorDoBotao) {
      console.error("[WhatsApp] modelo", nome, "precisa do valor do botao e não recebeu");
      return "falhou";
    }
    componentes.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: valorDoBotao }],
    });
  }

  const tentar = async (comps: Record<string, unknown>[]) => {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: paraFormatoWhatsApp(telefone),
        type: "template",
        template: {
          name: modelo.nome,
          language: { code: modelo.idioma },
          components: comps,
        },
      }),
    });
    if (res.ok) return { ok: true, status: res.status, detalhe: "" };
    return { ok: false, status: res.status, detalhe: await res.text().catch(() => "") };
  };

  try {
    let r = await tentar(componentes);

    // Editar um modelo APROVADO na Meta manda ele para revisão de novo, e
    // enquanto ela não sai o que está cadastrado lá pode não ser o que
    // este código espera. Sem esta volta, o aviso de vaga simplesmente
    // não sai — justo enquanto a vaga está aberta e o cliente esperando.
    //
    // Só vale para o botão de link: é o único componente que a gente
    // adiciona a um modelo que já existia sem ele. Depois da aprovação a
    // primeira tentativa passa e esta nunca roda.
    if (!r.ok && modelo.botaoComLink && pareceParametroDemais(r.detalhe)) {
      const semBotao = await tentar(soCorpo);
      if (semBotao.ok) {
        console.warn("[WhatsApp] modelo", nome, "enviado SEM o botão: a Meta ainda não tem o botão cadastrado");
        return "enviado";
      }
      r = semBotao;
    }

    if (!r.ok) {
      console.error("[WhatsApp] modelo", nome, "falhou:", r.status, r.detalhe.slice(0, 300));
      console.error("[WhatsApp] texto previsto:", previsto);
      return "falhou";
    }
    return "enviado";
  } catch (err) {
    console.error("[WhatsApp] erro ao enviar modelo", nome, err);
    return "falhou";
  }
}

/**
 * A Meta reclamou de parâmetro a mais, e não de outra coisa.
 *
 * Restringir a isto importa: token morto (401) ou modelo pausado não
 * melhoram tentando de novo, e repetir só gastaria a segunda chamada.
 */
function pareceParametroDemais(detalhe: string): boolean {
  const t = detalhe.toLowerCase();
  return t.includes("132000") || t.includes("number of parameters") || t.includes("param");
}
