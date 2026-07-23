"use client";

import { useEffect, useState } from "react";

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

const STYLES: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: "bg-green-500/15", border: "border-green-500/40", icon: "✓" },
  error: { bg: "bg-red-500/15", border: "border-red-500/40", icon: "✕" },
  info: { bg: "bg-blue-500/15", border: "border-blue-500/40", icon: "ℹ" },
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
            className={`${s.bg} ${s.border} border rounded-xl px-4 py-3 shadow-lg backdrop-blur-sm max-w-sm w-full flex items-center gap-3`}
            style={{ pointerEvents: "auto", animation: "toastIn 0.2s ease-out" }}
          >
            <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${t.type === "success" ? "bg-green-500 text-white" : t.type === "error" ? "bg-red-500 text-white" : "bg-blue-500 text-white"}`}>
              {s.icon}
            </span>
            <p className="text-sm text-white flex-1">{t.message}</p>
          </div>
        );
      })}
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
