import { Icon, type NomeIcone } from "./Icon";

/**
 * Peças de retorno: giro, esqueleto, etiqueta, aviso e tela vazia.
 *
 * Toda informação de estado vem com TEXTO ou ÍCONE, nunca só cor: quem não
 * distingue verde de vermelho precisa ler "Pago" e "Expirado".
 */

export type Tom = "destaque" | "ok" | "warn" | "err" | "info" | "neutro";

const COR: Record<Tom, string> = {
  destaque: "var(--hud-accent)",
  ok: "var(--hud-ok)",
  warn: "var(--hud-warn)",
  err: "var(--hud-err)",
  info: "var(--hud-info)",
  neutro: "var(--hud-text-2)",
};

export function Spinner({
  tamanho = 28,
  rotulo,
  sobreDestaque = false,
}: {
  tamanho?: number;
  /** Texto ao lado. Sem ele, o giro e anunciado como "Carregando" so para leitor de tela. */
  rotulo?: string;
  /** Giro em cima do botao dourado: usa a cor escura do texto do botao. */
  sobreDestaque?: boolean;
}) {
  const cor = sobreDestaque ? "var(--hud-on-accent)" : "var(--hud-accent)";
  const borda = Math.max(2, Math.round(tamanho / 9));
  return (
    <span role="status" className="inline-flex items-center gap-3">
      <span
        aria-hidden="true"
        className="hud-spin inline-block rounded-full"
        style={{
          width: tamanho,
          height: tamanho,
          border: `${borda}px solid color-mix(in srgb, ${cor} 22%, transparent)`,
          borderTopColor: cor,
        }}
      />
      {rotulo ? <span className="text-[13px] text-hud-muted">{rotulo}</span> : <span className="sr-only">Carregando</span>}
    </span>
  );
}

export function Skeleton({ altura = 64, linhas = 1, className = "" }: { altura?: number; linhas?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="hud-skeleton" style={{ height: altura, opacity: i === 0 ? 1 : 0.7 }} />
      ))}
    </div>
  );
}

export function Badge({ tom = "destaque", children, className = "" }: { tom?: Tom; children: React.ReactNode; className?: string }) {
  const cor = COR[tom];
  return (
    <span
      className={`inline-flex items-center rounded-[3px] border px-2 py-[3px] text-[10px] font-bold leading-none ${className}`}
      style={{
        color: cor,
        borderColor: `color-mix(in srgb, ${cor} 55%, transparent)`,
        backgroundColor: tom === "ok" ? `color-mix(in srgb, ${cor} 8%, transparent)` : undefined,
      }}
    >
      {children}
    </span>
  );
}

const ICONE_AVISO: Record<"info" | "ok" | "warn" | "err", NomeIcone> = {
  info: "info",
  ok: "sucesso",
  warn: "alerta",
  err: "erro",
};

export function Alert({
  tom = "info",
  titulo,
  children,
  className = "",
}: {
  tom?: "info" | "ok" | "warn" | "err";
  titulo?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const cor = COR[tom];
  return (
    <div
      role={tom === "err" || tom === "warn" ? "alert" : "status"}
      className={`flex gap-2.5 rounded border p-3 text-[13px] leading-relaxed ${className}`}
      style={{
        borderColor: `color-mix(in srgb, ${cor} 50%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${cor} 8%, transparent)`,
        color: `color-mix(in srgb, ${cor} var(--hud-tint-mix), white)`,
      }}
    >
      <span className="mt-[1px] shrink-0">
        <Icon nome={ICONE_AVISO[tom]} tamanho={18} />
      </span>
      <div className="min-w-0">
        {titulo && <b className="font-bold">{titulo}</b>}
        {titulo && children ? " · " : null}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({
  titulo,
  texto,
  acao,
  icone,
  erro = false,
}: {
  titulo: string;
  texto?: React.ReactNode;
  acao?: { rotulo: string; onClick: () => void };
  icone?: NomeIcone;
  /** Tela de erro (não carregou), em vez de "não há nada". */
  erro?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded border border-dashed border-hud-border px-4 py-7 text-center">
      {icone ? (
        <span className={erro ? "text-hud-err" : "text-hud-accent"}>
          <Icon nome={icone} tamanho={36} />
        </span>
      ) : (
        <svg aria-hidden="true" width="40" height="40" viewBox="0 0 112 112" fill="none">
          <polygon
            points="56,4 102,30 102,82 56,108 10,82 10,30"
            fill={`color-mix(in srgb, ${erro ? "var(--hud-err)" : "var(--hud-accent)"} 8%, transparent)`}
            stroke={`color-mix(in srgb, ${erro ? "var(--hud-err)" : "var(--hud-accent)"} 60%, transparent)`}
            strokeWidth="3"
          />
        </svg>
      )}
      <p className="font-display text-xl text-hud-text">{titulo}</p>
      {texto && <div className="max-w-xs text-xs leading-relaxed text-hud-muted">{texto}</div>}
      {acao && (
        <button
          type="button"
          onClick={acao.onClick}
          className="hud-focus mt-1.5 min-h-[44px] rounded border border-hud-accent px-5 text-[13px] font-bold text-hud-light bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)]"
        >
          {acao.rotulo}
        </button>
      )}
    </div>
  );
}
