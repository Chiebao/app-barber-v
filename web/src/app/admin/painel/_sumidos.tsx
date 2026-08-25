"use client";

import { useEffect, useState } from "react";

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
      <div className="rounded-xl bg-dark-800 border border-gray-700 p-5">
        <div className="h-4 w-40 bg-gray-700/60 rounded animate-pulse" />
      </div>
    );
  }
  if (!dados) return null;

  if (dados.total === 0) {
    return (
      <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-2">
        <h3 className="font-semibold text-white">🔍 Clientes sumidos</h3>
        <p className="text-sm text-gray-400">
          Nenhum cliente atrasado no momento — quem costuma voltar está voltando no ritmo.
          Bom sinal! 👏
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-4">
        <p className="text-sm font-semibold text-yellow-400">
          🔍 {dados.total} cliente{dados.total > 1 ? "s" : ""} passou do ponto de voltar
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Comparamos o ritmo de cada um com o tempo que está sem vir. Chamar de volta quem já foi
          cliente costuma dar mais resultado do que buscar gente nova.
        </p>
      </div>

      <div className="space-y-3">
        {dados.clientes.map((c) => {
          const jaChamado = chamados.includes(c.clientId);
          return (
            <div key={c.clientId} className="rounded-xl border border-gray-700 bg-dark-800 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{c.nome}</p>
                  <p className="text-sm text-gray-400">{c.telefone}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-yellow-400 tabular-nums">{c.diasSemVir}d</p>
                  <p className="text-xs text-gray-500">sem vir</p>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Vinha a cada <strong className="text-gray-300">{c.intervaloMedio} dias</strong> ·{" "}
                {c.visitas} visitas · última em{" "}
                {new Date(c.ultimaVisita + "T12:00:00").toLocaleDateString("pt-BR")}
              </p>

              <button
                onClick={() => chamar(c)}
                className={
                  "w-full rounded-lg py-2 text-sm font-medium transition border " +
                  (jaChamado
                    ? "border-gray-700 text-gray-500"
                    : "border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20")
                }
              >
                {jaChamado ? "✓ Chamado" : "💬 Chamar de volta"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
