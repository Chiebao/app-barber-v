"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/app/lib/toast";
import { Modal, useConfirmacao } from "@/app/lib/modal";

/**
 * Despesas do mês.
 *
 * O app sempre soube tudo que entra e nada que sai, então "quanto sobrou" era
 * impossível de responder. Esta tela é o outro lado da conta.
 *
 * A aposta inteira está na recorrência: aluguel, água e luz são a maior parte
 * do que uma barbearia gasta e não mudam. Se dependessem de alguém lembrar de
 * digitar todo mês, os números parariam de fechar em três semanas e a tela
 * viraria enfeite. Cadastra uma vez, marca "repete todo mês", e o cron lança.
 */

interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  categoria: string;
  data: string;
  recorrente: boolean;
  automatica: boolean;
}

interface Categoria { id: string; rotulo: string }

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-08-15" → { dia: "15", mes: "ago" } */
function diaEMes(iso: string) {
  const [, m, d] = iso.split("-");
  return { dia: d, mes: MESES[Number(m) - 1] || "" };
}

/**
 * "2026-08" → "Agosto de 2026".
 *
 * A maiúscula é feita aqui, e não com `capitalize` do CSS: aquela classe
 * capitaliza TODA palavra e produz "Agosto De 2026".
 */
function mesPorExtenso(mes: string) {
  const nomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const [a, m] = mes.split("-");
  return `${nomes[Number(m) - 1] || ""} de ${a}`;
}

/** Mês corrente no fuso de São Paulo — o navegador do dono já está nele. */
function mesDeHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function mudarMes(mes: string, passos: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + passos, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Despesas({
  token,
  onVoltar,
  onUnauthorized,
  onMudou,
}: {
  token: string | null;
  onVoltar: () => void;
  onUnauthorized: () => void;
  /** Avisa o painel para recarregar o lucro, que depende destes números. */
  onMudou?: () => void;
}) {
  const [confirmar, dialogoConfirmacao] = useConfirmacao();
  const [mes, setMes] = useState(mesDeHoje());
  const [dados, setDados] = useState<{
    total: number;
    porCategoria: Record<string, number>;
    categorias: Categoria[];
    despesas: Despesa[];
  } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Formulário
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Despesa | null>(null);
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [repete, setRepete] = useState(false);

  const buscar = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    try {
      const res = await fetch(`/api/me/despesas?mes=${mes}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const d = await res.json();
      if (res.ok) setDados(d);
      else toast.error(d.error || "Não consegui carregar as despesas");
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setCarregando(false);
    }
  }, [token, mes, onUnauthorized]);

  useEffect(() => { buscar(); }, [buscar]);

  function abrirNova() {
    setEditando(null);
    setValor("");
    setDescricao("");
    setCategoria("");
    setRepete(false);
    setAberto(true);
  }

  function abrirEdicao(d: Despesa) {
    setEditando(d);
    setValor(String(d.valor).replace(".", ","));
    setDescricao(d.descricao);
    setCategoria(d.categoria);
    setRepete(d.recorrente);
    setAberto(true);
  }

  async function salvar() {
    // Aceita "45,90" e "45.90" — o dono digita com vírgula.
    const numero = parseFloat(valor.replace(/\./g, "").replace(",", "."));
    if (!numero || numero <= 0) { toast.error("Informe quanto foi"); return; }
    if (!categoria) { toast.error("Escolha a categoria"); return; }
    if (!descricao.trim()) { toast.error("Descreva a despesa"); return; }
    if (!token) return;

    setSalvando(true);
    try {
      const res = await fetch("/api/me/despesas", {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...(editando ? { id: editando.id } : {}),
          descricao: descricao.trim(),
          valor: numero,
          categoria,
          recorrente: repete,
        }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || "Não consegui salvar"); return; }
      toast.success(editando ? "Despesa atualizada" : "Despesa lançada");
      setAberto(false);
      buscar();
      onMudou?.();
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(d: Despesa) {
    const ok = await confirmar({
      titulo: `Apagar "${d.descricao}"?`,
      texto: d.recorrente
        ? "Esta é a despesa que se repete todo mês. Apagando, os lançamentos que já aconteceram continuam no histórico, mas os próximos meses param de ser lançados sozinhos."
        : "O lançamento some deste mês e o lucro é recalculado.",
      acao: "Apagar",
      perigo: true,
    });
    if (!ok || !token) return;

    try {
      const res = await fetch("/api/me/despesas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: d.id }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (!res.ok) { const e = await res.json(); toast.error(e.error || "Não consegui apagar"); return; }
      toast.success("Despesa apagada");
      buscar();
      onMudou?.();
    } catch {
      toast.error("Erro de conexão");
    }
  }

  const cats = dados?.categorias || [];
  const rotulo = (id: string) => cats.find((c) => c.id === id)?.rotulo || "Outros";
  const ehMesAtual = mes === mesDeHoje();

  return (
    <div className="space-y-4">
      {dialogoConfirmacao}

      <div className="flex items-center gap-3">
        <button
          onClick={onVoltar}
          className="hud-focus min-h-[44px] rounded border border-hud-border px-3 py-2 text-sm text-hud-muted hover:text-hud-text transition"
        >
          ← Voltar
        </button>
        <h2 className="font-display text-2xl leading-tight text-hud-text">Despesas</h2>
      </div>

      {/* Navegação de mês */}
      <div className="hud-card flex items-center justify-between p-2">
        <button
          onClick={() => setMes(mudarMes(mes, -1))}
          className="rounded px-3 py-2 text-hud-muted hover:text-hud-text hover:bg-white/5 transition"
          aria-label="Mês anterior"
        >
          ←
        </button>
        <span className="text-sm font-semibold text-hud-text">{mesPorExtenso(mes)}</span>
        <button
          onClick={() => setMes(mudarMes(mes, 1))}
          disabled={ehMesAtual}
          className="rounded px-3 py-2 text-hud-muted hover:text-hud-text hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition"
          aria-label="Mês seguinte"
        >
          →
        </button>
      </div>

      <button
        onClick={abrirNova}
        className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 transition"
      >
        + Nova despesa
      </button>

      {carregando && <p className="text-center text-sm text-hud-muted py-8">Carregando...</p>}

      {!carregando && dados && (
        <>
          <div className="hud-card flex items-baseline justify-between p-4">
            <span className="text-xs font-bold uppercase tracking-widest text-hud-muted">
              Total do mês
            </span>
            <span className="text-lg font-bold text-hud-err tabular-nums">{BRL(dados.total)}</span>
          </div>

          {dados.despesas.length === 0 && (
            <div className="hud-card p-6 text-center space-y-2">
              <p className="text-sm text-hud-muted">Nenhuma despesa neste mês.</p>
              <p className="text-xs text-hud-muted">
                Comece pelo aluguel e marque &quot;repete todo mês&quot; — aí você não
                precisa lembrar de novo.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {dados.despesas.map((d) => {
              const { dia, mes: m } = diaEMes(d.data);
              return (
                <div
                  key={d.id}
                  className="hud-card flex items-center gap-3 p-3"
                >
                  <div className="w-10 shrink-0 text-center leading-tight text-hud-muted tabular-nums">
                    <span className="block text-base font-bold text-hud-text">{dia}</span>
                    <span className="block text-[10px] uppercase tracking-wider">{m}</span>
                  </div>

                  <button
                    onClick={() => abrirEdicao(d)}
                    className="flex-1 min-w-0 text-left"
                  >
                    {/* Duas linhas em vez de cortar: "Pomada e cera — fornecedor"
                        vira "Pomada e cera — for…" a 375px, e o que sobra não
                        diz de onde saiu o dinheiro. */}
                    <span className="block text-sm font-semibold text-hud-text leading-snug line-clamp-2">
                      {d.descricao}
                    </span>
                    <span className="flex items-center gap-1.5 flex-wrap text-xs text-hud-muted mt-1">
                      {/* A categoria aparece sempre — antes ela sumia nas
                          recorrentes, e "Conta de luz" perdia o "Contas". */}
                      <span className="rounded-full border border-hud-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        {rotulo(d.categoria)}
                      </span>
                      {(d.recorrente || d.automatica) && (
                        <span className="rounded-full border border-[color-mix(in_srgb,var(--hud-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-hud-light">
                          todo mês
                        </span>
                      )}
                      {d.automatica && <span>lançada sozinha</span>}
                    </span>
                  </button>

                  <span className="text-sm font-bold text-hud-err tabular-nums whitespace-nowrap">
                    {BRL(d.valor)}
                  </span>

                  <button
                    onClick={() => apagar(d)}
                    className="shrink-0 rounded px-2 py-1 text-hud-faint hover:text-hud-err transition"
                    aria-label={`Apagar ${d.descricao}`}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          {dados.despesas.length > 0 && (
            <div className="hud-card p-4">
              <span className="text-xs font-bold uppercase tracking-widest text-hud-muted">
                Por categoria
              </span>
              <div className="mt-3 space-y-2">
                {Object.entries(dados.porCategoria)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, v]) => (
                    <div key={cat} className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-hud-soft">{rotulo(cat)}</span>
                      <span className="text-sm font-semibold text-hud-text tabular-nums">{BRL(v)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Lançar / editar ── */}
      <Modal gaveta aberto={aberto} onFechar={() => setAberto(false)}>
        <h3 className="font-display text-[22px] leading-tight text-hud-text">
          {editando ? "Editar despesa" : "Nova despesa"}
        </h3>

        <div className="space-y-1.5">
          <label htmlFor="d-valor" className="block text-xs font-semibold text-hud-muted">
            Quanto foi
          </label>
          <input
            id="d-valor"
            type="text"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            autoFocus
            className="w-full rounded bg-hud-bg border border-hud-border p-3 text-2xl text-center text-hud-text font-display focus:border-hud-accent focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-hud-muted">Categoria</label>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoria(c.id)}
                className={
                  categoria === c.id
                    ? "rounded-full gold-fill border border-hud-accent px-3 py-2 text-sm font-semibold text-[var(--hud-on-accent)] transition"
                    : "rounded-full border border-hud-border px-3 py-2 text-sm font-semibold text-hud-muted hover:text-hud-text transition"
                }
              >
                {c.rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="d-desc" className="block text-xs font-semibold text-hud-muted">
            O que foi
          </label>
          <input
            id="d-desc"
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Aluguel, conta de luz, pomada..."
            maxLength={80}
            className="w-full rounded bg-hud-bg border border-hud-border p-3 text-hud-text focus:border-hud-accent focus:outline-none"
          />
        </div>

        <button
          onClick={() => setRepete(!repete)}
          className="flex w-full items-center justify-between gap-3 rounded border border-hud-border p-3 text-left hover:bg-white/5 transition"
          aria-pressed={repete}
        >
          <span className="text-sm font-semibold text-hud-text">
            Repete todo mês
            <span className="block text-xs font-normal text-hud-muted mt-0.5">
              Lanço sozinho, você não precisa lembrar
            </span>
          </span>
          <span
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${repete ? "gold-fill" : "bg-[var(--hud-track)]"}`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full transition-all ${repete ? "left-6 bg-hud-bg" : "left-1 bg-[var(--hud-text-2)]"}`}
            />
          </span>
        </button>

        <button
          onClick={salvar}
          disabled={salvando}
          className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition"
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        <button
          onClick={() => setAberto(false)}
          className="w-full rounded border border-hud-border py-3 text-sm font-medium text-hud-muted hover:text-hud-text transition"
        >
          Cancelar
        </button>
      </Modal>
    </div>
  );
}
