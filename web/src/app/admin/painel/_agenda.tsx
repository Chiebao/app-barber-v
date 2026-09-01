"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/app/lib/toast";
import { Modal, useConfirmacao } from "@/app/lib/modal";

/**
 * A régua do dia.
 *
 * Antes isto era uma grade de botões de horário, todos do mesmo tamanho. Um
 * corte de 1h15 e um de 30 min ocupavam o mesmo retângulo, e o buraco de 45
 * minutos entre dois atendimentos não aparecia em lugar nenhum — o barbeiro
 * não tinha como VER que o dia estava furado.
 *
 * Aqui a altura é o tempo: 45 minutos livres ocupam 45 minutos de tela. É a
 * mesma informação que a agenda sempre teve, desenhada na escala em que ela
 * significa alguma coisa.
 */

interface Agendamento {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  cliente: string;
  servicos: string[];
}

interface Regra {
  id: string;
  horaInicio: string;
  horaFim: string;
  diasSemana: number[];
}

interface Dados {
  allSlots: string[];
  blocked: string[];
  fixos: string[];
  allDay: boolean;
  booked: string[];
  agendamentos: Agendamento[];
  bloqueios: { startTime: string; endTime: string; tipo: "pontual" | "fixo" }[];
  shopHours: { openTime: string; closeTime: string; slotInterval: number };
}

/** Pixels por minuto. Abaixo disso um corte de 30 min fica ilegível. */
const ESCALA = 1.15;
/** Altura mínima de uma faixa, para o texto sempre caber. */
const ALTURA_MIN = 44;

const DIAS = [
  { n: 0, curto: "D", nome: "domingo" },
  { n: 1, curto: "S", nome: "segunda" },
  { n: 2, curto: "T", nome: "terça" },
  { n: 3, curto: "Q", nome: "quarta" },
  { n: 4, curto: "Q", nome: "quinta" },
  { n: 5, curto: "S", nome: "sexta" },
  { n: 6, curto: "S", nome: "sábado" },
];

const INTERVALOS = [15, 20, 30, 45, 60];

function emMinutos(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}
function emTexto(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
/** 75 → "1h15", 60 → "1h", 45 → "45min" */
function duracao(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

type Faixa =
  | { tipo: "corte"; inicio: number; fim: number; agendamento: Agendamento }
  | { tipo: "fixo"; inicio: number; fim: number }
  | { tipo: "bloqueado"; inicio: number; fim: number; horarios: string[] }
  | { tipo: "livre"; inicio: number; fim: number; horarios: string[] };

/**
 * Transforma agendamentos e bloqueios numa sequência de faixas sem buraco.
 *
 * Monta por FRONTEIRA, não por passo. A primeira versão caminhava de
 * `slotInterval` em `slotInterval` a partir de um cursor, e isso quebrava
 * exatamente onde a agenda ficou interessante: depois de um encaixe o cursor
 * sai da grade (11:15, 12:15, 13:15…), nenhum rótulo bate com os blocos, e um
 * passo de 1h atravessa por cima de um corte que começa às 14:00. Na tela
 * apareceu "3h livre" engolindo o almoço, e um corte de 30 min desenhado
 * como 15.
 *
 * Aqui as peças conhecidas (corte, bloqueio) são colocadas na régua e o que
 * sobra entre elas é, por definição, livre.
 */
function montarFaixas(d: Dados): Faixa[] {
  const abre = emMinutos(d.shopHours.openTime);
  const fecha = emMinutos(d.shopHours.closeTime);
  if (!Number.isFinite(abre) || !Number.isFinite(fecha) || fecha <= abre) return [];

  /** Blocos da grade cobertos por um intervalo — é o que o toque manda de volta. */
  const gradeEntre = (inicio: number, fim: number) =>
    d.allSlots.filter((t) => {
      const m = emMinutos(t);
      return m >= inicio && m < fim;
    });

  type Peca = { inicio: number; fim: number; faixa: Faixa };
  const pecas: Peca[] = [];

  for (const a of d.agendamentos) {
    const i = emMinutos(a.startTime);
    const f = emMinutos(a.endTime);
    if (!Number.isFinite(i) || !Number.isFinite(f) || f <= i) continue;
    pecas.push({ inicio: i, fim: f, faixa: { tipo: "corte", inicio: i, fim: f, agendamento: a } });
  }

  for (const b of d.bloqueios || []) {
    const i = emMinutos(b.startTime);
    const f = emMinutos(b.endTime);
    if (!Number.isFinite(i) || !Number.isFinite(f) || f <= i) continue;
    pecas.push({
      inicio: i,
      fim: f,
      faixa:
        b.tipo === "fixo"
          ? { tipo: "fixo", inicio: i, fim: f }
          : { tipo: "bloqueado", inicio: i, fim: f, horarios: gradeEntre(i, f) },
    });
  }

  // Corte antes de bloqueio no desempate: se os dois cobrem o mesmo minuto, o
  // que importa ao barbeiro é o cliente que vai chegar.
  const ordem = { corte: 0, bloqueado: 1, fixo: 2, livre: 3 };
  pecas.sort((a, b) => a.inicio - b.inicio || ordem[a.faixa.tipo] - ordem[b.faixa.tipo]);

  const faixas: Faixa[] = [];
  let cursor = abre;

  for (const p of pecas) {
    const fim = Math.min(p.fim, fecha);
    if (fim <= cursor) continue; // já coberto por uma peça anterior
    const inicio = Math.max(p.inicio, cursor);
    if (inicio >= fecha) break;

    if (inicio > cursor) {
      faixas.push({ tipo: "livre", inicio: cursor, fim: inicio, horarios: gradeEntre(cursor, inicio) });
    }

    const faixa = { ...p.faixa, inicio, fim } as Faixa;
    if (faixa.tipo === "bloqueado") faixa.horarios = gradeEntre(inicio, fim);
    faixas.push(faixa);
    cursor = fim;
  }

  if (cursor < fecha) {
    faixas.push({ tipo: "livre", inicio: cursor, fim: fecha, horarios: gradeEntre(cursor, fecha) });
  }

  return faixas;
}

export default function Agenda({
  token,
  data,
  onMudarData,
  barberId,
  slotInterval,
  onMudarIntervalo,
  onUnauthorized,
}: {
  token: string | null;
  data: string;
  onMudarData: (d: string) => void;
  /** Barbeiro cuja agenda estamos editando (o dono manda o próprio perfil). */
  barberId?: string;
  slotInterval: number;
  onMudarIntervalo: (min: number) => Promise<void>;
  onUnauthorized: () => void;
}) {
  const [confirmar, dialogoConfirmacao] = useConfirmacao();
  const [d, setD] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [verIntervalo, setVerIntervalo] = useState(false);
  const [verBloqueio, setVerBloqueio] = useState(false);
  const [regras, setRegras] = useState<Regra[]>([]);

  // Formulário da regra
  const [de, setDe] = useState("12:00");
  const [ate, setAte] = useState("13:00");
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5, 6]);

  const auth = useMemo(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }),
    [token],
  );

  const buscar = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    try {
      const q = `date=${data}${barberId ? `&barberId=${barberId}` : ""}`;
      const [rd, rr] = await Promise.all([
        fetch(`/api/me/blocked-slots?${q}`, { headers: auth }),
        fetch(`/api/me/blocked-slots/recorrentes${barberId ? `?barberId=${barberId}` : ""}`, { headers: auth }),
      ]);
      if (rd.status === 401 || rr.status === 401) { onUnauthorized(); return; }
      if (rd.ok) setD(await rd.json());
      if (rr.ok) setRegras((await rr.json()).regras || []);
    } catch {
      toast.error("Erro ao carregar a agenda");
    } finally {
      setCarregando(false);
    }
  }, [token, data, barberId, auth, onUnauthorized]);

  useEffect(() => { buscar(); }, [buscar]);

  async function mexerNosBlocos(horarios: string[], bloquear: boolean) {
    if (!token || horarios.length === 0) return;
    setSalvando(true);
    try {
      const res = await fetch("/api/me/blocked-slots", {
        method: bloquear ? "POST" : "DELETE",
        headers: auth,
        body: JSON.stringify({ date: data, times: horarios, ...(barberId ? { barberId } : {}) }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (!res.ok) { toast.error("Não consegui atualizar"); return; }
      await buscar();
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setSalvando(false);
    }
  }

  async function diaInteiro(bloquear: boolean) {
    if (bloquear && !(await confirmar({
      titulo: "Bloquear o dia inteiro?",
      texto: "Nenhum horário deste dia vai aparecer para o cliente. Dá para liberar depois.",
      acao: "Bloquear o dia",
    }))) return;
    if (!token) return;
    setSalvando(true);
    try {
      const res = await fetch("/api/me/blocked-slots", {
        method: bloquear ? "POST" : "DELETE",
        headers: auth,
        body: JSON.stringify({ date: data, allDay: true, ...(barberId ? { barberId } : {}) }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      toast.success(bloquear ? "Dia bloqueado" : "Dia liberado");
      setVerBloqueio(false);
      await buscar();
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarRegra() {
    if (!token) return;
    if (dias.length === 0) { toast.error("Escolha ao menos um dia"); return; }
    setSalvando(true);
    try {
      const res = await fetch("/api/me/blocked-slots/recorrentes", {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ horaInicio: de, horaFim: ate, diasSemana: dias, ...(barberId ? { barberId } : {}) }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Não consegui salvar"); return; }
      toast.success("Bloqueio criado — vale toda semana");
      setVerBloqueio(false);
      await buscar();
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setSalvando(false);
    }
  }

  async function apagarRegra(r: Regra) {
    const ok = await confirmar({
      titulo: `Apagar o bloqueio de ${r.horaInicio} às ${r.horaFim}?`,
      texto: "Os dias que já passaram continuam como estão. A partir de agora esse horário volta a aceitar agendamento.",
      acao: "Apagar",
      perigo: true,
    });
    if (!ok || !token) return;
    setSalvando(true);
    try {
      const res = await fetch("/api/me/blocked-slots/recorrentes", {
        method: "DELETE", headers: auth, body: JSON.stringify({ id: r.id }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (!res.ok) { toast.error("Não consegui apagar"); return; }
      toast.success("Bloqueio removido");
      await buscar();
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setSalvando(false);
    }
  }

  const faixas = d ? montarFaixas(d) : [];
  const livreTotal = faixas.filter((f) => f.tipo === "livre").reduce((s, f) => s + (f.fim - f.inicio), 0);

  // Seis dias a partir de hoje, como tira de datas.
  const hoje = new Date();
  const diasTira = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    return { iso, dia: dt.getDate(), semana: DIAS[dt.getDay()].nome.slice(0, 3) };
  });

  return (
    <div className="space-y-4">
      {dialogoConfirmacao}

      <h2 className="text-lg font-semibold text-white">📅 Minha Agenda</h2>

      {/* Tira de datas */}
      {/* scrollbar escondida: o globals.css pinta a barra de dourado e ela
          apareceria como um risco atravessado embaixo das datas */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {diasTira.map((x) => (
          <button
            key={x.iso}
            onClick={() => onMudarData(x.iso)}
            className={`shrink-0 w-[52px] rounded-xl py-1.5 text-center border transition ${
              x.iso === data
                ? "bg-brand-500 border-brand-500 text-dark-900"
                : "bg-dark-800 border-gray-700 text-gray-300 hover:border-gray-500"
            }`}
          >
            <span className="block text-[10px] uppercase tracking-wide opacity-75">{x.semana}</span>
            <span className="block text-base font-bold tabular-nums">{x.dia}</span>
          </button>
        ))}
      </div>

      {/* Controles */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setVerIntervalo(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/45 bg-brand-500/10 px-3 py-2 text-xs font-bold text-brand-400"
        >
          Intervalo <span className="text-white">{slotInterval >= 60 ? "1h" : `${slotInterval}min`}</span>
          <span className="opacity-60">▾</span>
        </button>
        <button
          onClick={() => setVerBloqueio(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-dark-800 px-3 py-2 text-xs font-bold text-gray-400 hover:text-white transition"
        >
          Bloquear <span className="opacity-60">▾</span>
        </button>
        {livreTotal > 0 && (
          <span className="inline-flex items-center rounded-full border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-500">
            {duracao(livreTotal)} livre
          </span>
        )}
      </div>

      {carregando && <p className="text-center text-sm text-gray-500 py-10">Carregando...</p>}

      {!carregando && d && d.allDay && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-5 text-center space-y-3">
          <p className="text-sm font-semibold text-red-400">Dia inteiro bloqueado</p>
          <p className="text-xs text-gray-500">Nenhum horário aparece para o cliente.</p>
          <button
            onClick={() => diaInteiro(false)}
            disabled={salvando}
            className="w-full rounded-xl border border-green-500/50 bg-green-500/10 py-2.5 text-sm font-semibold text-green-400 hover:bg-green-500/20 disabled:opacity-50 transition"
          >
            Liberar o dia
          </button>
        </div>
      )}

      {/* ── A régua ── */}
      {!carregando && d && !d.allDay && faixas.length === 0 && (
        <p className="text-center text-sm text-gray-500 py-10">Nenhum horário neste dia.</p>
      )}

      {!carregando && d && !d.allDay && faixas.length > 0 && (
        <div className="flex gap-2">
          <div className="w-11 shrink-0 flex flex-col">
            {faixas.map((f) => (
              <div
                key={`e-${f.inicio}`}
                style={{ height: Math.max(ALTURA_MIN, (f.fim - f.inicio) * ESCALA) }}
                className="text-[11px] text-gray-500 tabular-nums pt-1"
              >
                {emTexto(f.inicio)}
              </div>
            ))}
          </div>

          <div className="flex-1 flex flex-col gap-1 min-w-0">
            {faixas.map((f) => {
              const altura = Math.max(ALTURA_MIN, (f.fim - f.inicio) * ESCALA) - 4;
              const mins = f.fim - f.inicio;

              // Faixa curta não comporta duas linhas: um corte de 30 min tem
              // ~40px de altura e o texto saía cortado ao meio.
              const compacto = altura < 58;

              if (f.tipo === "corte") {
                const a = f.agendamento;
                const detalhe =
                  (a.servicos.join(", ") || "Atendimento") +
                  (a.status === "pending_payment" ? " · aguardando Pix" : "");
                return (
                  <div
                    key={`c-${f.inicio}`}
                    style={{ height: altura }}
                    className="rounded-xl border border-brand-500/35 bg-brand-500/15 px-3 py-1.5 overflow-hidden flex flex-col justify-center"
                  >
                    {compacto ? (
                      <span className="text-sm font-bold text-brand-400 truncate leading-tight">
                        {a.cliente}
                        <span className="font-medium text-brand-400/70"> · {duracao(mins)}</span>
                      </span>
                    ) : (
                      <>
                        <span className="text-sm font-bold text-brand-400 truncate leading-tight">
                          {a.cliente}
                        </span>
                        <span className="text-[11px] text-brand-400/70 truncate leading-tight mt-0.5">
                          {detalhe} · {duracao(mins)}
                        </span>
                      </>
                    )}
                  </div>
                );
              }

              if (f.tipo === "fixo") {
                return (
                  <div
                    key={`f-${f.inicio}`}
                    style={{
                      height: altura,
                      backgroundImage:
                        "repeating-linear-gradient(45deg, rgba(139,143,163,.10), rgba(139,143,163,.10) 7px, transparent 7px, transparent 14px)",
                    }}
                    className="rounded-xl border border-dashed border-gray-700 px-3 py-2 overflow-hidden flex flex-col justify-center"
                  >
                    <span className="text-sm font-bold text-gray-400 leading-tight">Fechado · todo dia</span>
                    {!compacto && (<span className="text-[11px] text-gray-500 leading-tight mt-0.5">
                      {emTexto(f.inicio)} – {emTexto(f.fim)} · toque em Bloquear para mudar
                    </span>)}
                  </div>
                );
              }

              if (f.tipo === "bloqueado") {
                return (
                  <button
                    key={`b-${f.inicio}`}
                    onClick={() => mexerNosBlocos(f.horarios, false)}
                    disabled={salvando}
                    style={{ height: altura }}
                    className="rounded-xl border border-red-500/40 bg-red-500/8 px-3 py-2 text-left overflow-hidden flex flex-col justify-center disabled:opacity-50"
                  >
                    <span className="text-sm font-bold text-red-400 leading-tight">Bloqueado · {duracao(mins)}</span>
                    {!compacto && <span className="text-[11px] text-gray-500 leading-tight mt-0.5">Toque para liberar</span>}
                  </button>
                );
              }

              return (
                <button
                  key={`l-${f.inicio}`}
                  onClick={() => mexerNosBlocos(f.horarios, true)}
                  disabled={salvando}
                  style={{ height: altura }}
                  className="rounded-xl border border-dashed border-green-500/35 bg-green-500/5 px-3 py-2 text-left overflow-hidden flex flex-col justify-center disabled:opacity-50"
                >
                  <span className="text-sm font-bold text-green-400 leading-tight">{duracao(mins)} livre</span>
                  {!compacto && <span className="text-[11px] text-gray-500 leading-tight mt-0.5">Toque para fechar</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Intervalo ── */}
      <Modal aberto={verIntervalo} onFechar={() => setVerIntervalo(false)}>
        <h3 className="text-xl font-semibold text-white">Intervalo da agenda</h3>
        <p className="text-sm text-gray-300">
          De quanto em quanto tempo a agenda oferece horário quando o dia está vazio.
        </p>
        <div className="flex flex-wrap gap-2">
          {INTERVALOS.map((min) => (
            <button
              key={min}
              onClick={async () => { await onMudarIntervalo(min); setVerIntervalo(false); await buscar(); }}
              className={
                slotInterval === min
                  ? "rounded-full bg-brand-500 border border-brand-500 px-4 py-2.5 text-sm font-bold text-dark-900"
                  : "rounded-full border border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-400 hover:text-white transition"
              }
            >
              {min >= 60 ? "1 hora" : `${min} min`}
            </button>
          ))}
        </div>
        {/* Sem este aviso parece que muda só o dia aberto na tela. */}
        <p className="text-xs text-gray-500">
          Vale para a barbearia inteira, todos os dias — é o mesmo ajuste que
          fica em Configurações.
        </p>
        <button
          onClick={() => setVerIntervalo(false)}
          className="w-full rounded-xl border border-gray-700 py-3 text-sm font-medium text-gray-400 hover:text-white transition"
        >
          Fechar
        </button>
      </Modal>

      {/* ── Bloquear ── */}
      <Modal aberto={verBloqueio} onFechar={() => setVerBloqueio(false)}>
        <h3 className="text-xl font-semibold text-white">Bloquear horário</h3>

        <button
          onClick={() => diaInteiro(true)}
          disabled={salvando}
          className="w-full rounded-xl border border-gray-700 py-3 text-sm font-semibold text-gray-300 hover:bg-white/5 disabled:opacity-50 transition"
        >
          Fechar o dia inteiro
        </button>

        <div className="rounded-xl border border-gray-700 p-4 space-y-3">
          <div>
            <span className="block text-sm font-semibold text-white">Todo dia, no mesmo horário</span>
            <span className="block text-xs text-gray-500 mt-0.5">
              O almoço, por exemplo. Vale toda semana, sem você precisar voltar aqui.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="time"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="flex-1 min-w-0 rounded-lg bg-dark-900 border border-gray-700 px-3 py-2.5 text-white text-sm focus:border-brand-500 focus:outline-none"
              aria-label="Começa às"
            />
            <span className="text-gray-500 text-sm shrink-0">até</span>
            <input
              type="time"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="flex-1 min-w-0 rounded-lg bg-dark-900 border border-gray-700 px-3 py-2.5 text-white text-sm focus:border-brand-500 focus:outline-none"
              aria-label="Termina às"
            />
          </div>

          <div className="flex gap-1.5">
            {DIAS.map((dia) => {
              const on = dias.includes(dia.n);
              return (
                <button
                  key={dia.n}
                  onClick={() => setDias((p) => (on ? p.filter((x) => x !== dia.n) : [...p, dia.n]))}
                  aria-label={dia.nome}
                  aria-pressed={on}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                    on
                      ? "bg-brand-500 text-dark-900"
                      : "border border-gray-700 text-gray-500 hover:text-white"
                  }`}
                >
                  {dia.curto}
                </button>
              );
            })}
          </div>

          <button
            onClick={salvarRegra}
            disabled={salvando}
            className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition"
          >
            {salvando ? "Salvando..." : "Criar bloqueio"}
          </button>
        </div>

        {regras.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
              Bloqueios que se repetem
            </span>
            {regras.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-gray-700 px-3 py-2.5"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-white tabular-nums">
                    {r.horaInicio} – {r.horaFim}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {r.diasSemana.length === 7
                      ? "todos os dias"
                      : r.diasSemana.map((n) => DIAS[n].nome.slice(0, 3)).join(", ")}
                  </span>
                </span>
                <button
                  onClick={() => apagarRegra(r)}
                  className="shrink-0 rounded-lg px-2 py-1 text-gray-600 hover:text-red-400 transition"
                  aria-label="Apagar regra"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setVerBloqueio(false)}
          className="w-full rounded-xl border border-gray-700 py-3 text-sm font-medium text-gray-400 hover:text-white transition"
        >
          Fechar
        </button>
      </Modal>
    </div>
  );
}
