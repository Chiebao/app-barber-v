"use client";

import { useEffect, useState } from "react";
import { Alert, GoldButton, HudCard, Icon, Spinner } from "@/app/components/hud";

/**
 * Tela de pagamento do sinal via Pix (Mercado Pago).
 *
 * A diferença para o Pix manual: aqui a tela confirma sozinha. Enquanto o
 * cliente paga, consultamos o status; quando o Mercado Pago avisa que caiu,
 * a tela troca para "confirmado" sem ninguém precisar clicar em nada.
 */
export default function PixAutomatico({
  pix,
  appointmentId,
  phone,
  onConfirmado,
  onVoltar,
}: {
  pix: { copiaECola: string; qrCodeBase64: string | null; valor: number };
  appointmentId: string | null;
  phone: string;
  onConfirmado: () => void;
  onVoltar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [verificando, setVerificando] = useState(true);

  // Consulta o status até confirmar. Para sozinho depois de ~10 minutos
  // para não ficar batendo no servidor à toa com a aba esquecida aberta.
  useEffect(() => {
    if (!appointmentId) return;
    let ativo = true;
    let tentativas = 0;

    const checar = async () => {
      if (!ativo) return;
      tentativas++;
      try {
        const res = await fetch(
          `/api/appointments/${appointmentId}/payment-status?phone=${phone.replace(/\D/g, "")}`,
        );
        if (res.ok) {
          const d = await res.json();
          if (d.pago) { ativo = false; onConfirmado(); return; }
        }
      } catch { /* segue tentando */ }

      if (tentativas > 200) { setVerificando(false); return; } // ~10 min
      if (ativo) setTimeout(checar, 3000);
    };

    const t = setTimeout(checar, 3000);
    return () => { ativo = false; clearTimeout(t); };
  }, [appointmentId, phone, onConfirmado]);

  const copiar = () => {
    navigator.clipboard.writeText(pix.copiaECola).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-[28px] leading-tight text-hud-text">Pague o sinal para garantir</h2>
        <p className="mt-1 text-sm text-hud-muted">
          Assim que o Pix cair, seu horário é confirmado automaticamente.
        </p>
      </div>

      <HudCard variante="destaque" className="space-y-4 p-5">
        <div className="flex items-end justify-between gap-3">
          <span className="text-sm text-hud-muted">Valor do sinal</span>
          <span className="gold-text gold-glow font-display text-3xl tabular-nums">R$ {pix.valor.toFixed(2).replace(".", ",")}</span>
        </div>

        {pix.qrCodeBase64 && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${pix.qrCodeBase64}`}
              alt="QR Code do Pix"
              className="h-52 w-52 rounded bg-white p-2"
            />
          </div>
        )}

        <p className="text-center text-xs text-hud-muted">Escaneie o QR Code ou use o código abaixo</p>
        <GoldButton cheio onClick={copiar}>
          <Icon nome={copiado ? "check" : "copiar"} tamanho={18} /> {copiado ? "Código copiado!" : "Copiar código Pix"}
        </GoldButton>
      </HudCard>

      {verificando ? (
        <div role="status" className="flex items-start gap-3 rounded border border-[color-mix(in_srgb,var(--hud-info)_50%,transparent)] bg-[color-mix(in_srgb,var(--hud-info)_8%,transparent)] px-4 py-3">
          <Spinner tamanho={18} />
          <p className="text-sm leading-snug text-hud-text">
            Aguardando o pagamento…
            <span className="mt-1 block text-xs text-hud-muted">Pode deixar esta tela aberta — ela confirma sozinha em alguns segundos.</span>
          </p>
        </div>
      ) : (
        <Alert tom="info" titulo="Não detectamos o pagamento por aqui">
          Se você já pagou, tudo certo — a barbearia recebe a confirmação do mesmo jeito.
        </Alert>
      )}

      <GoldButton variante="neutro" cheio onClick={onVoltar}>Voltar ao início</GoldButton>
    </div>
  );
}
