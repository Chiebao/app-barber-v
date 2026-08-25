"use client";

import { useEffect, useState } from "react";

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
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Pague o sinal para garantir</h2>
        <p className="text-gray-400 mt-1 text-sm">
          Assim que o Pix cair, seu horário é confirmado automaticamente.
        </p>
      </div>

      <div className="bg-dark-900 border border-gray-700 rounded-2xl p-5 space-y-4">
        <div className="flex justify-between items-baseline">
          <span className="text-gray-400 text-sm">Valor do sinal</span>
          <span className="text-2xl font-bold text-brand-400">R$ {pix.valor.toFixed(2)}</span>
        </div>

        {pix.qrCodeBase64 && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${pix.qrCodeBase64}`}
              alt="QR Code do Pix"
              className="w-52 h-52 rounded-xl bg-white p-2"
            />
          </div>
        )}

        <div>
          <p className="text-xs text-gray-400 mb-2 text-center">
            Escaneie o QR Code ou use o código abaixo
          </p>
          <button
            onClick={copiar}
            className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 transition"
          >
            {copiado ? "✓ Código copiado!" : "📋 Copiar código Pix"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 px-4 py-3 flex items-start gap-3">
        {verificando ? (
          <>
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mt-0.5 shrink-0" />
            <p className="text-sm text-blue-300 leading-snug">
              Aguardando o pagamento…
              <span className="block text-blue-200/70 text-xs mt-1">
                Pode deixar esta tela aberta — ela confirma sozinha em alguns segundos.
              </span>
            </p>
          </>
        ) : (
          <p className="text-sm text-blue-300 leading-snug">
            Não detectamos o pagamento por aqui.
            <span className="block text-blue-200/70 text-xs mt-1">
              Se você já pagou, tudo certo — a barbearia recebe a confirmação do mesmo jeito.
            </span>
          </p>
        )}
      </div>

      <button
        onClick={onVoltar}
        className="w-full rounded-xl border border-gray-700 py-3 text-sm text-gray-400 hover:text-white transition"
      >
        Voltar ao início
      </button>
    </div>
  );
}
