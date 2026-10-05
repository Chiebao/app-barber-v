import { REGUA_COBRANCA } from "@/app/lib/assinatura";

/**
 * Em que passo da cobranca cada barbearia esta — para o painel da plataforma.
 *
 * A pergunta do dia seguinte a um vencimento e sempre a mesma: a fatura
 * saiu? o WhatsApp foi? ele abriu o link? pagou? "Pendente" nao responde
 * nenhuma delas. Tudo aqui e derivado das faturas gravadas.
 */

const DIA_MS = 86_400_000;

export interface FaturaDoProcesso {
  id: string;
  createdAt: Date;
  status: string;
  plano: string;
  valor: number;
  pagaEm: Date | null;
  metodo: string | null;
  origem: string | null;
  avisadaEm: Date | null;
  avisoWhatsapp: string | null;
  abertaEm: Date | null;
}

export type ChaveEtapa = "fatura" | "aviso" | "aberta" | "paga";

export interface Etapa {
  chave: ChaveEtapa;
  feito: boolean;
  /** Tentou e nao saiu — hoje so o WhatsApp tem como falhar. */
  falhou: boolean;
  /** Nao aconteceu, mas um passo DEPOIS dele aconteceu: nao faz falta. */
  pulado: boolean;
  quando: Date | null;
}

/**
 * As faturas da rodada atual, da mais antiga para a mais nova.
 *
 * Uma rodada termina num pagamento. Andando da mais nova para tras, para na
 * primeira paga que NAO seja a mais nova: essa ja e a rodada anterior. Se a
 * mais nova e a paga, a rodada e ela e o que veio antes — inclusive a do
 * plano que ele nao escolheu, que o pagamento cancelou e que carrega o aviso.
 */
export function rodadaAtual(faturas: FaturaDoProcesso[]): FaturaDoProcesso[] {
  const recentes = [...faturas].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const rodada: FaturaDoProcesso[] = [];
  for (const f of recentes) {
    if (f.status === "paga" && rodada.length > 0) break;
    rodada.push(f);
  }
  return rodada.reverse();
}

function maisCedo(datas: (Date | null)[]): Date | null {
  return datas.reduce<Date | null>((m, d) => (d && (!m || d < m) ? d : m), null);
}

/** Os quatro passos da rodada: fatura, aviso, abertura do link, pagamento. */
export function etapasDa(rodada: FaturaDoProcesso[]): Etapa[] {
  const avisoOk = rodada.filter((f) => f.avisadaEm && f.avisoWhatsapp && f.avisoWhatsapp !== "falhou");
  const avisoTentado = rodada.filter((f) => f.avisadaEm);
  const paga = rodada.find((f) => f.status === "paga") ?? null;

  const etapas: Etapa[] = [
    { chave: "fatura", feito: rodada.length > 0, falhou: false, pulado: false, quando: rodada[0]?.createdAt ?? null },
    {
      chave: "aviso",
      feito: avisoOk.length > 0,
      falhou: avisoOk.length === 0 && avisoTentado.length > 0,
      pulado: false,
      quando: maisCedo((avisoOk.length ? avisoOk : avisoTentado).map((f) => f.avisadaEm)),
    },
    { chave: "aberta", feito: rodada.some((f) => f.abertaEm), falhou: false, pulado: false, quando: maisCedo(rodada.map((f) => f.abertaEm)) },
    { chave: "paga", feito: !!paga, falhou: false, pulado: false, quando: paga?.pagaEm ?? null },
  ];

  // Passo que nao aconteceu, com um passo POSTERIOR feito, nao faz falta: o
  // dono que gerou a fatura no painel nao precisava de aviso, e quem pagou
  // pelo painel nunca abriu o link. Cinza ali pareceria pendencia.
  for (let i = 0; i < etapas.length; i++) {
    const depoisFeito = etapas.slice(i + 1).some((e) => e.feito);
    if (!etapas[i].feito && !etapas[i].falhou && depoisFeito) etapas[i].pulado = true;
  }
  return etapas;
}

/** Primeira rodada do agendador no instante `t` ou depois dele. */
function rodadaDoCron(t: Date): Date {
  const r = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), REGUA_COBRANCA.horaUtc));
  if (r < t) r.setUTCDate(r.getUTCDate() + 1);
  return r;
}

/**
 * Quando o cron vai gerar a proxima fatura, se nada mudar ate la.
 *
 * Null quando nao vai: cortesia, cancelada, ou faturas demais em aberto.
 * Mesmas contas do cron, pela mesma `REGUA_COBRANCA` — e uma previsao: o
 * GitHub Actions costuma atrasar alguns minutos, dai o "por volta das 9h".
 */
export function proximaFaturaAutomatica(
  sub: { status: string; periodoFim: Date; canceladaEm: Date | null },
  pendentes: { createdAt: Date }[],
  agora: Date,
): Date | null {
  if (sub.status === "cortesia" || sub.canceladaEm) return null;
  if (pendentes.length >= REGUA_COBRANCA.maxFaturasAbertas) return null;

  // O cron pega quem vence ate `antecedenciaDias` depois da rodada...
  const elegivel = new Date(sub.periodoFim.getTime() - REGUA_COBRANCA.antecedenciaDias * DIA_MS);
  // ...e pula quem ainda tem link aberto com menos de `validadeDias`.
  const maisNova = pendentes.reduce<Date | null>((m, p) => (!m || p.createdAt > m ? p.createdAt : m), null);
  const linkVence = maisNova ? new Date(maisNova.getTime() + REGUA_COBRANCA.validadeDias * DIA_MS) : null;

  let desde = agora;
  if (elegivel > desde) desde = elegivel;
  if (linkVence && linkVence > desde) desde = linkVence;
  return rodadaDoCron(desde);
}
