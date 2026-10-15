"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/app/components/hud";
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
    <div className="hud-card p-5 space-y-3">
      {dialogoConfirmacao}
      <div>
        <h3 className="font-display text-xl text-hud-text">Código de recuperação</h3>
        <p className="text-xs text-hud-muted mt-1">
          Se você esquecer a senha, usa este código na tela de login para criar uma nova —
          sem precisar falar com ninguém.
        </p>
      </div>

      {code ? (
        <div className="rounded bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-accent)_40%,transparent)] p-4 space-y-3">
          <p className="text-xs text-hud-light font-semibold uppercase tracking-widest">
            Anote agora — não mostraremos de novo
          </p>
          <p className="text-2xl font-mono font-bold text-hud-text text-center tracking-wider select-all">
            {code}
          </p>
          <button
            onClick={copy}
            className="hud-focus min-h-[44px] w-full rounded gold-fill min-h-[48px] text-sm font-bold hover:brightness-105 transition"
          >
            {copied ? "Copiado!" : "Copiar código"}
          </button>
          <p className="text-xs text-hud-muted">
            Guarde no bloco de notas do celular ou anote num papel. Vale uma vez: depois de usar,
            gere outro aqui.
          </p>
        </div>
      ) : (
        <>
          {hasCode === true && (
            <div className="flex items-center gap-2 rounded bg-[color-mix(in_srgb,var(--hud-ok)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-ok)_30%,transparent)] px-3 py-2">
              <span className="text-hud-ok text-sm">✓ Você já tem um código guardado</span>
            </div>
          )}
          {hasCode === false && (
            <div className="flex items-start gap-2 rounded bg-[color-mix(in_srgb,var(--hud-warn)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-warn)_30%,transparent)] px-3 py-2">
              <span className="text-hud-warn text-sm">
                <Icon nome="alerta" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Você ainda não tem um código. Sem ele, só o suporte consegue redefinir sua senha.
              </span>
            </div>
          )}
          <button
            onClick={generate}
            disabled={busy || hasCode === null}
            className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all"
          >
            {busy ? "Gerando..." : hasCode ? "Gerar um novo código" : "Gerar meu código"}
          </button>
        </>
      )}
    </div>
  );
}
