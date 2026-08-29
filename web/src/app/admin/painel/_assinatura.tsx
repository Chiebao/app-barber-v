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

const VISUAL: Record<string, { rotulo: string; cor: string; borda: string; fundo: string }> = {
  trial:     { rotulo: "Teste grátis",  cor: "text-blue-400",   borda: "border-blue-500/40",   fundo: "bg-blue-500/10" },
  ativa:     { rotulo: "Ativa",          cor: "text-green-400",  borda: "border-green-500/40",  fundo: "bg-green-500/10" },
  carencia:  { rotulo: "Em atraso",      cor: "text-yellow-400", borda: "border-yellow-500/40", fundo: "bg-yellow-500/10" },
  bloqueada: { rotulo: "Bloqueada",      cor: "text-red-400",    borda: "border-red-500/40",    fundo: "bg-red-500/10" },
  cortesia:  { rotulo: "Cortesia",       cor: "text-brand-400",  borda: "border-brand-400/40",  fundo: "bg-brand-500/10" },
  cancelada: { rotulo: "Cancelada",      cor: "text-gray-400",   borda: "border-gray-600",      fundo: "bg-dark-800" },
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
  const [cobranca, setCobranca] = useState<{ id: string; valor: number; link: string } | null>(null);
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
        <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!situacao) return null;

  const v = VISUAL[situacao.estado] || VISUAL.ativa;
  const vence = new Date(situacao.periodoFim).toLocaleDateString("pt-BR");

  return (
    <div className="space-y-5">
      {/* Onde eu estou */}
      <div className={`rounded-2xl border p-5 ${v.borda} ${v.fundo}`}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className={`text-xs uppercase tracking-widest font-semibold ${v.cor}`}>{v.rotulo}</span>
          {situacao.estado !== "cortesia" && (
            <span className="text-xs text-gray-400">
              {situacao.estado === "bloqueada" ? "venceu em" : "até"} {vence}
            </span>
          )}
        </div>

        {situacao.estado === "cortesia" ? (
          <p className="text-lg text-white">Acesso liberado, sem cobrança.</p>
        ) : (
          <p className="text-3xl font-semibold text-white tabular-nums">
            {situacao.diasRestantes}
            <span className="text-base font-normal text-gray-400 ml-2">
              {situacao.diasRestantes === 1 ? "dia" : "dias"}
              {situacao.estado === "carencia" ? " até bloquear" : situacao.estado === "trial" ? " de teste" : ""}
            </span>
          </p>
        )}

        {situacao.aviso && <p className="text-sm text-gray-300 mt-2">{situacao.aviso}</p>}
      </div>

      {/* Pagar. Só aparece quando faz sentido: em cortesia não há cobrança,
          e no meio de um período pago não há o que acertar. */}
      {situacao.podeGerenciar &&
        situacao.estado !== "cortesia" &&
        (situacao.estado !== "ativa" || situacao.diasRestantes <= 7) && (
        <div className="rounded-xl bg-dark-800 border border-brand-400/40 p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-gray-300">
              {situacao.estado === "trial" ? "Assinar agora" : "Renovar assinatura"}
            </p>
            <p className="text-lg font-semibold text-white tabular-nums">{BRL(situacao.valorCiclo)}</p>
          </div>

          <button
            onClick={pagarAgora}
            disabled={gerando}
            className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all press-scale"
          >
            {gerando ? "Gerando cobrança..." : "Pagar com Pix ou cartão"}
          </button>

          {cobranca && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-gray-400">
                A página de pagamento abriu em outra aba. Se não abriu, use o link:
              </p>
              <a
                href={cobranca.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg bg-dark-900 border border-gray-700 px-3 py-2 text-xs text-brand-400 truncate"
              >
                {cobranca.link}
              </a>
              <p className="text-xs text-gray-500">
                Assim que o pagamento cair, sua assinatura é liberada sozinha — não precisa
                avisar ninguém.
              </p>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Pix ou cartão. No cartão, compromete apenas {BRL(situacao.valorCiclo)} do seu limite.
          </p>
        </div>
      )}

      {/* O que acontece se eu não pagar — dito antes de ele perguntar */}
      {situacao.estado !== "cortesia" && (
        <div className="rounded-xl bg-dark-800 border border-gray-700 p-4 space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Se o pagamento atrasar</p>
          <p className="text-sm text-gray-300">
            <span className="text-yellow-400">•</span> Você tem <strong>{situacao.diasCarencia} dias</strong> de
            acesso normal depois do vencimento.
          </p>
          <p className="text-sm text-gray-300">
            <span className="text-red-400">•</span> Passou disso, o painel fica <strong>só leitura</strong>: você
            ainda vê a agenda e confirma pagamento, mas não cria nem edita.
          </p>
          <p className="text-sm text-gray-300">
            <span className="text-red-400">•</span> O link para de aceitar agendamento novo — quem já tinha
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
          <p className="text-xs text-gray-500 uppercase tracking-widest">Planos</p>

          {[1, 6, 12].map((meses) => {
            const doGrupo = planos.filter(p => p.compromisso === meses);
            if (doGrupo.length === 0) return null;
            const titulo = meses === 1 ? "Sem compromisso" : meses === 6 ? "Semestral" : "Anual";
            const melhor = doGrupo.reduce((a, b) => (a.mensal <= b.mensal ? a : b));

            return (
              <div key={meses} className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-semibold text-white">{titulo}</p>
                  {meses === 12 && (
                    <span className="text-[10px] uppercase tracking-wide text-brand-400 border border-brand-400/40 rounded px-1.5 py-0.5">
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
                      className={`w-full flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                        atual
                          ? "border-brand-400 bg-brand-500/10"
                          : "border-gray-700 bg-dark-800 hover:border-brand-400/60"
                      } disabled:cursor-default`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold ${atual ? "text-brand-400" : "text-white"}`}>
                          Pagando {p.comoPaga}
                          {atual && <span className="ml-2 text-xs font-normal">· seu plano</span>}
                        </p>
                        <p className="text-xs text-gray-500">
                          {p.mesesCobranca === 1
                            ? `${BRL(p.porCobranca)} por mês`
                            : `${BRL(p.porCobranca)} de uma vez, cobre ${p.mesesCobranca} meses`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-semibold text-white tabular-nums">{BRL(p.mensal)}</p>
                        <p className="text-xs text-gray-500">por mês</p>
                        {p.economiaMensal > 0 && (
                          <p className="text-xs text-green-400 tabular-nums">−{BRL(p.economiaMensal)}/mês</p>
                        )}
                      </div>
                    </button>
                  );
                })}

                {meses > 1 && (
                  <p className="text-xs text-gray-600 pl-1">
                    À vista sai {BRL(melhor.mensal)}/mês porque você adianta o período inteiro.
                  </p>
                )}
              </div>
            );
          })}

          <p className="text-xs text-gray-500">
            Preço fixo por barbearia — vale para 1 ou 10 barbeiros.
          </p>
        </div>
      )}

      {/* Histórico */}
      {cobrancas.length > 0 && (
        <div className="rounded-xl bg-dark-800 border border-gray-700 overflow-hidden">
          <p className="px-4 pt-4 pb-2 text-xs text-gray-500 uppercase tracking-widest">Cobranças</p>
          <div className="divide-y divide-gray-700/60">
            {cobrancas.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white tabular-nums">{BRL(c.valor)}</p>
                  <p className="text-xs text-gray-500">
                    venceu {new Date(c.vencimento).toLocaleDateString("pt-BR")}
                    {c.metodo ? ` · ${c.metodo}` : ""}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  c.status === "paga" ? "bg-green-500/15 text-green-400"
                  : c.status === "vencida" ? "bg-red-500/15 text-red-400"
                  : "bg-yellow-500/15 text-yellow-400"
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
              <p className="text-xs text-brand-400 uppercase tracking-widest mb-1">Mudar de plano</p>
              <h3 className="text-xl font-semibold text-white">Plano {confirmarPlano.rotulo}</h3>
            </div>

            <div className="rounded-xl bg-dark-900 border border-gray-700 p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-gray-400">Sai por</span>
                <span className="text-2xl font-semibold text-brand-400 tabular-nums">
                  {BRL(confirmarPlano.mensal)}<span className="text-sm font-normal text-gray-500">/mês</span>
                </span>
              </div>
              <div className="border-t border-gray-700/60 pt-3 flex items-baseline justify-between">
                <span className="text-sm text-gray-400">
                  {confirmarPlano.mesesCobranca === 1
                    ? "Você paga todo mês"
                    : `Você paga uma vez a cada ${confirmarPlano.mesesCobranca} meses`}
                </span>
                <span className="text-lg font-semibold text-white tabular-nums">{BRL(confirmarPlano.porCobranca)}</span>
              </div>
              {confirmarPlano.mesesCobranca > 1 ? (
                <p className="text-xs text-gray-500">
                  É um pagamento único de {BRL(confirmarPlano.porCobranca)} que cobre{" "}
                  {confirmarPlano.mesesCobranca} meses — não é uma mensalidade de {BRL(confirmarPlano.mensal)}.
                </p>
              ) : confirmarPlano.compromisso > 1 ? (
                <p className="text-xs text-gray-500">
                  Preço de plano {confirmarPlano.compromisso === 12 ? "anual" : "semestral"}, mas cobrado
                  mês a mês — sem desembolsar {BRL(confirmarPlano.totalCompromisso)} de uma vez.
                </p>
              ) : null}
              {confirmarPlano.economiaMensal > 0 && (
                <p className="text-xs text-green-400">
                  Economiza {BRL(confirmarPlano.economiaMensal)} por mês em relação ao mensal.
                </p>
              )}
            </div>

            <p className="text-xs text-gray-500">
              Vale a partir da próxima cobrança. O período que você já pagou não muda de preço.
            </p>

            <button
              onClick={() => { const p = confirmarPlano; setConfirmarPlano(null); alterar({ plano: p.id }); }}
              disabled={salvando}
              className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all"
            >
              {salvando ? "Alterando..." : `Mudar para ${confirmarPlano.rotulo}`}
            </button>
            <button
              onClick={() => setConfirmarPlano(null)}
              className="w-full text-sm text-gray-500 hover:text-gray-300 transition py-1"
            >
              Deixar como está
            </button>
          </>)}</Modal>

      {/* Confirmar cancelamento */}
      <Modal aberto={!!confirmarCancelar} onFechar={() => setConfirmarCancelar(false)}>{confirmarCancelar && (<>
            <h3 className="text-xl font-semibold text-white">Cancelar assinatura?</h3>
            <div className="rounded-xl bg-dark-900 border border-gray-700 p-4 space-y-2">
              <p className="text-sm text-gray-300">
                <span className="text-green-400">•</span> Você continua com acesso normal até{" "}
                <strong className="text-white">{vence}</strong>.
              </p>
              <p className="text-sm text-gray-300">
                <span className="text-yellow-400">•</span> Depois disso o link para de aceitar agendamento novo.
              </p>
              <p className="text-sm text-gray-300">
                <span className="text-green-400">•</span> Sua agenda e seu histórico continuam salvos.
              </p>
            </div>
            <p className="text-xs text-gray-500">Dá para reativar a qualquer momento, sem taxa.</p>
            <button
              onClick={() => { setConfirmarCancelar(false); alterar({ cancelar: true }); }}
              disabled={salvando}
              className="w-full rounded-xl border border-red-500/40 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition"
            >
              {salvando ? "Cancelando..." : "Sim, cancelar"}
            </button>
            <button
              onClick={() => setConfirmarCancelar(false)}
              className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 transition"
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
              className="w-full rounded-xl border border-brand-400/40 py-3 text-sm text-brand-400 hover:bg-brand-500/10 disabled:opacity-50 transition"
            >
              Reativar assinatura
            </button>
          ) : (
            <button
              onClick={() => setConfirmarCancelar(true)}
              disabled={salvando}
              className="w-full text-sm text-gray-500 hover:text-red-400 disabled:opacity-50 transition py-2"
            >
              Cancelar assinatura
            </button>
          )}
        </div>
      )}
    </div>
  );
}
