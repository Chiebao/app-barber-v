/** Limpa espacos/quebras coladas no valor — ja causou falha silenciosa em producao. */
function envClean(name: string): string {
  return (process.env[name] || "").trim().replace(/\n$/, "").trim();
}

const WHATSAPP_API_TOKEN = envClean("WHATSAPP_API_TOKEN");
const WHATSAPP_PHONE_ID = envClean("WHATSAPP_PHONE_ID");

interface AppointmentNotification {
  barberPhone: string;
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  shopName: string;
  isCancellation?: boolean;
  isPendingPayment?: boolean;
}

export async function sendWhatsAppNotification(
  data: AppointmentNotification
): Promise<boolean> {
  // Se não tiver configurado, loga no console (dev mode)
  if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_ID) {
    console.log("[WhatsApp] Notificacao (modo dev):", data);
    console.log(
      `[WhatsApp] Mensagem: Novo agendamento na ${data.shopName}!\n` +
        `Cliente: ${data.clientName}\n` +
        `Servico: ${data.serviceName}\n` +
        `Data: ${data.date}\n` +
        `Horario: ${data.time}`
    );
    return true;
  }

  const phone = data.barberPhone.replace(/\D/g, "");
  const phoneWithCountry = phone.startsWith("55") ? phone : `55${phone}`;
  console.log("[WhatsApp] Enviando para:", phoneWithCountry, "| PHONE_ID:", WHATSAPP_PHONE_ID);

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneWithCountry,
          type: "text",
          text: {
            body: data.isCancellation
              ? `*Cancelamento na ${data.shopName}*\n\n` +
                `O cliente *${data.clientName}* cancelou o agendamento.\n` +
                `*Servico:* ${data.serviceName}\n` +
                `*Data:* ${data.date}\n` +
                `*Horario:* ${data.time}\n\n` +
                `_O horario ja esta disponivel para novos agendamentos._`
              : data.isPendingPayment
              ? `*⏳ Agendamento aguardando Pix - ${data.shopName}*\n\n` +
                `O cliente *${data.clientName}* enviou o comprovante de pagamento e aguarda confirmacao.\n` +
                `*Servico:* ${data.serviceName}\n` +
                `*Data:* ${data.date}\n` +
                `*Horario:* ${data.time}\n\n` +
                `_Confirme o pagamento no app BarberPro._`
              : `*Novo agendamento na ${data.shopName}!*\n\n` +
                `*Cliente:* ${data.clientName}\n` +
                `*Servico:* ${data.serviceName}\n` +
                `*Data:* ${data.date}\n` +
                `*Horario:* ${data.time}\n\n` +
                `_Enviado pelo BarberPro_`,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("[WhatsApp] Erro ao enviar:", err);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[WhatsApp] Erro:", error);
    return false;
  }
}
