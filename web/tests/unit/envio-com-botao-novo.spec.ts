import { test, expect } from "@playwright/test";
import { enviarModelo, trocarConsultaDeParar } from "../../src/app/lib/whatsapp-send";

/**
 * A volta atrás quando a Meta ainda não tem o botão.
 *
 * Editar um modelo APROVADO manda ele para revisão de novo, e enquanto ela
 * não sai o que está cadastrado lá pode não ser o que este código espera.
 * Sem a volta, o aviso de vaga não sai — justo enquanto a vaga está aberta.
 */

type Chamada = { componentes: { type: string }[] };

/** Troca o fetch por um que responde o que o teste mandar, e anota as chamadas. */
function fingirMeta(respostas: { ok: boolean; status: number; corpo: string }[]) {
  const chamadas: Chamada[] = [];
  const original = globalThis.fetch;
  let i = 0;

  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    const enviado = JSON.parse(init.body);
    chamadas.push({ componentes: enviado.template.components });
    const r = respostas[Math.min(i++, respostas.length - 1)];
    return {
      ok: r.ok,
      status: r.status,
      text: async () => r.corpo,
    };
  }) as unknown as typeof fetch;

  return { chamadas, restaurar: () => { globalThis.fetch = original; } };
}

const PARAMETRO_DEMAIS = JSON.stringify({
  error: { message: "Number of parameters does not match", code: 132000 },
});
const TOKEN_MORTO = JSON.stringify({
  error: { message: "Error validating access token", code: 190 },
});

test.beforeEach(() => {
  // Teste de unidade não tem banco: ninguém aqui pediu PARAR.
  trocarConsultaDeParar(async () => false);
  process.env.WHATSAPP_API_TOKEN = "token-de-teste";
  process.env.WHATSAPP_PHONE_ID = "000000";
});

test("a Meta sem o botão ainda: reenvia só com o corpo e a mensagem sai", async () => {
  const meta = fingirMeta([
    { ok: false, status: 400, corpo: PARAMETRO_DEMAIS },
    { ok: true, status: 200, corpo: "" },
  ]);
  try {
    const ok = await enviarModelo(
      "5511999999999", "vaga_disponivel",
      ["Maria", "Barbearia do Zé", "12 de setembro", "09:00"], "henrbarber",
    );

    expect(ok, "a mensagem tinha que sair mesmo assim").toBe(true);
    expect(meta.chamadas).toHaveLength(2);
    // A primeira leva o botão; a segunda é só o corpo, que é o formato que
    // a Meta tem aprovado enquanto a edição não passa pela revisão.
    expect(meta.chamadas[0].componentes.map(c => c.type)).toEqual(["body", "button"]);
    expect(meta.chamadas[1].componentes.map(c => c.type)).toEqual(["body"]);
  } finally { meta.restaurar(); }
});

test("depois de aprovado, vai com botão e não tenta de novo", async () => {
  const meta = fingirMeta([{ ok: true, status: 200, corpo: "" }]);
  try {
    const ok = await enviarModelo(
      "5511999999999", "vaga_disponivel",
      ["Maria", "Barbearia do Zé", "12 de setembro", "09:00"], "henrbarber",
    );
    expect(ok).toBe(true);
    expect(meta.chamadas, "uma chamada só — a volta atrás não devia rodar").toHaveLength(1);
  } finally { meta.restaurar(); }
});

test("token morto não vira segunda tentativa", async () => {
  // Repetir aqui não melhora nada e só gastaria a chamada. É o motivo de a
  // volta atrás olhar o ERRO em vez de simplesmente tentar de novo.
  const meta = fingirMeta([{ ok: false, status: 401, corpo: TOKEN_MORTO }]);
  try {
    const ok = await enviarModelo(
      "5511999999999", "vaga_disponivel",
      ["Maria", "Barbearia do Zé", "12 de setembro", "09:00"], "henrbarber",
    );
    expect(ok).toBe(false);
    expect(meta.chamadas).toHaveLength(1);
  } finally { meta.restaurar(); }
});

test("modelo sem botão de link nunca ganha uma segunda tentativa", async () => {
  const meta = fingirMeta([{ ok: false, status: 400, corpo: PARAMETRO_DEMAIS }]);
  try {
    const ok = await enviarModelo(
      "5511999999999", "lembrete_agendamento",
      ["João", "Barbearia do Zé", "14:30", "Corte"],
    );
    expect(ok).toBe(false);
    expect(meta.chamadas).toHaveLength(1);
  } finally { meta.restaurar(); }
});
