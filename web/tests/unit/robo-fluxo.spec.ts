import { test, expect } from "@playwright/test";
import fs from "fs";
import { decidir, normalizar, type Contexto, type EstadoDaConversa } from "../../src/app/lib/robo-fluxo";
import * as T from "../../src/app/lib/robo-textos";
import { telefoneCanonico, variantesDoTelefone } from "../../src/app/lib/telefone";
import { PLANOS } from "../../src/app/lib/assinatura";

/**
 * A ordem de quem responde, sem banco e sem envio.
 *
 * A mesma linha recebe interessado, cliente de barbearia e quem tem conta. Errar
 * aqui é mandar o preço do BarberPro para quem perguntou quanto custa o corte.
 */

const AGORA = new Date("2026-11-01T15:00:00.000Z");
const HORA = 60 * 60 * 1000;
const antes = (horas: number) => new Date(AGORA.getTime() - horas * HORA);

const CLIENTE = {
  barbearia: { name: "HenrBarber", phone: "15911112222", slug: "henrbarber" },
  quando: { date: new Date("2026-11-02T00:00:00.000Z"), startTime: "10:00" },
};
const CONTA = { criadaEm: antes(24 * 90) };

function conversa(campos: Partial<EstadoDaConversa> = {}): EstadoDaConversa {
  return {
    etapa: "p1",
    origem: "direto",
    papel: null,
    barbeiros: null,
    agenda: null,
    perguntasNaoEntendidas: [],
    naoEntendidasSeguidas: 0,
    souClienteEm: null,
    iniciadaEm: antes(1),
    ultimaMensagemEm: antes(1),
    encerradaEm: null,
    ...campos,
  };
}

function ctx(texto: string, campos: Partial<Contexto> = {}): Contexto {
  return {
    mensagem: { tipo: "texto", texto },
    agora: AGORA,
    pediuParar: false,
    conversa: null,
    conta: null,
    cliente: null,
    ...campos,
  };
}

function botao(id: keyof typeof T.BOTOES, campos: Partial<Contexto> = {}): Contexto {
  return ctx("", { mensagem: { tipo: "botao", texto: T.BOTOES[id].titulo, botaoId: id }, ...campos });
}

const AUDIO: Contexto["mensagem"] = { tipo: "midia", texto: "[audio] o cliente mandou um áudio" };

test.describe("Tabela de ordem: cada linha cai na resposta certa", () => {
  test("2. PARAR, sozinho ou em frase, vale para todo mundo", () => {
    for (const t of ["PARAR", "Pare", "sair", "quero parar de receber", "Não quero mais receber isso", "me tira, sair da lista", "cancelar inscrição"]) {
      const d = decidir(ctx(t));
      expect(d.ordem, t).toBe(2);
      expect(d.parar).toBe("registrar");
      expect(d.mensagens).toEqual([T.PARAR_DEMAIS]);
    }
    // Só a palavra sozinha: "sair" no meio de uma frase não é pedido.
    expect(decidir(ctx("que horas vou sair daqui")).parar).toBeUndefined();
  });

  test("2. o texto do PARAR vai pelo cadastro, e conversa aberta não muda a escolha", () => {
    expect(decidir(ctx("parar", { conta: CONTA, cliente: CLIENTE })).mensagens).toEqual([T.PARAR_CONTA]);

    const deCliente = decidir(ctx("parar", { cliente: CLIENTE, conversa: conversa() }));
    expect(deCliente.mensagens[0].texto).toContain("https://wa.me/5515911112222");
    expect(deCliente.comBarbearia).toBe(true);
    expect(deCliente.conversa?.encerradaEm).toEqual(AGORA);

    expect(decidir(ctx("parar", { conversa: conversa() })).mensagens).toEqual([T.PARAR_DEMAIS]);
  });

  test("2. cliente de barbearia sem telefone recebe o link de Meus agendamentos", () => {
    const d = decidir(ctx("parar", { cliente: { ...CLIENTE, barbearia: { ...CLIENTE.barbearia, phone: null } } }));
    expect(d.mensagens[0].texto).toContain("/henrbarber/meus-agendamentos");
  });

  test("3. VOLTAR com pedido registrado desfaz", () => {
    const d = decidir(ctx("voltar", { pediuParar: true }));
    expect(d.ordem).toBe(3);
    expect(d.parar).toBe("desfazer");
    expect(d.mensagens).toEqual([T.VOLTAR_DEMAIS]);
    expect(decidir(ctx("VOLTAR", { pediuParar: true, cliente: CLIENTE })).mensagens).toEqual([T.VOLTAR_COM_CADASTRO]);
    expect(decidir(ctx("VOLTAR", { pediuParar: true, conta: CONTA })).mensagens).toEqual([T.VOLTAR_COM_CADASTRO]);
  });

  test("6 do pedido. VOLTAR sem pedido registrado é mensagem comum", () => {
    const d = decidir(ctx("voltar"));
    expect(d.ordem).toBe(11);
    expect(d.parar).toBeUndefined();
    expect(decidir(ctx("voltar", { cliente: CLIENTE })).ordem).toBe(7);
  });

  test("4. as mensagens prontas abrem a conversa", () => {
    const insta = decidir(ctx(T.MENSAGEM_DO_INSTAGRAM));
    expect(insta.ordem).toBe(4);
    expect(insta.mensagens[0].texto).toContain("Vi que você veio do Instagram");
    expect(insta.conversa?.origem).toBe("instagram");

    const site = decidir(ctx(T.MENSAGEM_DO_SITE));
    expect(site.ordem).toBe(4);
    expect(site.mensagens[0].texto).not.toContain("Instagram");
    expect(site.conversa?.origem).toBe("site");

    expect(decidir(ctx("barberpro")).conversa?.origem).toBe("barberpro");
  });

  test("4. só desfaz o PARAR de quem não é cliente nem tem conta", () => {
    expect(decidir(ctx("BARBERPRO", { pediuParar: true })).parar).toBe("desfazer");
    expect(decidir(ctx("BARBERPRO", { pediuParar: true, cliente: CLIENTE })).parar).toBeUndefined();
    expect(decidir(ctx("BARBERPRO", { pediuParar: true, conta: CONTA })).parar).toBeUndefined();
  });

  test("5. conversa aberta continua de onde parou", () => {
    const d = decidir(ctx("Só eu", { conversa: conversa({ etapa: "p2", papel: "sou_dono" }) }));
    expect(d.ordem).toBe(5);
    expect(d.mensagens).toEqual([T.P3]);
  });

  test("5. quem é cliente: só botão e palavra-chave comercial seguem na conversa", () => {
    const campos = { cliente: CLIENTE, conversa: conversa({ etapa: "p2", papel: "sou_dono" }) };
    expect(decidir(botao("so_eu", campos)).ordem).toBe(5);
    expect(decidir(ctx("qual o preço", campos)).ordem).toBe(5);
    expect(decidir(ctx("quero um atendente", campos)).ordem).toBe(5);

    const resto = decidir(ctx("vou faltar", campos));
    expect(resto.ordem).toBe(7);
    expect(resto.comBarbearia).toBe(true);
    expect(decidir({ ...ctx("", campos), mensagem: AUDIO }).ordem).toBe(7);
  });

  test("6. quem tem conta recebe a mensagem CONTA", () => {
    const d = decidir(ctx("oi", { conta: CONTA }));
    expect(d.ordem).toBe(6);
    expect(d.mensagens).toEqual([T.CONTA]);
    expect(d.comBarbearia).toBe(false);
  });

  test("7. cliente de barbearia recebe a resposta atual, com a barbearia", () => {
    const d = decidir(ctx("oi", { cliente: CLIENTE }));
    expect(d.ordem).toBe(7);
    expect(d.comBarbearia).toBe(true);
    expect(d.mensagens[0].texto).toBe(
      "Oi! 👋\n\nEsta linha é automática e não é lida por ninguém. 😅\n\n" +
        "Para falar com a *HenrBarber*, é por aqui:\nhttps://wa.me/5515911112222\n\n" +
        "📆 Seu horário: 02/11 às 10:00",
    );
  });

  test("8. desconhecido que pediu PARAR: silêncio, menos ATENDENTE", () => {
    const d = decidir(ctx("oi", { pediuParar: true }));
    expect(d.ordem).toBe(8);
    expect(d.mensagens).toEqual([]);
    expect(decidir(ctx("quanto custa", { pediuParar: true })).mensagens).toEqual([]);

    const atendente = decidir(ctx("ATENDENTE", { pediuParar: true }));
    expect(atendente.ordem).toBe(8);
    expect(atendente.mensagens[0].texto).toContain("wa.me/5515997767794");
  });

  test("9. quem tocou em Sou cliente há menos de 30 dias recebe CLIENTE", () => {
    const fechada = conversa({ souClienteEm: antes(24 * 29), encerradaEm: antes(24 * 29) });
    const d = decidir(ctx("oi", { conversa: fechada }));
    expect(d.ordem).toBe(9);
    expect(d.mensagens).toEqual([T.CLIENTE]);

    const velha = conversa({ souClienteEm: antes(24 * 31), encerradaEm: antes(24 * 31) });
    expect(decidir(ctx("oi", { conversa: velha })).ordem).toBe(11);
  });

  test("10. quem já respondeu as 3 perguntas volta na Oferta, e a conversa reabre", () => {
    const passada = conversa({ etapa: "oferta", papel: "sou_dono", barbeiros: "so_eu", agenda: "caderno", ultimaMensagemEm: antes(30) });
    const d = decidir(ctx("oi", { conversa: passada }));
    expect(d.ordem).toBe(10);
    expect(d.mensagens).toEqual([T.OFERTA]);

    // O botão da Oferta tem de andar, e não cair na ordem 10 de novo.
    const toque = decidir(botao("quero_testar", { conversa: d.conversa! }));
    expect(toque.ordem).toBe(5);
    expect(toque.mensagens).toEqual([T.TESTE]);
  });

  test("11. a primeira mensagem de qualquer número recebe as Boas-vindas", () => {
    for (const texto of ["oi", "quanto custa o corte?", "ATENDENTE"]) {
      const d = decidir(ctx(texto));
      expect(d.ordem, texto).toBe(11);
      expect(d.mensagens).toEqual([T.boasVindas(false)]);
    }
    expect(decidir({ ...ctx(""), mensagem: AUDIO }).ordem).toBe(11);
  });
});

test.describe("Quando a conversa termina", () => {
  test("Sou cliente encerra", () => {
    const d = decidir(botao("sou_cliente", { conversa: conversa() }));
    expect(d.mensagens).toEqual([T.CLIENTE]);
    expect(d.conversa?.encerradaEm).toEqual(AGORA);
    expect(d.conversa?.souClienteEm).toEqual(AGORA);
  });

  test("24 horas sem mensagem encerra", () => {
    const parada = conversa({ etapa: "p2", papel: "sou_dono", ultimaMensagemEm: antes(24) });
    expect(decidir(ctx("Só eu", { conversa: parada })).ordem).toBe(11);
  });

  test("cadastrar-se depois de começar encerra, e quem já tinha conta continua", () => {
    const aberta = conversa({ etapa: "p2", papel: "sou_dono" });
    expect(decidir(ctx("Só eu", { conversa: aberta, conta: { criadaEm: antes(0.5) } })).ordem).toBe(6);
    expect(decidir(ctx("Só eu", { conversa: aberta, conta: { criadaEm: antes(5) } })).ordem).toBe(5);
  });
});

test("o caminho completo: Boas-vindas, P2, P3, Demonstração, Oferta e cada botão", () => {
  const abertura = decidir(ctx("oi"));
  expect(abertura.mensagens[0].botoes?.map((b) => b.titulo)).toEqual(["Sou dono", "Sou barbeiro", "Sou cliente"]);

  const p2 = decidir(botao("sou_dono", { conversa: abertura.conversa! }));
  expect(p2.mensagens).toEqual([T.P2]);

  const p3 = decidir(botao("dois_ou_tres", { conversa: p2.conversa! }));
  expect(p3.mensagens).toEqual([T.P3]);

  const fim = decidir(botao("caderno", { conversa: p3.conversa! }));
  expect(fim.mensagens).toHaveLength(2);
  expect(fim.mensagens[0].texto.startsWith("Entendi, tudo no caderno.\n\nOlha a tela")).toBe(true);
  expect(fim.mensagens[1]).toEqual(T.OFERTA);
  const oferta = fim.conversa!;
  expect([oferta.papel, oferta.barbeiros, oferta.agenda]).toEqual(["sou_dono", "dois_ou_tres", "caderno"]);

  expect(decidir(botao("quero_testar", { conversa: oferta })).mensagens).toEqual([T.TESTE]);
  const precos = decidir(botao("ver_precos", { conversa: oferta }));
  expect(precos.mensagens).toEqual([T.PRECOS]);
  expect(precos.mensagens[0].botoes?.map((b) => b.titulo)).toEqual(["Quero testar", "Tenho uma dúvida"]);
  const duvida = decidir(botao("tenho_duvida", { conversa: oferta }));
  expect(duvida.mensagens).toEqual([T.DUVIDA]);
  expect(duvida.conversa?.etapa).toBe("duvida");
});

test("cada abertura da Demonstração segue a resposta da P3, e sem resposta não tem abertura", () => {
  expect(T.demonstracao("whatsapp").texto.startsWith("Entendi, tudo por mensagem.")).toBe(true);
  expect(T.demonstracao("outro_app").texto.startsWith("Beleza, assim você consegue comparar.")).toBe(true);
  expect(T.demonstracao(null).texto.startsWith("Olha a tela")).toBe(true);
});

test.describe("Perguntas soltas", () => {
  const naP2 = { conversa: conversa({ etapa: "p2", papel: "sou_dono" }) };
  const naOferta = { conversa: conversa({ etapa: "oferta", papel: "sou_dono", barbeiros: "so_eu", agenda: "caderno" }) };

  test("responde e repete a pergunta em que a pessoa estava", () => {
    expect(decidir(ctx("quanto custa?", naP2)).mensagens).toEqual([T.PRECOS, T.P2]);
    expect(decidir(ctx("e o lembrete?", naP2)).mensagens).toEqual([T.LEMBRETE, T.P2]);
    expect(decidir(ctx("tem como baixar", naP2)).mensagens).toEqual([T.BAIXAR, T.P2]);
  });

  test("depois das perguntas, oferece os botões da Oferta", () => {
    expect(decidir(ctx("e o furo?", naOferta)).mensagens).toEqual([T.FALTA, T.OFERTA]);
    expect(decidir(ctx("no-show", naOferta)).mensagens).toEqual([T.FALTA, T.OFERTA]);
    expect(decidir(ctx("é grátis?", naOferta)).mensagens).toEqual([T.TESTE, T.OFERTA]);
    // PREÇOS já traz os botões: não manda o mesmo convite duas vezes.
    expect(decidir(ctx("preço", naOferta)).mensagens).toEqual([T.PRECOS]);
    const demo = decidir(ctx("como funciona", naOferta)).mensagens;
    expect(demo[0].texto.startsWith("Entendi, tudo no caderno.")).toBe(true);
    expect(demo[1]).toEqual(T.OFERTA);
  });

  test("palavra inteira: faltar não é falta", () => {
    expect(decidir(ctx("vou faltar", naOferta)).mensagens).toEqual([T.NAO_ENTENDI]);
  });

  test("áudio, foto ou arquivo pedem texto e não contam como não entendi", () => {
    const d = decidir({ ...ctx("", naP2), mensagem: AUDIO });
    expect(d.mensagens).toEqual([T.MIDIA]);
    expect(d.conversa?.naoEntendidasSeguidas).toBe(0);
  });
});

test.describe("Não entendi e ATENDENTE", () => {
  test("dois seguidos levam a ATENDENTE, com o resumo do que a pessoa respondeu", () => {
    const inicio = conversa({ etapa: "oferta", papel: "sou_dono", barbeiros: "dois_ou_tres", agenda: "caderno" });
    const primeira = decidir(ctx("aceita vale refeição?", { conversa: inicio }));
    expect(primeira.mensagens).toEqual([T.NAO_ENTENDI]);
    expect(primeira.conversa?.naoEntendidasSeguidas).toBe(1);

    const segunda = decidir(ctx("e bitcoin?", { conversa: primeira.conversa! }));
    const link = new URL(segunda.mensagens[0].texto.split("\n")[1]);
    expect(link.origin + link.pathname).toBe("https://wa.me/5515997767794");
    expect(link.searchParams.get("text")).toBe("Oi, vim do atendimento automático. Sou dono, 2 ou 3 barbeiros, agenda no caderno.");
    // As duas ficam guardadas, para sabermos o que falta responder.
    expect(segunda.conversa?.perguntasNaoEntendidas).toEqual(["aceita vale refeição?", "e bitcoin?"]);
    expect(segunda.conversa?.naoEntendidasSeguidas).toBe(0);
  });

  test("entender algo no meio zera a contagem", () => {
    const uma = decidir(ctx("xyz", { conversa: conversa({ etapa: "oferta" }) }));
    const meio = decidir(ctx("preço", { conversa: uma.conversa! }));
    expect(decidir(ctx("xyz", { conversa: meio.conversa! })).mensagens).toEqual([T.NAO_ENTENDI]);
  });

  test("ATENDENTE, PESSOA, HUMANO e o botão levam ao mesmo lugar", () => {
    const aberta = { conversa: conversa() };
    const padrao = "Oi, vim do atendimento automático e quero falar sobre o BarberPro.";
    for (const c of [ctx("ATENDENTE", aberta), ctx("quero falar com uma pessoa", aberta), ctx("humano", aberta), botao("falar_com_pessoa", aberta)]) {
      const url = new URL(decidir(c).mensagens[0].texto.split("\n")[1]);
      expect(url.searchParams.get("text")).toBe(padrao);
    }
  });
});

test.describe("Cliente de barbearia nunca recebe o comercial", () => {
  for (const texto of ["quanto custa o corte?", "vou faltar", "a falta foi marcada errada", "ATENDENTE"]) {
    test(`"${texto}" recebe a resposta atual`, () => {
      const d = decidir(ctx(texto, { cliente: CLIENTE }));
      expect(d.ordem).toBe(7);
      const tudo = d.mensagens.map((m) => m.texto).join("\n");
      expect(tudo).toContain("Esta linha é automática");
      expect(tudo).not.toContain("R$");
      expect(tudo).not.toContain("Pix");
      expect(d.conversa).toBeUndefined();
    });
  }
});

test.describe("Limites da Meta e coerência dos textos", () => {
  const todas = [
    T.boasVindas(true), T.boasVindas(false), T.P1, T.P2, T.P3, T.demonstracao("caderno"), T.OFERTA, T.DUVIDA,
    T.TESTE, T.PRECOS, T.CLIENTE, T.CONTA, T.PARAR_CONTA, T.pararCliente("https://wa.me/5515911112222"),
    T.PARAR_DEMAIS, T.VOLTAR_COM_CADASTRO, T.VOLTAR_DEMAIS, T.LEMBRETE, T.FALTA, T.BAIXAR, T.NAO_ENTENDI, T.MIDIA,
    T.atendente({ papel: "sou_barbeiro", barbeiros: "quatro_ou_mais", agenda: "outro_app" }),
  ];

  test("todo botão tem até 20 caracteres", () => {
    for (const b of Object.values(T.BOTOES)) expect(b.titulo.length, b.titulo).toBeLessThanOrEqual(20);
  });

  test("toda mensagem tem até 3 botões e até 1.024 caracteres", () => {
    for (const m of todas) {
      expect((m.botoes ?? []).length, m.texto).toBeLessThanOrEqual(3);
      expect(m.texto.length, m.texto).toBeLessThanOrEqual(1024);
    }
  });

  test("os preços do robô batem com o catálogo", () => {
    const reais = (v: number) => v.toFixed(2).replace(".", ",");
    for (const plano of Object.values(PLANOS)) {
      expect(T.PRECOS.texto).toContain(`R$ ${reais(plano.mensal)} por mês`);
      if (plano.mesesCobranca > 1) {
        expect(T.PRECOS.texto).toContain(`R$ ${reais(plano.mensal * plano.mesesCobranca)}`);
      }
    }
  });

  test("a mensagem pronta do site é a mesma da página de vendas", () => {
    const pagina = fs.readFileSync("src/app/page.tsx", "utf8");
    expect(pagina).toContain(`const CONVITE = "${T.MENSAGEM_DO_SITE}";`);
    expect(normalizar(T.MENSAGEM_DO_SITE)).toBe("oi quero saber mais sobre o barberpro");
  });
});

test.describe("Telefone", () => {
  test("com ou sem 55 e com ou sem o 9º dígito, é a mesma chave", () => {
    for (const t of ["15991234567", "5515991234567", "1591234567", "551591234567", "+55 (15) 99123-4567"]) {
      expect(telefoneCanonico(t), t).toBe("5515991234567");
    }
  });

  test("as variantes cobrem as quatro grafias do celular", () => {
    expect(new Set(variantesDoTelefone("551591234567"))).toEqual(
      new Set(["1591234567", "551591234567", "15991234567", "5515991234567"]),
    );
  });

  test("telefone fixo não ganha o 9", () => {
    expect(telefoneCanonico("1532123456")).toBe("551532123456");
    expect(new Set(variantesDoTelefone("1532123456"))).toEqual(new Set(["1532123456", "551532123456"]));
  });
});
