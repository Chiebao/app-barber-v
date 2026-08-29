"use client";

import { useState } from "react";
import { toast } from "@/app/lib/toast";

/**
 * Painel da plataforma — visão do dono do BarberPro (não do dono da barbearia).
 * Mostra quantas barbearias existem, quais estão vivas e quais pararam de usar.
 */

interface Barbearia {
  id: string; nome: string; slug: string; criadaEm: string;
  barbeiros: number; agendamentosTotal: number; receitaMes: number;
  ultimoAgendamento: string | null; diasParado: number | null;
  situacao: "ativa" | "em_risco" | "sem_uso";
  assinatura: {
    estado: string; plano: string; valorCiclo: number; diasRestantes: number;
    venceEm: string; metodo: string | null;
    ultimaCobranca: { status: string; valor: number; vencimento: string; pagaEm: string | null; link: string | null } | null;
  };
}
interface Assinaturas {
  mrr: number; pagantes: number;
  porEstado: Record<string, number>;
  cobrancasPendentes: number; valorPendente: number;
}
interface Resumo {
  barbearias: number; ativas: number; emRisco: number; semUso: number;
  ativasNaSemana: number; clientesTotal: number; agendamentosMes: number;
  receitaMes: number; novasEm30Dias: number;
}

const ASSINATURA_VISUAL: Record<string, { label: string; cor: string }> = {
  trial:     { label: "Teste",     cor: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  ativa:     { label: "Pagando",   cor: "bg-green-500/15 text-green-400 border-green-500/30" },
  carencia:  { label: "Atrasada",  cor: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  bloqueada: { label: "Bloqueada", cor: "bg-red-500/15 text-red-400 border-red-500/30" },
  cortesia:  { label: "Cortesia",  cor: "bg-brand-500/15 text-brand-400 border-brand-400/30" },
  cancelada: { label: "Cancelada", cor: "bg-gray-700/40 text-gray-400 border-gray-600" },
};

const SITUACAO = {
  ativa:    { label: "Ativa",    cor: "bg-green-500/15 text-green-400 border-green-500/30" },
  em_risco: { label: "Em risco", cor: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  sem_uso:  { label: "Sem uso",  cor: "bg-red-500/15 text-red-400 border-red-500/30" },
} as const;

export default function PlataformaPage() {
  const [secret, setSecret] = useState("");
  const [dados, setDados] = useState<{ resumo: Resumo; barbearias: Barbearia[]; assinaturas: Assinaturas } | null>(null);
  const [loading, setLoading] = useState(false);

  const carregar = async () => {
    if (!secret) { toast.error("Informe a senha-mestra"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/plataforma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const d = await res.json();
      if (res.ok) setDados(d);
      else toast.error(d.error || "Erro ao carregar");
    } catch { toast.error("Erro de conexão"); }
    finally { setLoading(false); }
  };

  const moeda = (v: number) => "R$ " + v.toFixed(2).replace(".", ",");
  const fmtData = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

  if (!dados) {
    return (
      <main className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        <div className="max-w-sm w-full space-y-4">
          <div className="text-center space-y-1">
            <div className="text-4xl">📊</div>
            <h1 className="text-xl font-bold text-white">Painel da Plataforma</h1>
            <p className="text-sm text-gray-500">Visão geral de todas as barbearias</p>
          </div>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") carregar(); }}
            placeholder="Senha-mestra"
            className="w-full rounded-xl bg-dark-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-600 focus:border-brand-400 focus:outline-none"
          />
          <button
            onClick={carregar}
            disabled={loading}
            className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all"
          >
            {loading ? "Carregando..." : "Entrar"}
          </button>
        </div>
      </main>
    );
  }

  const r = dados.resumo;

  const saude = [
    { v: String(r.barbearias), l: "Barbearias", cor: "text-white" },
    { v: String(r.ativas), l: "Ativas", cor: "text-green-400" },
    { v: String(r.emRisco), l: "Em risco (30d+ paradas)", cor: "text-yellow-400" },
    { v: String(r.semUso), l: "Nunca agendaram", cor: "text-red-400" },
  ];

  const volume = [
    { v: String(r.agendamentosMes), l: "Agendamentos no mês" },
    { v: moeda(r.receitaMes), l: "Movimentado no mês" },
    { v: String(r.clientesTotal), l: "Clientes cadastrados" },
    { v: String(r.novasEm30Dias), l: "Novas em 30 dias" },
  ];

  return (
    <main className="min-h-screen bg-dark-900 text-white px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex items-end justify-between gap-4 border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-brand-400">Painel da Plataforma</h1>
            <p className="text-sm text-gray-500">Como o BarberPro está indo, no total</p>
          </div>
          <button
            onClick={carregar}
            className="text-sm text-gray-400 border border-gray-700 rounded-lg px-3 py-1.5 hover:text-white transition"
          >
            Atualizar
          </button>
        </header>

        {/* Saúde da base */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {saude.map((k) => (
            <div key={k.l} className="rounded-xl bg-dark-800 border border-gray-700 p-4">
              <p className={"text-3xl font-bold " + k.cor}>{k.v}</p>
              <p className="text-xs text-gray-500 mt-1">{k.l}</p>
            </div>
          ))}
        </section>

        {/* Volume */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {volume.map((k) => (
            <div key={k.l} className="rounded-xl bg-dark-800 border border-gray-700 p-4">
              <p className="text-xl font-bold text-brand-400">{k.v}</p>
              <p className="text-xs text-gray-500 mt-1">{k.l}</p>
            </div>
          ))}
        </section>

        {/* Dinheiro da plataforma — o que o BarberPro fatura, não as barbearias */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Assinaturas</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-brand-500/10 border border-brand-400/30 p-4">
              <p className="text-3xl font-bold text-brand-400 tabular-nums">
                {dados.assinaturas.mrr.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              {/* Semestral e anual são cobrados de uma vez; aqui entram pela
                  fatia mensal, senão o número pula e não serve de termômetro */}
              <p className="text-xs text-gray-500 mt-1">Por mês (MRR)</p>
            </div>
            <div className="rounded-xl bg-dark-800 border border-gray-700 p-4">
              <p className="text-3xl font-bold text-green-400 tabular-nums">{dados.assinaturas.pagantes}</p>
              <p className="text-xs text-gray-500 mt-1">Pagantes</p>
            </div>
            <div className="rounded-xl bg-dark-800 border border-gray-700 p-4">
              <p className="text-3xl font-bold text-blue-400 tabular-nums">{dados.assinaturas.porEstado.trial || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Em teste grátis</p>
            </div>
            <div className="rounded-xl bg-dark-800 border border-gray-700 p-4">
              <p className="text-3xl font-bold text-yellow-400 tabular-nums">
                {dados.assinaturas.valorPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {dados.assinaturas.cobrancasPendentes} cobrança{dados.assinaturas.cobrancasPendentes !== 1 ? "s" : ""} em aberto
              </p>
            </div>
          </div>
          {((dados.assinaturas.porEstado.carencia || 0) + (dados.assinaturas.porEstado.bloqueada || 0)) > 0 && (
            <p className="text-sm text-yellow-400">
              ⚠️ {dados.assinaturas.porEstado.carencia || 0} atrasada(s) e{" "}
              {dados.assinaturas.porEstado.bloqueada || 0} bloqueada(s) — vale uma mensagem antes de virar cancelamento.
            </p>
          )}
        </section>

        {/* Lista */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Barbearias</h2>
          {dados.barbearias.length === 0 ? (
            <p className="text-gray-500 py-8 text-center">Nenhuma barbearia cadastrada ainda.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-dark-800 text-gray-400">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Barbearia</th>
                    <th className="text-center px-3 py-3 font-medium">Situação</th>
                    <th className="text-center px-3 py-3 font-medium">Assinatura</th>
                    <th className="text-right px-3 py-3 font-medium">Barbeiros</th>
                    <th className="text-right px-3 py-3 font-medium">Agend.</th>
                    <th className="text-right px-3 py-3 font-medium">No mês</th>
                    <th className="text-right px-4 py-3 font-medium">Último uso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {dados.barbearias.map((b) => (
                    <tr key={b.id} className="bg-dark-900 hover:bg-dark-800/60 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{b.nome}</p>
                        <p className="text-xs text-gray-600">/{b.slug}</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={"text-xs px-2 py-1 rounded-full border " + SITUACAO[b.situacao].cor}>
                          {SITUACAO[b.situacao].label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className={"text-xs px-2 py-1 rounded-full border " + (ASSINATURA_VISUAL[b.assinatura.estado]?.cor || "border-gray-700 text-gray-400")}>
                          {ASSINATURA_VISUAL[b.assinatura.estado]?.label || b.assinatura.estado}
                        </span>
                        {b.assinatura.estado !== "cortesia" && (
                          <p className="text-[10px] text-gray-600 mt-1 tabular-nums">
                            {b.assinatura.diasRestantes}d · {moeda(b.assinatura.valorCiclo)}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-300">{b.barbeiros}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-300">{b.agendamentosTotal}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-brand-400">{moeda(b.receitaMes)}</td>
                      <td className="px-4 py-3 text-right text-gray-400">
                        {fmtData(b.ultimoAgendamento)}
                        {b.diasParado !== null && b.diasParado > 7 && (
                          <span className="block text-xs text-yellow-500">{b.diasParado} dias atrás</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
