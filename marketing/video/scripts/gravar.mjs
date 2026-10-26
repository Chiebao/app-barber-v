// Grava o app DE VERDADE numa tela de celular e guarda, junto do vídeo, onde
// e quando cada toque aconteceu — o Remotion usa isso para desenhar o círculo
// do dedo e aproximar a câmera no lugar certo.
//
// Uso: node scripts/gravar.mjs <cena>   (cenas em scripts/cenas.mjs)
//
// Grava pelo screencast do Chrome (JPEG por quadro, em 3x) e não pelo
// recordVideo do Playwright: aquele sai em VP8 de bitrate baixo e o texto da
// tela fica borrado quando a câmera aproxima.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CENAS } from "./cenas.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://localhost:3100";
const FPS = 30;
const LARGURA = 390, ALTURA = 844, ESCALA = 3;

const nome = process.argv[2];
const cena = CENAS[nome];
if (!cena) {
  console.error(`Cena desconhecida. Opções: ${Object.keys(CENAS).join(", ")}`);
  process.exit(1);
}

const ffmpeg = process.env.FFMPEG || "ffmpeg";
const pastaQuadros = path.join(raiz, "gravacoes", `${nome}-quadros`);
rmSync(pastaQuadros, { recursive: true, force: true });
mkdirSync(pastaQuadros, { recursive: true });

const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: LARGURA, height: ALTURA },
  deviceScaleFactor: ESCALA,
  isMobile: true,
  hasTouch: true,
  locale: "pt-BR",
  timezoneId: "America/Sao_Paulo",
});
const pagina = await contexto.newPage();

// Abre ANTES de gravar: o carregamento não entra no vídeo.
await pagina.goto(BASE + cena.url, { waitUntil: "networkidle" });
await pagina.addStyleTag({ content: "::-webkit-scrollbar{display:none} *{scrollbar-width:none} html{-webkit-tap-highlight-color:transparent}" });
await pagina.waitForTimeout(600);

const cdp = await contexto.newCDPSession(pagina);
const quadros = []; // { arquivo, t } — t em segundos (relógio do Chrome)
let inicio = null;
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  const t = metadata.timestamp;
  if (inicio === null) inicio = t;
  const arquivo = `q${String(quadros.length).padStart(5, "0")}.jpg`;
  writeFileSync(path.join(pastaQuadros, arquivo), Buffer.from(data, "base64"));
  quadros.push({ arquivo, t: t - inicio });
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", {
  format: "jpeg", quality: 92,
  maxWidth: LARGURA * ESCALA, maxHeight: ALTURA * ESCALA, everyNthFrame: 1,
});

// O relógio dos eventos é o mesmo dos quadros: o primeiro quadro chega logo
// depois do startScreencast; o desvio é de poucos ms.
const t0 = Date.now();
const agora = () => (Date.now() - t0) / 1000;
const eventos = [];
// Esperas de rede que saem do vídeo: fica só um instante do "carregando",
// o resto é cortado (servidor de prévia é mais lento que produção).
const cortes = [];
const SOBRA = 0.35;

const ctx = {
  pagina,
  espera: (ms) => pagina.waitForTimeout(ms),
  async toque(alvo, { rotulo } = {}) {
    const el = typeof alvo === "string" ? pagina.locator(alvo).first() : alvo.first();
    await el.scrollIntoViewIfNeeded();
    const caixa = await el.boundingBox();
    const x = caixa.x + caixa.width / 2, y = caixa.y + caixa.height / 2;
    eventos.push({ tipo: "toque", t: agora(), x: x / LARGURA, y: y / ALTURA, rotulo: rotulo || null });
    await pagina.waitForTimeout(140); // o círculo aparece um instante antes da tela reagir, como um dedo
    await el.click();
  },
  async digita(alvo, texto, { atraso = 70 } = {}) {
    const el = typeof alvo === "string" ? pagina.locator(alvo).first() : alvo.first();
    await ctx.toque(el);
    eventos.push({ tipo: "digita", t: agora(), texto });
    await el.pressSequentially(texto, { delay: atraso });
  },
  marca(rotulo) {
    eventos.push({ tipo: "marca", t: agora(), rotulo });
  },
  async esperaCortada(promessa) {
    const a = agora();
    await promessa;
    await pagina.waitForTimeout(150); // a tela nova precisa ser pintada antes do fim do corte
    const b = agora();
    if (b - a > SOBRA) cortes.push([a + SOBRA, b]);
  },
};

await pagina.waitForTimeout(500);
await cena.roteiro(ctx);
await pagina.waitForTimeout(800);
const fim = agora();

await cdp.send("Page.stopScreencast");
await navegador.close();

// Relógio do vídeo final: o que cai dentro de um corte é espremido no começo
// dele, e tudo depois anda para trás o tamanho do corte.
const mapa = (t) => {
  let tirado = 0;
  for (const [a, b] of cortes) {
    if (t >= b) tirado += b - a;
    else if (t > a) return a - tirado;
  }
  return t - tirado;
};
const fimMapeado = mapa(fim);
for (const e of eventos) e.t = mapa(e.t);

// Quadros chegam só quando a tela MUDA. Vira vídeo de taxa fixa segurando
// cada quadro até o próximo. Quadro com duração zero (dentro de corte) sai.
const lista = [];
quadros.forEach((q, i) => {
  const proximo = i + 1 < quadros.length ? mapa(quadros[i + 1].t) : fimMapeado;
  const duracao = proximo - mapa(q.t);
  if (duracao <= 0.0005) return;
  lista.push(`file '${q.arquivo}'\nduration ${duracao.toFixed(4)}`);
});
lista.push(lista[lista.length - 1].split("\n")[0]);
writeFileSync(path.join(pastaQuadros, "lista.txt"), "ffconcat version 1.0\n" + lista.join("\n") + "\n");

const saida = path.join(raiz, "public", "gravacoes", `${nome}.mp4`);
mkdirSync(path.dirname(saida), { recursive: true });
execFileSync(ffmpeg, [
  "-y", "-hide_banner", "-loglevel", "error",
  "-f", "concat", "-safe", "0", "-i", path.join(pastaQuadros, "lista.txt"),
  "-vf", `fps=${FPS},scale=${LARGURA * ESCALA}:${ALTURA * ESCALA}:flags=lanczos,format=yuv420p`,
  "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-movflags", "+faststart",
  saida,
], { stdio: "inherit" });

const meta = { cena: nome, duracao: fimMapeado, cortes, fps: FPS, largura: LARGURA, altura: ALTURA, eventos };
writeFileSync(path.join(raiz, "src", "gravacoes", `${nome}.json`), JSON.stringify(meta, null, 2));
rmSync(pastaQuadros, { recursive: true, force: true });
console.log(`ok: ${nome} — ${fimMapeado.toFixed(1)}s (cortados ${(fim - fimMapeado).toFixed(1)}s), ${quadros.length} quadros, ${eventos.length} eventos`);
console.log(`   ${path.relative(raiz, saida)}`);
