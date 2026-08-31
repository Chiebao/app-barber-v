"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
          <h3 className="text-xl font-semibold text-white">{pedido.titulo}</h3>
          {pedido.texto && (
            <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
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
                ? "w-full rounded-xl bg-red-500 py-3 font-semibold text-white hover:bg-red-600 transition"
                : "w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 transition"
            }
          >
            {pedido.acao ?? "Confirmar"}
          </button>
          <button
            onClick={() => responder(false)}
            className="w-full rounded-xl border border-gray-700 py-3 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            {pedido.cancelar ?? "Cancelar"}
          </button>
        </>
      )}
    </Modal>
  );

  return [confirmar, elemento];
}
