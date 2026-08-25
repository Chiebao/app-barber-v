"use client";

import { useEffect, useState } from "react";
import { toast } from "@/app/lib/toast";

/**
 * Conectar a conta do Mercado Pago da barbearia.
 *
 * Conectado, o Pix do anti-falta vira automático: o cliente paga pelo QR e o
 * sistema confirma sozinho. Sem conectar, continua a chave Pix manual — nada
 * deixa de funcionar, só exige o barbeiro conferir o extrato.
 */

interface Situacao {
  disponivel: boolean;
  conectado: boolean;
  conectadoEm: string | null;
  temPixManual: boolean;
}

export default function MercadoPago({ token }: { token: string | null }) {
  const [s, setS] = useState<Situacao | null>(null);
  const [busy, setBusy] = useState(false);

  const carregar = () => {
    if (!token) return;
    fetch("/api/me/mercadopago", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then(setS)
      .catch(() => setS(null));
  };

  useEffect(carregar, [token]);

  // Volta do Mercado Pago traz ?mp=conectado|erro na URL
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const mp = p.get("mp");
    if (!mp) return;
    if (mp === "conectado") toast.success(p.get("msg") || "Mercado Pago conectado!");
    else toast.error(p.get("msg") || "Não foi possível conectar");
    window.history.replaceState({}, "", window.location.pathname);
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conectar = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch("/api/me/mercadopago", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (res.ok && d.url) window.location.href = d.url;
      else toast.error(d.error || "Não foi possível iniciar a conexão");
    } catch {
      toast.error("Erro ao conectar");
    } finally {
      setBusy(false);
    }
  };

  const desconectar = async () => {
    if (!token) return;
    if (!confirm("Desconectar o Mercado Pago? O Pix volta a ser confirmado na mão.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/me/mercadopago", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { toast.success("Mercado Pago desconectado"); carregar(); }
      else toast.error("Erro ao desconectar");
    } catch {
      toast.error("Erro ao desconectar");
    } finally {
      setBusy(false);
    }
  };

  if (!s) return null;

  return (
    <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-3">
      <div>
        <h3 className="font-semibold text-white">💠 Pix automático (Mercado Pago)</h3>
        <p className="text-xs text-gray-500 mt-1">
          Conecte sua conta e o sinal do cliente com histórico de falta é confirmado sozinho —
          você não precisa mais conferir o extrato.
        </p>
      </div>

      {!s.disponivel && (
        <p className="text-sm text-gray-500">
          Ainda não disponível nesta plataforma. Por enquanto, use a chave Pix manual acima.
        </p>
      )}

      {s.disponivel && s.conectado && (
        <>
          <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2">
            <span className="text-green-400 text-sm">
              ✓ Conectado
              {s.conectadoEm && (
                <span className="text-gray-400">
                  {" "}desde {new Date(s.conectadoEm).toLocaleDateString("pt-BR")}
                </span>
              )}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            O dinheiro cai direto na sua conta do Mercado Pago. O BarberPro só gera a cobrança.
          </p>
          <button
            onClick={desconectar}
            disabled={busy}
            className="w-full rounded-xl border border-gray-700 py-2.5 text-sm text-gray-400 hover:text-white disabled:opacity-50 transition"
          >
            {busy ? "..." : "Desconectar"}
          </button>
        </>
      )}

      {s.disponivel && !s.conectado && (
        <>
          <button
            onClick={conectar}
            disabled={busy}
            className="w-full rounded-xl bg-[#009EE3] py-3 font-semibold text-white hover:bg-[#0088c7] disabled:opacity-50 transition-all"
          >
            {busy ? "Abrindo..." : "Conectar Mercado Pago"}
          </button>
          <p className="text-xs text-gray-500">
            Você vai autorizar no site do Mercado Pago e voltar para cá. Não temos acesso à sua
            senha nem ao seu saldo.
            {!s.temPixManual && (
              <span className="block mt-1 text-yellow-500">
                Enquanto não conectar nem cadastrar uma chave Pix, o bloqueio por falta fica desligado.
              </span>
            )}
          </p>
        </>
      )}
    </div>
  );
}
