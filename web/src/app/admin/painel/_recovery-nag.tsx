"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/app/components/hud";

/**
 * Aviso na home do painel para quem ainda NAO gerou codigo de recuperacao.
 *
 * Por que isso existe: o codigo e a unica forma de o barbeiro voltar sozinho
 * para a conta se esquecer a senha. Quem nunca gerou so descobre que precisava
 * no pior momento possivel — trancado do lado de fora. Entao avisamos antes.
 *
 * E dispensavel, mas volta depois de 7 dias: um lembrete que some para sempre
 * no primeiro toque nao lembra ninguem de nada.
 */

const CHAVE_ADIADO = "barberpro:recovery-nag-adiado";
const DIAS_ATE_VOLTAR = 7;

export default function RecoveryNag({
  token,
  onIrParaConfig,
}: {
  token: string | null;
  onIrParaConfig: () => void;
}) {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    if (!token) return;

    const adiadoEm = Number(localStorage.getItem(CHAVE_ADIADO) || 0);
    const aindaAdiado =
      adiadoEm > 0 && Date.now() - adiadoEm < DIAS_ATE_VOLTAR * 86400000;
    if (aindaAdiado) return;

    fetch("/api/me/recovery-code", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMostrar(d ? !d.hasCode : false))
      .catch(() => setMostrar(false));
  }, [token]);

  if (!mostrar) return null;

  const adiar = () => {
    localStorage.setItem(CHAVE_ADIADO, String(Date.now()));
    setMostrar(false);
  };

  return (
    <div className="rounded border border-[color-mix(in_srgb,var(--hud-warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--hud-warn)_10%,transparent)] p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-hud-warn"><Icon nome="cadeado" tamanho={20} /></span>
        <div className="flex-1">
          <p className="font-semibold text-hud-warn text-sm">
            Gere seu código de recuperação
          </p>
          <p className="text-xs text-hud-soft mt-1 leading-relaxed">
            É com ele que você cria uma senha nova sozinho se esquecer a atual.
            Leva 10 segundos — e evita ficar sem acesso à sua agenda.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onIrParaConfig}
          className="hud-focus min-h-[44px] flex-1 rounded bg-hud-warn py-2.5 text-sm font-semibold text-[var(--hud-on-accent)] hover:brightness-110 transition"
        >
          Gerar agora
        </button>
        <button
          onClick={adiar}
          className="hud-focus min-h-[44px] rounded border border-hud-border px-4 py-2.5 text-sm text-hud-muted hover:text-hud-text transition"
        >
          Depois
        </button>
      </div>
    </div>
  );
}
