"use client";

import { forwardRef } from "react";
import { Spinner } from "./Feedback";

/**
 * Botões do Ouro HUD.
 *
 * Primário: gradiente metálico, texto escuro em maiúsculas, canto chanfrado.
 * Um por tela — é o "próximo passo". O resto é contorno (secundário), card
 * escuro (neutro), link (fantasma) ou vermelho (destrutivo).
 *
 * `carregando` mantém o MESMO botão, com um giro dentro, e bloqueia o
 * segundo toque: trocar por outro elemento faz a tela pular e convida o
 * toque duplo que gera agendamento em dobro.
 */

export type VarianteBotao =
  | "primario"
  | "secundario"
  | "neutro"
  | "fantasma"
  | "destrutivo"
  | "destrutivo-contorno";

const BASE =
  "hud-focus inline-flex items-center justify-center gap-2.5 font-bold transition select-none " +
  "disabled:cursor-not-allowed active:scale-[0.98] motion-reduce:active:scale-100";

const VARIANTES: Record<VarianteBotao, string> = {
  primario: "gold-fill uppercase tracking-[0.1em] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105",
  secundario:
    "rounded border border-hud-accent text-hud-light bg-[color-mix(in_srgb,var(--hud-accent)_8%,transparent)] hover:bg-[color-mix(in_srgb,var(--hud-accent)_14%,transparent)]",
  neutro: "rounded border border-hud-border text-hud-text bg-[color-mix(in_srgb,var(--hud-surface)_90%,transparent)] hover:border-hud-muted",
  fantasma: "rounded text-hud-light bg-transparent hover:underline underline-offset-4",
  // Mesmo texto do botao principal: escuro nas paletas escuras, branco nas
  // claras (onde o vermelho escurece e o texto escuro some).
  destrutivo: "rounded bg-hud-err text-[var(--hud-on-accent)] font-extrabold hover:brightness-110",
  "destrutivo-contorno":
    "rounded border border-[color-mix(in_srgb,var(--hud-err)_45%,transparent)] text-hud-err bg-[color-mix(in_srgb,var(--hud-err)_6%,transparent)]",
};

const DESABILITADO = "!bg-none !bg-[var(--hud-disabled-bg)] !text-[var(--hud-disabled-text)] border border-hud-border !shadow-none";

export interface GoldButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao;
  carregando?: boolean;
  /** Ocupa a largura toda — o normal no celular. */
  cheio?: boolean;
  /** Primário pequeno (44px) para dentro de cartões. Os outros já são 44–52px. */
  compacto?: boolean;
}

export const GoldButton = forwardRef<HTMLButtonElement, GoldButtonProps>(function GoldButton(
  { variante = "primario", carregando = false, cheio = false, compacto = false, disabled, className = "", children, type, ...resto },
  ref,
) {
  const primario = variante === "primario";
  const altura = primario ? (compacto ? "min-h-[44px] text-[13px] px-5" : "min-h-[56px] text-[15px] px-6") : variante === "fantasma" ? "min-h-[44px] text-sm px-3" : compacto ? "min-h-[44px] text-[13px] px-4" : "min-h-[52px] text-sm px-5";
  const inativo = disabled || carregando;
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={inativo}
      aria-busy={carregando || undefined}
      className={[
        BASE,
        altura,
        VARIANTES[variante],
        primario && !compacto ? "hud-chamfer" : primario ? "rounded" : "",
        disabled && !carregando ? DESABILITADO : "",
        carregando ? "opacity-85" : "",
        cheio ? "w-full" : "",
        className,
      ].join(" ")}
      {...resto}
    >
      {carregando && <Spinner tamanho={16} sobreDestaque={primario || variante === "destrutivo"} />}
      {children}
    </button>
  );
});
