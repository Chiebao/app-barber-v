"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/app/lib/toast";
import { gerarRelatorioPdf } from "./_relatorio-pdf";

/**
 * Relatório financeiro por período.
 *
 * A aba Financeiro mostrava onze números agregados do mês corrente e não
 * respondia as perguntas que o dono realmente tem: quem me deve, quanto
 * entrou de cada forma de pagamento, quanto foi corte e quanto foi produto,
 * como fechou o mês passado, quanto pagar de comissão.
 *
 * O backend já respondia tudo isso — /api/me/finance aceita período e
 * barbeiro desde sempre. Faltava a tela.
 */

interface Barbeiro { id: string; name: string; }

interface Resumo {
  totalAppointments: number;
  totalPaid: number;
  totalUnpaid: number;
  paidCount: number;
  unpaidCount: number;
  comandaTotal: number;
  totalRevenue: number;
  paymentCounts: Record<string, { count: number; total: number }>;
  barberBreakdown: { id: string; name: string; count: number; revenue: number; commission: number; commissionValue: number }[];
  avgRating: number | null;
}

interface Atendimento {
  id: string;
  date: string;
  startTime: string;
  totalPrice: number;
  paidAt: string | null;
  paymentMethod: string | null;
  deferredPaymentDate: string | null;
  barberName: string;
  client: { name: string; phone: string };
  comandaTotal: number;
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ROTULO_PAGAMENTO: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  adiado: "Vai pagar depois",
  indefinido: "Não informado",
};

const COR_PAGAMENTO: Record<string, string> = {
  pix: "bg-green-500",
  dinheiro: "bg-brand-500",
  cartao: "bg-blue-500",
  adiado: "bg-yellow-500",
  indefinido: "bg-gray-500",
};

/** Datas do período escolhido, no fuso local do barbeiro. */
function periodoDe(chave: string): { start: string; end: string } {
  const hoje = new Date();
  const iso = (d: Date) => {
    const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return t.toISOString().slice(0, 10);
  };

  if (chave === "hoje") return { start: iso(hoje), end: iso(hoje) };

  if (chave === "semana") {
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - 6);
    return { start: iso(inicio), end: iso(hoje) };
  }

  if (chave === "passado") {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    return { start: iso(inicio), end: iso(fim) };
  }

  // "mes" — do dia 1 até hoje
  return { start: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), end: iso(hoje) };
}

const PERIODOS = [
  { id: "hoje", label: "Hoje" },
  { id: "semana", label: "7 dias" },
  { id: "mes", label: "Este mês" },
  { id: "passado", label: "Mês passado" },
];

export default function Relatorio({
  token,
  ehDono,
  nomeBarbearia,
  barbeiros,
  onVoltar,
  onUnauthorized,
}: {
  token: string | null;
  ehDono: boolean;
  nomeBarbearia: string;
  barbeiros: Barbeiro[];
  onVoltar: () => void;
  onUnauthorized: () => void;
}) {
  const [periodo, setPeriodo] = useState("mes");
  const [custom, setCustom] = useState<{ start: string; end: string } | null>(null);
  const [barbeiroId, setBarbeiroId] = useState("");
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [verDevedores, setVerDevedores] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [verLista, setVerLista] = useState(false);

  const faixa = useMemo(() => custom ?? periodoDe(periodo), [custom, periodo]);

  const buscar = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    try {
      const extra = barbeiroId ? `&barberId=${barbeiroId}` : "";
      const res = await fetch(`/api/me/finance?start=${faixa.start}&end=${faixa.end}${extra}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (!res.ok) { toast.error("Não foi possível carregar o relatório"); return; }
      const d = await res.json();
      setResumo(d.summary);
      setAtendimentos(d.appointments || []);
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setCarregando(false);
    }
  }, [token, faixa.start, faixa.end, barbeiroId, onUnauthorized]);

  useEffect(() => { buscar(); }, [buscar]);

  const devedores = atendimentos.filter(a => !a.paidAt);

  const exportar = async () => {
    if (!resumo) return;
    setGerandoPdf(true);
    try {
      await gerarRelatorioPdf({
        nomeBarbearia,
        inicio: faixa.start,
        fim: faixa.end,
        barbeiroFiltrado: barbeiroId ? (barbeiros.find(b => b.id === barbeiroId)?.name ?? null) : null,
        resumo,
        atendimentos,
      });
    } catch (e) {
      console.error("PDF:", e);
      toast.error("Não foi possível gerar o PDF");
    } finally {
      setGerandoPdf(false);
    }
  };

  /** Abre o WhatsApp do cliente com a cobrança pronta. */
  const cobrar = (a: Atendimento) => {
    const tel = a.client.phone.replace(/\D/g, "");
    const [ano, mes, dia] = a.date.split("-");
    const msg = encodeURIComponent(
      `Olá, ${a.client.name}! Passando para lembrar do atendimento do dia ${dia}/${mes}/${ano} ` +
      `às ${a.startTime}, no valor de ${BRL(a.totalPrice + a.comandaTotal)}. ` +
      `Quando puder acertar, me avisa! Obrigado 🙏`
    );
    window.open(`https://wa.me/55${tel}?text=${msg}`, "_blank");
  };

  const formatarData = (iso: string) => {
    const [a, m, d] = iso.split("-");
    return `${d}/${m}`;
  };

  const totalComissoes = resumo?.barberBreakdown.reduce((s, b) => s + b.commissionValue, 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onVoltar} className="flex items-center gap-1 text-brand-400 text-sm hover:text-brand-300 shrink-0">
          <span className="text-lg">←</span> Voltar
        </button>
        <h2 className="flex-1 text-lg font-semibold text-white">📄 Relatório</h2>
        {resumo && resumo.totalAppointments > 0 && (
          <button
            onClick={exportar}
            disabled={gerandoPdf}
            className="shrink-0 rounded-lg border border-brand-400/50 px-3 py-2 text-xs text-brand-400 hover:bg-brand-500/10 disabled:opacity-50 transition"
          >
            {gerandoPdf ? "Gerando..." : "⬇ PDF"}
          </button>
        )}
      </div>

      {/* Período */}
      <div className="flex gap-2 flex-wrap">
        {PERIODOS.map(p => (
          <button
            key={p.id}
            onClick={() => { setPeriodo(p.id); setCustom(null); }}
            className={`px-3 py-2 rounded-lg text-sm border transition ${
              !custom && periodo === p.id
                ? "border-brand-400 bg-brand-500/10 text-brand-400"
                : "border-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">De</label>
          <input
            type="date" value={faixa.start}
            onChange={e => setCustom({ start: e.target.value, end: faixa.end })}
            className="w-full rounded-lg bg-dark-800 border border-gray-700 px-3 py-2 text-sm text-white focus:border-brand-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Até</label>
          <input
            type="date" value={faixa.end}
            onChange={e => setCustom({ start: faixa.start, end: e.target.value })}
            className="w-full rounded-lg bg-dark-800 border border-gray-700 px-3 py-2 text-sm text-white focus:border-brand-400 focus:outline-none"
          />
        </div>
      </div>

      {ehDono && barbeiros.length > 1 && (
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Barbeiro</label>
          <select
            value={barbeiroId}
            onChange={e => setBarbeiroId(e.target.value)}
            className="w-full rounded-lg bg-dark-800 border border-gray-700 px-3 py-2.5 text-sm text-white focus:border-brand-400 focus:outline-none"
          >
            <option value="">Todos</option>
            {barbeiros.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {carregando ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !resumo ? null : resumo.totalAppointments === 0 ? (
        <div className="text-center py-14 text-gray-500">
          <p className="text-4xl mb-3">📭</p>
          <p>Nenhum atendimento neste período</p>
        </div>
      ) : (
        <>
          {/* Entrou de verdade — serviço e produto separados, que é a
              pergunta "quanto foi corte e quanto foi produto" */}
          <div className="rounded-2xl bg-brand-500/10 border border-brand-400/30 p-5">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Entrou no período</p>
            <p className="text-4xl font-semibold text-brand-400 tabular-nums">{BRL(resumo.totalRevenue)}</p>
            <div className="mt-3 pt-3 border-t border-brand-400/20 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-400 text-xs">Serviços</p>
                <p className="text-white font-semibold tabular-nums">{BRL(resumo.totalPaid)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Produtos</p>
                <p className="text-white font-semibold tabular-nums">{BRL(resumo.comandaTotal)}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              {resumo.paidCount} atendimento{resumo.paidCount !== 1 ? "s" : ""} pago{resumo.paidCount !== 1 ? "s" : ""}
              {resumo.avgRating ? ` · nota ${resumo.avgRating} ★` : ""}
            </p>
          </div>

          {/* Como entrou — para bater com o caixa e o extrato */}
          {Object.keys(resumo.paymentCounts).length > 0 && (
            <div className="rounded-xl bg-dark-800 border border-gray-700 p-4 space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-widest">Como entrou</p>
              {Object.entries(resumo.paymentCounts)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([metodo, dados]) => {
                  const pct = resumo.totalPaid > 0 ? Math.round((dados.total / resumo.totalPaid) * 100) : 0;
                  return (
                    <div key={metodo} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">
                          {ROTULO_PAGAMENTO[metodo] || metodo}
                          <span className="text-gray-500 text-xs ml-1.5">{dados.count}×</span>
                        </span>
                        <span className="text-white font-semibold tabular-nums">{BRL(dados.total)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-dark-900 overflow-hidden">
                        <div className={`h-full rounded-full ${COR_PAGAMENTO[metodo] || "bg-gray-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Quem deve — o número que antes era texto morto */}
          {resumo.totalUnpaid > 0 && (
            <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-4 space-y-3">
              <button onClick={() => setVerDevedores(v => !v)} className="w-full flex items-center justify-between text-left">
                <div>
                  <p className="text-xs text-yellow-500/80 uppercase tracking-widest">Falta receber</p>
                  <p className="text-2xl font-semibold text-yellow-400 tabular-nums">{BRL(resumo.totalUnpaid)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {resumo.unpaidCount} atendimento{resumo.unpaidCount !== 1 ? "s" : ""} — toque para ver de quem
                  </p>
                </div>
                <span className="text-yellow-500/60 text-lg">{verDevedores ? "▲" : "▼"}</span>
              </button>

              {verDevedores && (
                <div className="space-y-2 pt-2 border-t border-yellow-500/20">
                  {devedores.map(a => (
                    <div key={a.id} className="flex items-center gap-3 rounded-lg bg-dark-900/60 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{a.client.name}</p>
                        <p className="text-xs text-gray-400">
                          {formatarData(a.date)} · {a.startTime} · {a.barberName}
                          {a.deferredPaymentDate && (
                            <span className="text-yellow-400"> · prometeu {formatarData(a.deferredPaymentDate.slice(0, 10))}</span>
                          )}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-yellow-400 tabular-nums shrink-0">
                        {BRL(a.totalPrice + a.comandaTotal)}
                      </p>
                      <button
                        onClick={() => cobrar(a)}
                        title="Cobrar pelo WhatsApp"
                        className="shrink-0 rounded-lg border border-green-500/40 px-2.5 py-2 text-sm text-green-400 hover:bg-green-500/10 transition"
                      >
                        💬
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Comissões — quanto pagar a cada um, no período escolhido */}
          {ehDono && resumo.barberBreakdown.length > 0 && (
            <div className="rounded-xl bg-dark-800 border border-gray-700 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 uppercase tracking-widest">Por barbeiro</p>
                {totalComissoes > 0 && (
                  <p className="text-xs text-green-400">
                    Comissões: <span className="font-semibold tabular-nums">{BRL(totalComissoes)}</span>
                  </p>
                )}
              </div>
              {resumo.barberBreakdown.map(b => (
                <div key={b.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{b.name}</p>
                    <p className="text-xs text-gray-500">{b.count} atendimento{b.count !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-white tabular-nums">{BRL(b.revenue)}</p>
                    {b.commission > 0 && (
                      <p className="text-xs text-green-400 tabular-nums">
                        {b.commission}% = {BRL(b.commissionValue)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Detalhe, para quando o número não bate e ele quer conferir */}
          <div className="rounded-xl bg-dark-800 border border-gray-700 overflow-hidden">
            <button onClick={() => setVerLista(v => !v)} className="w-full flex items-center justify-between p-4 text-left hover:bg-brand-500/5 transition">
              <span className="text-sm text-gray-300">
                Ver os {resumo.totalAppointments} atendimentos
              </span>
              <span className="text-gray-600">{verLista ? "▲" : "▼"}</span>
            </button>

            {verLista && (
              <div className="border-t border-gray-700 divide-y divide-gray-700/60 max-h-96 overflow-y-auto">
                {atendimentos.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{a.client.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatarData(a.date)} · {a.startTime} · {a.barberName}
                        {a.paidAt && a.paymentMethod ? ` · ${ROTULO_PAGAMENTO[a.paymentMethod] || a.paymentMethod}` : ""}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold tabular-nums shrink-0 ${a.paidAt ? "text-green-400" : "text-yellow-400"}`}>
                      {BRL(a.totalPrice + a.comandaTotal)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
