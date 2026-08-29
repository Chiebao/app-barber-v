"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/app/lib/toast";
import { Modal } from "@/app/lib/modal";

/**
 * Porta de entrada do painel quando falta aceitar os termos.
 *
 * Cobre a conta que nunca aceitou e a que aceitou uma versão anterior. É
 * bloqueante de propósito: aceite que dá para adiar indefinidamente não é
 * aceite, é banner.
 *
 * Não trava o barbeiro contratado — a API já responde que ele não precisa,
 * porque quem contratou o serviço foi o dono.
 */
export default function Aceite({
  token,
  onAceito,
  onSair,
}: {
  token: string | null;
  onAceito: () => void;
  onSair: () => void;
}) {
  const [estado, setEstado] = useState<{
    precisaAceitar: boolean;
    versaoVigente: string;
    vigenciaDesde?: string;
    versaoAceita: string | null;
    primeiraVez: boolean;
  } | null>(null);
  const [marcado, setMarcado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const buscar = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/me/aceite", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setEstado(await r.json());
    } catch { /* sem resposta, o painel segue normal */ }
  }, [token]);

  useEffect(() => { buscar(); }, [buscar]);

  if (!estado?.precisaAceitar) return null;

  const aceitar = async () => {
    if (!marcado || !token) return;
    setSalvando(true);
    try {
      const r = await fetch("/api/me/aceite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ versao: estado.versaoVigente }),
      });
      const d = await r.json();
      if (r.ok) {
        setEstado(e => (e ? { ...e, precisaAceitar: false } : e));
        toast.success("Obrigado! Bom trabalho.");
        onAceito();
      }
      else if (r.status === 409) { toast.error(d.error); buscar(); setMarcado(false); }
      else toast.error(d.error || "Não foi possível registrar");
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setSalvando(false);
    }
  };

  return (
    // Bloqueante: o aceite não é uma sugestão, e clicar fora não pode
    // servir de saída.
    <Modal aberto onFechar={() => {}} bloqueante largura="max-w-md">

        <div>
          <p className="text-xs text-brand-400 uppercase tracking-widest mb-2">
            {estado.primeiraVez ? "Antes de continuar" : "Termos atualizados"}
          </p>
          <h2 className="text-xl font-semibold text-white">
            {estado.primeiraVez
              ? "Precisamos do seu aceite"
              : "Nossos termos mudaram"}
          </h2>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed">
            {estado.primeiraVez ? (
              <>
                Sua conta foi criada antes de passarmos a registrar o aceite dos termos.
                Para continuar usando o painel, precisamos que você leia e aceite —
                leva um minuto e vale para as duas partes.
              </>
            ) : (
              <>
                Publicamos uma versão nova dos Termos de Uso e da Política de
                Privacidade{estado.vigenciaDesde ? `, em vigor desde ${estado.vigenciaDesde}` : ""}.
                {estado.versaoAceita
                  ? ` Você havia aceitado a versão ${estado.versaoAceita}.`
                  : ""}{" "}
                Leia a versão atual para continuar.
              </>
            )}
          </p>
        </div>

        <div className="rounded-xl bg-dark-900 border border-gray-700 p-4 space-y-2.5">
          <a
            href="/termos" target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between text-sm text-brand-400 hover:text-brand-300 transition"
          >
            <span>📄 Termos de Uso</span>
            <span className="text-gray-600">abrir ›</span>
          </a>
          <div className="border-t border-gray-700/60" />
          <a
            href="/privacidade" target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between text-sm text-brand-400 hover:text-brand-300 transition"
          >
            <span>🔒 Política de Privacidade</span>
            <span className="text-gray-600">abrir ›</span>
          </a>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={marcado}
            onChange={(e) => setMarcado(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-brand-500 cursor-pointer"
          />
          <span className="text-sm text-gray-300 leading-relaxed">
            Li e aceito os Termos de Uso e a Política de Privacidade
            {estado.versaoVigente ? ` (versão ${estado.versaoVigente})` : ""}.
          </span>
        </label>

        <button
          onClick={aceitar}
          disabled={!marcado || salvando}
          className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {salvando ? "Registrando..." : "Aceitar e continuar"}
        </button>

        <button
          onClick={onSair}
          className="w-full text-sm text-gray-500 hover:text-gray-300 transition py-1"
        >
          Sair da conta
        </button>

        <p className="text-xs text-gray-600 text-center leading-relaxed">
          Registramos a data e a versão do seu aceite. Seus dados e sua agenda
          continuam intactos.
        </p>
    </Modal>
  );
}
