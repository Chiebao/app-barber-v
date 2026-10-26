import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COR, GRADIENTE_OURO, TEXTO, TITULO } from "../tema";

/**
 * Frase que entra palavra por palavra. Palavra entre *asteriscos* sai em
 * ouro. Os quadros são relativos à Sequence em que ela está.
 */
export function Frase({ texto, duracao, tamanho = 76, fonte = "titulo", atraso = 3 }: {
  texto: string; duracao: number; tamanho?: number; fonte?: "titulo" | "texto"; atraso?: number;
}) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const linhas = texto.split("\n");
  const saida = interpolate(f, [duracao - 8, duracao], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  let indice = 0;
  return (
    <div
      style={{
        fontFamily: fonte === "titulo" ? TITULO : TEXTO, fontWeight: fonte === "titulo" ? 400 : 800,
        fontSize: tamanho, lineHeight: 1.12, color: COR.texto, textAlign: "center",
        opacity: saida, transform: `translateY(${(1 - saida) * -30}px)`, letterSpacing: fonte === "texto" ? -1 : 0,
        textShadow: "0 6px 30px rgba(0,0,0,.6)",
      }}
    >
      {linhas.map((linha, l) => (
        <div key={l}>
          {linha.split(" ").map((palavra, p) => {
            // "*link*..." também é ouro: a pontuação depois do asterisco fica junto
            const m = palavra.match(/^\*(.+)\*([^*]*)$/);
            const ouro = !!m;
            const limpa = m ? m[1] + m[2] : palavra;
            const entra = spring({ frame: f - indice++ * atraso, fps, config: { damping: 14, stiffness: 160, mass: 0.6 } });
            return (
              <span
                key={p}
                style={{
                  display: "inline-block", marginRight: "0.26em",
                  opacity: entra, transform: `translateY(${(1 - entra) * 46}px) scale(${0.85 + entra * 0.15})`,
                  filter: `blur(${(1 - entra) * 8}px)`,
                  ...(ouro ? { backgroundImage: GRADIENTE_OURO, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : {}),
                }}
              >
                {limpa}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
