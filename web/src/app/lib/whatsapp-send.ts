/**
 * Envio simples de mensagem por WhatsApp (Cloud API da Meta).
 *
 * Separado do `whatsapp.ts` (que só sabe montar avisos de agendamento) para
 * poder mandar qualquer texto — código de senha, por exemplo.
 *
 * Nunca lança: uma falha de envio não pode derrubar o fluxo que a chamou.
 */

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
