"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/app/components/hud";
import { toast } from "@/app/lib/toast";

/**
 * Tudo que a barbearia tem para receber, sem recorte de período.
 *
 * Agrupado por CLIENTE porque é assim que a cobrança acontece na vida real:
 * o dono não cobra três atendimentos, ele manda uma mensagem para o cara que
 * deve três cortes. Quem prometeu pagar e não pagou vem primeiro.
 */

interface ClienteDevendo {
  id: string; name: string; phone: string;
  total: number; qtd: number; maisAntigo: string; temPromessaVencida: boolean;
}

interface ItemAberto {
  id: string; date: string; startTime: string; total: number;
  barberName: string; client: { id: string; name: string; phone: string };
  servicos: string[]; prometidoPara: string | null;
  promessaVencida: boolean; diasEmAberto: number;
}

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataCurta = (iso: string) => { const [a, m, d] = iso.split("-"); return `${d}/${m}/${a.slice(2)}`; };

export default function AReceber({
  token,
  onVoltar,
  onUnauthorized,
  onPagou,
}: {
  token: string | null;
  onVoltar: () => void;
  onUnauthorized: () => void;
  onPagou?: () => void;
}) {
  const [dados, setDados] = useState<{
    total: number; quantidade: number; promessasVencidas: number;
    clientes: ClienteDevendo[]; itens: ItemAberto[];
  } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    try {
      const res = await fetch("/api/me/a-receber", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { onUnauthorized(); return; }
      if (!res.ok) { toast.error("Não foi possível carregar"); return; }
      setDados(await res.json());
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setCarregando(false);
    }
  }, [token, onUnauthorized]);

  useEffect(() => { buscar(); }, [buscar]);

  const cobrar = (c: ClienteDevendo, itens: ItemAberto[]) => {
    const tel = c.phone.replace(/\D/g, "");
    const lista = itens.map(i => `• ${dataCurta(i.date)} — ${BRL(i.total)}`).join("\n");
    const msg = encodeURIComponent(
      `Olá, ${c.name}! Tudo bem?\n\n` +
      (itens.length === 1
        ? `Passando para lembrar do atendimento do dia ${dataCurta(itens[0].date)}, no valor de ${BRL(c.total)}.`
        : `Passando para lembrar dos atendimentos em aberto:\n${lista}\n\nTotal: ${BRL(c.total)}.`) +
      `\n\nQuando puder acertar, me avisa. Obrigado! 🙏`
    );
    window.open(`https://wa.me/55${tel}?text=${msg}`, "_blank");
  };

  /** Baixa rápida: recebeu na mão, marca aqui sem ir até a agenda. */
  const marcarPago = async (item: ItemAberto, metodo: string) => {
    if (!token) return;
    setBaixando(item.id);
    try {
      const res = await fetch("/api/me/finance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ appointmentId: item.id, paymentMethod: metodo }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.ok) { toast.success(`${item.client.name} — pago em ${metodo}`); buscar(); onPagou?.(); }
      else { const d = await res.json().catch(() => ({})); toast.error(d.error || "Não foi possível dar baixa"); }
    } catch {
      toast.error("Erro ao dar baixa");
    } finally {
      setBaixando(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onVoltar} className="hud-focus flex items-center gap-1 text-hud-light text-sm hover:text-hud-light shrink-0">
          <span className="text-lg">←</span> Voltar
        </button>
        <h2 className="font-display text-2xl leading-tight text-hud-text"><Icon nome="dinheiro" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />A receber</h2>
      </div>

      {carregando ? (
        <div className="flex justify-center py-14">
          <div className="w-7 h-7 border-2 border-hud-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !dados ? null : dados.quantidade === 0 ? (
        <div className="text-center py-16 text-hud-muted">
          <p className="text-4xl mb-3"><Icon nome="sucesso" tamanho={18} /></p>
          <p>Ninguém devendo</p>
          <p className="text-xs mt-1">Todo atendimento que já passou está pago.</p>
        </div>
      ) : (
        <>
          <div className="rounded bg-[color-mix(in_srgb,var(--hud-warn)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-warn)_30%,transparent)] p-5">
            <p className="text-xs text-[color-mix(in_srgb,var(--hud-warn)_80%,transparent)] uppercase tracking-widest mb-1">Total em aberto</p>
            <p className="text-4xl font-semibold text-hud-warn tabular-nums">{BRL(dados.total)}</p>
            <p className="text-xs text-hud-muted mt-2">
              {dados.quantidade} atendimento{dados.quantidade !== 1 ? "s" : ""} ·{" "}
              {dados.clientes.length} cliente{dados.clientes.length !== 1 ? "s" : ""}
              {dados.promessasVencidas > 0 && (
                <span className="text-hud-err"> · {dados.promessasVencidas} promessa{dados.promessasVencidas !== 1 ? "s" : ""} vencida{dados.promessasVencidas !== 1 ? "s" : ""}</span>
              )}
            </p>
          </div>

          <div className="space-y-2">
            {dados.clientes.map(c => {
              const itensDele = dados.itens.filter(i => i.client.id === c.id);
              const expandido = aberto === c.id;
              return (
                <div
                  key={c.id}
                  className={`rounded border overflow-hidden ${
                    c.temPromessaVencida ? "border-[color-mix(in_srgb,var(--hud-err)_40%,transparent)] bg-[color-mix(in_srgb,var(--hud-err)_5%,transparent)]" : "border-hud-border bg-hud-surface"
                  }`}
                >
                  <div className="flex items-center gap-3 p-4">
                    <button onClick={() => setAberto(expandido ? null : c.id)} className="flex-1 min-w-0 text-left">
                      <p className="font-semibold text-hud-text truncate">{c.name}</p>
                      <p className="text-xs text-hud-muted">
                        {c.qtd} atendimento{c.qtd !== 1 ? "s" : ""} · desde {dataCurta(c.maisAntigo)}
                        {c.temPromessaVencida && <span className="text-hud-err"> · prometeu e não pagou</span>}
                      </p>
                    </button>
                    <p className={`text-lg font-semibold tabular-nums shrink-0 ${c.temPromessaVencida ? "text-hud-err" : "text-hud-warn"}`}>
                      {BRL(c.total)}
                    </p>
                    <button
                      onClick={() => cobrar(c, itensDele)}
                      title="Cobrar pelo WhatsApp"
                      className="shrink-0 rounded border border-[color-mix(in_srgb,var(--hud-ok)_40%,transparent)] px-3 py-2 text-sm text-hud-ok hover:bg-[color-mix(in_srgb,var(--hud-ok)_10%,transparent)] transition"
                    >
                      <Icon nome="mensagem" tamanho={18} />                    </button>
                  </div>

                  {expandido && (
                    <div className="border-t border-hud-border divide-y divide-hud-border/40">
                      {itensDele.map(i => (
                        <div key={i.id} className="p-3 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-hud-text">
                                {dataCurta(i.date)} · {i.startTime}
                                <span className="text-hud-muted text-xs ml-2">{i.barberName}</span>
                              </p>
                              <p className="text-xs text-hud-muted truncate">
                                {i.servicos.join(", ") || "sem serviço"}
                                {i.prometidoPara && (
                                  <span className={i.promessaVencida ? "text-hud-err" : "text-hud-warn"}>
                                    {" "}· prometeu {dataCurta(i.prometidoPara)}
                                  </span>
                                )}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-hud-warn tabular-nums shrink-0">{BRL(i.total)}</p>
                          </div>
                          <div className="flex gap-2">
                            {["pix", "dinheiro", "cartao"].map(m => (
                              <button
                                key={m}
                                onClick={() => marcarPago(i, m)}
                                disabled={baixando === i.id}
                                className="flex-1 rounded border border-hud-border py-1.5 text-xs text-hud-muted hover:text-hud-ok hover:border-[color-mix(in_srgb,var(--hud-ok)_40%,transparent)] disabled:opacity-50 transition"
                              >
                                {baixando === i.id ? "..." : m === "cartao" ? "Cartão" : m === "pix" ? "Pix" : "Dinheiro"}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-hud-faint text-center">
            Só aparece atendimento que já aconteceu. Horário marcado para frente é agenda, não dívida.
          </p>
        </>
      )}
    </div>
  );
}
