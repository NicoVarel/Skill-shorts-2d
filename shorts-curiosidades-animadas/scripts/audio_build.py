#!/usr/bin/env python3
"""Mezcla final: narración + SFX con intención + música original (con ducking bajo la voz) + loudnorm a -14 LUFS.

Uso: python audio_build.py <SHORTS/NNN-nombre>
Lee: 06-audio/narration.wav, 06-audio/sfx_cues.json, 08-project/short.json (duración), meta.music del storyboard.
Escribe: 06-audio/music.wav, 06-audio/mix.wav (estéreo 48 kHz), 06-audio/mix_report.json, 06-audio/credits.md
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import wave
from pathlib import Path

import numpy as np
from scipy import signal

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audiolib as AL  # noqa: E402

SR = AL.SR


def read_mono(p):
    with wave.open(str(p)) as w:
        ch, n = w.getnchannels(), w.getnframes()
        a = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
    return a.reshape(-1, ch).mean(axis=1) if ch > 1 else a


def write_stereo(p, st):
    with wave.open(str(p), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype(np.int16).tobytes())


def vad_env(x, win=0.03):
    n = int(win * SR)
    sq = np.convolve(x ** 2, np.ones(n) / n, mode="same")
    rms = np.sqrt(sq)
    act = np.clip((rms - 0.008) / 0.03, 0, 1)
    # ataque rápido, liberación lenta
    out = np.zeros_like(act); g = 0.0
    a_att = 1 - np.exp(-1 / (0.05 * SR)); a_rel = 1 - np.exp(-1 / (0.45 * SR))
    # suavizado vectorizado por bloques de 480 muestras (10 ms)
    blk = 480
    for i in range(0, len(act), blk):
        v = act[i:i + blk].max()
        g += (v - g) * (a_att if v > g else a_rel) * (blk / 24)
        g = float(np.clip(g, 0, 1))
        out[i:i + blk] = g
    return out


def db(x):
    return 10 ** (x / 20)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("short_dir")
    ap.add_argument("--no-music", action="store_true")
    ap.add_argument("--target-lufs", type=float, default=-14.0)
    a = ap.parse_args()
    d = Path(a.short_dir); au = d / "06-audio"
    t0 = time.time()
    sb = json.loads((d / "03-storyboard" / "scenes.json").read_text(encoding="utf-8"))
    proj = json.loads((d / "08-project" / "short.json").read_text(encoding="utf-8"))
    total = proj["meta"]["duration"]
    n = int(total * SR)
    voice = read_mono(au / "narration.wav")
    voice = np.pad(voice, (0, max(0, n - len(voice))))[:n]
    mus_meta = sb.get("meta", {}).get("music", {"mood": "curioso"})
    cues = json.loads((au / "sfx_cues.json").read_text(encoding="utf-8")) if (au / "sfx_cues.json").exists() else []

    # SFX
    sfx = np.zeros((n, 2), np.float32)
    used = {}
    for c in cues:
        name = c["name"]
        if name not in AL.SFX:
            raise SystemExit(f"SFX desconocido: {name}. Disponibles: {', '.join(sorted(AL.SFX))}")
        fn = AL.SFX[name]
        if name in AL.AMBIENCES:
            dur = c.get("dur", 6.0); x = fn(dur)
            fade = np.minimum(1, np.arange(len(x)) / (SR * 0.5)) * np.minimum(1, (len(x) - np.arange(len(x))) / (SR * 0.7)); x = x * fade
            g = 0.55 * c.get("vol", 1.0)
        else:
            x = fn(); g = 0.5 * c.get("vol", 1.0)
        pan = float(c.get("pan", 0))
        gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        i = int(c["t"] * SR)
        if i >= n:
            continue
        m = min(len(x), n - i)
        sfx[i:i + m, 0] += x[:m] * g * gl; sfx[i:i + m, 1] += x[:m] * g * gr
        used[name] = used.get(name, 0) + 1

    # Música
    music_st = np.zeros((n, 2), np.float32); mood = None
    if not a.no_music and mus_meta.get("mood") not in (None, "none"):
        mood = mus_meta.get("mood", "curioso")
        m = AL.music(mood, total, seed=mus_meta.get("seed", 3), bpm=mus_meta.get("bpm"))
        m = m[:n] if len(m) >= n else np.pad(m, ((0, n - len(m)), (0, 0)))
        rms_m = np.sqrt(np.mean(m ** 2)) + 1e-9
        speech_rms = np.sqrt(np.mean(voice[np.abs(voice) > 0.02] ** 2)) + 1e-9
        level = mus_meta.get("level_db", -22)  # respecto a la voz
        m = m * (speech_rms / rms_m) * db(level)
        duck = 1 - (1 - db(mus_meta.get("duck_db", -9))) * vad_env(voice)
        music_st = (m * duck[:, None]).astype(np.float32)
        write_stereo(au / "music.wav", m)

    mix = np.stack([voice, voice], axis=1) * 1.0 + sfx + music_st
    # limitador suave
    mix = np.tanh(mix * 0.95) / np.tanh(0.95) if np.max(np.abs(mix)) > 0.95 else mix
    pre = au / "mix_pre.wav"; write_stereo(pre, mix)

    # loudnorm de dos pasadas
    p1 = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(pre), "-af", f"loudnorm=I={a.target_lufs}:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    txt = p1.stderr[p1.stderr.rindex("{"):p1.stderr.rindex("}") + 1]
    st = json.loads(txt)
    af = (f"loudnorm=I={a.target_lufs}:TP=-1.5:LRA=11:measured_I={st['input_i']}:measured_TP={st['input_tp']}:measured_LRA={st['input_lra']}"
          f":measured_thresh={st['input_thresh']}:offset={st['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(pre), "-af", af, "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", str(au / "mix.wav")], check=True)
    pre.unlink(missing_ok=True)
    p2 = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(au / "mix.wav"), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    summ = p2.stderr[p2.stderr.rindex("Summary:"):]
    rep = {"duration_s": round(total, 2), "mood": mood, "sfx_used": used, "loudnorm_input": st, "final_summary": summ.strip().splitlines()[:14], "seconds": round(time.time() - t0, 1)}
    (au / "mix_report.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
    (au / "credits.md").write_text(
        "# Créditos de audio\n\n"
        f"- **Narración:** {json.loads((au / 'words.json').read_text(encoding='utf-8')).get('source', 'desconocida')}.\n"
        f"- **Música:** original, generada de forma procedural por `scripts/audiolib.py` (mood `{mood}`). Sin muestras ni licencias de terceros.\n"
        "- **Efectos de sonido:** originales, sintetizados por `scripts/audiolib.py`. Sin muestras ni licencias de terceros.\n"
        "- **Recursos visuales:** personajes y escenarios generados proceduralmente por el motor de la skill; three.js (MIT) como biblioteca de render.\n", encoding="utf-8")
    print(json.dumps(rep, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
