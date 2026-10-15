"use client";

import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Icon } from "./Icon";
import { Spinner } from "./Feedback";

/**
 * Link + QR, envio de foto e tabela.
 */

export function QrLinkPanel({
  link,
  onBaixar,
  rotulo = "Link de agendamento",
}: {
  link: string;
  /** Sem isso o botão "Baixar QR" não aparece. */
  onBaixar?: () => void;
  rotulo?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const visivel = link.replace(/^https?:\/\//, "");

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sem permissão de área de transferência: o link continua visível */
    }
  };

  const compartilhar = async () => {
    if (navigator.share) {
      try { await navigator.share({ url: link }); } catch { /* cancelou */ }
    } else {
      copiar();
    }
  };

  return (
    <div className="hud-card flex flex-col items-center gap-2.5 p-3.5">
      <div className="rounded bg-white p-2.5">
        <QRCodeSVG value={link} size={128} bgColor="#FFFFFF" fgColor="#0B0B14" aria-label={`QR code: ${rotulo}`} role="img" />
      </div>
      <button
        type="button"
        onClick={copiar}
        className="hud-focus flex min-h-[44px] w-full items-center justify-between gap-3 rounded border border-hud-border px-3 text-left text-xs text-hud-soft bg-[color-mix(in_srgb,var(--hud-bg)_70%,transparent)]"
      >
        <span className="min-w-0 truncate">{visivel}</span>
        <span className="shrink-0 font-bold text-hud-light" aria-live="polite">{copiado ? "Copiado ✓" : "Copiar"}</span>
      </button>
      <div className="flex w-full gap-2">
        {onBaixar && (
          <button type="button" onClick={onBaixar} className="hud-focus flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded border border-hud-border text-xs font-bold text-hud-text">
            <Icon nome="baixar" tamanho={16} /> Baixar QR
          </button>
        )}
        <button type="button" onClick={compartilhar} className="hud-focus flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded border border-hud-border text-xs font-bold text-hud-text">
          <Icon nome="compartilhar" tamanho={16} /> Compartilhar
        </button>
      </div>
    </div>
  );
}

export function PhotoUpload({
  url,
  onEscolher,
  carregando = false,
  rotulo = "Enviar foto",
  onRemover,
}: {
  url?: string | null;
  onEscolher: (arquivo: File) => void;
  carregando?: boolean;
  rotulo?: string;
  onRemover?: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        disabled={carregando}
        aria-label={url ? "Trocar foto" : rotulo}
        className="hud-focus relative flex h-24 flex-1 flex-col items-center justify-center gap-1.5 overflow-hidden rounded border border-dashed border-hud-accent text-xs font-bold text-hud-light bg-[color-mix(in_srgb,var(--hud-accent)_5%,transparent)]"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : carregando ? (
          <Spinner tamanho={24} />
        ) : (
          <>
            <Icon nome="enviar" tamanho={24} />
            {rotulo}
          </>
        )}
      </button>
      {url && onRemover && (
        <button type="button" onClick={onRemover} aria-label="Remover foto" className="hud-focus flex h-11 w-11 items-center justify-center rounded border border-hud-border text-hud-err">
          <Icon nome="lixo" tamanho={18} />
        </button>
      )}
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onEscolher(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export interface ColunaTabela<L> {
  chave: string;
  rotulo: string;
  largura?: string;
  alinhar?: "esquerda" | "direita" | "centro";
  render: (linha: L) => React.ReactNode;
}

export function DataTable<L>({
  colunas,
  linhas,
  chaveDaLinha,
  vazio = "Nada por aqui ainda.",
  rotulo,
}: {
  colunas: ColunaTabela<L>[];
  linhas: L[];
  chaveDaLinha: (l: L) => string;
  vazio?: string;
  rotulo: string;
}) {
  const alinhamento = (a?: string) => (a === "direita" ? "text-right" : a === "centro" ? "text-center" : "text-left");
  return (
    <div className="hud-card overflow-x-auto">
      <table className="w-full border-collapse text-[13px]" aria-label={rotulo}>
        <thead>
          <tr className="border-b border-hud-border bg-[color-mix(in_srgb,var(--hud-accent)_6%,transparent)]">
            {colunas.map((c) => (
              <th key={c.chave} scope="col" style={{ width: c.largura }} className={`px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-hud-muted ${alinhamento(c.alinhar)}`}>
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 ? (
            <tr>
              <td colSpan={colunas.length} className="px-3.5 py-6 text-center text-hud-muted">{vazio}</td>
            </tr>
          ) : (
            linhas.map((l) => (
              <tr key={chaveDaLinha(l)} className="border-b border-hud-border last:border-b-0">
                {colunas.map((c) => (
                  <td key={c.chave} className={`px-3.5 py-3 text-hud-text ${alinhamento(c.alinhar)}`}>{c.render(l)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
