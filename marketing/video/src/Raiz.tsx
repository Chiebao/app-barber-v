import { Composition } from "remotion";
import { Amostra, DURACAO_AMOSTRA } from "./Amostra";
import { ALTURA, FPS, LARGURA } from "./tema";

export function Raiz() {
  return (
    <Composition id="Amostra" component={Amostra} durationInFrames={DURACAO_AMOSTRA} fps={FPS} width={LARGURA} height={ALTURA} />
  );
}
