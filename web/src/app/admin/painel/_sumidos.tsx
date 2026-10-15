"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/app/components/hud";

/**
 * Radar de cliente sumido (B19).
 *
 * Compara o ritmo de cada cliente com o tempo que ele está sem aparecer.
 * Não é uma lista para olhar — é uma lista para AGIR, por isso cada linha
 * tem o botão de chamar no WhatsApp com a mensagem já pronta.
 */

interface Sumido {
  clientId: string;
  nome: string;
  telefone: string;
  visitas: number;
  intervaloMedio: number;
  diasSemVir: number;
  atrasoEmDias: number;
  ultimaVisita: string;
}

export default function Sumidos({
  token,
  shopName,
  bookingLink,
}: {
  token: string | null;
  shopName?: string;
  bookingLink?: string;
}) {
  const [dados, setDados] = useState<{ total: number; clientes: Sumido[] } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [chamados, setChamados] = useState<string[]>([]);

  useEffect(() => {
    if (!token) return;
    fetch("/api/me/clientes-sumidos", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then(setDados)
      .catch(() => setDados(null))
      .finally(() => setCarregando(false));
  }, [token]);

  const chamar = (c: Sumido) => {
    const tel = c.telefone.replace(/\D/g, "");
    const telWA = tel.startsWith("55") ? tel : "55" + tel;
    const primeiro = c.nome.split(" ")[0];
    const msg = encodeURIComponent(
      `Oi ${primeiro}! Tudo bem? 🫡\n` +
        `Faz um tempo que você não aparece na ${shopName || "barbearia"} e o pessoal já sentiu falta!\n\n` +
        `Que tal marcar um horário?${bookingLink ? "\n" + bookingLink : ""}`,
    );
    window.open(`https://wa.me/${telWA}?text=${msg}`, "_blank");
    setChamados((p) => [...p, c.clientId]);
  };

  if (carregando) {
    return (
      <div className="hud-card p-5">
        <div className="h-4 w-40 bg-[color-mix(in_srgb,var(--hud-surface)_60%,transparent)] rounded animate-pulse" />
      </div>
    );
  }
  if (!dados) return null;

  if (dados.total === 0) {
    return (
      <div className="hud-card p-5 space-y-2">
        <h3 className="font-semibold text-hud-text"><Icon nome="busca" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Clientes sumidos</h3>
        <p className="text-sm text-hud-muted">
          Nenhum cliente atrasado no momento — quem costuma voltar está voltando no ritmo.
          Bom sinal!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded bg-[color-mix(in_srgb,var(--hud-warn)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-warn)_30%,transparent)] p-4">
        <p className="text-sm font-semibold text-hud-warn">
          {dados.total} cliente{dados.total > 1 ? "s" : ""} passou do ponto de voltar
        </p>
        <p className="text-xs text-hud-muted mt-1">
          Comparamos o ritmo de cada um com o tempo que está sem vir. Chamar de volta quem já foi
          cliente costuma dar mais resultado do que buscar gente nova.
        </p>
      </div>

      <div className="space-y-3">
        {dados.clientes.map((c) => {
          const jaChamado = chamados.includes(c.clientId);
          return (
            <div key={c.clientId} className="hud-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-hud-text truncate">{c.nome}</p>
                  <p className="text-sm text-hud-muted">{c.telefone}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-hud-warn tabular-nums">{c.diasSemVir}d</p>
                  <p className="text-xs text-hud-muted">sem vir</p>
                </div>
              </div>

              <p className="text-xs text-hud-muted">
                Vinha a cada <strong className="text-hud-soft">{c.intervaloMedio} dias</strong> ·{" "}
                {c.visitas} visitas · última em{" "}
                {new Date(c.ultimaVisita + "T12:00:00").toLocaleDateString("pt-BR")}
              </p>

              <button
                onClick={() => chamar(c)}
                className={
                  "w-full rounded py-2 text-sm font-medium transition border " +
                  (jaChamado
                    ? "border-hud-border text-hud-muted"
                    : "border-[color-mix(in_srgb,var(--hud-ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--hud-ok)_10%,transparent)] text-hud-ok hover:bg-[color-mix(in_srgb,var(--hud-ok)_20%,transparent)]")
                }
              >
                {jaChamado ? "Chamado" : "Chamar de volta"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
