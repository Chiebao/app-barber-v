"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/app/lib/toast";
import { Modal } from "@/app/lib/modal";

/**
 * Horário de trabalho, um dia por vez.
 *
 * A alternativa era a semana inteira numa lista: sete blocos de quatro campos,
 * 28 campos numa tela de celular. O momento que decide é a PRIMEIRA
 * configuração, e é exatamente aí que 28 campos cobram caro — antes de o
 * barbeiro ter visto valor nenhum no app.
 *
 * Aqui ele preenche um dia, toca em "copiar para" e resolve a semana em quatro
 * toques. O resumo nas abas (T 13–21) devolve o que a lista tinha de bom: bate
 * o olho e vê a semana, mesmo editando um dia de cada vez.
 */

interface Dia {
  dia: number;
  aberto: boolean;
  abre: string;
  fecha: string;
  almocoInicio: string | null;
  almocoFim: string | null;
}

const NOMES = [
  { curto: "D", longo: "Domingo" },
  { curto: "S", longo: "Segunda-feira" },
  { curto: "T", longo: "Terça-feira" },
  { curto: "Q", longo: "Quarta-feira" },
  { curto: "Q", longo: "Quinta-feira" },
  { curto: "S", longo: "Sexta-feira" },
  { curto: "S", longo: "Sábado" },
];

/** "09:00" → "09h" · "13:30" → "13h30" */
function curto(h: string) {
  const [a, b] = h.split(":");
  return b === "00" ? `${a}h` : `${a}h${b}`;
}

function emMin(h: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(h || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

function duracao(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

export default function Expediente({
  aberto,
  onFechar,
  token,
  onSalvo,
  onUnauthorized,
}: {
  aberto: boolean;
  onFechar: () => void;
  token: string | null;
  onSalvo: () => void;
  onUnauthorized: () => void;
}) {
  const [dias, setDias] = useState<Dia[]>([]);
  const [sel, setSel] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const buscar = useCallback(async () => {
    if (!token || !aberto) return;
    setCarregando(true);
    try {
      const r = await fetch("/api/me/expediente", { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) { onUnauthorized(); return; }
      const d = await r.json();
      if (r.ok) setDias(d.dias || []);
    } catch {
      toast.error("Não consegui carregar o horário");
    } finally {
      setCarregando(false);
    }
  }, [token, aberto, onUnauthorized]);

  useEffect(() => { buscar(); }, [buscar]);

  const atual = dias.find((d) => d.dia === sel);

  function mudar(campo: keyof Dia, valor: string | boolean | null) {
    setDias((p) => p.map((d) => (d.dia === sel ? { ...d, [campo]: valor } : d)));
  }

  function copiarPara(destino: number) {
    if (!atual) return;
    setDias((p) =>
      p.map((d) =>
        d.dia === destino
          ? { ...d, aberto: atual.aberto, abre: atual.abre, fecha: atual.fecha, almocoInicio: atual.almocoInicio, almocoFim: atual.almocoFim }
          : d,
      ),
    );
    toast.success(`Copiado para ${NOMES[destino].longo.split("-")[0].toLowerCase()}`);
  }

  async function salvar() {
    if (!token) return;
    setSalvando(true);
    try {
      const r = await fetch("/api/me/expediente", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dias }),
      });
      if (r.status === 401) { onUnauthorized(); return; }
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || "Não consegui salvar"); return; }
      toast.success("Horário salvo");
      onSalvo();
      onFechar();
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setSalvando(false);
    }
  }

  /** As faixas do dia, para ele ver como fica antes de salvar. */
  function faixas(d: Dia) {
    const abre = emMin(d.abre);
    const fecha = emMin(d.fecha);
    if (!Number.isFinite(abre) || !Number.isFinite(fecha) || fecha <= abre) return [];
    const i = d.almocoInicio ? emMin(d.almocoInicio) : NaN;
    const f = d.almocoFim ? emMin(d.almocoFim) : NaN;
    if (!Number.isFinite(i) || !Number.isFinite(f) || f <= i || i < abre || f > fecha) {
      return [{ tipo: "trab" as const, de: d.abre, ate: d.fecha, min: fecha - abre }];
    }
    return [
      { tipo: "trab" as const, de: d.abre, ate: d.almocoInicio!, min: i - abre },
      { tipo: "pausa" as const, de: d.almocoInicio!, ate: d.almocoFim!, min: f - i },
      { tipo: "trab" as const, de: d.almocoFim!, ate: d.fecha, min: fecha - f },
    ];
  }

  return (
    <Modal aberto={aberto} onFechar={onFechar} largura="max-w-md">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-xl font-semibold text-white">Horário de trabalho</h3>
        <button
          onClick={onFechar}
          aria-label="Fechar"
          className="shrink-0 rounded-lg px-2 py-1 text-lg text-gray-500 hover:text-white transition"
        >
          ✕
        </button>
      </div>

      {carregando && <p className="text-sm text-gray-500 py-6 text-center">Carregando...</p>}

      {!carregando && atual && (
        <>
          {/* Abas com o resumo: bate o olho e vê a semana */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {dias.map((d) => (
              <button
                key={d.dia}
                onClick={() => setSel(d.dia)}
                className={`shrink-0 w-[52px] rounded-xl py-1.5 text-center border transition ${
                  d.dia === sel
                    ? "bg-brand-500 border-brand-500 text-dark-900"
                    : d.aberto
                    ? "bg-dark-900 border-gray-700 text-gray-300"
                    : "bg-dark-900 border-gray-800 text-gray-600"
                }`}
              >
                <span className="block text-sm font-bold">{NOMES[d.dia].curto}</span>
                <span className="block text-[9px] font-semibold tabular-nums mt-0.5">
                  {d.aberto ? `${curto(d.abre)}–${curto(d.fecha)}` : "fech"}
                </span>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-gray-700 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-white">{NOMES[sel].longo}</span>
              <button
                onClick={() => mudar("aberto", !atual.aberto)}
                aria-pressed={atual.aberto}
                aria-label={atual.aberto ? "Fechar este dia" : "Abrir este dia"}
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${atual.aberto ? "bg-brand-500" : "bg-gray-700"}`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full transition-all ${atual.aberto ? "left-6 bg-dark-900" : "left-1 bg-gray-400"}`}
                />
              </button>
            </div>

            {!atual.aberto ? (
              // Fechar guarda os horários: reabrir não faz digitar de novo.
              <p className="text-xs text-gray-500">
                Fechado. Os horários ficam guardados — se reabrir, voltam como estavam.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Campo rotulo="Abre" valor={atual.abre} onMudar={(v) => mudar("abre", v)} />
                  <Campo rotulo="Fecha" valor={atual.fecha} onMudar={(v) => mudar("fecha", v)} />
                  <Campo
                    rotulo="Almoço de"
                    valor={atual.almocoInicio || ""}
                    onMudar={(v) => mudar("almocoInicio", v || null)}
                  />
                  <Campo
                    rotulo="até"
                    valor={atual.almocoFim || ""}
                    onMudar={(v) => mudar("almocoFim", v || null)}
                  />
                </div>
                <p className="text-[11px] text-gray-500">
                  Dia sem parada? Deixe o almoço vazio.
                </p>

                {/* Como o dia fica, antes de salvar */}
                <div className="flex flex-col gap-1">
                  {faixas(atual).map((f, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs tabular-nums ${
                        f.tipo === "trab"
                          ? "border border-green-500/30 bg-green-500/5 text-green-400"
                          : "border border-dashed border-gray-700 text-gray-500"
                      }`}
                    >
                      <span className="font-bold w-[92px]">{f.de} – {f.ate}</span>
                      <span>{f.tipo === "trab" ? `atendendo · ${duracao(f.min)}` : "almoço"}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* O caso comum é cinco dias iguais e dois diferentes. */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-gray-500">Copiar para:</span>
            {dias
              .filter((d) => d.dia !== sel)
              .map((d) => (
                <button
                  key={d.dia}
                  onClick={() => copiarPara(d.dia)}
                  className="rounded-full border border-gray-700 px-2.5 py-1 text-[11px] font-bold text-gray-400 hover:border-brand-400 hover:text-brand-400 transition"
                >
                  {NOMES[d.dia].longo.slice(0, 3)}
                </button>
              ))}
          </div>

          <button
            onClick={salvar}
            disabled={salvando}
            className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition"
          >
            {salvando ? "Salvando..." : "Salvar horário"}
          </button>
        </>
      )}
    </Modal>
  );
}

function Campo({
  rotulo,
  valor,
  onMudar,
}: {
  rotulo: string;
  valor: string;
  onMudar: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{rotulo}</span>
      <input
        type="time"
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        className="rounded-lg bg-dark-900 border border-gray-700 px-2.5 py-2 text-sm text-white text-center tabular-nums focus:border-brand-500 focus:outline-none"
      />
    </label>
  );
}
