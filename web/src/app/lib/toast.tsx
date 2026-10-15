"use client";

import { useEffect, useState } from "react";
import { Icon, type NomeIcone } from "@/app/components/hud/Icon";

/* ──────────────────────────────────────────────────────────────
   Toast system — zero dependência externa.
   Uso: import { toast } from "@/app/lib/toast";
        toast.success("Salvo!");
        toast.error("Deu ruim");
        toast.info("Sessão expirada");
   E monte <Toaster /> uma vez no layout.
   ────────────────────────────────────────────────────────────── */

type ToastType = "success" | "error" | "info";
export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

let counter = 0;
const listeners = new Set<(items: ToastItem[]) => void>();
let items: ToastItem[] = [];

function emit() {
  for (const l of listeners) l([...items]);
}

function push(type: ToastType, message: string, durationMs = 4000) {
  const id = ++counter;
  items = [...items, { id, type, message }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, durationMs);
}

export const toast = {
  success: (msg: string) => push("success", msg),
  error: (msg: string) => push("error", msg, 5000),
  info: (msg: string) => push("info", msg),
};

// Visual do Kit Ouro HUD: cartão escuro sólido, borda na cor do estado e
// ícone de linha. O ícone diz o tipo junto com a cor — nunca só a cor.
const STYLES: Record<ToastType, { cor: string; icone: NomeIcone; rotulo: string }> = {
  success: { cor: "#4ADE80", icone: "check", rotulo: "Sucesso" },
  error: { cor: "#F87171", icone: "erro", rotulo: "Erro" },
  info: { cor: "#60A5FA", icone: "info", rotulo: "Aviso" },
};

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setList);
    return () => { listeners.delete(setList); };
  }, []);

  if (list.length === 0) return null;

  return (
    <div
      style={{ position: "fixed", top: 16, left: 0, right: 0, zIndex: 10000, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none", padding: "0 16px" }}
    >
      {list.map((t) => {
        const s = STYLES[t.type];
        return (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            className="hud-anim max-w-sm w-full flex items-center gap-2.5 rounded border px-3.5 py-3"
            style={{
              pointerEvents: "auto",
              animation: "toastIn 0.2s ease-out",
              background: "#161625",
              borderColor: `color-mix(in srgb, ${s.cor} 50%, transparent)`,
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            }}
          >
            <span className="shrink-0" style={{ color: s.cor }}>
              <Icon nome={s.icone} tamanho={18} traco={2.5} />
            </span>
            <span className="sr-only">{s.rotulo}: </span>
            <p className="text-[13px] flex-1" style={{ color: "#F5F5F7" }}>{t.message}</p>
          </div>
        );
      })}
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
