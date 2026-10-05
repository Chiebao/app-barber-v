"use client";

import { useState, type ReactNode } from "react";
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
interface Resumo {
  barbearias: number; ativas: number; emRisco: number; semUso: number;
  ativasNaSemana: number; clientesTotal: number; agendamentosMes: number;
  receitaMes: number; novasEm30Dias: number;
}

const ASSINATURA_VISUAL: Record<string, { label: string; cor: string }> = {
  trial:     { label: "Teste",     cor: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  ativa:     { label: "Pagando",   cor: "bg-green-500/15 text-green-400 border-green-500/30" },
  carencia:  { label: "Atrasada",  cor: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  bloqueada: { label: "Bloqueada", cor: "bg-red-500/15 text-red-400 border-red-500/30" },
  cortesia:  { label: "Cortesia",  cor: "bg-brand-500/15 text-brand-400 border-brand-400/30" },
  cancelada: { label: "Cancelada", cor: "bg-gray-700/40 text-gray-400 border-gray-600" },
};

const SITUACAO = {
  ativa:    { label: "Ativa",    cor: "bg-green-500/15 text-green-400 border-green-500/30" },
  em_risco: { label: "Em risco", cor: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  sem_uso:  { label: "Sem uso",  cor: "bg-red-500/15 text-red-400 border-red-500/30" },
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
  pendente:  { label: "em aberto", cor: "text-yellow-400" },
  paga:      { label: "paga",      cor: "text-green-400" },
  cancelada: { label: "cancelada", cor: "text-gray-500" },
  vencida:   { label: "vencida",   cor: "text-red-400" },
};

const MODELO_WHATSAPP: Record<string, string> = {
  fim_do_teste: "fim do teste",
  cobranca_assinatura: "cobrança",
};

export default function PlataformaPage() {
  const [secret, setSecret] = useState("");
  const [dados, setDados] = useState<{ resumo: Resumo; barbearias: Barbearia[]; assinaturas: Assinaturas; uso: Uso } | null>(null);
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
      <main className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        <div className="max-w-sm w-full space-y-4">
          <div className="text-center space-y-1">
            <div className="text-4xl">📊</div>
            <h1 className="text-xl font-bold text-white">Painel da Plataforma</h1>
            <p className="text-sm text-gray-500">Visão geral de todas as barbearias</p>
          </div>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") carregar(); }}
            placeholder="Senha-mestra"
            className="w-full rounded-xl bg-dark-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-600 focus:border-brand-400 focus:outline-none"
          />
          <button
            onClick={carregar}
            disabled={loading}
            className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all"
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
    { v: String(r.barbearias), l: "Barbearias", cor: "text-white" },
    { v: String(r.ativas), l: "Ativas", cor: "text-green-400" },
    { v: String(r.emRisco), l: "Em risco (30d+ paradas)", cor: "text-yellow-400" },
    { v: String(r.semUso), l: "Nunca agendaram", cor: "text-red-400" },
  ];

  const volume = [
    { v: String(r.agendamentosMes), l: "Agendamentos no mês" },
    { v: moeda(r.receitaMes), l: "Movimentado no mês" },
    { v: String(r.clientesTotal), l: "Clientes cadastrados" },
    { v: String(r.novasEm30Dias), l: "Novas em 30 dias" },
  ];

  return (
    <main className="min-h-screen bg-dark-900 text-white px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex items-end justify-between gap-4 border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-brand-400">Painel da Plataforma</h1>
            <p className="text-sm text-gray-500">Como o BarberPro está indo, no total</p>
          </div>
          <button
            onClick={carregar}
            className="text-sm text-gray-400 border border-gray-700 rounded-lg px-3 py-1.5 hover:text-white transition"
          >
            Atualizar
          </button>
        </header>

        {/* Saúde da base */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {saude.map((k) => (
            <div key={k.l} className="rounded-xl bg-dark-800 border border-gray-700 p-4">
              <p className={"text-3xl font-bold " + k.cor}>{k.v}</p>
              <p className="text-xs text-gray-500 mt-1">{k.l}</p>
            </div>
          ))}
        </section>

        {/* Volume */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {volume.map((k) => (
            <div key={k.l} className="rounded-xl bg-dark-800 border border-gray-700 p-4">
              <p className="text-xl font-bold text-brand-400">{k.v}</p>
              <p className="text-xs text-gray-500 mt-1">{k.l}</p>
            </div>
          ))}
        </section>

        {/* Dinheiro da plataforma — o que o BarberPro fatura, não as barbearias */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Assinaturas</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-brand-500/10 border border-brand-400/30 p-4">
              <p className="text-3xl font-bold text-brand-400 tabular-nums">
                {dados.assinaturas.mrr.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              {/* Semestral e anual são cobrados de uma vez; aqui entram pela
                  fatia mensal, senão o número pula e não serve de termômetro */}
              <p className="text-xs text-gray-500 mt-1">Por mês (MRR)</p>
            </div>
            <div className="rounded-xl bg-dark-800 border border-gray-700 p-4">
              <p className="text-3xl font-bold text-green-400 tabular-nums">{dados.assinaturas.pagantes}</p>
              <p className="text-xs text-gray-500 mt-1">Pagantes</p>
            </div>
            <div className="rounded-xl bg-dark-800 border border-gray-700 p-4">
              <p className="text-3xl font-bold text-blue-400 tabular-nums">{dados.assinaturas.porEstado.trial || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Em teste grátis</p>
            </div>
            <div className="rounded-xl bg-dark-800 border border-gray-700 p-4">
              <p className="text-3xl font-bold text-yellow-400 tabular-nums">
                {dados.assinaturas.valorPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {dados.assinaturas.cobrancasPendentes} cobrança{dados.assinaturas.cobrancasPendentes !== 1 ? "s" : ""} em aberto
              </p>
            </div>
          </div>
          {((dados.assinaturas.porEstado.carencia || 0) + (dados.assinaturas.porEstado.bloqueada || 0)) > 0 && (
            <p className="text-sm text-yellow-400">
              ⚠️ {dados.assinaturas.porEstado.carencia || 0} atrasada(s) e{" "}
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
              <h2 className="text-lg font-semibold">Cobrança, passo a passo</h2>
              <p className="text-xs text-gray-500">Fatura gerada → aviso no WhatsApp → link aberto → pagamento</p>
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
          <h2 className="text-lg font-semibold">Uso do produto</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metrica n={dados.uso.agendamentos.hoje} rotulo="Agendamentos hoje" destaque />
            <Metrica n={dados.uso.agendamentos.sete} rotulo="Nos últimos 7 dias" />
            <Metrica n={dados.uso.agendamentos.trinta} rotulo="Nos últimos 30 dias" />
            <Metrica n={dados.uso.agendamentos.total} rotulo="Desde o início" />
          </div>

          {dados.uso.porMes.length > 0 && (
            <div className="rounded-xl bg-dark-800 border border-gray-700 p-4">
              <p className="text-xs text-gray-500 mb-3">Agendamentos por mês</p>
              <div className="flex items-end gap-2 h-28">
                {dados.uso.porMes.map((m) => {
                  const maior = Math.max(...dados.uso.porMes.map((x) => x.n), 1);
                  return (
                    <div key={m.mes} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-400 tabular-nums">{m.n}</span>
                      <div
                        className="w-full rounded-t bg-brand-500"
                        style={{ height: `${Math.max(4, (m.n / maior) * 72)}px` }}
                      />
                      <span className="text-[10px] text-gray-500">{m.mes.slice(5)}/{m.mes.slice(2, 4)}</span>
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

          <h2 className="text-lg font-semibold">Barbearias</h2>
          {dados.barbearias.length === 0 ? (
            <p className="text-gray-500 py-8 text-center">Nenhuma barbearia cadastrada ainda.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-dark-800 text-gray-400">
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
                <tbody className="divide-y divide-gray-800">
                  {dados.barbearias.map((b) => (
                    <tr key={b.id} className="bg-dark-900 hover:bg-dark-800/60 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{b.nome}</p>
                        <p className="text-xs text-gray-600">/{b.slug}</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={"text-xs px-2 py-1 rounded-full border " + SITUACAO[b.situacao].cor}>
                          {SITUACAO[b.situacao].label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className={"text-xs px-2 py-1 rounded-full border " + (ASSINATURA_VISUAL[b.assinatura.estado]?.cor || "border-gray-700 text-gray-400")}>
                          {ASSINATURA_VISUAL[b.assinatura.estado]?.label || b.assinatura.estado}
                        </span>
                        {b.assinatura.estado !== "cortesia" && (
                          <p className="text-[10px] text-gray-600 mt-1 tabular-nums">
                            {b.assinatura.diasRestantes}d · {moeda(b.assinatura.valorCiclo)}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-300">{b.barbeiros}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-300">{b.agendamentosTotal}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-brand-400">{moeda(b.receitaMes)}</td>
                      <td className="px-4 py-3 text-right text-gray-400">
                        {fmtData(b.ultimoAgendamento)}
                        {b.diasParado !== null && b.diasParado > 7 && (
                          <span className="block text-xs text-yellow-500">{b.diasParado} dias atrás</span>
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
        "rounded-xl border p-4 " +
        (destaque ? "bg-brand-500/10 border-brand-400/30" : "bg-dark-800 border-gray-700")
      }
    >
      <p className={`text-2xl font-bold tabular-nums ${destaque ? "text-brand-400" : "text-white"}`}>{n}</p>
      <p className="text-xs text-gray-500 mt-1">{rotulo}</p>
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
      ? <>Pago. A próxima fatura sai <b className="text-white">{quandoSai(p.proximaFatura)}</b>, por volta das 9h.</>
      : <>Pago.</>;
  } else if (semRodada) {
    proximo = p.proximaFatura
      ? <>A fatura e o WhatsApp saem <b className="text-white">{quandoSai(p.proximaFatura)}</b>, por volta das 9h.</>
      : <>Nenhuma cobrança prevista.</>;
  } else if (aviso.falhou) {
    proximo = <span className="text-red-300">O WhatsApp não saiu. Vale chamar {b.dono.nome} direto.</span>;
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
    e.feito ? "border-green-500 bg-green-500 text-dark-900"
    : e.falhou ? "border-red-500 bg-dark-800 text-red-400"
    : i === atual ? "border-brand-400 bg-dark-800 text-brand-400 ring-4 ring-brand-500/15"
    : "border-gray-700 bg-dark-800 text-gray-600";

  return (
    <article className="space-y-4 rounded-xl border border-gray-700 bg-dark-800 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{b.nome}</p>
          <p className="text-xs text-gray-500">
            {b.dono.nome} · {plano(b.assinatura.plano)} {reais(b.assinatura.valorCiclo)}
            {situacao && ` · ${situacao}`}
          </p>
        </div>
        <span className={"shrink-0 rounded-full border px-2 py-1 text-xs " + (visual?.cor || "border-gray-700 text-gray-400")}>
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
                  className={"absolute left-1/2 top-3.5 h-0.5 w-full " + (proximoFeito ? "bg-green-500/60" : "bg-gray-700")}
                />
              )}
              <span className={"relative z-10 grid h-7 w-7 place-items-center rounded-full border text-xs font-bold " + estilo(e, i)}>
                {e.feito ? "✓" : e.falhou ? "✕" : e.pulado ? "–" : i + 1}
              </span>
              <span className="mt-2 text-[11px] leading-tight text-gray-300">{PASSO[e.chave]}</span>
              <span className={"mt-0.5 text-[10px] tabular-nums " + (e.falhou ? "text-red-400" : "text-gray-500")}>
                {legenda(e, i)}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-sm text-gray-300">{proximo}</p>

      {p.faturaAberta && !paga.feito && (
        <a
          href={chamarNoWhatsapp(b, p.faturaAberta)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-400 transition hover:bg-green-500/20"
        >
          Chamar {b.dono.nome} no WhatsApp
        </a>
      )}

      {!semRodada && (
        <ul className="space-y-1 border-t border-gray-700/60 pt-3 text-[11px] text-gray-500">
          {p.rodada.map((f) => {
            const st = STATUS_FATURA[f.status] ?? { label: f.status, cor: "text-gray-400" };
            const zap = f.avisoWhatsapp
              ? f.avisoWhatsapp === "falhou" ? "WhatsApp falhou" : `WhatsApp: ${MODELO_WHATSAPP[f.avisoWhatsapp] ?? f.avisoWhatsapp}`
              : null;
            return (
              <li key={f.id} className="flex flex-wrap gap-x-1.5">
                <span className="tabular-nums text-gray-400">{diaHora(f.criadaEm)}</span>
                <span>·</span>
                <span className="text-gray-300">{plano(f.plano)} {reais(f.valor)}</span>
                {f.origem && <><span>·</span><span>{ORIGEM[f.origem] ?? f.origem}</span></>}
                {zap && <><span>·</span><span className={f.avisoWhatsapp === "falhou" ? "text-red-400" : ""}>{zap}</span></>}
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
