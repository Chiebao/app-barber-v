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
          <h3 className="text-xl font-semibold text-white">Adicionar produto</h3>
          <p className="text-xs text-gray-500 mt-0.5">{clienteNome}</p>
        </div>
        <button
          onClick={onFechar}
          aria-label="Fechar"
          className="shrink-0 rounded-lg px-2 py-1 text-lg text-gray-500 hover:text-white transition"
        >
          ✕
        </button>
      </div>

      {carregando && <p className="text-sm text-gray-500 py-4 text-center">Carregando...</p>}

      {!carregando && produtos.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center leading-relaxed">
          Nenhum produto cadastrado ainda.
          <span className="block text-xs text-gray-500 mt-1">
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
              className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                qtd > 0 ? "border-brand-500/45 bg-brand-500/10" : "border-gray-700"
              }`}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-white truncate">{p.name}</span>
                <span className="block text-xs text-gray-500 tabular-nums">{BRL(p.price)}</span>
              </span>

              {qtd === 0 ? (
                <button
                  onClick={() => mudar(p.id, 1)}
                  className="shrink-0 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-bold text-gray-300 hover:border-brand-400 hover:text-brand-400 transition"
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
                    className="h-7 w-7 rounded-lg border border-gray-700 text-gray-300 hover:text-white transition"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-bold text-brand-400 tabular-nums">{qtd}</span>
                  <button
                    onClick={() => mudar(p.id, 1)}
                    aria-label={`Mais um ${p.name}`}
                    className="h-7 w-7 rounded-lg border border-gray-700 text-gray-300 hover:text-white transition"
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
        <div className="flex items-baseline justify-between gap-3 rounded-xl bg-dark-900 border border-gray-700 px-3 py-2.5">
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Produtos
          </span>
          <span className="text-base font-bold text-brand-400 tabular-nums">{BRL(total)}</span>
        </div>
      )}

      <button
        onClick={salvar}
        disabled={salvando}
        className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition"
      >
        {salvando ? "Salvando..." : "Salvar edição"}
      </button>
    </Modal>
  );
}
