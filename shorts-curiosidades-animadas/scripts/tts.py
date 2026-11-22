#!/usr/bin/env python3
"""Genera la narración con edge-tts (voz de reserva) escena por escena y escribe words.json con tiempos exactos.

IMPORTANTE (honestidad): edge-tts NO es local: envía el texto del guion al servicio en línea de Microsoft Edge.
Úsalo solo con guiones que puedan salir de tu equipo. La voz preferida del canal es la voz real del fundador
(usa transcribe.py con su audio). No necesita clave API.

Uso: python tts.py <SHORTS/NNN-nombre> [--voice es-MX-JorgeNeural] [--rate +0%] [--gap 0.2]
Salidas: 06-audio/narration.wav (48 kHz mono), 06-audio/words.json, 06-audio/tts_timing.json
"""
from __future__ import annotations

import argparse
import asyncio
import json
import subprocess
import sys
import tempfile
import time
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from align import assign_times  # noqa: E402
from build_project import narr_tokens, strip_markup  # noqa: E402

SR = 48000


async def synth(text, voice, rate, pitch, out_mp3):
    import edge_tts
    comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
    words = []
    with open(out_mp3, "wb") as f:
        async for ch in comm.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({"w": ch["text"], "t0": ch["offset"] / 1e7, "t1": (ch["offset"] + ch["duration"]) / 1e7})
    return words


def to_wav(src, dst):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-ar", str(SR), "-ac", "1", "-c:a", "pcm_s16le", str(dst)], check=True)


def read_wav(p):
    with wave.open(str(p)) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    return a


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("short_dir")
    ap.add_argument("--voice", default=None)
    ap.add_argument("--rate", default=None)
    ap.add_argument("--pitch", default=None)
    ap.add_argument("--gap", type=float, default=0.2, help="pausa entre escenas (s)")
    a = ap.parse_args()
    d = Path(a.short_dir)
    sb = json.loads((d / "03-storyboard" / "scenes.json").read_text(encoding="utf-8"))
    v = sb.get("meta", {}).get("voice", {})
    voice = a.voice or v.get("name", "es-MX-JorgeNeural"); rate = a.rate or v.get("rate", "+0%"); pitch = a.pitch or v.get("pitch", "+0Hz")
    out_dir = d / "06-audio"; out_dir.mkdir(exist_ok=True)
    t0 = time.time()
    chunks, all_words, offset = [], [], 0.0
    tmp = Path(tempfile.mkdtemp(prefix="nv_tts_"))
    info = []
    for s in sb["scenes"]:
        text = strip_markup(s["narration"])
        mp3 = tmp / f"{s['id']}.mp3"; wav = tmp / f"{s['id']}.wav"
        ev = asyncio.run(synth(text, voice, rate, pitch, mp3))
        to_wav(mp3, wav)
        x = read_wav(wav)
        thr = 0.012
        idx = np.where(np.abs(x) > thr)[0]
        lead = max(0, (idx[0] if len(idx) else 0) - int(0.04 * SR)); tail = min(len(x), (idx[-1] if len(idx) else len(x)) + int(0.12 * SR))
        x = x[lead:tail]
        lead_s = lead / SR
        dur = len(x) / SR
        toks = [t for t, _ in narr_tokens(s["narration"])]
        timed = [{"w": e["w"], "t0": max(0, e["t0"] - lead_s), "t1": max(0, e["t1"] - lead_s)} for e in ev]
        times = assign_times(toks, timed, 0.0, dur) if timed else assign_times(toks, [], 0.0, dur)
        unmatched = sum(1 for t in times if not t.get("matched"))
        for k, (tok, tm) in enumerate(zip(toks, times)):
            all_words.append({"w": tok, "t0": round(offset + tm["t0"], 3), "t1": round(offset + min(tm["t1"], dur), 3), "scene": s["id"], "i": k})
        info.append({"scene": s["id"], "dur": round(dur, 2), "words": len(toks), "edge_events": len(ev), "interpolated": unmatched})
        chunks.append(x)
        gap = s.get("gap", a.gap)
        chunks.append(np.zeros(int(gap * SR), dtype=np.float32))
        offset += dur + gap
    full = np.concatenate(chunks[:-1])  # sin el último silencio
    # normalizar pico suave
    peak = np.max(np.abs(full)) or 1.0
    full = full * (0.89 / peak)
    out_wav = out_dir / "narration.wav"
    with wave.open(str(out_wav), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(full, -1, 1) * 32767).astype(np.int16).tobytes())
    (out_dir / "words.json").write_text(json.dumps({"audio": "narration.wav", "duration": round(len(full) / SR, 3), "source": f"edge-tts:{voice}", "words": all_words}, ensure_ascii=False, indent=1), encoding="utf-8")
    (out_dir / "tts_timing.json").write_text(json.dumps({"voice": voice, "rate": rate, "seconds": round(time.time() - t0, 2), "scenes": info}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({"voice": voice, "duration_s": round(len(full) / SR, 2), "gen_seconds": round(time.time() - t0, 1), "scenes": info}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
