"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/app/components/hud";
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
    <div className="hud-card p-5 space-y-3">
      <div>
        <h3 className="font-semibold text-hud-text"><Icon nome="sino" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Notificações neste aparelho</h3>
        <p className="text-xs text-hud-muted mt-1">
          Receba um aviso na hora que um cliente agendar ou cancelar — mesmo com o app fechado.
        </p>
      </div>

      {state === "on" && (
        <>
          <div className="flex items-center gap-2 rounded bg-[color-mix(in_srgb,var(--hud-ok)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-ok)_30%,transparent)] px-3 py-2">
            <span className="text-hud-ok text-sm">✓ Ativadas neste aparelho</span>
          </div>
          <button onClick={disable} disabled={busy}
            className="hud-focus min-h-[44px] w-full rounded border border-hud-border py-2.5 text-sm text-hud-muted hover:text-hud-text disabled:opacity-50 transition">
            {busy ? "..." : "Desativar aqui"}
          </button>
        </>
      )}

      {state === "off" && (
        <button onClick={enable} disabled={busy}
          className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all">
          {busy ? "Ativando..." : "Ativar notificações"}
        </button>
      )}

      {state === "needs-install" && (
        <div className="rounded bg-[color-mix(in_srgb,var(--hud-info)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-info)_30%,transparent)] px-3 py-3 text-sm text-hud-info space-y-1">
          <p className="font-medium">Instale o app para receber notificações</p>
          <p className="text-xs text-[color-mix(in_srgb,var(--hud-info)_80%,transparent)]">
            No iPhone, toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>,
            abra o BarberPro por lá e ative aqui. É uma exigência da Apple.
          </p>
        </div>
      )}

      {state === "blocked" && (
        <div className="rounded bg-[color-mix(in_srgb,var(--hud-err)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-err)_30%,transparent)] px-3 py-3 text-sm text-hud-err space-y-1">
          <p className="font-medium">Notificações bloqueadas</p>
          <p className="text-xs text-[color-mix(in_srgb,var(--hud-err)_80%,transparent)]">
            Você bloqueou as notificações para este site. Libere nas configurações do navegador
            (cadeado ao lado do endereço) e volte aqui.
          </p>
        </div>
      )}

      {state === "unsupported" && (
        <p className="text-sm text-hud-muted">
          Este navegador não suporta notificações. Tente pelo Chrome (Android/PC) ou instale o app.
        </p>
      )}
    </div>
  );
}
