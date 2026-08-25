"use client";

import { useEffect, useState } from "react";

/**
 * Funil do link: de cada 10 pessoas que abrem, quantas agendam.
 *
 * O número sozinho não serve — o que serve é saber o que fazer com ele.
 * Por isso a tela sempre fecha com uma leitura: converteu pouco = problema
 * no fluxo; converteu bem = o gargalo é divulgação.
 */

interface Dados {
  dias: number;
  atual: { visitas: number; agendamentos: number; conversao: number };
  anterior: { visitas: number; agendamentos: number; conversao: number };
  variacaoConversao: number;
  semDados: boolean;
}

export default function Conversao({ token }: { token: string | null }) {
  const [d, setD] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch("/api/me/analytics?dias=30", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setD(j))
      .catch(() => setD(null))
      .finally(() => setCarregando(false));
  }, [token]);

  if (carregando) {
    return (
      <div className="rounded-xl bg-dark-800 border border-gray-700 p-5">
        <div className="h-4 w-40 bg-gray-700/60 rounded animate-pulse" />
      </div>
    );
  }

  if (!d) return null;

  if (d.semDados) {
    return (
      <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-2">
        <h3 className="font-semibold text-white">📈 Conversão do seu link</h3>
        <p className="text-sm text-gray-400">
          Ainda não temos dados suficientes. Assim que seus clientes começarem a abrir o link,
          mostramos aqui quantos deles realmente agendam.
        </p>
      </div>
    );
  }

  const { visitas, agendamentos, conversao } = d.atual;
  const variou = d.variacaoConversao;

  // A leitura importa mais que o número
  const leitura =
    visitas < 10
      ? "Poucas visitas ainda — divulgue mais o link para ter um número confiável."
      : conversao >= 50
      ? "Ótima conversão! Quem abre, agenda. Seu gargalo agora é divulgação: quanto mais gente abrir o link, mais agendamentos."
      : conversao >= 25
      ? "Conversão saudável. Dá para melhorar deixando preços e horários mais claros logo na entrada."
      : "Muita gente abre e não agenda. Vale olhar se há horários disponíveis suficientes e se os preços estão claros.";

  return (
    <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-white">📈 Conversão do seu link</h3>
        <span className="text-xs text-gray-500">últimos {d.dias} dias</span>
      </div>

      <div className="flex items-end gap-2">
        <p className="text-4xl font-bold text-brand-400 tabular-nums">{conversao}%</p>
        {d.anterior.visitas > 0 && variou !== 0 && (
          <span
            className={
              "text-sm font-semibold pb-1 " + (variou > 0 ? "text-green-400" : "text-red-400")
            }
          >
            {variou > 0 ? "▲" : "▼"} {Math.abs(variou)} pts
          </span>
        )}
      </div>

      {/* Funil visual */}
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Abriram o link</span>
            <span className="tabular-nums text-gray-300">{visitas}</span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-700" />
        </div>
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Agendaram</span>
            <span className="tabular-nums text-brand-400">{agendamentos}</span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-700"
              style={{ width: Math.min(100, conversao) + "%" }}
            />
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 leading-relaxed border-t border-gray-700 pt-3">
        {leitura}
      </p>
    </div>
  );
}
