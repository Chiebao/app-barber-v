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

  // O botão de copiar código carrega o próprio código na URL, então ele
  // entra como um segundo componente com o mesmo valor do corpo.
  const componentes: Record<string, unknown>[] = [
    { type: "body", parameters: variaveis.map((v) => ({ type: "text", text: v })) },
  ];
  if (modelo.botaoComCodigo) {
    componentes.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: variaveis[0] }],
    });
  }

  try {
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
          components: componentes,
        },
      }),
    });

    if (!res.ok) {
      const detalhe = await res.text().catch(() => "");
      console.error("[WhatsApp] modelo", nome, "falhou:", res.status, detalhe.slice(0, 300));
      console.error("[WhatsApp] texto previsto:", previsto);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[WhatsApp] erro ao enviar modelo", nome, err);
    return false;
  }
}
