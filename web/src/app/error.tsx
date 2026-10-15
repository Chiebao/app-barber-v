"use client";

import { useEffect } from "react";
import { Icon } from "@/app/components/hud";

/**
 * Tela de erro do App Router.
 *
 * Sem isto, um erro não tratado no cliente deixa a página em branco — o
 * barbeiro vê um vazio no meio do expediente e não tem o que fazer. Aqui
 * ele pelo menos consegue tentar de novo ou voltar, sem fechar o app.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("erro não tratado:", error);
  }, [error]);

  return (
    <main className="min-h-screen hud-bg text-hud-text flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-full bg-[color-mix(in_srgb,var(--hud-err)_15%,transparent)] border border-[color-mix(in_srgb,var(--hud-err)_30%,transparent)] flex items-center justify-center text-3xl">
          <Icon nome="alerta" tamanho={18} />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Algo deu errado aqui</h1>
          <p className="text-sm text-hud-muted mt-2">
            Não foi culpa sua. Tente de novo — seus agendamentos continuam salvos.
          </p>
        </div>
        <div className="space-y-2">
          <button
            onClick={reset}
            className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 transition-all"
          >
            Tentar de novo
          </button>
          <a
            href="/admin/painel"
            className="block w-full rounded border border-hud-border py-3 text-sm text-hud-soft hover:text-hud-text transition"
          >
            Voltar ao painel
          </a>
        </div>
        {error.digest && (
          <p className="text-xs text-hud-faint">
            Código do erro: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>
    </main>
  );
}
