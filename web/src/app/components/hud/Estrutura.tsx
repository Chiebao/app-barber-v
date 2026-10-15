"use client";

import { Icon, type NomeIcone } from "./Icon";

/**
 * Peças de estrutura: cartão, passos, abas, cabeçalho de subtela e a barra
 * de navegação do barbeiro.
 */

export function HudCard({
  variante = "normal",
  onClick,
  children,
  className = "",
  rotulo,
}: {
  /** `destaque` leva cantoneiras: só UM por tela. `selecionado` também. */
  variante?: "normal" | "selecionado" | "destaque";
  /** Com clique, vira botão (escolher serviço, barbeiro…). */
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  /** Nome acessível quando o conteúdo sozinho não basta. */
  rotulo?: string;
}) {
  const classes = [
    "hud-card",
    variante === "selecionado" ? "hud-card-sel hud-corners" : "",
    variante === "destaque" ? "hud-corners" : "",
    className,
  ].join(" ");
  if (!onClick) return <div className={classes}>{children}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={variante === "selecionado"}
      aria-label={rotulo}
      className={`${classes} hud-focus block w-full text-left transition hover:border-hud-muted`}
    >
      {children}
    </button>
  );
}

/** Barras do fluxo do cliente + "Etapa X de N". */
export function StepPills({ atual, total, rotulo }: { atual: number; total: number; rotulo?: string }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-hud-text">
        Etapa <span className="gold-text font-bold">{atual}</span> de {total}
        {rotulo && <span className="text-hud-muted"> · {rotulo}</span>}
      </p>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={atual}
        aria-label={`Etapa ${atual} de ${total}`}
        className="mt-2 flex gap-1.5"
      >
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          return (
            <span
              key={n}
              className="h-1.5 flex-1 rounded-[3px]"
              style={{
                background: n <= atual ? "var(--hud-gradient-h)" : "var(--hud-track)",
                boxShadow: n === atual ? "0 0 12px color-mix(in srgb, var(--hud-accent) 60%, transparent)" : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  abas,
  valor,
  onChange,
  rotulo,
}: {
  abas: { valor: T; rotulo: React.ReactNode }[];
  valor: T;
  onChange: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div role="tablist" aria-label={rotulo} className="flex border-b border-hud-border">
      {abas.map((a) => {
        const ativa = a.valor === valor;
        return (
          <button
            key={a.valor}
            type="button"
            role="tab"
            aria-selected={ativa}
            onClick={() => onChange(a.valor)}
            className={`hud-focus relative flex min-h-[44px] flex-1 items-center justify-center text-[13px] ${ativa ? "font-bold text-hud-light" : "font-semibold text-hud-muted hover:text-hud-text"}`}
          >
            {ativa && <span aria-hidden="true" className="absolute -bottom-px left-[20%] right-[20%] h-0.5" style={{ background: "var(--hud-gradient-h)" }} />}
            {a.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/** Cabeçalho das subtelas: voltar (44px) + título Marcellus. */
export function ScreenHeader({
  titulo,
  onVoltar,
  direita,
  rotuloVoltar = "Voltar",
}: {
  titulo: React.ReactNode;
  onVoltar?: () => void;
  direita?: React.ReactNode;
  rotuloVoltar?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {onVoltar && (
        <button
          type="button"
          onClick={onVoltar}
          aria-label={rotuloVoltar}
          className="hud-focus flex h-11 w-11 shrink-0 items-center justify-center rounded border border-hud-border text-hud-accent bg-[color-mix(in_srgb,var(--hud-surface)_85%,transparent)]"
        >
          <Icon nome="voltar" />
        </button>
      )}
      <h1 className="min-w-0 flex-1 truncate font-display text-[28px] leading-tight text-hud-text">{titulo}</h1>
      {direita}
    </div>
  );
}

/** Rótulo de seção, em maiúsculas espaçadas. */
export function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`hud-eyebrow ${className}`}>{children}</p>;
}

/** Barra inferior do painel do barbeiro (68px). */
export function BottomNav<T extends string>({
  itens,
  valor,
  onChange,
}: {
  itens: { valor: T; rotulo: string; icone: NomeIcone }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[68px] border-t border-hud-border bg-hud-bg pb-[env(safe-area-inset-bottom)]"
    >
      {itens.map((it) => {
        const ativo = it.valor === valor;
        return (
          <button
            key={it.valor}
            type="button"
            onClick={() => onChange(it.valor)}
            aria-current={ativo ? "page" : undefined}
            className={`hud-focus relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-bold ${ativo ? "text-hud-accent" : "text-hud-muted"}`}
          >
            {ativo && (
              <span
                aria-hidden="true"
                className="absolute -top-px left-1/4 right-1/4 h-0.5"
                style={{ background: "var(--hud-gradient-h)", boxShadow: "0 0 10px var(--hud-accent)" }}
              />
            )}
            <Icon nome={it.icone} tamanho={22} />
            <span className={ativo ? "gold-text" : ""}>{it.rotulo}</span>
          </button>
        );
      })}
    </nav>
  );
}
