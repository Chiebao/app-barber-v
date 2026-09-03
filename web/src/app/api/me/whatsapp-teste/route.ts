import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/app/lib/auth";
import { enviarModelo } from "@/app/lib/whatsapp-send";
import { MODELOS, preverTexto, type NomeModelo } from "@/app/lib/whatsapp-templates";
import { situacao, registrarFalha, mensagemDeBloqueio, TESTE_CANAL } from "@/app/lib/limite";

/**
 * Manda cada modelo aprovado para um número, com dados de exemplo.
 *
 * Prova o que só a Meta pode dizer: que o modelo existe com aquele nome,
 * naquele idioma, com aquele número de variáveis, e que a mensagem chega.
 * Já perdemos tempo com envio recusado porque o botão de copiar código
 * carrega {{1}} na URL e o app mandava a variável uma vez só.
 *
 * O que ele NÃO prova: o gatilho. Que o cron acha o agendamento certo, que o
 * cancelamento avisa a fila — isso é o app usando o app, e é teste separado.
 *
 * Só dono, e com limite: cada disparo é dinheiro.
 */

const schema = z.object({
  telefone: z.string().min(10),
  /** Sem isto, manda todos os aprovados. */
  modelo: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    if (payload.role !== "owner") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { telefone, modelo } = schema.parse(await req.json());

    // Por barbearia, não por número de destino: quem paga é a barbearia, e
    // trocar o destino não devia zerar o contador.
    const chave = `teste-canal:${payload.shopId}`;
    const trava = await situacao(chave);
    if (trava.bloqueado) {
      return NextResponse.json({ error: mensagemDeBloqueio(trava.segundos) }, { status: 429 });
    }
    await registrarFalha(chave, TESTE_CANAL);

    const alvos = (modelo ? [modelo] : Object.keys(MODELOS)) as NomeModelo[];
    const resultados: Array<{ modelo: string; enviado: boolean; texto: string }> = [];

    for (const nome of alvos) {
      const m = MODELOS[nome];
      if (!m) {
        resultados.push({ modelo: nome, enviado: false, texto: "modelo desconhecido" });
        continue;
      }
      // Os exemplos do registro são os mesmos que foram cadastrados na Meta,
      // então o que chega no celular é o que ela aprovou.
      const enviado = await enviarModelo(telefone, nome, m.exemplo);
      resultados.push({ modelo: nome, enviado, texto: preverTexto(nome, m.exemplo) });
    }

    return NextResponse.json({
      destino: telefone,
      enviados: resultados.filter((r) => r.enviado).length,
      falhas: resultados.filter((r) => !r.enviado).length,
      resultados,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.errors }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
