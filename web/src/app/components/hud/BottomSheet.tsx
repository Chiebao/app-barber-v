"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

/**
 * Gaveta que sobe de baixo — formulários de cadastro (serviço, barbeiro,
 * produto, despesa) e menus no celular.
 *
 * Renderiza no `document.body` pelo mesmo motivo do `Modal` (lib/modal):
 * o vidro do `globals.css` cria containing block para `position: fixed`, e
 * a gaveta declarada dentro de um cartão abriria dentro do cartão.
 */
export function BottomSheet({
  aberto,
  onFechar,
  titulo,
  children,
  rodape,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  children: React.ReactNode;
  /** Botões fixos no pé da gaveta (Salvar / Cancelar). */
  rodape?: React.ReactNode;
}) {
  const [montado, setMontado] = useState(false);
  const idTitulo = useId();
  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto, onFechar]);

  if (!aberto || !montado) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitulo}
      onClick={onFechar}
      className="fixed inset-0 z-[9998] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="hud-anim flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-[14px] rounded-b-[4px] border border-hud-border"
        style={{
          background: "var(--hud-surface)",
          borderTop: "2px solid var(--hud-accent)",
          boxShadow: "0 -14px 40px var(--hud-shadow)",
          animation: "hud-sheet-in 0.22s ease-out",
          color: "var(--hud-text)",
        }}
      >
        <div className="px-4 pt-2.5">
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-sm" style={{ background: "var(--hud-text-3)" }} />
          <div className="flex items-center justify-between gap-3">
            <h2 id={idTitulo} className="font-display text-xl">{titulo}</h2>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="hud-focus -mr-2 flex h-11 w-11 items-center justify-center rounded text-hud-muted hover:text-hud-text"
            >
              <Icon nome="fechar" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2">{children}</div>
        {rodape && <div className="border-t border-hud-border px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{rodape}</div>}
      </div>
    </div>,
    document.body,
  );
}
