"use client";

import { useEffect, useState } from "react";
import { toast } from "@/app/lib/toast";
import { useConfirmacao } from "@/app/lib/modal";

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
  // O diálogo vive dentro deste componente porque a pergunta é dele; o
  // portal do Modal garante que ele apareça sobre a tela toda mesmo assim.
  const [confirmar, dialogoConfirmacao] = useConfirmacao();
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
    if (!(await confirmar({
      titulo: "Desconectar o Mercado Pago?",
      texto: "O Pix volta a ser confirmado na mão, um a um, no painel.",
      acao: "Desconectar",
      perigo: true,
    }))) return;
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
    <div className="hud-card p-5 space-y-3">
      {dialogoConfirmacao}
      <div>
        <h3 className="font-display text-xl text-hud-text">Pix automático (Mercado Pago)</h3>
        <p className="text-xs text-hud-muted mt-1">
          Conecte sua conta e o sinal do cliente com histórico de falta é confirmado sozinho —
          você não precisa mais conferir o extrato.
        </p>
      </div>

      {!s.disponivel && (
        <p className="text-sm text-hud-muted">
          Ainda não disponível nesta plataforma. Por enquanto, use a chave Pix manual acima.
        </p>
      )}

      {s.disponivel && s.conectado && (
        <>
          <div className="flex items-center gap-2 rounded bg-[color-mix(in_srgb,var(--hud-ok)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-ok)_30%,transparent)] px-3 py-2">
            <span className="text-hud-ok text-sm">
              ✓ Conectado
              {s.conectadoEm && (
                <span className="text-hud-muted">
                  {" "}desde {new Date(s.conectadoEm).toLocaleDateString("pt-BR")}
                </span>
              )}
            </span>
          </div>
          <p className="text-xs text-hud-muted">
            O dinheiro cai direto na sua conta do Mercado Pago. O BarberPro só gera a cobrança.
          </p>
          <button
            onClick={desconectar}
            disabled={busy}
            className="hud-focus min-h-[44px] w-full rounded border border-hud-border py-2.5 text-sm text-hud-muted hover:text-hud-text disabled:opacity-50 transition"
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
            className="hud-focus w-full rounded bg-[#009EE3] py-3 font-semibold text-hud-text hover:bg-[#0088c7] disabled:opacity-50 transition-all"
          >
            {busy ? "Abrindo..." : "Conectar Mercado Pago"}
          </button>
          <p className="text-xs text-hud-muted">
            Você vai autorizar no site do Mercado Pago e voltar para cá. Não temos acesso à sua
            senha nem ao seu saldo.
            {!s.temPixManual && (
              <span className="block mt-1 text-hud-warn">
                Enquanto não conectar nem cadastrar uma chave Pix, o bloqueio por falta fica desligado.
              </span>
            )}
          </p>
        </>
      )}
    </div>
  );
}
