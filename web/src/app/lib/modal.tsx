"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ILHA_ESCURA } from "@/app/components/hud/tema";

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
  gaveta = false,
}: {
  aberto: boolean;
  onFechar: () => void;
  children: React.ReactNode;
  largura?: string;
  /** Impede fechar por Esc ou clique fora — para quando a decisao e obrigatoria. */
  bloqueante?: boolean;
  /** Sobe de baixo no celular (formulário de cadastro/edição, Kit Ouro HUD).
   *  No computador continua centralizado. Confirmação NÃO usa: lá é modal. */
  gaveta?: boolean;
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
      className={gaveta ? "items-end sm:items-center sm:p-4" : undefined}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: gaveta ? undefined : "center",
        justifyContent: "center",
        padding: gaveta ? 0 : 16,
        background: bloqueante ? "rgba(0,0,0,0.9)" : "rgba(0,0,0,0.7)",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={
          gaveta
            ? `hud-scope hud-anim w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-[14px] rounded-b-none sm:rounded border p-5 sm:p-6 space-y-4 sm:my-auto`
            : `hud-scope w-full ${largura} rounded border p-6 space-y-4 my-auto`
        }
        // Sólido de propósito: a classe de vidro deixaria o modal
        // semitransparente e o texto competindo com a página atrás.
        // Ilha escura (components/hud/tema): o conteúdo das telas ainda é
        // texto branco, e num tema claro sumiria.
        style={{
          ...ILHA_ESCURA,
          backgroundColor: "#161625",
          borderColor: "#2A2D42",
          boxShadow: "0 14px 40px rgba(0,0,0,0.55)",
          color: "#F5F5F7",
          ...(gaveta ? { borderTop: "2px solid var(--hud-accent)", animation: "hud-sheet-in 0.22s ease-out" } : {}),
        }}
      >
        {gaveta && <div aria-hidden="true" className="mx-auto -mt-2 mb-1 h-1 w-10 rounded-sm bg-[#4A4E66] sm:hidden" />}
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Confirmação do app, no lugar do `confirm()` do navegador.
 *
 * O `confirm()` nativo é desenhado pelo sistema operacional, não por nós:
 * no celular ele aparece como um alerta cinza do Android/iOS, com a fonte
 * do sistema e o domínio do site no topo. Ao lado do resto do painel, parece
 * que o produto quebrou e o telefone assumiu — o dono descreveu como
 * "parece SMS". Também trava a aba inteira enquanto está aberto.
 *
 * Devolve promessa de propósito. A alternativa seria um `useState` por
 * pergunta, como já havia em _assinatura.tsx; com quatorze lugares para
 * converter, isso viraria quatorze estados soltos. Assim cada chamada
 * continua sendo uma linha só:
 *
 *     if (!(await confirmar({ titulo: "Apagar?" }))) return;
 */
export interface PedidoConfirmacao {
  titulo: string;
  /** Explicação do que vai acontecer. Aceita quebra de linha. */
  texto?: string;
  /** Rótulo do botão que confirma. */
  acao?: string;
  /** Rótulo do botão que desiste. */
  cancelar?: string;
  /** Pinta a ação de vermelho — para o que não tem volta. */
  perigo?: boolean;
}

export function useConfirmacao(): [
  (pedido: PedidoConfirmacao) => Promise<boolean>,
  React.ReactNode,
] {
  const [pedido, setPedido] = useState<PedidoConfirmacao | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirmar = useCallback((p: PedidoConfirmacao) => {
    // Se já havia uma pergunta aberta, a promessa dela precisa terminar —
    // senão fica um `await` esperando para sempre.
    resolver.current?.(false);
    setPedido(p);
    return new Promise<boolean>((res) => { resolver.current = res; });
  }, []);

  const responder = useCallback((v: boolean) => {
    setPedido(null);
    resolver.current?.(v);
    resolver.current = null;
  }, []);

  // Esc e clique fora contam como desistir, igual ao confirm() nativo.
  const elemento = (
    <Modal aberto={!!pedido} onFechar={() => responder(false)}>
      {pedido && (
        <>
          <h3 className="font-display text-[22px] leading-tight text-hud-text">{pedido.titulo}</h3>
          {pedido.texto && (
            <p className="text-[13px] text-hud-muted whitespace-pre-line leading-relaxed">
              {pedido.texto}
            </p>
          )}
          {/* A ação que a pessoa pediu é a que fica em destaque. O modal de
              cancelar assinatura inverte isso de propósito — lá queremos que
              ela desista — mas aqui inverter faz o app parecer que está
              duvidando de um clique deliberado. */}
          <button
            onClick={() => responder(true)}
            autoFocus
            className={
              pedido.perigo
                ? "hud-focus w-full min-h-[46px] rounded bg-hud-err text-[13px] font-extrabold text-[#0B0B14] hover:brightness-110 transition"
                : "hud-focus gold-fill w-full min-h-[46px] rounded text-[13px] font-extrabold hover:brightness-105 transition"
            }
          >
            {pedido.acao ?? "Confirmar"}
          </button>
          <button
            onClick={() => responder(false)}
            className="hud-focus w-full min-h-[46px] rounded border border-hud-border text-[13px] font-bold text-hud-text hover:border-hud-muted transition"
          >
            {pedido.cancelar ?? "Cancelar"}
          </button>
        </>
      )}
    </Modal>
  );

  return [confirmar, elemento];
}
