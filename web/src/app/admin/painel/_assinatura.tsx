"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/app/lib/toast";
import { Modal } from "@/app/lib/modal";

/**
 * Tela de assinatura do dono.
 *
 * Precisa responder três coisas sem rolagem: em que pé eu estou, quanto
 * custa, e o que acontece se eu não pagar. A última é a que mais gera
 * cancelamento quando fica vaga.
 */

interface Situacao {
  estado: "trial" | "ativa" | "carencia" | "bloqueada" | "cortesia" | "cancelada";
  podeEscrever: boolean;
  aceitaAgendamento: boolean;
  diasRestantes: number;
  periodoFim: string;
  plano: string;
  valorCiclo: number;
  aviso: string | null;
  podeGerenciar: boolean;
  diasCarencia: number;
  canceladaEm: string | null;
  metodo: string | null;
  descontoAAcertar: number;
  ciclosPagos: number;
  compromisso: number;
}

interface Plano {
  id: string; rotulo: string; comoPaga: string;
  compromisso: number; mesesCobranca: number;
  mensal: number; porCobranca: number; totalCompromisso: number;
  economiaMensal: number;
}

interface Cobranca {
  id: string; valor: number; status: string;
  vencimento: string; pagaEm: string | null; metodo: string | null;
}

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Nome do plano pelo tamanho do compromisso, em meses. */
const NOME_COMPROMISSO: Record<number, string> = { 3: "Trimestral", 6: "Semestral", 12: "Anual" };

const VISUAL: Record<string, { rotulo: string; cor: string; borda: string; fundo: string }> = {
  trial:     { rotulo: "Teste grátis",  cor: "text-hud-info",   borda: "border-[color-mix(in_srgb,var(--hud-info)_40%,transparent)]",   fundo: "bg-[color-mix(in_srgb,var(--hud-info)_10%,transparent)]" },
  ativa:     { rotulo: "Ativa",          cor: "text-hud-ok",  borda: "border-[color-mix(in_srgb,var(--hud-ok)_40%,transparent)]",  fundo: "bg-[color-mix(in_srgb,var(--hud-ok)_10%,transparent)]" },
  carencia:  { rotulo: "Em atraso",      cor: "text-hud-warn", borda: "border-[color-mix(in_srgb,var(--hud-warn)_40%,transparent)]", fundo: "bg-[color-mix(in_srgb,var(--hud-warn)_10%,transparent)]" },
  bloqueada: { rotulo: "Bloqueada",      cor: "text-hud-err",    borda: "border-[color-mix(in_srgb,var(--hud-err)_40%,transparent)]",    fundo: "bg-[color-mix(in_srgb,var(--hud-err)_10%,transparent)]" },
  cortesia:  { rotulo: "Cortesia",       cor: "text-hud-light",  borda: "border-[color-mix(in_srgb,var(--hud-accent)_40%,transparent)]",  fundo: "bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)]" },
  cancelada: { rotulo: "Cancelada",      cor: "text-hud-muted",   borda: "border-hud-border",      fundo: "bg-hud-surface" },
};

export default function Assinatura({
  token,
  onUnauthorized,
}: {
  token: string | null;
  onUnauthorized: () => void;
}) {
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [cobranca, setCobranca] = useState<{ id: string; valor: number; link: string; mensalidade: number; descontoAAcertar: number } | null>(null);
  // Confirmações em modal do app. O confirm() do navegador rompe o visual e
  // no celular parece notificação do sistema, não parte do produto.
  const [confirmarPlano, setConfirmarPlano] = useState<Plano | null>(null);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);

  const buscar = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/me/assinatura", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { onUnauthorized(); return; }
      const d = await res.json();
      setSituacao(d.situacao);
      setPlanos(d.planos || []);
      setCobrancas(d.cobrancas || []);
    } catch {
      toast.error("Não foi possível carregar a assinatura");
    } finally {
      setCarregando(false);
    }
  }, [token, onUnauthorized]);

  useEffect(() => { buscar(); }, [buscar]);

  const alterar = async (corpo: Record<string, unknown>) => {
    if (!token) return;
    setSalvando(true);
    try {
      const res = await fetch("/api/me/assinatura", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const d = await res.json();
      if (res.ok) { toast.success(d.mensagem || "Pronto"); buscar(); }
      else toast.error(d.error || "Não foi possível alterar");
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setSalvando(false);
    }
  };

  /**
   * Gera a cobrança do ciclo e abre o checkout.
   *
   * O link abre em aba nova de propósito: o barbeiro volta para o painel e
   * encontra tudo como deixou, em vez de perder o contexto no meio do
   * pagamento.
   */
  const pagarAgora = async () => {
    if (!token) return;
    setGerando(true);
    try {
      const res = await fetch("/api/me/assinatura/cobranca", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || "Não foi possível gerar a cobrança"); return; }
      setCobranca(d.cobranca);
      window.open(d.cobranca.link, "_blank");
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setGerando(false);
    }
  };

  const trocarPlano = (p: Plano) => {
    if (p.id === situacao?.plano) return;
    setConfirmarPlano(p);
  };

  if (carregando) {
    return (
      <div className="flex justify-center py-14">
        <div className="w-7 h-7 border-2 border-hud-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!situacao) return null;

  const v = VISUAL[situacao.estado] || VISUAL.ativa;
  const vence = new Date(situacao.periodoFim).toLocaleDateString("pt-BR");

  return (
    <div className="space-y-5">
      {/* Onde eu estou */}
      <div className={`rounded border p-5 ${v.borda} ${v.fundo}`}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className={`text-xs uppercase tracking-widest font-semibold ${v.cor}`}>{v.rotulo}</span>
          {situacao.estado !== "cortesia" && (
            <span className="text-xs text-hud-muted">
              {situacao.estado === "bloqueada" ? "venceu em" : "até"} {vence}
            </span>
          )}
        </div>

        {situacao.estado === "cortesia" ? (
          <p className="text-lg text-hud-text">Acesso liberado, sem cobrança.</p>
        ) : (
          <p className="text-3xl font-semibold text-hud-text tabular-nums">
            {situacao.diasRestantes}
            <span className="text-base font-normal text-hud-muted ml-2">
              {situacao.diasRestantes === 1 ? "dia" : "dias"}
              {situacao.estado === "carencia" ? " até bloquear" : situacao.estado === "trial" ? " de teste" : ""}
            </span>
          </p>
        )}

        {situacao.aviso && <p className="text-sm text-hud-soft mt-2">{situacao.aviso}</p>}
      </div>

      {/* Pagar. Só aparece quando faz sentido: em cortesia não há cobrança,
          e no meio de um período pago não há o que acertar. */}
      {situacao.podeGerenciar &&
        situacao.estado !== "cortesia" &&
        (situacao.estado !== "ativa" || situacao.diasRestantes <= 7) && (
        <div className="rounded bg-hud-surface border border-[color-mix(in_srgb,var(--hud-accent)_40%,transparent)] p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-hud-soft">
              {situacao.estado === "trial" ? "Assinar agora" : "Renovar assinatura"}
            </p>
            <p className="text-lg font-semibold text-hud-text tabular-nums">{BRL(situacao.valorCiclo)}</p>
          </div>

          <button
            onClick={pagarAgora}
            disabled={gerando}
            className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all press-scale"
          >
            {gerando ? "Gerando cobrança..." : "Pagar com Pix ou cartão"}
          </button>

          {cobranca && (
            <div className="space-y-2 pt-1">
              {cobranca.descontoAAcertar > 0 && (
                <div className="rounded bg-hud-bg border border-hud-border p-3 space-y-1 text-xs">
                  <div className="flex justify-between text-hud-muted">
                    <span>Mensalidade</span>
                    <span className="tabular-nums">{BRL(cobranca.mensalidade)}</span>
                  </div>
                  <div className="flex justify-between text-hud-warn">
                    <span>Diferença de desconto</span>
                    <span className="tabular-nums">{BRL(cobranca.descontoAAcertar)}</span>
                  </div>
                  <div className="flex justify-between text-hud-text font-semibold border-t border-hud-border pt-1">
                    <span>Total</span>
                    <span className="tabular-nums">{BRL(cobranca.valor)}</span>
                  </div>
                </div>
              )}
              <p className="text-xs text-hud-muted">
                A página de pagamento abriu em outra aba. Se não abriu, use o link:
              </p>
              <a
                href={cobranca.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded bg-hud-bg border border-hud-border px-3 py-2 text-xs text-hud-light truncate"
              >
                {cobranca.link}
              </a>
              <p className="text-xs text-hud-muted">
                Assim que o pagamento cair, sua assinatura é liberada sozinha — não precisa
                avisar ninguém.
              </p>
            </div>
          )}

          <p className="text-xs text-hud-muted">
            Pix ou cartão. No cartão, compromete apenas {BRL(situacao.valorCiclo)} do seu limite.
          </p>
        </div>
      )}

      {situacao.descontoAAcertar > 0 && (
        <div className="rounded bg-[color-mix(in_srgb,var(--hud-warn)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-warn)_30%,transparent)] p-4 space-y-2">
          <p className="text-xs text-[color-mix(in_srgb,var(--hud-warn)_80%,transparent)] uppercase tracking-widest">Diferença de desconto</p>
          <p className="text-2xl font-semibold text-hud-warn tabular-nums">
            {BRL(situacao.descontoAAcertar)}
          </p>
          <p className="text-sm text-hud-soft">
            Você usou {situacao.ciclosPagos} de {situacao.compromisso} meses com preço de plano longo.
            A diferença dos meses aproveitados entra na próxima cobrança, junto da mensalidade.
          </p>
        </div>
      )}

      {/* O que acontece se eu não pagar — dito antes de ele perguntar */}
      {situacao.estado !== "cortesia" && (
        <div className="hud-card p-4 space-y-2">
          <p className="hud-eyebrow mb-1">Se o pagamento atrasar</p>
          <p className="text-sm text-hud-soft">
            <span className="text-hud-warn">•</span> Você tem <strong>{situacao.diasCarencia} dias</strong> de
            acesso normal depois do vencimento.
          </p>
          <p className="text-sm text-hud-soft">
            <span className="text-hud-err">•</span> Passou disso, o painel fica <strong>só leitura</strong>: você
            ainda vê a agenda e confirma pagamento, mas não cria nem edita.
          </p>
          <p className="text-sm text-hud-soft">
            <span className="text-hud-err">•</span> O link para de aceitar agendamento novo — quem já tinha
            horário marcado não perde.
          </p>
        </div>
      )}

      {/* Planos.
          Agrupados por COMPROMISSO, não por preço: o barbeiro decide primeiro
          por quanto tempo quer se comprometer, e só então como quer pagar.
          Cinco cartões soltos numa lista ele não compara. */}
      {situacao.podeGerenciar && situacao.estado !== "cortesia" && (
        <div className="space-y-4">
          <p className="hud-eyebrow">Planos</p>

          {/* O trimestral estava no catálogo (lib/assinatura) mas não
              aparecia aqui: a lista de grupos era fixa em 1, 6 e 12. */}
          {[1, 3, 6, 12].map((meses) => {
            const doGrupo = planos.filter(p => p.compromisso === meses);
            if (doGrupo.length === 0) return null;
            const titulo = meses === 1 ? "Sem compromisso" : NOME_COMPROMISSO[meses] ?? `${meses} meses`;
            const melhor = doGrupo.reduce((a, b) => (a.mensal <= b.mensal ? a : b));

            return (
              <div key={meses} className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-semibold text-hud-text">{titulo}</p>
                  {meses === 12 && (
                    <span className="text-[10px] uppercase tracking-wide text-hud-light border border-[color-mix(in_srgb,var(--hud-accent)_40%,transparent)] rounded px-1.5 py-0.5">
                      mais barato
                    </span>
                  )}
                </div>

                {doGrupo.map((p) => {
                  const atual = p.id === situacao.plano;
                  return (
                    <button
                      key={p.id}
                      onClick={() => trocarPlano(p)}
                      disabled={salvando || atual}
                      className={`w-full flex items-center gap-3 rounded border p-4 text-left transition ${
                        atual
                          ? "border-hud-accent bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)]"
                          : "border-hud-border bg-hud-surface hover:border-[color-mix(in_srgb,var(--hud-accent)_60%,transparent)]"
                      } disabled:cursor-default`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold ${atual ? "text-hud-light" : "text-hud-text"}`}>
                          Pagando {p.comoPaga}
                          {atual && <span className="ml-2 text-xs font-normal">· seu plano</span>}
                        </p>
                        <p className="text-xs text-hud-muted">
                          {p.mesesCobranca === 1
                            ? `${BRL(p.porCobranca)} por mês`
                            : `${BRL(p.porCobranca)} de uma vez, cobre ${p.mesesCobranca} meses`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-semibold text-hud-text tabular-nums">{BRL(p.mensal)}</p>
                        <p className="text-xs text-hud-muted">por mês</p>
                        {p.economiaMensal > 0 && (
                          <p className="text-xs text-hud-ok tabular-nums">−{BRL(p.economiaMensal)}/mês</p>
                        )}
                      </div>
                    </button>
                  );
                })}

                {meses > 1 && (
                  <p className="text-xs text-hud-faint pl-1">
                    À vista sai {BRL(melhor.mensal)}/mês porque você adianta o período inteiro.
                  </p>
                )}
              </div>
            );
          })}

          <p className="text-xs text-hud-muted">
            Preço fixo por barbearia — vale para 1 ou 10 barbeiros.
          </p>
        </div>
      )}

      {/* Histórico */}
      {cobrancas.length > 0 && (
        <div className="hud-card overflow-hidden">
          <p className="px-4 pt-4 pb-2 hud-eyebrow">Cobranças</p>
          <div className="divide-y divide-hud-border/60">
            {cobrancas.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-hud-text tabular-nums">{BRL(c.valor)}</p>
                  <p className="text-xs text-hud-muted">
                    venceu {new Date(c.vencimento).toLocaleDateString("pt-BR")}
                    {c.metodo ? ` · ${c.metodo}` : ""}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  c.status === "paga" ? "bg-[color-mix(in_srgb,var(--hud-ok)_15%,transparent)] text-hud-ok"
                  : c.status === "vencida" ? "bg-[color-mix(in_srgb,var(--hud-err)_15%,transparent)] text-hud-err"
                  : "bg-[color-mix(in_srgb,var(--hud-warn)_15%,transparent)] text-hud-warn"
                }`}>
                  {c.status === "paga" ? "paga" : c.status === "vencida" ? "vencida" : "pendente"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmar troca de plano */}
      <Modal aberto={!!confirmarPlano} onFechar={() => setConfirmarPlano(null)}>{confirmarPlano && (<>
            <div>
              <p className="text-xs text-hud-light uppercase tracking-widest mb-1">Mudar de plano</p>
              <h3 className="font-display text-[22px] leading-tight text-hud-text">Plano {confirmarPlano.rotulo}</h3>
            </div>

            <div className="rounded bg-hud-bg border border-hud-border p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-hud-muted">Sai por</span>
                <span className="text-2xl font-semibold text-hud-light tabular-nums">
                  {BRL(confirmarPlano.mensal)}<span className="text-sm font-normal text-hud-muted">/mês</span>
                </span>
              </div>
              <div className="border-t border-hud-border pt-3 flex items-baseline justify-between">
                <span className="text-sm text-hud-muted">
                  {confirmarPlano.mesesCobranca === 1
                    ? "Você paga todo mês"
                    : `Você paga uma vez a cada ${confirmarPlano.mesesCobranca} meses`}
                </span>
                <span className="text-lg font-semibold text-hud-text tabular-nums">{BRL(confirmarPlano.porCobranca)}</span>
              </div>
              {confirmarPlano.mesesCobranca > 1 ? (
                <p className="text-xs text-hud-muted">
                  É um pagamento único de {BRL(confirmarPlano.porCobranca)} que cobre{" "}
                  {confirmarPlano.mesesCobranca} meses — não é uma mensalidade de {BRL(confirmarPlano.mensal)}.
                </p>
              ) : confirmarPlano.compromisso > 1 ? (
                <>
                  <p className="text-xs text-hud-muted">
                    Preço de plano {(NOME_COMPROMISSO[confirmarPlano.compromisso] ?? "").toLowerCase()}, mas cobrado
                    mês a mês — sem desembolsar {BRL(confirmarPlano.totalCompromisso)} de uma vez.
                  </p>
                  {/* Dito ANTES de escolher. Descobrir isso só na saída seria
                      uma armadilha, por mais justa que a conta seja. */}
                  <p className="text-xs text-[color-mix(in_srgb,var(--hud-warn)_90%,transparent)] leading-relaxed">
                    O desconto vem adiantado: você paga preço de{" "}
                    {(NOME_COMPROMISSO[confirmarPlano.compromisso] ?? "").toLowerCase()} já no primeiro mês.
                    Se sair antes de {confirmarPlano.compromisso} meses, a diferença dos meses usados
                    ({BRL(confirmarPlano.economiaMensal)} por mês) entra na cobrança se você voltar.
                  </p>
                </>
              ) : null}
              {confirmarPlano.economiaMensal > 0 && (
                <p className="text-xs text-hud-ok">
                  Economiza {BRL(confirmarPlano.economiaMensal)} por mês em relação ao mensal.
                </p>
              )}
            </div>

            <p className="text-xs text-hud-muted">
              Vale a partir da próxima cobrança. O período que você já pagou não muda de preço.
            </p>

            <button
              onClick={() => { const p = confirmarPlano; setConfirmarPlano(null); alterar({ plano: p.id }); }}
              disabled={salvando}
              className="hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all"
            >
              {salvando ? "Alterando..." : `Mudar para ${confirmarPlano.rotulo}`}
            </button>
            <button
              onClick={() => setConfirmarPlano(null)}
              className="w-full text-sm text-hud-muted hover:text-hud-soft transition py-1"
            >
              Deixar como está
            </button>
          </>)}</Modal>

      {/* Confirmar cancelamento */}
      <Modal aberto={!!confirmarCancelar} onFechar={() => setConfirmarCancelar(false)}>{confirmarCancelar && (<>
            <h3 className="font-display text-[22px] leading-tight text-hud-text">Cancelar assinatura?</h3>
            <div className="rounded bg-hud-bg border border-hud-border p-4 space-y-2">
              <p className="text-sm text-hud-soft">
                <span className="text-hud-ok">•</span> Você continua com acesso normal até{" "}
                <strong className="text-hud-text">{vence}</strong>.
              </p>
              <p className="text-sm text-hud-soft">
                <span className="text-hud-warn">•</span> Depois disso o link para de aceitar agendamento novo.
              </p>
              <p className="text-sm text-hud-soft">
                <span className="text-hud-ok">•</span> Sua agenda e seu histórico continuam salvos.
              </p>
            </div>
            <p className="text-xs text-hud-muted">Dá para reativar a qualquer momento, sem taxa.</p>
            <button
              onClick={() => { setConfirmarCancelar(false); alterar({ cancelar: true }); }}
              disabled={salvando}
              className="w-full rounded border border-[color-mix(in_srgb,var(--hud-err)_40%,transparent)] py-3 text-sm font-semibold text-hud-err hover:bg-[color-mix(in_srgb,var(--hud-err)_10%,transparent)] disabled:opacity-50 transition"
            >
              {salvando ? "Cancelando..." : "Sim, cancelar"}
            </button>
            <button
              onClick={() => setConfirmarCancelar(false)}
              className="hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 transition"
            >
              Continuar assinando
            </button>
          </>)}</Modal>

      {/* Cancelar / reativar */}
      {situacao.podeGerenciar && situacao.estado !== "cortesia" && (
        <div className="pt-2">
          {situacao.canceladaEm ? (
            <button
              onClick={() => alterar({ cancelar: false })}
              disabled={salvando}
              className="w-full rounded border border-[color-mix(in_srgb,var(--hud-accent)_40%,transparent)] py-3 text-sm text-hud-light hover:bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] disabled:opacity-50 transition"
            >
              Reativar assinatura
            </button>
          ) : (
            <button
              onClick={() => setConfirmarCancelar(true)}
              disabled={salvando}
              className="w-full text-sm text-hud-muted hover:text-hud-err disabled:opacity-50 transition py-2"
            >
              Cancelar assinatura
            </button>
          )}
        </div>
      )}
    </div>
  );
}
