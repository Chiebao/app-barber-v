"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/app/components/hud";

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
      <div className="hud-card p-5">
        <div className="h-4 w-40 bg-[color-mix(in_srgb,var(--hud-surface)_60%,transparent)] rounded animate-pulse" />
      </div>
    );
  }

  if (!d) return null;

  if (d.semDados) {
    return (
      <div className="hud-card p-5 space-y-2">
        <h3 className="font-semibold text-hud-text"><Icon nome="grafico" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Conversão do seu link</h3>
        <p className="text-sm text-hud-muted">
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
    <div className="hud-card p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-hud-text"><Icon nome="grafico" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Conversão do seu link</h3>
        <span className="text-xs text-hud-muted">últimos {d.dias} dias</span>
      </div>

      <div className="flex items-end gap-2">
        <p className="text-4xl font-bold text-hud-light tabular-nums">{conversao}%</p>
        {d.anterior.visitas > 0 && variou !== 0 && (
          <span
            className={
              "text-sm font-semibold pb-1 " + (variou > 0 ? "text-hud-ok" : "text-hud-err")
            }
          >
            {variou > 0 ? "▲" : "▼"} {Math.abs(variou)} pts
          </span>
        )}
      </div>

      {/* Funil visual */}
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs text-hud-muted mb-1">
            <span>Abriram o link</span>
            <span className="tabular-nums text-hud-soft">{visitas}</span>
          </div>
          <div className="h-2.5 rounded-full bg-[var(--hud-track)]" />
        </div>
        <div>
          <div className="flex justify-between text-xs text-hud-muted mb-1">
            <span>Agendaram</span>
            <span className="tabular-nums text-hud-light">{agendamentos}</span>
          </div>
          <div className="h-2.5 rounded-full bg-[var(--hud-track)] overflow-hidden">
            <div
              className="h-full rounded-full gold-fill transition-all duration-700"
              style={{ width: Math.min(100, conversao) + "%" }}
            />
          </div>
        </div>
      </div>

      <p className="text-xs text-hud-muted leading-relaxed border-t border-hud-border pt-3">
        {leitura}
      </p>
    </div>
  );
}
