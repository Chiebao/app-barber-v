"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/app/components/hud";
import { toast } from "@/app/lib/toast";

/**
 * Painel da plataforma — visão do dono do BarberPro (não do dono da barbearia).
 * Mostra quantas barbearias existem, quais estão vivas e quais pararam de usar.
 */

interface Etapa {
  chave: "fatura" | "aviso" | "aberta" | "paga";
  feito: boolean; falhou: boolean; pulado: boolean; quando: string | null;
}
interface FaturaDaRodada {
  id: string; criadaEm: string; status: string; plano: string; valor: number;
  pagaEm: string | null; metodo: string | null; origem: string | null;
  avisoWhatsapp: string | null; abertaEm: string | null;
}
interface Processo {
  etapas: Etapa[]; rodada: FaturaDaRodada[]; faturaAberta: string | null;
  proximaFatura: string | null; trialEndsAt: string | null; bloqueiaEm: string;
}
interface Barbearia {
  id: string; nome: string; slug: string; criadaEm: string;
  dono: { nome: string; telefone: string };
  processo: Processo | null;
  barbeiros: number; agendamentosTotal: number; receitaMes: number;
  ultimoAgendamento: string | null; diasParado: number | null;
  situacao: "ativa" | "em_risco" | "sem_uso";
  assinatura: {
    estado: string; plano: string; valorCiclo: number; diasRestantes: number;
    venceEm: string; metodo: string | null;
    ultimaCobranca: { status: string; valor: number; vencimento: string; pagaEm: string | null; link: string | null } | null;
  };
}
interface Assinaturas {
  mrr: number; pagantes: number;
  porEstado: Record<string, number>;
  cobrancasPendentes: number; valorPendente: number;
}
interface Uso {
  agendamentos: { hoje: number; sete: number; trinta: number; total: number };
  porMes: { mes: string; n: number }[];
  noShows: number; cancelados: number;
  taxaNoShow: number; taxaCancelamento: number;
  comandas: number; despesas: number; esperas: number; fixos: number; lembretes: number;
  avaliacoes: number; notaMedia: number | null;
  atendimentosPagos: number; volumeFinanceiro: number;
}
interface Interessado {
  telefone: string; nome: string | null; etapa: string; origem: string | null;
  papel: string | null; barbeiros: string | null; agenda: string | null;
  perguntasNaoEntendidas: string[]; souCliente: boolean; ultimaMensagemEm: string;
}
interface Interessados { total: number; pediramParar: number; lista: Interessado[] }
interface Resumo {
  barbearias: number; ativas: number; emRisco: number; semUso: number;
  ativasNaSemana: number; clientesTotal: number; agendamentosMes: number;
  receitaMes: number; novasEm30Dias: number;
}

const ASSINATURA_VISUAL: Record<string, { label: string; cor: string }> = {
  trial:     { label: "Teste",     cor: "bg-[color-mix(in_srgb,var(--hud-info)_15%,transparent)] text-hud-info border-[color-mix(in_srgb,var(--hud-info)_30%,transparent)]" },
  ativa:     { label: "Pagando",   cor: "bg-[color-mix(in_srgb,var(--hud-ok)_15%,transparent)] text-hud-ok border-[color-mix(in_srgb,var(--hud-ok)_30%,transparent)]" },
  carencia:  { label: "Atrasada",  cor: "bg-[color-mix(in_srgb,var(--hud-warn)_15%,transparent)] text-hud-warn border-[color-mix(in_srgb,var(--hud-warn)_30%,transparent)]" },
  bloqueada: { label: "Bloqueada", cor: "bg-[color-mix(in_srgb,var(--hud-err)_15%,transparent)] text-hud-err border-[color-mix(in_srgb,var(--hud-err)_30%,transparent)]" },
  cortesia:  { label: "Cortesia",  cor: "bg-[color-mix(in_srgb,var(--hud-accent)_15%,transparent)] text-hud-light border-[color-mix(in_srgb,var(--hud-accent)_30%,transparent)]" },
  cancelada: { label: "Cancelada", cor: "bg-[color-mix(in_srgb,var(--hud-surface)_40%,transparent)] text-hud-muted border-hud-border" },
};

const SITUACAO = {
  ativa:    { label: "Ativa",    cor: "bg-[color-mix(in_srgb,var(--hud-ok)_15%,transparent)] text-hud-ok border-[color-mix(in_srgb,var(--hud-ok)_30%,transparent)]" },
  em_risco: { label: "Em risco", cor: "bg-[color-mix(in_srgb,var(--hud-warn)_15%,transparent)] text-hud-warn border-[color-mix(in_srgb,var(--hud-warn)_30%,transparent)]" },
  sem_uso:  { label: "Sem uso",  cor: "bg-[color-mix(in_srgb,var(--hud-err)_15%,transparent)] text-hud-err border-[color-mix(in_srgb,var(--hud-err)_30%,transparent)]" },
} as const;

/** Ordem dos cartoes de cobranca: quem esta perto de bloquear vem primeiro. */
const URGENCIA: Record<string, number> = { carencia: 0, bloqueada: 1, trial: 2, ativa: 3 };

const PASSO: Record<Etapa["chave"], string> = {
  fatura: "Fatura gerada",
  aviso: "Aviso no WhatsApp",
  aberta: "Abriu o link",
  paga: "Pagou",
};

const ORIGEM: Record<string, string> = {
  cron: "gerada pelo sistema",
  link: "escolhida no link",
  painel: "gerada no painel",
};

const STATUS_FATURA: Record<string, { label: string; cor: string }> = {
  pendente:  { label: "em aberto", cor: "text-hud-warn" },
  paga:      { label: "paga",      cor: "text-hud-ok" },
  cancelada: { label: "cancelada", cor: "text-hud-muted" },
  vencida:   { label: "vencida",   cor: "text-hud-err" },
};

const MODELO_WHATSAPP: Record<string, string> = {
  fim_do_teste: "fim do teste",
  cobranca_assinatura: "cobrança",
};

export default function PlataformaPage() {
  const [secret, setSecret] = useState("");
  const [dados, setDados] = useState<{ resumo: Resumo; barbearias: Barbearia[]; assinaturas: Assinaturas; uso: Uso; interessados: Interessados } | null>(null);
  const [loading, setLoading] = useState(false);

  const carregar = async () => {
    if (!secret) { toast.error("Informe a senha-mestra"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/plataforma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const d = await res.json();
      if (res.ok) setDados(d);
      else toast.error(d.error || "Erro ao carregar");
    } catch { toast.error("Erro de conexão"); }
    finally { setLoading(false); }
  };

  const moeda = (v: number) => "R$ " + v.toFixed(2).replace(".", ",");
  const fmtData = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

  if (!dados) {
    return (
      <main className="min-h-screen hud-bg flex items-center justify-center p-4">
        <div className="max-w-sm w-full space-y-4">
          <div className="text-center space-y-1">
            <div className="text-4xl"><Icon nome="grafico" tamanho={18} /></div>
            <h1 className="text-xl font-bold text-hud-text">Painel da Plataforma</h1>
            <p className="text-sm text-hud-muted">Visão geral de todas as barbearias</p>
          </div>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") carregar(); }}
            placeholder="Senha-mestra"
            className="w-full rounded bg-hud-surface border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none"
          />
          <button
            onClick={carregar}
            disabled={loading}
            className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all"
          >
            {loading ? "Carregando..." : "Entrar"}
          </button>
        </div>
      </main>
    );
  }

  const r = dados.resumo;

  // Quem tem cobranca para acompanhar, do mais urgente para o mais folgado.
  // Cortesia e cancelada ficam de fora: nao ha processo nenhum ali.
  const acompanhar = dados.barbearias
    .filter((b) => b.processo && b.assinatura.estado in URGENCIA)
    .sort(
      (a, b) =>
        URGENCIA[a.assinatura.estado] - URGENCIA[b.assinatura.estado] ||
        a.assinatura.venceEm.localeCompare(b.assinatura.venceEm),
    );

  const saude = [
    { v: String(r.barbearias), l: "Barbearias", cor: "text-hud-text" },
    { v: String(r.ativas), l: "Ativas", cor: "text-hud-ok" },
    { v: String(r.emRisco), l: "Em risco (30d+ paradas)", cor: "text-hud-warn" },
    { v: String(r.semUso), l: "Nunca agendaram", cor: "text-hud-err" },
  ];

  const volume = [
    { v: String(r.agendamentosMes), l: "Agendamentos no mês" },
    { v: moeda(r.receitaMes), l: "Movimentado no mês" },
    { v: String(r.clientesTotal), l: "Clientes cadastrados" },
    { v: String(r.novasEm30Dias), l: "Novas em 30 dias" },
  ];

  return (
    <main className="min-h-screen hud-bg text-hud-text px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex items-end justify-between gap-4 border-b border-hud-border pb-4">
          <div>
            <h1 className="font-display text-[28px] leading-tight text-hud-text">Painel da Plataforma</h1>
            <p className="text-sm text-hud-muted">Como o BarberPro está indo, no total</p>
          </div>
          <button
            onClick={carregar}
            className="hud-focus min-h-[44px] text-sm text-hud-muted border border-hud-border rounded px-3 py-1.5 hover:text-hud-text transition"
          >
            Atualizar
          </button>
        </header>

        {/* Saúde da base */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {saude.map((k) => (
            <div key={k.l} className="hud-card p-4">
              <p className={"text-3xl font-bold " + k.cor}>{k.v}</p>
              <p className="text-xs text-hud-muted mt-1">{k.l}</p>
            </div>
          ))}
        </section>

        {/* Volume */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {volume.map((k) => (
            <div key={k.l} className="hud-card p-4">
              <p className="text-xl font-bold text-hud-light">{k.v}</p>
              <p className="text-xs text-hud-muted mt-1">{k.l}</p>
            </div>
          ))}
        </section>

        {/* Dinheiro da plataforma — o que o BarberPro fatura, não as barbearias */}
        <section className="space-y-3">
          <h2 className="font-display text-[28px] leading-tight text-hud-text">Assinaturas</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-accent)_30%,transparent)] p-4">
              <p className="text-3xl font-bold text-hud-light tabular-nums">
                {dados.assinaturas.mrr.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              {/* Semestral e anual são cobrados de uma vez; aqui entram pela
                  fatia mensal, senão o número pula e não serve de termômetro */}
              <p className="text-xs text-hud-muted mt-1">Por mês (MRR)</p>
            </div>
            <div className="hud-card p-4">
              <p className="text-3xl font-bold text-hud-ok tabular-nums">{dados.assinaturas.pagantes}</p>
              <p className="text-xs text-hud-muted mt-1">Pagantes</p>
            </div>
            <div className="hud-card p-4">
              <p className="text-3xl font-bold text-hud-info tabular-nums">{dados.assinaturas.porEstado.trial || 0}</p>
              <p className="text-xs text-hud-muted mt-1">Em teste grátis</p>
            </div>
            <div className="hud-card p-4">
              <p className="text-3xl font-bold text-hud-warn tabular-nums">
                {dados.assinaturas.valorPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              <p className="text-xs text-hud-muted mt-1">
                {dados.assinaturas.cobrancasPendentes} cobrança{dados.assinaturas.cobrancasPendentes !== 1 ? "s" : ""} em aberto
              </p>
            </div>
          </div>
          {((dados.assinaturas.porEstado.carencia || 0) + (dados.assinaturas.porEstado.bloqueada || 0)) > 0 && (
            <p className="text-sm text-hud-warn flex items-start gap-1.5">
              <Icon nome="alerta" tamanho={16} className="mt-0.5 shrink-0" /> {dados.assinaturas.porEstado.carencia || 0} atrasada(s) e{" "}
              {dados.assinaturas.porEstado.bloqueada || 0} bloqueada(s) — vale uma mensagem antes de virar cancelamento.
            </p>
          )}
        </section>

        {/* O "acompanhar o processo": em que passo cada dono parou. Sem isto
            so dava para ver "pendente" — que nao diz se o WhatsApp saiu, nem
            se ele chegou a abrir o link. */}
        {acompanhar.length > 0 && (
          <section className="space-y-3">
            <div>
              <h2 className="font-display text-[28px] leading-tight text-hud-text">Cobrança, passo a passo</h2>
              <p className="text-xs text-hud-muted">Fatura gerada → aviso no WhatsApp → link aberto → pagamento</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {acompanhar.map((b) => (
                <CartaoCobranca key={b.id} b={b} />
              ))}
            </div>
          </section>
        )}

        {/* Lista */}
        <section className="space-y-3">
          {/* O que prova numa conversa que o produto e usado — nao so
              cadastrado. Barbearia que nao lanca comanda nem recebe
              agendamento pelo link e caderno digital. */}
          <h2 className="font-display text-[28px] leading-tight text-hud-text">Uso do produto</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metrica n={dados.uso.agendamentos.hoje} rotulo="Agendamentos hoje" destaque />
            <Metrica n={dados.uso.agendamentos.sete} rotulo="Nos últimos 7 dias" />
            <Metrica n={dados.uso.agendamentos.trinta} rotulo="Nos últimos 30 dias" />
            <Metrica n={dados.uso.agendamentos.total} rotulo="Desde o início" />
          </div>

          {dados.uso.porMes.length > 0 && (
            <div className="hud-card p-4">
              <p className="text-xs text-hud-muted mb-3">Agendamentos por mês</p>
              <div className="flex items-end gap-2 h-28">
                {dados.uso.porMes.map((m) => {
                  const maior = Math.max(...dados.uso.porMes.map((x) => x.n), 1);
                  return (
                    <div key={m.mes} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-hud-muted tabular-nums">{m.n}</span>
                      <div
                        className="w-full rounded-t gold-fill"
                        style={{ height: `${Math.max(4, (m.n / maior) * 72)}px` }}
                      />
                      <span className="text-[10px] text-hud-muted">{m.mes.slice(5)}/{m.mes.slice(2, 4)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metrica n={dados.uso.comandas} rotulo="Produtos na comanda" />
            <Metrica n={dados.uso.fixos} rotulo="Cortes fixos ativos" />
            <Metrica n={dados.uso.esperas} rotulo="Entradas na lista de espera" />
            <Metrica n={dados.uso.despesas} rotulo="Despesas lançadas" />
            <Metrica n={dados.uso.lembretes} rotulo="Lembretes WhatsApp enviados" />
            <Metrica n={dados.uso.atendimentosPagos} rotulo="Atendimentos pagos" />
            <Metrica
              n={dados.uso.volumeFinanceiro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              rotulo="Movimentado pelas barbearias"
            />
            <Metrica
              n={dados.uso.notaMedia !== null ? `${dados.uso.notaMedia} ★` : "—"}
              rotulo={`Nota média (${dados.uso.avaliacoes} avaliações)`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Metrica n={`${dados.uso.taxaNoShow}%`} rotulo={`Taxa de falta (${dados.uso.noShows})`} />
            <Metrica n={`${dados.uso.taxaCancelamento}%`} rotulo={`Taxa de cancelamento (${dados.uso.cancelados})`} />
          </div>

          <h2 className="font-display text-[28px] leading-tight text-hud-text">Interessados no WhatsApp</h2>
          <div className="grid grid-cols-2 gap-3">
            <Metrica n={dados.interessados.total} rotulo="Falaram com o robô" destaque />
            <Metrica n={dados.interessados.pediramParar} rotulo="Pediram PARAR" />
          </div>
          {dados.interessados.lista.length === 0 ? (
            <p className="text-hud-muted py-4 text-center">Ninguém falou com o robô ainda.</p>
          ) : (
            <div className="space-y-2">
              {dados.interessados.lista.map((i) => (
                <div key={i.telefone} className="hud-card p-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <a href={`https://wa.me/${i.telefone}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-hud-text underline">
                      {i.nome || i.telefone}
                    </a>
                    <span className="text-xs text-hud-muted tabular-nums">{i.telefone}</span>
                    <span className="ml-auto text-xs text-hud-muted">{new Date(i.ultimaMensagemEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                  <p className="text-sm text-hud-soft mt-1">
                    {i.souCliente ? "Disse que é cliente" : ["Etapa " + i.etapa, i.origem, i.papel, i.barbeiros, i.agenda].filter(Boolean).join(" · ")}
                  </p>
                  {i.perguntasNaoEntendidas.length > 0 && (
                    <p className="text-xs text-hud-warn mt-1">Sem resposta: {i.perguntasNaoEntendidas.slice(-3).join(" | ")}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <h2 className="font-display text-[28px] leading-tight text-hud-text">Barbearias</h2>
          {dados.barbearias.length === 0 ? (
            <p className="text-hud-muted py-8 text-center">Nenhuma barbearia cadastrada ainda.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-hud-border">
              <table className="w-full text-sm">
                <thead className="bg-hud-surface text-hud-muted">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Barbearia</th>
                    <th className="text-center px-3 py-3 font-medium">Situação</th>
                    <th className="text-center px-3 py-3 font-medium">Assinatura</th>
                    <th className="text-right px-3 py-3 font-medium">Barbeiros</th>
                    <th className="text-right px-3 py-3 font-medium">Agend.</th>
                    <th className="text-right px-3 py-3 font-medium">No mês</th>
                    <th className="text-right px-4 py-3 font-medium">Último uso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hud-border">
                  {dados.barbearias.map((b) => (
                    <tr key={b.id} className="bg-hud-bg hover:bg-[color-mix(in_srgb,var(--hud-bg)_60%,transparent)] transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-hud-text">{b.nome}</p>
                        <p className="text-xs text-hud-faint">/{b.slug}</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={"text-xs px-2 py-1 rounded-full border " + SITUACAO[b.situacao].cor}>
                          {SITUACAO[b.situacao].label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className={"text-xs px-2 py-1 rounded-full border " + (ASSINATURA_VISUAL[b.assinatura.estado]?.cor || "border-hud-border text-hud-muted")}>
                          {ASSINATURA_VISUAL[b.assinatura.estado]?.label || b.assinatura.estado}
                        </span>
                        {b.assinatura.estado !== "cortesia" && (
                          <p className="text-[10px] text-hud-faint mt-1 tabular-nums">
                            {b.assinatura.diasRestantes}d · {moeda(b.assinatura.valorCiclo)}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-hud-soft">{b.barbeiros}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-hud-soft">{b.agendamentosTotal}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-hud-light">{moeda(b.receitaMes)}</td>
                      <td className="px-4 py-3 text-right text-hud-muted">
                        {fmtData(b.ultimoAgendamento)}
                        {b.diasParado !== null && b.diasParado > 7 && (
                          <span className="block text-xs text-hud-warn">{b.diasParado} dias atrás</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/** Um numero com o rotulo embaixo. Repetido demais para ficar solto. */
function Metrica({ n, rotulo, destaque }: { n: number | string; rotulo: string; destaque?: boolean }) {
  return (
    <div
      className={
        "rounded border p-4 " +
        (destaque ? "bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] border-[color-mix(in_srgb,var(--hud-accent)_30%,transparent)]" : "bg-hud-surface border-hud-border")
      }
    >
      <p className={`text-2xl font-bold tabular-nums ${destaque ? "text-hud-light" : "text-hud-text"}`}>{n}</p>
      <p className="text-xs text-hud-muted mt-1">{rotulo}</p>
    </div>
  );
}

// Horario de Brasilia, nao o do navegador: quem abre o painel viajando
// leria "fatura saiu as 12:00" de um cron que rodou as 9h.
const BRT = "America/Sao_Paulo";
const dia = (s: string) => new Date(s).toLocaleDateString("pt-BR", { timeZone: BRT, day: "2-digit", month: "2-digit" });
const diaHora = (s: string) =>
  new Date(s)
    .toLocaleString("pt-BR", { timeZone: BRT, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    .replace(",", "");
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const plano = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

/** "hoje", "amanhã (06/10)" ou "em 30/10" — no dia de Brasilia. */
function quandoSai(s: string): string {
  const alvo = dia(s);
  if (alvo === dia(new Date().toISOString())) return "hoje";
  if (alvo === dia(new Date(Date.now() + 86_400_000).toISOString())) return `amanhã (${alvo})`;
  return `em ${alvo}`;
}

/** Conversa no WhatsApp com o dono, ja com o link de pagamento na mensagem. */
function chamarNoWhatsapp(b: Barbearia, faturaId: string): string {
  const digitos = b.dono.telefone.replace(/\D/g, "");
  const numero = digitos.length <= 11 ? "55" + digitos : digitos;
  const link = `${window.location.origin}/pagar/${faturaId}`;
  const texto = `Oi, ${b.dono.nome}! Tudo certo? A fatura do BarberPro da ${b.nome} está aqui, é só escolher o plano e pagar: ${link}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/**
 * Um dono, os quatro passos da cobranca e o que vem a seguir.
 *
 * O passo "agora" e o primeiro que falta: e nele que o dono parou, e e ali
 * que vale olhar — ou chamar no WhatsApp.
 */
function CartaoCobranca({ b }: { b: Barbearia }) {
  const p = b.processo!;
  const [fatura, aviso, aberta, paga] = p.etapas;
  const semRodada = p.rodada.length === 0;
  const atual = paga.feito || (semRodada && !p.proximaFatura)
    ? -1
    : p.etapas.findIndex((e) => !e.feito && !e.pulado && !e.falhou);
  const visual = ASSINATURA_VISUAL[b.assinatura.estado];

  const situacao =
    b.assinatura.estado === "trial" && p.trialEndsAt ? `teste até ${dia(p.trialEndsAt)}`
    : b.assinatura.estado === "carencia"
      ? `${p.trialEndsAt ? `teste acabou ${dia(p.trialEndsAt)}` : `venceu ${dia(b.assinatura.venceEm)}`} · bloqueia ${dia(p.bloqueiaEm)}`
    : b.assinatura.estado === "bloqueada" ? `bloqueada desde ${dia(p.bloqueiaEm)}`
    : b.assinatura.estado === "ativa" ? `pago até ${dia(b.assinatura.venceEm)}`
    : "";

  let proximo: ReactNode;
  if (paga.feito) {
    proximo = p.proximaFatura
      ? <>Pago. A próxima fatura sai <b className="text-hud-text">{quandoSai(p.proximaFatura)}</b>, por volta das 9h.</>
      : <>Pago.</>;
  } else if (semRodada) {
    proximo = p.proximaFatura
      ? <>A fatura e o WhatsApp saem <b className="text-hud-text">{quandoSai(p.proximaFatura)}</b>, por volta das 9h.</>
      : <>Nenhuma cobrança prevista.</>;
  } else if (aviso.falhou) {
    proximo = <span className="text-hud-err">O WhatsApp não saiu. Vale chamar {b.dono.nome} direto.</span>;
  } else if (!aberta.feito) {
    proximo = <>Esperando {b.dono.nome} abrir o link.</>;
  } else {
    proximo = <>{b.dono.nome} abriu o link em {diaHora(aberta.quando!)} e ainda não pagou.</>;
  }

  const legenda = (e: Etapa, i: number) => {
    if (e.feito && e.quando) {
      const pix = e.chave === "paga" ? p.rodada.find((f) => f.status === "paga")?.metodo : null;
      return diaHora(e.quando) + (pix ? ` · ${pix === "cartao" ? "cartão" : pix}` : "");
    }
    if (e.falhou) return "não saiu";
    if (e.pulado) return "não precisou";
    if (i === 0 && atual === 0 && p.proximaFatura) return `prevista ${dia(p.proximaFatura)}`;
    return "—";
  };

  const estilo = (e: Etapa, i: number) =>
    e.feito ? "border-hud-ok bg-hud-ok text-[var(--hud-on-accent)]"
    : e.falhou ? "border-hud-err bg-hud-surface text-hud-err"
    : i === atual ? "border-hud-accent bg-hud-surface text-hud-light ring-4 ring-[color-mix(in_srgb,var(--hud-accent)_15%,transparent)]"
    : "border-hud-border bg-hud-surface text-hud-faint";

  return (
    <article className="hud-card space-y-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-hud-text">{b.nome}</p>
          <p className="text-xs text-hud-muted">
            {b.dono.nome} · {plano(b.assinatura.plano)} {reais(b.assinatura.valorCiclo)}
            {situacao && ` · ${situacao}`}
          </p>
        </div>
        <span className={"shrink-0 rounded-full border px-2 py-1 text-xs " + (visual?.cor || "border-hud-border text-hud-muted")}>
          {visual?.label || b.assinatura.estado}
        </span>
      </header>

      <ol className="grid grid-cols-4" aria-label="Passos da cobrança">
        {p.etapas.map((e, i) => {
          const proximoFeito = i < 3 && (p.etapas[i + 1].feito || p.etapas[i + 1].pulado);
          return (
            <li key={e.chave} className="relative flex flex-col items-center text-center">
              {i < 3 && (
                <span
                  aria-hidden
                  className={"absolute left-1/2 top-3.5 h-0.5 w-full " + (proximoFeito ? "bg-[color-mix(in_srgb,var(--hud-ok)_60%,transparent)]" : "bg-[var(--hud-track)]")}
                />
              )}
              <span className={"relative z-10 grid h-7 w-7 place-items-center rounded-full border text-xs font-bold " + estilo(e, i)}>
                {e.feito ? "✓" : e.falhou ? "✕" : e.pulado ? "–" : i + 1}
              </span>
              <span className="mt-2 text-[11px] leading-tight text-hud-soft">{PASSO[e.chave]}</span>
              <span className={"mt-0.5 text-[10px] tabular-nums " + (e.falhou ? "text-hud-err" : "text-hud-muted")}>
                {legenda(e, i)}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-sm text-hud-soft">{proximo}</p>

      {p.faturaAberta && !paga.feito && (
        <a
          href={chamarNoWhatsapp(b, p.faturaAberta)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded border border-[color-mix(in_srgb,var(--hud-ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--hud-ok)_10%,transparent)] px-3 py-1.5 text-xs font-semibold text-hud-ok transition hover:bg-[color-mix(in_srgb,var(--hud-ok)_20%,transparent)]"
        >
          Chamar {b.dono.nome} no WhatsApp
        </a>
      )}

      {!semRodada && (
        <ul className="space-y-1 border-t border-hud-border pt-3 text-[11px] text-hud-muted">
          {p.rodada.map((f) => {
            const st = STATUS_FATURA[f.status] ?? { label: f.status, cor: "text-hud-muted" };
            const zap = f.avisoWhatsapp
              ? f.avisoWhatsapp === "falhou" ? "WhatsApp falhou" : `WhatsApp: ${MODELO_WHATSAPP[f.avisoWhatsapp] ?? f.avisoWhatsapp}`
              : null;
            return (
              <li key={f.id} className="flex flex-wrap gap-x-1.5">
                <span className="tabular-nums text-hud-muted">{diaHora(f.criadaEm)}</span>
                <span>·</span>
                <span className="text-hud-soft">{plano(f.plano)} {reais(f.valor)}</span>
                {f.origem && <><span>·</span><span>{ORIGEM[f.origem] ?? f.origem}</span></>}
                {zap && <><span>·</span><span className={f.avisoWhatsapp === "falhou" ? "text-hud-err" : ""}>{zap}</span></>}
                <span>·</span>
                <span className={st.cor}>{st.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
