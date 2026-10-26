"""Narração de um roteiro, uma fala por trecho, com a voz Piper.

Uso: python scripts/narrar.py <roteiro> [voz] [takes]
     voz: cadu (padrão), faber, jeff   takes: quantas tentativas por fala (5)

Piper é código aberto e roda no computador; as vozes pt-BR foram treinadas em
dados CC0, então podem ir para anúncio.

A voz muda um pouco a cada geração (o modelo tem sorteio por dentro): uma sai
limpa, outra embola "WhatsApp" ou "a barba". Por isso cada fala sai em várias
tomadas e fica a que o transcritor (faster-whisper) entende melhor — é a
conferência de pronúncia que um ouvido faria.

Grava public/narracao/<roteiro>/<id>.wav e src/narracao/<roteiro>.duracoes.json:
a composição monta a linha do tempo a partir de quanto cada fala dura.
"""
import difflib
import json
import os
import re
import subprocess
import sys
import unicodedata
import wave

import numpy as np
from faster_whisper import WhisperModel
from piper import PiperVoice
from piper.config import SynthesisConfig

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
RITMO = float(os.environ.get("RITMO", "0.9"))


def normaliza(texto: str) -> list[str]:
    sem_acento = unicodedata.normalize("NFD", texto.lower())
    sem_acento = "".join(c for c in sem_acento if unicodedata.category(c) != "Mn")
    return re.findall(r"[a-z]+", sem_acento)


def nota(esperado: str, ouvido: str) -> float:
    return difflib.SequenceMatcher(None, normaliza(esperado), normaliza(ouvido)).ratio()


def transcreve(modelo: WhisperModel, arquivo: str) -> str:
    cru = subprocess.run([FFMPEG, "-v", "error", "-i", arquivo, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    audio = np.frombuffer(cru, np.int16).astype(np.float32) / 32768
    segs, _ = modelo.transcribe(audio, language="pt", beam_size=5)
    return " ".join(s.text.strip() for s in segs)


def duracao(arquivo: str) -> float:
    with wave.open(arquivo) as w:
        return w.getnframes() / w.getframerate()


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("Uso: python scripts/narrar.py <roteiro> [voz] [takes]")
    roteiro = sys.argv[1]
    voz_nome = sys.argv[2] if len(sys.argv) > 2 else "cadu"
    takes = int(sys.argv[3]) if len(sys.argv) > 3 else 5

    with open(os.path.join(RAIZ, "src", "narracao", f"{roteiro}.json"), encoding="utf-8") as f:
        falas = json.load(f)
    pasta = os.path.join(RAIZ, "public", "narracao", roteiro)
    os.makedirs(pasta, exist_ok=True)

    voz = PiperVoice.load(os.path.join(RAIZ, "vozes", f"pt_BR-{voz_nome}-medium.onnx"))
    ouvido = WhisperModel("small", device="cpu", compute_type="int8")
    config = SynthesisConfig(length_scale=RITMO)

    duracoes = {}
    for fala in falas:
        # Asteriscos marcam a palavra em ouro na legenda; reticências, lidas,
        # viram pausa longa no meio da frase.
        texto = re.sub(r"\.\.\.", ",", (fala.get("fala") or fala["texto"]).replace("*", ""))
        # O que se espera OUVIR: a legenda, ou "confere" quando a fala tem
        # grafia de pronúncia ("línque") ou frase a mais que a legenda.
        conferir = fala.get("confere") or fala["texto"].replace("*", "").replace("...", "")
        melhor = None
        for n in range(takes):
            cru = os.path.join(pasta, f"{fala['id']}.take{n}.wav")
            with wave.open(cru, "wb") as w:
                voz.synthesize_wav(texto, w, syn_config=config)
            ouviu = transcreve(ouvido, cru)
            pontos = nota(conferir, ouviu)
            if melhor is None or pontos > melhor[0]:
                melhor = (pontos, cru, ouviu)
            if pontos >= 0.97:
                break
        saida = os.path.join(pasta, f"{fala['id']}.wav")
        # Corta o silêncio das pontas e deixa no volume de anúncio (-16 LUFS).
        subprocess.run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", melhor[1], "-af",
                        "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                        "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                        "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", saida], check=True)
        for n in range(takes):
            try:
                os.remove(os.path.join(pasta, f"{fala['id']}.take{n}.wav"))
            except FileNotFoundError:
                pass
        duracoes[fala["id"]] = round(duracao(saida), 3)
        print(f"{fala['id']:10} {duracoes[fala['id']]:5.2f}s  nota {melhor[0]:.2f}  ouviu: {melhor[2]}")

    with open(os.path.join(RAIZ, "src", "narracao", f"{roteiro}.duracoes.json"), "w", encoding="utf-8") as f:
        json.dump({"voz": voz_nome, "duracoes": duracoes}, f, ensure_ascii=False, indent=2)
    print(f"total falado: {sum(duracoes.values()):.1f}s (voz {voz_nome})")


if __name__ == "__main__":
    main()
