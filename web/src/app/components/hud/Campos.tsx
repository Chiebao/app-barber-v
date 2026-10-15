"use client";

import { forwardRef, useId } from "react";
import { Icon } from "./Icon";

/**
 * Campos e controles do Ouro HUD.
 *
 * `Field` é só a moldura (rótulo, dica, erro) e liga o rótulo ao campo pelo
 * id — tocar no rótulo foca o campo, e o leitor de tela lê o erro junto.
 * O campo de dentro é um `<input>`/`<select>`/`<textarea>` comum, então
 * `value`, `onChange` e validação continuam iguais em cada tela.
 */

export function Field({
  label,
  dica,
  erro,
  children,
  className = "",
}: {
  label?: string;
  dica?: string;
  erro?: string | null;
  /** Recebe o id e os atributos de acessibilidade para pôr no campo. */
  children: (a11y: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const idAjuda = `${id}-ajuda`;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="hud-label mb-1.5 block">
          {label}
        </label>
      )}
      {children({ id, "aria-invalid": erro ? true : undefined, "aria-describedby": erro || dica ? idAjuda : undefined })}
      {(erro || dica) && (
        <p id={idAjuda} className={`mt-1 text-xs ${erro ? "text-[color-mix(in_srgb,var(--hud-err)_var(--hud-tint-mix),white)]" : "text-hud-muted"}`}>
          {erro || dica}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { prefixo?: string }>(
  function Input({ prefixo, className = "", ...resto }, ref) {
    if (!prefixo) return <input ref={ref} className={`hud-input ${className}`} {...resto} />;
    return (
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-hud-muted">
          {prefixo}
        </span>
        <input ref={ref} className={`hud-input ${className}`} style={{ paddingLeft: 14 + prefixo.length * 10 + 8 }} {...resto} />
      </div>
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className = "", children, ...resto },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={`hud-input ${className}`} {...resto}>
        {children}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-hud-muted">
        <Icon nome="abaixo" tamanho={16} />
      </span>
    </div>
  );
});

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { className = "", ...resto },
  ref,
) {
  return <textarea ref={ref} className={`hud-input ${className}`} {...resto} />;
});

/** Opção que liga/desliga ou escolhe uma entre várias. 44px de altura útil. */
export function Chip({
  selecionado = false,
  onClick,
  children,
  disabled,
  className = "",
}: {
  selecionado?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selecionado}
      onClick={onClick}
      disabled={disabled}
      className={[
        "hud-focus inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-xs transition",
        "disabled:cursor-not-allowed disabled:opacity-45",
        selecionado
          ? "border-hud-accent font-bold text-hud-light bg-[color-mix(in_srgb,var(--hud-accent)_14%,transparent)]"
          : "border-hud-border font-semibold text-hud-soft bg-[color-mix(in_srgb,var(--hud-surface)_80%,transparent)] hover:border-hud-muted",
        className,
      ].join(" ")}
    >
      {selecionado && <Icon nome="check" tamanho={14} traco={2.5} />}
      {children}
    </button>
  );
}

/** Uma entre poucas opções lado a lado (Pix / Dinheiro / Cartão). */
export function Segmented<T extends string>({
  opcoes,
  valor,
  onChange,
  rotulo,
}: {
  opcoes: { valor: T; rotulo: React.ReactNode }[];
  valor: T;
  onChange: (v: T) => void;
  /** Nome do grupo para leitor de tela. */
  rotulo: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex rounded border border-hud-border p-[3px] bg-[color-mix(in_srgb,var(--hud-surface)_90%,transparent)]">
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(o.valor)}
            className={[
              "hud-focus flex min-h-[44px] flex-1 items-center justify-center rounded-[3px] text-[13px] transition",
              ativo ? "gold-fill font-extrabold" : "font-semibold text-hud-muted hover:text-hud-text",
            ].join(" ")}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/** Interruptor. O texto do lado diz o que ele liga — nunca só a cor. */
export function Switch({
  ligado,
  onChange,
  rotulo,
  descricao,
  disabled,
}: {
  ligado: boolean;
  onChange: (v: boolean) => void;
  rotulo: string;
  descricao?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      disabled={disabled}
      onClick={() => onChange(!ligado)}
      className="hud-focus flex min-h-[44px] w-full items-center justify-between gap-4 rounded text-left disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-hud-text">{rotulo}</span>
        {descricao && <span className="block text-xs text-hud-muted">{descricao}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-[26px] w-[46px] shrink-0 rounded-full transition ${ligado ? "gold-fill" : "bg-[var(--hud-track)]"}`}
      >
        <span
          className="absolute top-[3px] h-5 w-5 rounded-full transition-all motion-reduce:transition-none"
          style={{ left: ligado ? 23 : 3, background: ligado ? "var(--hud-on-accent)" : "var(--hud-text-2)" }}
        />
      </span>
    </button>
  );
}

export function Checkbox({
  marcado,
  onChange,
  children,
  disabled,
}: {
  marcado: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={`flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-hud-soft ${disabled ? "opacity-50" : ""}`}>
      <input
        type="checkbox"
        checked={marcado}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={[
          "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[3px] transition",
          "peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--hud-ring)]",
          marcado ? "gold-fill" : "border-[1.5px] border-[var(--hud-text-3)]",
        ].join(" ")}
      >
        {marcado && <Icon nome="check" tamanho={14} traco={3.5} />}
      </span>
      <span>{children}</span>
    </label>
  );
}
