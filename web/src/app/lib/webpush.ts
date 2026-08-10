import webpush from "web-push";
import { prisma } from "@/app/lib/prisma";

/**
 * Notificações do navegador (Web Push) para o PWA do barbeiro/dono.
 *
 * Resolve o cenário: o barbeiro está com o app fechado e um cliente agenda —
 * hoje ele só descobriria abrindo o painel. Com isso, o aviso chega mesmo com
 * o app fechado, sem custo e sem depender da API do WhatsApp.
 *
 * iPhone: só funciona no iOS 16.4+ e com o PWA instalado na tela de início
 * (limitação da Apple, não do nosso código).
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:contato@barberpro.app";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Caminho aberto ao tocar na notificação (ex.: "/admin/painel"). */
  url?: string;
  /** Agrupa notificações do mesmo assunto (a nova substitui a anterior). */
  tag?: string;
}

/**
 * Envia uma notificação para todos os aparelhos inscritos dos barbeiros informados.
 * Inscrições mortas (404/410) são removidas automaticamente.
 * Nunca lança: falha de notificação não pode derrubar um agendamento.
 */
export async function sendWebPush(barberIds: string[], payload: PushPayload): Promise<number> {
  try {
    if (!ensureConfigured()) return 0;
    const ids = [...new Set(barberIds.filter(Boolean))];
    if (ids.length === 0) return 0;

    const subs = await prisma.pushSubscription.findMany({
      where: { barberId: { in: ids } },
    });
    if (subs.length === 0) return 0;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || "/admin/painel",
      tag: payload.tag,
    });

    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        ),
      ),
    );

    // Limpa inscrições que o navegador descartou (usuário desinstalou/revogou)
    const dead: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const code = (r.reason as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) dead.push(subs[i].id);
      }
    });
    if (dead.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } }).catch(() => {});
    }

    return results.filter((r) => r.status === "fulfilled").length;
  } catch (err) {
    console.error("[webpush] falha ao enviar:", err);
    return 0;
  }
}

/**
 * Barbeiros que devem ser avisados sobre um agendamento:
 * o barbeiro que vai atender + o dono (quando for outra pessoa).
 */
export async function notifyTargets(shopId: string, barberId: string): Promise<string[]> {
  const targets = new Set<string>([barberId]);
  try {
    const owner = await prisma.barber.findFirst({
      where: { shopId, isOwnerProfile: true },
      select: { id: true },
    });
    if (owner) targets.add(owner.id);
  } catch { /* ignore */ }
  return [...targets];
}
