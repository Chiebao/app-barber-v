"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Onde o link do WhatsApp cai: escolher o plano e pagar, sem login.
 *
 * Antes a mensagem mandava abrir o painel em Configuracoes — entrar, achar a
 * aba, gerar a cobranca, so entao pagar. Cada passo desses e um lugar onde o
 * dono deixa para depois, e "depois" e o dia em que a agenda bloqueia.
 */

interface Plano { id: string; rotulo: string; mensal: number; meses: number; total: number }
interface Dados {
  loja: string; dono: string; saiuDoTeste: boolean; emDia: boolean;
  planoAtual: string; planos: Plano[];
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Pagar({ params }: { params: { faturaId: string } }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [escolhido, setEscolhido] = useState<string>("");
  const [indo, setIndo] = useState(false);

  useEffect(() => {
    fetch(`/api/pagar/${params.faturaId}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Link inválido");
        setDados(j);
        setEscolhido(j.planoAtual);
      })
      .catch((e) => setErro(e.message));
  }, [params.faturaId]);

  const pagar = async () => {
    setIndo(true);
    setErro(null);
    try {
      const r = await fetch(`/api/pagar/${params.faturaId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: escolhido }),
      });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.error || "Não consegui abrir o pagamento");
      // Vai direto para o checkout. `replace` para o voltar do celular nao
      // cair numa pagina que gera outra cobranca.
      window.location.replace(j.url);
    } catch (e) {
      setErro((e as Error).message);
      setIndo(false);
    }
  };

  const plano = dados?.planos.find((p) => p.id === escolhido);
  const maisBarato = dados ? Math.min(...dados.planos.map((p) => p.mensal)) : 0;

  return (
    <main className="min-h-screen hud-bg px-5 py-10">
      <div className="mx-auto flex max-w-[28rem] flex-col gap-6">
        <span className="flex items-center gap-2.5 font-display text-xl tracking-tight text-hud-text">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-10 w-10 rounded-full border border-[color-mix(in_srgb,var(--hud-accent)_40%,transparent)] object-cover" />
          <span>Barber<span className="text-hud-light">Pro</span></span>
        </span>

        {!dados && !erro && <p className="text-sm text-hud-muted">Carregando…</p>}

        {erro && !dados && (
          <div className="rounded border border-[color-mix(in_srgb,var(--hud-err)_30%,transparent)] bg-[color-mix(in_srgb,var(--hud-err)_10%,transparent)] p-4 text-sm text-hud-err">{erro}</div>
        )}

        {dados?.emDia && (
          <div className="flex flex-col gap-4">
            <h1 className="font-display text-3xl leading-tight text-hud-text">Tudo certo por aqui ✓</h1>
            <p className="text-hud-muted">
              A assinatura da <b className="text-hud-text">{dados.loja}</b> está em dia. Não há nada para pagar agora.
            </p>
            <Link href="/admin/painel" className="w-full rounded gold-fill py-4 text-center font-semibold text-[var(--hud-on-accent)]">
              Abrir o painel
            </Link>
          </div>
        )}

        {dados && !dados.emDia && (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="text-balance font-display text-3xl leading-tight text-hud-text">
                {dados.saiuDoTeste
                  ? `${dados.dono}, o teste grátis da ${dados.loja} terminou`
                  : `Assinatura da ${dados.loja}`}
              </h1>
              <p className="text-hud-muted">
                Escolha um plano para continuar recebendo agendamentos. A partir de {brl(maisBarato)} por mês.
              </p>
            </div>

            <div role="radiogroup" aria-label="Planos" className="grid gap-3">
              {dados.planos.map((p) => {
                const ativo = p.id === escolhido;
                const economia = Math.round((dados.planos[0].mensal - p.mensal) * p.meses * 100) / 100;
                return (
                  <button
                    key={p.id}
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => setEscolhido(p.id)}
                    className={
                      "grid grid-cols-[1fr_auto] items-center gap-3 rounded border p-4 text-left transition " +
                      (ativo ? "border-hud-accent bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)]" : "border-white/10 bg-hud-surface hover:border-white/25")
                    }
                  >
                    <span>
                      <span className="block font-bold text-hud-text">{p.rotulo}</span>
                      <span className="block text-xs text-hud-muted">
                        {p.meses === 1 ? "Cobrado todo mês" : `${brl(p.total)} a cada ${p.meses} meses`}
                        {economia > 0 && <span className="text-hud-ok"> · economiza {brl(economia)}</span>}
                      </span>
                    </span>
                    <span className="text-right">
                      <b className="block font-display text-xl tabular-nums text-hud-text">{brl(p.mensal)}</b>
                      <span className="text-[11px] text-hud-muted">por mês</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {erro && <p className="text-sm text-hud-err">{erro}</p>}

            <button
              onClick={pagar}
              disabled={!plano || indo}
              className="hud-focus w-full rounded gold-fill py-4 font-semibold text-[var(--hud-on-accent)] transition hover:brightness-105 disabled:opacity-60"
            >
              {indo ? "Abrindo o pagamento…" : plano ? `Pagar ${brl(plano.total)}` : "Escolha um plano"}
            </button>

            <p className="text-center text-xs leading-relaxed text-hud-muted">
              Pix ou cartão, pela InfinitePay. A confirmação é automática — a agenda continua liberada assim que o
              pagamento cair.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
