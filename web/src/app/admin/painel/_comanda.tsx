"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/app/lib/toast";
import { Modal } from "@/app/lib/modal";

/**
 * Produtos vendidos durante o atendimento.
 *
 * Deliberadamente NÃO é um PDV. O barbeiro lembra da pomada na hora de
 * receber, com o cliente ainda na cadeira — abrir outra tela, outra venda e
 * outro pagamento nesse momento é o caminho mais curto para ele desistir e o
 * produto sumir do relatório.
 *
 * Então: um toque no atendimento que já existe, marca o produto, salva. O
 * valor entra junto no que o cliente vai pagar.
 */

interface Produto {
  id: string;
  name: string;
  price: number;
  active: boolean;
}

interface ItemComanda {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Comanda({
  aberto,
  onFechar,
  token,
  appointmentId,
  clienteNome,
  itensAtuais,
  onSalvo,
  onUnauthorized,
}: {
  aberto: boolean;
  onFechar: () => void;
  token: string | null;
  appointmentId: string | null;
  clienteNome: string;
  itensAtuais: ItemComanda[];
  onSalvo: () => void;
  onUnauthorized: () => void;
}) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  /** productId → quantidade. Zero significa remover. */
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});

  const buscar = useCallback(async () => {
    if (!token || !aberto) return;
    setCarregando(true);
    try {
      const r = await fetch("/api/me/products", { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) { onUnauthorized(); return; }
      const d = await r.json();
      if (r.ok) setProdutos((d.products || []).filter((p: Produto) => p.active));
    } catch {
      toast.error("Não consegui carregar os produtos");
    } finally {
      setCarregando(false);
    }
  }, [token, aberto, onUnauthorized]);

  useEffect(() => { buscar(); }, [buscar]);

  // Começa do que já está na comanda, para o barbeiro ver o que lançou antes
  // em vez de duplicar sem perceber.
  useEffect(() => {
    if (!aberto) return;
    const inicial: Record<string, number> = {};
    for (const i of itensAtuais) inicial[i.productId] = i.quantity;
    setQuantidades(inicial);
  }, [aberto, itensAtuais]);

  function mudar(id: string, delta: number) {
    setQuantidades((p) => {
      const nova = Math.max(0, (p[id] || 0) + delta);
      return { ...p, [id]: nova };
    });
  }

  const total = produtos.reduce((s, p) => s + p.price * (quantidades[p.id] || 0), 0);

  /** O que mudou em relação ao que já estava salvo. */
  function diferencas() {
    const antes: Record<string, number> = {};
    for (const i of itensAtuais) antes[i.productId] = i.quantity;
    const ids = new Set([...Object.keys(antes), ...Object.keys(quantidades)]);
    return [...ids]
      .map((id) => ({ id, de: antes[id] || 0, para: quantidades[id] || 0 }))
      .filter((x) => x.de !== x.para);
  }

  async function salvar() {
    if (!token || !appointmentId) return;
    const mudou = diferencas();
    if (mudou.length === 0) { onFechar(); return; }

    setSalvando(true);
    try {
      for (const m of mudou) {
        const r = await fetch("/api/me/products", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ appointmentId, productId: m.id, quantity: m.para }),
        });
        if (r.status === 401) { onUnauthorized(); return; }
        if (!r.ok) { toast.error("Não consegui salvar a comanda"); return; }
      }
      toast.success("Comanda atualizada");
      onSalvo();
      onFechar();
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={aberto} onFechar={onFechar}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[22px] leading-tight text-hud-text">Adicionar produto</h3>
          <p className="text-xs text-hud-muted mt-0.5">{clienteNome}</p>
        </div>
        <button
          onClick={onFechar}
          aria-label="Fechar"
          className="hud-focus min-h-[44px] shrink-0 rounded px-2 py-1 text-lg text-hud-muted hover:text-hud-text transition"
        >
          ✕
        </button>
      </div>

      {carregando && <p className="text-sm text-hud-muted py-4 text-center">Carregando...</p>}

      {!carregando && produtos.length === 0 && (
        <p className="text-sm text-hud-muted py-4 text-center leading-relaxed">
          Nenhum produto cadastrado ainda.
          <span className="block text-xs text-hud-muted mt-1">
            Cadastre em Início › Produtos para vender durante o atendimento.
          </span>
        </p>
      )}

      <div className="space-y-2 max-h-72 overflow-y-auto">
        {produtos.map((p) => {
          const qtd = quantidades[p.id] || 0;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-3 rounded border p-3 transition ${
                qtd > 0 ? "border-[color-mix(in_srgb,var(--hud-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)]" : "border-hud-border"
              }`}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-hud-text truncate">{p.name}</span>
                <span className="block text-xs text-hud-muted tabular-nums">{BRL(p.price)}</span>
              </span>

              {qtd === 0 ? (
                <button
                  onClick={() => mudar(p.id, 1)}
                  className="shrink-0 rounded border border-hud-border px-3 py-1.5 text-xs font-bold text-hud-soft hover:border-hud-accent hover:text-hud-light transition"
                >
                  Adicionar
                </button>
              ) : (
                // Quantidade em vez de só marcar: duas pomadas é um caso comum,
                // e sem isto ele teria que lançar o mesmo produto duas vezes.
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => mudar(p.id, -1)}
                    aria-label={`Menos um ${p.name}`}
                    className="h-7 w-7 rounded border border-hud-border text-hud-soft hover:text-hud-text transition"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-bold text-hud-light tabular-nums">{qtd}</span>
                  <button
                    onClick={() => mudar(p.id, 1)}
                    aria-label={`Mais um ${p.name}`}
                    className="h-7 w-7 rounded border border-hud-border text-hud-soft hover:text-hud-text transition"
                  >
                    +
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {total > 0 && (
        <div className="flex items-baseline justify-between gap-3 rounded bg-hud-bg border border-hud-border px-3 py-2.5">
          <span className="text-xs font-bold uppercase tracking-widest text-hud-muted">
            Produtos
          </span>
          <span className="text-base font-bold text-hud-light tabular-nums">{BRL(total)}</span>
        </div>
      )}

      <button
        onClick={salvar}
        disabled={salvando}
        className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition"
      >
        {salvando ? "Salvando..." : "Salvar edição"}
      </button>
    </Modal>
  );
}
