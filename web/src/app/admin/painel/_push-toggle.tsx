"use client";

import { useEffect, useState } from "react";
import { toast } from "@/app/lib/toast";

/**
 * Ativa as notificações do navegador para o barbeiro.
 *
 * Resolve o problema de "o cliente agendou e eu nem fiquei sabendo": com isso
 * o aviso chega mesmo com o app fechado.
 *
 * iPhone: só funciona no iOS 16.4+ e com o PWA instalado na tela de início —
 * por isso avisamos quando detectamos Safari fora do modo instalado.
 */

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "checking" | "unsupported" | "needs-install" | "off" | "on" | "blocked";

export default function PushToggle({ token }: { token: string | null }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (typeof window === "undefined") return;

      const hasApi = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const isStandalone =
        window.matchMedia?.("(display-mode: standalone)").matches ||
        // iOS expõe isso fora do padrão
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      if (!hasApi) {
        // No iPhone, a API só aparece com o PWA instalado na tela de início
        if (!alive) return;
        setState(isIOS && !isStandalone ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") { if (alive) setState("blocked"); return; }

      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (alive) setState(sub ? "on" : "off");
      } catch {
        if (alive) setState("off");
      }
    })();
    return () => { alive = false; };
  }, []);

  const enable = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        toast.error("Permissão de notificação não concedida");
        return;
      }

      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) { toast.error("Notificações não configuradas no servidor"); return; }

      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
        }));

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const res = await fetch("/api/me/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) { toast.error("Não foi possível ativar. Tente de novo."); return; }

      setState("on");
      // Manda uma notificação de teste para o barbeiro ver que funcionou
      fetch("/api/me/push-subscription", { method: "PUT", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
      toast.success("Notificações ativadas!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao ativar notificações");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/me/push-subscription", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setState("off");
      toast.success("Notificações desativadas neste aparelho");
    } catch {
      toast.error("Erro ao desativar");
    } finally {
      setBusy(false);
    }
  };

  if (state === "checking") return null;

  return (
    <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-3">
      <div>
        <h3 className="font-semibold text-white">🔔 Notificações neste aparelho</h3>
        <p className="text-xs text-gray-500 mt-1">
          Receba um aviso na hora que um cliente agendar ou cancelar — mesmo com o app fechado.
        </p>
      </div>

      {state === "on" && (
        <>
          <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2">
            <span className="text-green-400 text-sm">✓ Ativadas neste aparelho</span>
          </div>
          <button onClick={disable} disabled={busy}
            className="w-full rounded-xl border border-gray-700 py-2.5 text-sm text-gray-400 hover:text-white disabled:opacity-50 transition">
            {busy ? "..." : "Desativar aqui"}
          </button>
        </>
      )}

      {state === "off" && (
        <button onClick={enable} disabled={busy}
          className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all">
          {busy ? "Ativando..." : "Ativar notificações"}
        </button>
      )}

      {state === "needs-install" && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 px-3 py-3 text-sm text-blue-300 space-y-1">
          <p className="font-medium">Instale o app para receber notificações</p>
          <p className="text-xs text-blue-200/80">
            No iPhone, toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>,
            abra o BarberPro por lá e ative aqui. É uma exigência da Apple.
          </p>
        </div>
      )}

      {state === "blocked" && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-3 text-sm text-red-300 space-y-1">
          <p className="font-medium">Notificações bloqueadas</p>
          <p className="text-xs text-red-200/80">
            Você bloqueou as notificações para este site. Libere nas configurações do navegador
            (cadeado ao lado do endereço) e volte aqui.
          </p>
        </div>
      )}

      {state === "unsupported" && (
        <p className="text-sm text-gray-500">
          Este navegador não suporta notificações. Tente pelo Chrome (Android/PC) ou instale o app.
        </p>
      )}
    </div>
  );
}
