"use client";

import { useEffect, useState } from "react";

/**
 * Taxa de ocupação da agenda (B18).
 *
 * O número sozinho não diz o que fazer — por isso a leitura vem junto:
 * ocupação baixa é problema de divulgação, ocupação alta é sinal de que a
 * agenda está no limite e dá para cobrar mais.
 */

interface DiaSemana { dia: string; aberta: boolean; taxa: number }
interface Dados {
  dias: number;
  taxa: number;
  horasOcupadas: number;
  horasDisponiveis: number;
  atendimentos: number;
  barbeiros: number;
  porDiaSemana: DiaSemana[];
  semDados: boolean;
}

export default function Ocupacao({ token }: { token: string | null }) {
  const [d, setD] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch("/api/me/ocupacao?dias=7", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then(setD)
      .catch(() => setD(null))
      .finally(() => setCarregando(false));
  }, [token]);

  if (carregando) {
    return (
      <div className="rounded-xl bg-dark-800 border border-gray-700 p-5">
        <div className="h-4 w-44 bg-gray-700/60 rounded animate-pulse" />
      </div>
    );
  }
  if (!d) return null;

  if (d.semDados) {
    return (
      <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-2">
        <h3 className="font-semibold text-white">🪑 Ocupação da agenda</h3>
        <p className="text-sm text-gray-400">
          Sem atendimentos nos últimos {d.dias} dias. Assim que a agenda começar a rodar,
          mostramos aqui quanto da sua cadeira está sendo aproveitado.
        </p>
      </div>
    );
  }

  const cor =
    d.taxa >= 80 ? "text-green-400" : d.taxa >= 50 ? "text-brand-400" : "text-yellow-400";
  const barra =
    d.taxa >= 80 ? "bg-green-500" : d.taxa >= 50 ? "bg-brand-500" : "bg-yellow-500";

  const leitura =
    d.taxa >= 85
      ? "Sua agenda está praticamente cheia. Esse é o momento de considerar aumentar o preço ou abrir mais horários — a demanda já existe."
      : d.taxa >= 60
      ? "Boa ocupação. Ainda cabe gente: divulgar o link nos dias mais fracos deve encher o resto."
      : d.taxa >= 30
      ? "Tem bastante cadeira vazia. O gargalo aqui é trazer gente — vale reforçar a divulgação do link."
      : "A agenda está muito ociosa. Antes de qualquer coisa, garanta que os clientes conhecem o link de agendamento.";

  const maisFraco = d.porDiaSemana
    .filter((x) => x.aberta)
    .sort((a, b) => a.taxa - b.taxa)[0];

  return (
    <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-white">🪑 Ocupação da agenda</h3>
        <span className="text-xs text-gray-500">últimos {d.dias} dias</span>
      </div>

      <div>
        <div className="flex items-end gap-3">
          <p className={"text-4xl font-bold tabular-nums " + cor}>{d.taxa}%</p>
          <p className="text-xs text-gray-500 pb-1.5">
            {d.horasOcupadas}h de {d.horasDisponiveis}h disponíveis
          </p>
        </div>
        <div className="h-2.5 rounded-full bg-gray-700 overflow-hidden mt-2">
          <div
            className={"h-full rounded-full transition-all duration-700 " + barra}
            style={{ width: Math.min(100, d.taxa) + "%" }}
          />
        </div>
      </div>

      {/* Por dia da semana */}
      <div className="flex gap-1.5">
        {d.porDiaSemana.map((x) => (
          <div key={x.dia} className="flex-1 text-center">
            <div className="h-16 flex items-end justify-center">
              {x.aberta ? (
                <div
                  className={"w-full rounded-t " + (x.taxa >= 60 ? "bg-brand-500" : "bg-gray-600")}
                  style={{ height: Math.max(4, Math.min(100, x.taxa)) + "%" }}
                  title={x.taxa + "%"}
                />
              ) : (
                <div className="w-full h-1 rounded bg-gray-800" title="fechado" />
              )}
            </div>
            <p className={"text-xs mt-1 " + (x.aberta ? "text-gray-400" : "text-gray-700")}>
              {x.dia}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 leading-relaxed border-t border-gray-700 pt-3">
        {leitura}
        {maisFraco && d.taxa < 85 && (
          <span className="block mt-1 text-gray-500">
            Dia mais vazio: <strong className="text-gray-300">{maisFraco.dia}</strong> ({maisFraco.taxa}%).
          </span>
        )}
      </p>
    </div>
  );
}
