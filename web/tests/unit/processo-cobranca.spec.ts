import { test, expect } from "@playwright/test";
import { primeiroNome } from "../../src/app/lib/assinatura";
import {
  rodadaAtual,
  etapasDa,
  proximaFaturaAutomatica,
  type FaturaDoProcesso,
} from "../../src/app/lib/processo-cobranca";

/**
 * O "acompanhar a cobranca" do painel da plataforma.
 *
 * Os passos sao derivados das faturas gravadas, e a previsao da proxima
 * fatura repete as contas do cron. Se as duas coisas mentirem, o painel diz
 * "WhatsApp saiu" para quem nao recebeu nada — pior do que nao dizer.
 */

const t = (iso: string) => new Date(iso);

function fatura(parcial: Partial<FaturaDoProcesso> & { createdAt: Date }): FaturaDoProcesso {
  return {
    id: Math.random().toString(36).slice(2),
    status: "pendente", plano: "mensal", valor: 45.9,
    pagaEm: null, metodo: null, origem: "cron",
    avisadaEm: null, avisoWhatsapp: null, abertaEm: null,
    ...parcial,
  };
}

const estado = (etapas: ReturnType<typeof etapasDa>) =>
  etapas.map((e) => (e.feito ? "feito" : e.falhou ? "falhou" : e.pulado ? "pulado" : "falta"));

test.describe("primeiro nome na mensagem", () => {
  test("corta no espaco, nao na letra s", () => {
    // `split(/s+/)` — a barra perdida — fazia "Elias" virar "Elia" no
    // WhatsApp de cobranca. "Eduardo Guilherme" passava inteiro.
    expect(primeiroNome("Elias Henrique")).toBe("Elias");
    expect(primeiroNome("  Eduardo   Guilherme ")).toBe("Eduardo");
    expect(primeiroNome("Murilo Santos")).toBe("Murilo");
    expect(primeiroNome("Ana")).toBe("Ana");
    expect(primeiroNome("")).toBe("");
  });
});

test.describe("passos da cobranca", () => {
  test("sem fatura nenhuma, tudo por fazer", () => {
    expect(estado(etapasDa(rodadaAtual([])))).toEqual(["falta", "falta", "falta", "falta"]);
  });

  test("fatura do cron com WhatsApp entregue, link ainda fechado", () => {
    const r = rodadaAtual([
      fatura({ createdAt: t("2026-10-06T12:03:00Z"), avisadaEm: t("2026-10-06T12:03:05Z"), avisoWhatsapp: "fim_do_teste" }),
    ]);
    const e = etapasDa(r);
    expect(estado(e)).toEqual(["feito", "feito", "falta", "falta"]);
    expect(e[1].quando?.toISOString()).toBe("2026-10-06T12:03:05.000Z");
  });

  test("WhatsApp que nao saiu aparece como falha, nao como pendente", () => {
    const e = etapasDa(rodadaAtual([
      fatura({ createdAt: t("2026-10-06T12:03:00Z"), avisadaEm: t("2026-10-06T12:03:05Z"), avisoWhatsapp: "falhou" }),
    ]));
    expect(estado(e)).toEqual(["feito", "falhou", "falta", "falta"]);
  });

  test("o caminho inteiro: aviso no mensal, escolheu o anual no link e pagou", () => {
    const mensal = fatura({
      createdAt: t("2026-10-06T12:03:00Z"), status: "cancelada",
      avisadaEm: t("2026-10-06T12:03:05Z"), avisoWhatsapp: "fim_do_teste", abertaEm: t("2026-10-06T17:30:00Z"),
    });
    const anual = fatura({
      createdAt: t("2026-10-06T17:31:00Z"), status: "paga", plano: "anual", valor: 358.8, origem: "link",
      abertaEm: t("2026-10-06T17:31:10Z"), pagaEm: t("2026-10-06T17:33:00Z"), metodo: "pix",
    });
    const r = rodadaAtual([anual, mensal]);
    // A cancelada pelo pagamento e da MESMA rodada — e ela que carrega o aviso.
    expect(r.map((f) => f.plano)).toEqual(["mensal", "anual"]);
    const e = etapasDa(r);
    expect(estado(e)).toEqual(["feito", "feito", "feito", "feito"]);
    expect(e[2].quando?.toISOString()).toBe("2026-10-06T17:30:00.000Z");
  });

  test("rodada nova depois de paga nao herda os passos da anterior", () => {
    const r = rodadaAtual([
      fatura({ createdAt: t("2026-10-06T12:03:00Z"), status: "paga", pagaEm: t("2026-10-06T13:00:00Z"),
        avisadaEm: t("2026-10-06T12:03:05Z"), avisoWhatsapp: "fim_do_teste", abertaEm: t("2026-10-06T12:50:00Z") }),
      fatura({ createdAt: t("2026-11-01T12:04:00Z") }),
    ]);
    expect(r).toHaveLength(1);
    expect(estado(etapasDa(r))).toEqual(["feito", "falta", "falta", "falta"]);
  });

  test("pagou pelo painel sem aviso nem link: os passos do meio nao fazem falta", () => {
    const e = etapasDa(rodadaAtual([
      fatura({ createdAt: t("2026-10-20T15:00:00Z"), origem: "painel", status: "paga", pagaEm: t("2026-10-20T15:02:00Z") }),
    ]));
    expect(estado(e)).toEqual(["feito", "pulado", "pulado", "feito"]);
  });
});

test.describe("quando sai a proxima fatura", () => {
  const sub = (periodoFim: string, extra: Partial<{ status: string; canceladaEm: Date | null }> = {}) => ({
    status: "trial", periodoFim: t(periodoFim), canceladaEm: null, ...extra,
  });

  test("teste que acaba amanha: sai na rodada de amanha, 9h de Brasilia", () => {
    const quando = proximaFaturaAutomatica(sub("2026-10-06T03:00:00Z"), [], t("2026-10-05T19:00:00Z"));
    expect(quando?.toISOString()).toBe("2026-10-06T12:00:00.000Z");
  });

  test("antes das 9h de hoje, e ja elegivel: sai hoje", () => {
    const quando = proximaFaturaAutomatica(sub("2026-10-06T03:00:00Z"), [], t("2026-10-05T10:00:00Z"));
    expect(quando?.toISOString()).toBe("2026-10-05T12:00:00.000Z");
  });

  test("vencimento longe: sai cinco dias antes dele", () => {
    const quando = proximaFaturaAutomatica(sub("2026-11-04T00:24:35Z"), [], t("2026-10-05T19:00:00Z"));
    expect(quando?.toISOString()).toBe("2026-10-30T12:00:00.000Z");
  });

  test("link aberto ainda valendo: so depois dos tres dias", () => {
    const quando = proximaFaturaAutomatica(
      sub("2026-10-06T03:00:00Z", { status: "trial" }),
      [{ createdAt: t("2026-10-06T12:05:00Z") }],
      t("2026-10-06T13:00:00Z"),
    );
    expect(quando?.toISOString()).toBe("2026-10-10T12:00:00.000Z");
  });

  test("cortesia, cancelada ou faturas demais em aberto: nao sai", () => {
    const agora = t("2026-10-05T19:00:00Z");
    expect(proximaFaturaAutomatica(sub("2026-10-06T03:00:00Z", { status: "cortesia" }), [], agora)).toBeNull();
    expect(proximaFaturaAutomatica(sub("2026-10-06T03:00:00Z", { canceladaEm: agora }), [], agora)).toBeNull();
    const quatro = [1, 2, 3, 4].map((d) => ({ createdAt: t(`2026-09-2${d}T12:00:00Z`) }));
    expect(proximaFaturaAutomatica(sub("2026-10-06T03:00:00Z"), quatro, agora)).toBeNull();
  });
});
