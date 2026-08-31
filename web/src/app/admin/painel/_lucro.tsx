"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/app/lib/toast";

/**
 * Lucro do mês.
 *
 * O número em destaque é o que SOBRA, não o faturamento. É de propósito:
 * faturamento alto com pouco sobrando é exatamente a armadilha que esta tela
 * existe para revelar. Destacar o faturamento faria dela mais um lugar de se
 * sentir bem sem saber de nada.
 */

interface Resultado {
  mes: string;
  entrou: number;
  servicos: number;
  produtos: number;
  comissoes: number;
  despesas: number;
  lucro: number;
  atendimentos: number;
  margemProdutos: { vendeu: number; custou: number; margem: number; itensSemCusto: number };
  comparacao: { mes: string; lucro: number; variacao: number | null };
}

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const NOMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function nomeDoMes(mes: string) {
  return NOMES[Number(mes.split("-")[1]) - 1] || "";
}

export default function Lucro({
  token,
  onUnauthorized,
  onVerDespesas,
  recarregar,
}: {
  token: string | null;
  onUnauthorized: () => void;
  onVerDespesas: () => void;
  /** Muda quando uma despesa é lançada — força recalcular. */
  recarregar?: number;
}) {
  const [r, setR] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState(true);

  const buscar = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/me/resultado", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { onUnauthorized(); return; }
      const d = await res.json();
      if (res.ok) setR(d);
      else toast.error(d.error || "Não consegui calcular o lucro");
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setCarregando(false);
    }
  }, [token, onUnauthorized]);

  useEffect(() => { buscar(); }, [buscar, recarregar]);

  if (carregando || !r) return null;

  const semNada = r.entrou === 0 && r.despesas === 0;
  const positivo = r.lucro >= 0;
  const v = r.comparacao.variacao;

  return (
    <div className="rounded-xl bg-dark-800 border border-gray-700 p-4 space-y-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Lucro mensal</span>
        <span
          className={`font-display text-4xl leading-none tabular-nums ${positivo ? "text-brand-400" : "text-red-400"}`}
        >
          {BRL(r.lucro)}
        </span>
        {v !== null && (
          <span className={`text-xs font-semibold mt-1 ${v >= 0 ? "text-green-400" : "text-red-400"}`}>
            {v >= 0 ? "↑" : "↓"} {Math.abs(v)}%{" "}
            <span className="font-medium text-gray-500">
              vs {nomeDoMes(r.comparacao.mes)} ({BRL(r.comparacao.lucro)})
            </span>
          </span>
        )}
      </div>

      {semNada ? (
        <p className="text-xs text-gray-500 leading-relaxed">
          Ainda não há atendimento pago nem despesa lançada neste mês. Assim que
          houver, a conta aparece aqui.
        </p>
      ) : (
        <div className="flex flex-col">
          <Linha rotulo="Entrou" valor={r.entrou} cor="text-green-400" sinal="" />
          <Filha rotulo="Serviços" valor={r.servicos} />
          <Filha rotulo="Produtos" valor={r.produtos} />
          <Linha rotulo="Comissões" valor={r.comissoes} cor="text-red-400" sinal="− " />
          <Linha rotulo="Despesas" valor={r.despesas} cor="text-red-400" sinal="− " />
          <div className="flex items-baseline justify-between gap-3 border-t border-gray-700 mt-1.5 pt-3">
            <span className="text-sm font-bold text-white">Lucro</span>
            <span className={`text-lg font-bold tabular-nums ${positivo ? "text-brand-400" : "text-red-400"}`}>
              {BRL(r.lucro)}
            </span>
          </div>
        </div>
      )}

      {/* A margem é informativa e fica fora da conta acima: o dinheiro gasto
          para comprar produto já foi lançado como despesa. Descontar o custo
          aqui também seria tirar a mesma compra duas vezes. */}
      {r.margemProdutos.vendeu > 0 && (
        <div className="rounded-lg bg-dark-900 border border-gray-700 p-3 space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-gray-400">Margem dos produtos</span>
            <span className="text-sm font-semibold text-green-400 tabular-nums">
              {BRL(r.margemProdutos.margem)}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 leading-snug">
            Vendeu {BRL(r.margemProdutos.vendeu)}, custou {BRL(r.margemProdutos.custou)}.
            {r.margemProdutos.itensSemCusto > 0 && (
              <span className="text-yellow-400">
                {" "}
                {r.margemProdutos.itensSemCusto} venda
                {r.margemProdutos.itensSemCusto === 1 ? "" : "s"} sem custo cadastrado — a
                margem real é menor.
              </span>
            )}
          </p>
        </div>
      )}

      <button
        onClick={onVerDespesas}
        className="w-full rounded-xl border border-gray-700 py-2.5 text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition"
      >
        {r.despesas > 0 ? "Ver e lançar despesas" : "Lançar a primeira despesa"}
      </button>
    </div>
  );
}

function Linha({ rotulo, valor, cor, sinal }: { rotulo: string; valor: number; cor: string; sinal: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-gray-700/60">
      <span className="text-sm text-white">{rotulo}</span>
      <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${cor}`}>
        {sinal}
        {BRL(valor)}
      </span>
    </div>
  );
}

function Filha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 pl-3.5">
      <span className="text-xs text-gray-500">{rotulo}</span>
      <span className="text-xs font-medium text-gray-500 tabular-nums">{BRL(valor)}</span>
    </div>
  );
}
