#!/usr/bin/env python3
"""Voz aportada por el usuario (preferido: voz real del fundador) -> tiempos palabra a palabra con Whisper (local).

Casos de uso:
  1) Transcribir para escribir el guion/storyboard a partir del audio:
       python transcribe.py <audio> --out <SHORTS/NNN>/06-audio/transcript.json
  2) Con storyboard ya escrito (cada escena con su 'narration'): alinear el audio con el guion:
       python transcribe.py <audio> --short <SHORTS/NNN-nombre>
     Copia el audio a 06-audio/narration.wav (48 kHz mono, sin tocar el original) y escribe words.json.
Todo local: el audio no sale del equipo. Modelos Whisper: tiny/base/small (small recomendado, español).
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from align import assign_times  # noqa: E402
from build_project import narr_tokens  # noqa: E402


def whisper_words(audio, model_name="small", language="es"):
    import whisper
    tmp = Path(tempfile.mkdtemp(prefix="nv_wh_")) / "a16.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(audio), "-ar", "16000", "-ac", "1", str(tmp)], check=True)
    model = whisper.load_model(model_name)
    res = model.transcribe(str(tmp), language=language, word_timestamps=True, condition_on_previous_text=False, fp16=False)
    words = []
    for seg in res["segments"]:
        for w in seg.get("words", []):
            words.append({"w": w["word"].strip(), "t0": float(w["start"]), "t1": float(w["end"])})
    return words, res["text"].strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("--short")
    ap.add_argument("--out")
    ap.add_argument("--model", default="small")
    ap.add_argument("--lang", default="es")
    a = ap.parse_args()
    t0 = time.time()
    words, text = whisper_words(a.audio, a.model, a.lang)
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.audio]).decode().strip())
    if a.out and not a.short:
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        Path(a.out).write_text(json.dumps({"text": text, "duration": dur, "words": words}, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"Transcripción: {len(words)} palabras en {time.time() - t0:.1f}s -> {a.out}")
        print(text)
        return
    d = Path(a.short)
    sb = json.loads((d / "03-storyboard" / "scenes.json").read_text(encoding="utf-8"))
    out_dir = d / "06-audio"; out_dir.mkdir(exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", a.audio, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", str(out_dir / "narration.wav")], check=True)
    toks, owner = [], []
    for s in sb["scenes"]:
        for k, (t, _) in enumerate(narr_tokens(s["narration"])):
            toks.append(t); owner.append((s["id"], k))
    times = assign_times(toks, words, 0.0, dur)
    unmatched = sum(1 for t in times if not t.get("matched"))
    out = [{"w": t, "t0": round(tm["t0"], 3), "t1": round(tm["t1"], 3), "scene": sc, "i": k} for t, tm, (sc, k) in zip(toks, times, owner)]
    (out_dir / "words.json").write_text(json.dumps({"audio": "narration.wav", "duration": dur, "source": f"whisper:{a.model}", "words": out}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Alineadas {len(out)} palabras del guion con {len(words)} de Whisper ({unmatched} interpoladas) en {time.time() - t0:.1f}s")
    if unmatched > 0.2 * len(out):
        print("AVISO: más del 20 % de palabras interpoladas: el guion difiere del audio; revisa el texto de las escenas.")


if __name__ == "__main__":
    main()
