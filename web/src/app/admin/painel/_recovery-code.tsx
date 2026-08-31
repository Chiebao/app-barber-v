"use client";

import { useEffect, useState } from "react";
import { toast } from "@/app/lib/toast";
import { useConfirmacao } from "@/app/lib/modal";

/**
 * Código de recuperação — permite o barbeiro/dono redefinir a própria senha
 * na tela de login, sem precisar falar com o suporte.
 *
 * O código só aparece UMA vez (depois fica só o hash no banco), então a tela
 * insiste para o usuário anotar antes de sair.
 */
export default function RecoveryCode({ token }: { token: string | null }) {
  // O diálogo vive dentro deste componente porque a pergunta é dele; o
  // portal do Modal garante que ele apareça sobre a tela toda mesmo assim.
  const [confirmar, dialogoConfirmacao] = useConfirmacao();
  const [hasCode, setHasCode] = useState<boolean | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch("/api/me/recovery-code", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setHasCode(!!d?.hasCode))
      .catch(() => setHasCode(false));
  }, [token]);

  const generate = async () => {
    if (!token) return;
    if (hasCode && !(await confirmar({
      titulo: "Gerar um código novo?",
      texto: "O código anterior para de funcionar na hora. Se você anotou o antigo em algum lugar, ele deixa de servir.",
      acao: "Gerar novo",
    }))) return;
    setBusy(true);
    try {
      const res = await fetch("/api/me/recovery-code", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (res.ok && d.code) {
        setCode(d.code);
        setHasCode(true);
      } else {
        toast.error(d.error || "Não foi possível gerar o código");
      }
    } catch {
      toast.error("Erro ao gerar código");
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success("Código copiado — guarde em um lugar seguro");
    });
  };

  return (
    <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-3">
      {dialogoConfirmacao}
      <div>
        <h3 className="font-semibold text-white">🔑 Código de recuperação</h3>
        <p className="text-xs text-gray-500 mt-1">
          Se você esquecer a senha, usa este código na tela de login para criar uma nova —
          sem precisar falar com ninguém.
        </p>
      </div>

      {code ? (
        <div className="rounded-xl bg-brand-500/10 border border-brand-400/40 p-4 space-y-3">
          <p className="text-xs text-brand-300 font-semibold uppercase tracking-widest">
            Anote agora — não mostraremos de novo
          </p>
          <p className="text-2xl font-mono font-bold text-white text-center tracking-wider select-all">
            {code}
          </p>
          <button
            onClick={copy}
            className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-dark-900 hover:bg-brand-400 transition"
          >
            {copied ? "✓ Copiado!" : "📋 Copiar código"}
          </button>
          <p className="text-xs text-gray-400">
            Guarde no bloco de notas do celular ou anote num papel. Vale uma vez: depois de usar,
            gere outro aqui.
          </p>
        </div>
      ) : (
        <>
          {hasCode === true && (
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2">
              <span className="text-green-400 text-sm">✓ Você já tem um código guardado</span>
            </div>
          )}
          {hasCode === false && (
            <div className="flex items-start gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2">
              <span className="text-yellow-400 text-sm">
                ⚠️ Você ainda não tem um código. Sem ele, só o suporte consegue redefinir sua senha.
              </span>
            </div>
          )}
          <button
            onClick={generate}
            disabled={busy || hasCode === null}
            className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all"
          >
            {busy ? "Gerando..." : hasCode ? "Gerar um novo código" : "Gerar meu código"}
          </button>
        </>
      )}
    </div>
  );
}
