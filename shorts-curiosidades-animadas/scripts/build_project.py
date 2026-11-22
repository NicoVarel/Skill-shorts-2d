#!/usr/bin/env python3
"""Compila el storyboard (scenes.json) + biblia visual + tiempos de la voz en el proyecto de render (short.json).

Entradas (dentro de SHORTS/NNN-nombre/):
  03-storyboard/scenes.json        fuente de verdad: escenas, personajes, cámara, SFX (tiempos relativos a la escena)
  04-characters/characters.json    biblia visual en formato JSON (rig 2D)
  06-audio/words.json              tiempos palabra a palabra (tts.py o transcribe.py)
Salidas:
  08-project/short.json            lo que lee el motor 3D
  07-subtitles/subtitles.srt       subtítulos
  06-audio/sfx_cues.json           cues de SFX en tiempo absoluto (para audio_build.py)
  08-project/build_report.json     resumen (duración, escenas, avisos)

Tiempos en scenes.json: números (segundos desde el inicio de la escena) o cadenas "@w3" (inicio de la palabra 3 de la
narración de esa escena, empezando en 0), "@w3e" (fin de esa palabra), "@end" (fin de la escena), con sufijo +/-segundos
("@w3+0.2", "@end-0.4").
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import wave
from pathlib import Path

import numpy as np

TIME_KEYS = {"t", "t0", "t1", "dur_to"}
HL_RE = re.compile(r"\*(.+?)\*")


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def strip_markup(text):
    return HL_RE.sub(lambda m: m.group(1), text)


def narr_tokens(text):
    """Devuelve lista de (palabra, resaltada). Las marcas *…* pueden abarcar varias palabras y la puntuación
    pegada fuera de la marca (p. ej. *knocker-up*,) se queda unida a su palabra."""
    toks, inside = [], False
    for raw in text.split():
        starts = raw.startswith("*")
        if starts:
            inside = True
        hl = inside
        ends = raw.rstrip(".,;:!?…»)\"").endswith("*")
        w = raw.replace("*", "")
        toks.append((w, hl))
        if ends and inside:
            inside = False
    return toks


def resolve_time(v, words, dur):
    if not isinstance(v, str) or not v.startswith("@"):
        return v
    m = re.fullmatch(r"@(?:w(\d+)(e?)|end)([+-]\d+(?:\.\d+)?)?", v)
    if not m:
        raise ValueError(f"Tiempo no válido: {v}")
    off = float(m.group(3) or 0)
    if m.group(0).startswith("@end"):
        return round(dur + off, 3)
    k = int(m.group(1))
    if k >= len(words):
        raise ValueError(f"{v}: la escena solo tiene {len(words)} palabras")
    w = words[k]
    return round((w["t1"] if m.group(2) else w["t0"]) + off, 3)


def walk(obj, fn_time):
    if isinstance(obj, dict):
        for k, v in list(obj.items()):
            if k in TIME_KEYS:
                obj[k] = fn_time(v)
            else:
                walk(v, fn_time)
    elif isinstance(obj, list):
        for x in obj:
            walk(x, fn_time)


def make_cues(all_words, max_chars=17, max_lines=2):
    """Agrupa palabras en cues de máx. 2 líneas; corta en puntuación y en límites de escena."""
    cues, cur = [], []

    def cue_len(ws):
        # simula el reparto en líneas
        lines, line = [], ""
        for w in ws:
            cand = (line + " " + w["w"]).strip()
            if len(cand) <= max_chars or not line:
                line = cand
            else:
                lines.append(line); line = w["w"]
        lines.append(line)
        return lines

    def flush():
        nonlocal cur
        if cur:
            cues.append(cur); cur = []

    for i, w in enumerate(all_words):
        if cur and w.get("scene") != cur[-1].get("scene"):
            flush()
        trial = cur + [w]
        if len(cue_len(trial)) > max_lines:
            flush(); trial = [w]
        cur = trial
        end_punct = re.search(r"[.!?…:]$", w["w"]) is not None
        comma = re.search(r"[,;]$", w["w"]) is not None
        if end_punct or (comma and len(" ".join(x["w"] for x in cur)) > 14):
            flush()
    flush()
    out = []
    for ws in cues:
        lines, line = [], []
        txt = ""
        for w in ws:
            cand = (txt + " " + w["w"]).strip()
            if len(cand) <= max_chars or not line:
                line.append(w); txt = cand
            else:
                lines.append(line); line = [w]; txt = w["w"]
        lines.append(line)
        out.append({"start": ws[0]["t0"], "end": ws[-1]["t1"] + 0.12, "lines": lines})
    for a, b in zip(out, out[1:]):
        a["end"] = min(a["end"], b["start"] - 0.02)
        a["end"] = max(a["end"], a["start"] + 0.3)
    return out


def srt_time(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def audio_envelope(wav_path, fps):
    if not wav_path or not Path(wav_path).exists():
        return []
    with wave.open(str(wav_path)) as w:
        n, sr, ch, sw = w.getnframes(), w.getframerate(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(n)
    a = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    hop = sr / fps
    nf = int(len(a) / hop)
    env = np.array([np.sqrt(np.mean(a[int(i * hop):int((i + 1) * hop)] ** 2) + 1e-12) for i in range(nf)])
    ref = np.percentile(env, 95) or 1.0
    env = np.clip(env / ref, 0, 1.2)
    k = np.array([0.25, 0.5, 0.25]); env = np.convolve(env, k, mode="same")
    return [round(float(x), 2) for x in env]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("short_dir")
    ap.add_argument("--lead", type=float, default=0.12, help="la escena empieza este tiempo antes de su primera palabra")
    ap.add_argument("--outro", type=float, default=0.9, help="segundos tras la última palabra")
    ap.add_argument("--max-chars", type=int, default=17)
    a = ap.parse_args()
    d = Path(a.short_dir)
    sb = load(d / "03-storyboard" / "scenes.json")
    chars_p = d / "04-characters" / "characters.json"
    chars = load(chars_p)
    chars = chars.get("characters", chars)
    wj = load(d / "06-audio" / "words.json")
    fps = sb.get("meta", {}).get("fps", 30)
    warnings = []

    words_by_scene = {}
    for w in wj["words"]:
        words_by_scene.setdefault(w["scene"], []).append(w)
    scenes = sb["scenes"]
    for s in scenes:
        if s["id"] not in words_by_scene:
            raise SystemExit(f"La escena {s['id']} no tiene palabras en words.json (¿cambió la narración? vuelve a ejecutar tts.py)")
        # texto de la narración = fuente de verdad de la ortografía; marcas *…* para resaltar
        toks = narr_tokens(s["narration"])
        ws = words_by_scene[s["id"]]
        if len(toks) != len(ws):
            raise SystemExit(f"{s['id']}: {len(toks)} palabras en el guion y {len(ws)} en words.json. Re-sincroniza (tts.py/transcribe.py).")
        for (txt, hl), w in zip(toks, ws):
            w["w"] = txt.upper() if sb.get("meta", {}).get("subtitle_upper", True) else txt
            w["hl"] = hl or bool(re.search(r"\d", txt))

    # tiempos de escena
    starts = []
    for i, s in enumerate(scenes):
        ws = words_by_scene[s["id"]]
        st = 0.0 if i == 0 else max(starts[-1] + 0.5, ws[0]["t0"] - a.lead)
        starts.append(st)
    total = max(w["t1"] for w in wj["words"]) + a.outro
    if "min_duration" in sb.get("meta", {}):
        total = max(total, sb["meta"]["min_duration"])
    ends = starts[1:] + [total]

    out_scenes, sfx_abs, chips_abs = [], [], []
    for s, st, en in zip(scenes, starts, ends):
        ws = words_by_scene[s["id"]]
        rel = [{"t0": round(w["t0"] - st, 3), "t1": round(w["t1"] - st, 3)} for w in ws]
        dur = en - st
        sc = json.loads(json.dumps(s))
        walk(sc, lambda v: resolve_time(v, rel, dur))
        sc["start"], sc["end"] = round(st, 3), round(en, 3)
        for c in sc.get("chips", []):
            chips_abs.append({**c, "t0": round(st + c["t0"], 3), "t1": round(st + min(c["t1"], dur), 3)})
        for fx in sc.get("sfx", []):
            sfx_abs.append({"t": round(st + fx["t"], 3), "name": fx["name"], "vol": fx.get("vol", 1.0), "scene": s["id"], "pan": fx.get("pan", 0)})
        for amb in sc.get("ambience", []):
            sfx_abs.append({"t": round(st, 3), "name": amb["name"], "vol": amb.get("vol", 1.0), "scene": s["id"], "dur": round(dur + 0.5, 2), "pan": 0})
        sc.pop("chips", None); sc.pop("sfx", None); sc.pop("ambience", None)
        for c in sc.get("camera", {}).get("segments", []):
            if c.get("t1", 0) < dur - 0.05 and s is scenes[-1]:
                warnings.append(f"{s['id']}: el último segmento de cámara termina antes que la escena")
        sc["narration_plain"] = strip_markup(s["narration"])
        out_scenes.append(sc)

    cues = make_cues([w for ws in words_by_scene.values() for w in ws if True], max_chars=a.max_chars)
    cues.sort(key=lambda c: c["start"])

    env = audio_envelope(d / "06-audio" / "narration.wav", 30)
    meta = {"fps": fps, "duration": round(total, 3), "width": 1080, "height": 1920, "fadeIn": 0.2, "fadeOut": 0.4,
            "title": sb.get("title", ""), "engine": "shorts-curiosidades-animadas/engine v1"}
    project = {"meta": meta, "characters": chars, "scenes": out_scenes, "subtitles": cues, "chips": chips_abs,
               "audioEnv": env, "audioEnvFps": 30, "subtitleStyle": sb.get("subtitleStyle", {})}
    (d / "08-project").mkdir(exist_ok=True)
    (d / "08-project" / "short.json").write_text(json.dumps(project, ensure_ascii=False), encoding="utf-8")
    (d / "06-audio" / "sfx_cues.json").write_text(json.dumps(sfx_abs, ensure_ascii=False, indent=1), encoding="utf-8")

    (d / "07-subtitles").mkdir(exist_ok=True)
    lines = []
    for i, c in enumerate(cues, 1):
        lines += [str(i), f"{srt_time(c['start'])} --> {srt_time(c['end'])}"] + [" ".join(w["w"] for w in l) for l in c["lines"]] + [""]
    (d / "07-subtitles" / "subtitles.srt").write_text("\n".join(lines), encoding="utf-8")
    (d / "07-subtitles" / "cues.json").write_text(json.dumps(cues, ensure_ascii=False, indent=1), encoding="utf-8")
    rep = {"duration": meta["duration"], "scenes": [{"id": s["id"], "start": s["start"], "end": s["end"], "dur": round(s["end"] - s["start"], 2)} for s in out_scenes],
           "cues": len(cues), "sfx_cues": len(sfx_abs), "warnings": warnings}
    (d / "08-project" / "build_report.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(rep, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
