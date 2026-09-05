/**
 * Envio simples de mensagem por WhatsApp (Cloud API da Meta).
 *
 * Separado do `whatsapp.ts` (que só sabe montar avisos de agendamento) para
 * poder mandar qualquer texto — código de senha, por exemplo.
 *
 * Nunca lança: uma falha de envio não pode derrubar o fluxo que a chamou.
 */

import { MODELOS, preverTexto, type NomeModelo } from "@/app/lib/whatsapp-templates";

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
export async function enviarModelo(
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
): Promise<boolean> {
  const token = envClean("WHATSAPP_API_TOKEN");
  const phoneId = envClean("WHATSAPP_PHONE_ID");
  const previsto = preverTexto(nome, variaveis);

  if (!token || !phoneId) {
    console.log("[WhatsApp] sem credenciais — modelo nao enviado:", nome, "|", previsto.slice(0, 80));
    return false;
  }

  const modelo = MODELOS[nome];
  if (variaveis.length !== modelo.variaveis) {
    // Quantidade errada de variaveis e recusa certa da Meta — melhor
    // barrar aqui, onde da para ver o nome do modelo no log.
    console.error("[WhatsApp] modelo", nome, "espera", modelo.variaveis, "variaveis, recebeu", variaveis.length);
    return false;
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
      console.error("[WhatsApp] modelo", nome, "precisa do valor do botao e nao recebeu");
      return false;
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
        return true;
      }
      r = semBotao;
    }

    if (!r.ok) {
      console.error("[WhatsApp] modelo", nome, "falhou:", r.status, r.detalhe.slice(0, 300));
      console.error("[WhatsApp] texto previsto:", previsto);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[WhatsApp] erro ao enviar modelo", nome, err);
    return false;
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
