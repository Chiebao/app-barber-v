"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/app/lib/toast";
import { Modal } from "@/app/lib/modal";

/**
 * O que os clientes responderam.
 *
 * Antes disto, responder ao lembrete não levava a lugar nenhum: número da
 * Cloud API não tem caixa de entrada, e o que não cai num webhook é
 * descartado. O app pedia "é só responder por aqui" e jogava fora a resposta.
 *
 * A janela de 24h aparece na tela de propósito. Passada ela, a Meta só
 * entrega modelo aprovado — e modelo não serve para conversa. Deixar o
 * barbeiro escrever e descobrir no envio que não saiu seria pior do que
 * dizer antes.
 */

interface Mensagem {
  id: string;
  telefone: string;
  nome: string | null;
  texto: string;
  tipo: string;
  recebidaEm: string;
  lida: boolean;
  respondida: boolean;
  podeResponder: boolean;
  horasRestantes: number;
}

function quando(iso: string) {
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function Mensagens({
  token,
  onVoltar,
  onUnauthorized,
  onMudou,
}: {
  token: string | null;
  onVoltar: () => void;
  onUnauthorized: () => void;
  /** Avisa o painel para atualizar o contador do menu. */
  onMudou?: () => void;
}) {
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [respondendo, setRespondendo] = useState<Mensagem | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const buscar = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/me/mensagens", { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) { onUnauthorized(); return; }
      const d = await r.json();
      if (r.ok) setMsgs(d.mensagens || []);
    } catch {
      toast.error("Erro ao carregar as mensagens");
    } finally {
      setCarregando(false);
    }
  }, [token, onUnauthorized]);

  useEffect(() => { buscar(); }, [buscar]);

  // Abrir a tela já conta como ler: o contador existe para chamar atenção uma
  // vez, não para o barbeiro ter que tocar em cada linha.
  useEffect(() => {
    if (!token || carregando || msgs.every((m) => m.lida)) return;
    fetch("/api/me/mensagens", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ todas: true }),
    }).then(() => onMudou?.()).catch(() => {});
  }, [token, carregando, msgs, onMudou]);

  async function enviar() {
    if (!respondendo || !token || !texto.trim()) return;
    setEnviando(true);
    try {
      const r = await fetch("/api/me/mensagens", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: respondendo.id, texto: texto.trim() }),
      });
      if (r.status === 401) { onUnauthorized(); return; }
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || "Não consegui enviar"); return; }
      toast.success("Resposta enviada");
      setRespondendo(null);
      setTexto("");
      buscar();
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setEnviando(false);
    }
  }

  function abrirNoWhatsApp(m: Mensagem) {
    const tel = m.telefone.startsWith("55") ? m.telefone : `55${m.telefone}`;
    window.open(`https://wa.me/${tel}`, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onVoltar}
          className="hud-focus min-h-[44px] rounded border border-hud-border px-3 py-2 text-sm text-hud-muted hover:text-hud-text transition"
        >
          ← Voltar
        </button>
        <h2 className="font-display text-2xl leading-tight text-hud-text">Mensagens</h2>
      </div>

      {carregando && <p className="text-center text-sm text-hud-muted py-10">Carregando...</p>}

      {!carregando && msgs.length === 0 && (
        <div className="hud-card p-6 text-center space-y-2">
          <p className="text-sm text-hud-muted">Nenhuma mensagem ainda.</p>
          <p className="text-xs text-hud-muted leading-relaxed">
            Quando um cliente responder a um lembrete, a mensagem aparece aqui —
            e ele recebe na hora o seu WhatsApp para falar direto com você.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {msgs.map((m) => (
          <div
            key={m.id}
            className={`rounded border p-3.5 space-y-2.5 ${
              m.lida ? "bg-hud-surface border-hud-border" : "bg-[color-mix(in_srgb,var(--hud-accent)_5%,transparent)] border-[color-mix(in_srgb,var(--hud-accent)_40%,transparent)]"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-hud-text truncate">
                {m.nome || m.telefone}
              </span>
              <span className="text-xs text-hud-muted shrink-0">{quando(m.recebidaEm)}</span>
            </div>

            <p className="text-sm text-hud-soft leading-relaxed whitespace-pre-wrap break-words">
              {m.texto}
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {m.respondida && (
                <span className="rounded-full border border-[color-mix(in_srgb,var(--hud-ok)_35%,transparent)] bg-[color-mix(in_srgb,var(--hud-ok)_10%,transparent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-hud-ok">
                  respondida
                </span>
              )}
              {m.podeResponder ? (
                <>
                  <button
                    onClick={() => { setRespondendo(m); setTexto(""); }}
                    className="rounded gold-fill px-3 py-1.5 text-xs font-bold text-[var(--hud-on-accent)] hover:brightness-105 transition"
                  >
                    Responder aqui
                  </button>
                  <span className="text-[11px] text-hud-muted">
                    {m.horasRestantes}h para responder por aqui
                  </span>
                </>
              ) : (
                <>
                  <button
                    onClick={() => abrirNoWhatsApp(m)}
                    className="rounded border border-hud-border px-3 py-1.5 text-xs font-semibold text-hud-soft hover:text-hud-text transition"
                  >
                    Abrir no WhatsApp
                  </button>
                  {/* Sem esta frase o barbeiro acha que o app quebrou. */}
                  <span className="text-[11px] text-hud-muted">
                    Passaram 24h — o WhatsApp não deixa mais responder por aqui
                  </span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal aberto={!!respondendo} onFechar={() => setRespondendo(null)}>
        {respondendo && (
          <>
            <h3 className="font-display text-[22px] leading-tight text-hud-text">
              Responder {respondendo.nome || respondendo.telefone}
            </h3>
            <div className="rounded bg-hud-bg border border-hud-border p-3">
              <p className="text-xs text-hud-muted whitespace-pre-wrap break-words">
                {respondendo.texto}
              </p>
            </div>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={4}
              autoFocus
              maxLength={1000}
              placeholder="Escreva sua resposta..."
              className="w-full rounded bg-hud-bg border border-hud-border p-3 text-sm text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none resize-none"
            />
            <button
              onClick={enviar}
              disabled={enviando || !texto.trim()}
              className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition"
            >
              {enviando ? "Enviando..." : "Enviar"}
            </button>
            <button
              onClick={() => setRespondendo(null)}
              className="w-full rounded border border-hud-border py-3 text-sm font-medium text-hud-muted hover:text-hud-text transition"
            >
              Cancelar
            </button>
          </>
        )}
      </Modal>
    </div>
  );
}
