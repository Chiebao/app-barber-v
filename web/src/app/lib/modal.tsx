"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Modal do app.
 *
 * Existe por causa de um bug que custou caro para achar: o `globals.css`
 * aplica `backdrop-filter: blur()` em TODO `.bg-dark-800` e `.bg-dark-900`,
 * para o efeito de vidro. Só que `backdrop-filter` cria um containing block
 * para descendentes `position: fixed` — então um modal declarado dentro de
 * qualquer cartão deixava de se posicionar pela tela e passava a se
 * posicionar pelo cartão. Na prática: o dono rolava até o plano anual, tocava,
 * e o modal aparecia lá em cima, fora de vista.
 *
 * A saída é sair da árvore: renderizar no `document.body` por portal, onde
 * nenhum ancestral pode conter o `fixed`.
 *
 * O cartão também usa cor SÓLIDA, e não a classe de vidro. Um modal
 * translúcido sobre a página parece conteúdo censurado, que foi exatamente
 * como o bug apareceu.
 */
export function Modal({
  aberto,
  onFechar,
  children,
  largura = "max-w-sm",
  bloqueante = false,
}: {
  aberto: boolean;
  onFechar: () => void;
  children: React.ReactNode;
  largura?: string;
  /** Impede fechar por Esc ou clique fora — para quando a decisao e obrigatoria. */
  bloqueante?: boolean;
}) {
  const [montado, setMontado] = useState(false);

  // O portal só existe no navegador; no servidor não há document
  useEffect(() => setMontado(true), []);

  // Esc fecha, e a página atrás para de rolar enquanto o modal está aberto —
  // sem isso o dedo rola o fundo em vez do conteúdo do modal.
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape" && !bloqueante) onFechar(); };
    const janela = window as unknown as { __modaisAbertos?: number };
    janela.__modaisAbertos = (janela.__modaisAbertos || 0) + 1;
    const overflowAntes = janela.__modaisAbertos === 1 ? document.body.style.overflow : null;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", aoTeclar);
    return () => {
      janela.__modaisAbertos = Math.max(0, (janela.__modaisAbertos || 1) - 1);
      if (janela.__modaisAbertos === 0) document.body.style.overflow = overflowAntes ?? "";
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto, onFechar, bloqueante]);

  if (!aberto || !montado) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={bloqueante ? undefined : onFechar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: bloqueante ? "rgba(0,0,0,0.9)" : "rgba(0,0,0,0.72)",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${largura} rounded-2xl border border-gray-700 p-6 space-y-4 my-auto shadow-2xl`}
        // Sólido de propósito: a classe de vidro deixaria o modal
        // semitransparente e o texto competindo com a página atrás.
        style={{ backgroundColor: "#161625" }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
