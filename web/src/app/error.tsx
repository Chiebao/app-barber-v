"use client";

import { useEffect } from "react";

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
    console.error("erro nao tratado:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-dark-900 text-white flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-3xl">
          ⚠️
        </div>
        <div>
          <h1 className="text-xl font-semibold">Algo deu errado aqui</h1>
          <p className="text-sm text-gray-400 mt-2">
            Não foi culpa sua. Tente de novo — seus agendamentos continuam salvos.
          </p>
        </div>
        <div className="space-y-2">
          <button
            onClick={reset}
            className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 transition-all"
          >
            Tentar de novo
          </button>
          <a
            href="/admin/painel"
            className="block w-full rounded-xl border border-gray-700 py-3 text-sm text-gray-300 hover:text-white transition"
          >
            Voltar ao painel
          </a>
        </div>
        {error.digest && (
          <p className="text-xs text-gray-600">
            Código do erro: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>
    </main>
  );
}
