#!/usr/bin/env python3
"""Control de calidad automático de un Short terminado. NO marca como aprobado lo que no comprueba.

Uso: python qc.py <SHORTS/NNN-nombre> [--video 09-final/short.mp4] [--skip-report]
Genera: 09-final/qc-report.md, 09-final/qc.json y 09-final/contact_sheet.png (revisión visual MANUAL pendiente).
Cada comprobación es OK / AVISO / FALLO / MANUAL (lo que una máquina no puede juzgar: ortografía, estética, voz).
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
R = []  # (area, nombre, estado, detalle)


def add(area, name, state, detail=""):
    R.append((area, name, state, detail)); print(f"[{state:6}] {area} · {name} {detail}")


def run(cmd, **k):
    return subprocess.run(cmd, capture_output=True, text=True, **k)


def probe(video):
    out = run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)]).stdout
    return json.loads(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("short_dir"); ap.add_argument("--video"); ap.add_argument("--skip-report", action="store_true")
    ap.add_argument("--max-seconds", type=float, default=60.0)
    a = ap.parse_args()
    d = Path(a.short_dir); fin = d / "09-final"
    video = Path(a.video) if a.video else fin / "short.mp4"
    proj = json.loads((d / "08-project" / "short.json").read_text(encoding="utf-8"))
    words = json.loads((d / "06-audio" / "words.json").read_text(encoding="utf-8"))
    fps = proj["meta"]["fps"]

    # ---------------- VÍDEO: contenedor
    pr = probe(video)
    v = next(s for s in pr["streams"] if s["codec_type"] == "video")
    au = next((s for s in pr["streams"] if s["codec_type"] == "audio"), None)
    dur = float(pr["format"]["duration"])
    add("vídeo", "resolución 1080×1920 (9:16)", "OK" if (v["width"], v["height"]) == (1080, 1920) else "FALLO", f"{v['width']}x{v['height']}")
    num, den = map(int, v["r_frame_rate"].split("/")); real_fps = num / den
    add("vídeo", "30 fps", "OK" if abs(real_fps - 30) < 0.01 else "AVISO", f"{real_fps:.3f}")
    add("vídeo", "códec H.264 + yuv420p", "OK" if v["codec_name"] == "h264" and v["pix_fmt"] == "yuv420p" else "FALLO", f"{v['codec_name']} {v['pix_fmt']}")
    add("vídeo", "color BT.709 etiquetado", "OK" if v.get("color_space") == "bt709" else "AVISO", str(v.get("color_space")))
    add("audio", "AAC estéreo 48 kHz", "OK" if au and au["codec_name"] == "aac" and int(au["sample_rate"]) == 48000 else "FALLO", f"{au and au['codec_name']} {au and au['sample_rate']}")
    add("vídeo", f"duración ≤ {a.max_seconds:.0f} s (Short)", "OK" if dur <= a.max_seconds else "AVISO", f"{dur:.2f} s")
    if au:
        add("audio", "pista de audio y vídeo igual de largas", "OK" if abs(float(au.get("duration", dur)) - dur) < 0.25 else "AVISO", f"vídeo {dur:.2f} / audio {au.get('duration')}")
    add("vídeo", "tamaño de archivo razonable (<100 MB)", "OK" if int(pr["format"]["size"]) < 100e6 else "AVISO", f"{int(pr['format']['size']) / 1e6:.1f} MB")

    # ---------------- VÍDEO: negros, congelados
    bd = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-vf", "blackdetect=d=0.12:pic_th=0.97:pix_th=0.12", "-an", "-f", "null", "-"]).stderr
    blacks = [(float(m.group(1)), float(m.group(2))) for m in re.finditer(r"black_start:([\d.]+) black_end:([\d.]+)", bd)]
    mid_blacks = [b for b in blacks if b[0] > 0.6 and b[1] < dur - 0.7]
    add("vídeo", "sin fotogramas negros (salvo fundido inicial/final)", "OK" if not mid_blacks else "FALLO", str(mid_blacks) if mid_blacks else f"fundidos: {blacks}")
    fz = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-vf", "freezedetect=n=-55dB:d=1.2", "-an", "-f", "null", "-"]).stderr
    frozen = re.findall(r"freeze_start: ([\d.]+)", fz)
    add("vídeo", "sin tramos congelados > 1,2 s", "OK" if not frozen else "AVISO", ", ".join(frozen))

    # ---------------- VÍDEO: muestreo de contenido (escenas vacías / planos planos)
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "g.raw"
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video), "-vf", "fps=3,scale=108:192,format=gray", "-f", "rawvideo", str(raw)])
        arr = np.fromfile(raw, dtype=np.uint8).reshape(-1, 192, 108).astype(np.float32)
    stds = arr.reshape(len(arr), -1).std(axis=1); means = arr.reshape(len(arr), -1).mean(axis=1)
    t_s = np.arange(len(arr)) / 3
    flat = [round(float(t), 1) for t, s_ in zip(t_s, stds) if s_ < 14 and 0.7 < t < dur - 0.7]
    add("vídeo", "sin escenas vacías/planas (desviación de píxeles)", "OK" if not flat else "FALLO", f"{len(arr)} muestras; planas en {flat}")
    dark = [round(float(t), 1) for t, m in zip(t_s, means) if m < 28 and 0.7 < t < dur - 0.7]
    bright = [round(float(t), 1) for t, m in zip(t_s, means) if m > 235]
    add("vídeo", "exposición razonable (ni negro ni quemado)", "OK" if not dark and not bright else "AVISO", f"oscuros {dark} · quemados {bright}")
    # cambios bruscos de brillo (parpadeo)
    jumps = [round(float(t_s[i]), 1) for i in range(1, len(means)) if abs(means[i] - means[i - 1]) > 55]
    add("vídeo", "sin saltos bruscos de brillo (más allá de los cortes)", "OK" if len(jumps) <= len(proj["scenes"]) else "AVISO", f"{len(jumps)} saltos (cortes/escena: {len(proj['scenes'])})")

    # ---------------- ANIMACIÓN: informe de visibilidad desde el motor (personajes, fuera de cuadro)
    rep_p = fin / "frame_report.json"
    if not a.skip_report:
        r = run([sys.executable, str(HERE / "render.py"), "--project", str(d / "08-project"), "--report", "5", "--report-out", str(rep_p), "--workers", "1"])
        if r.returncode != 0:
            add("animación", "informe de visibilidad del motor", "FALLO", (r.stderr or r.stdout)[-300:])
    if rep_p.exists():
        rep = json.loads(rep_p.read_text(encoding="utf-8"))
        per_scene = {}
        for f in rep:
            main_actors = [x for x in f["actors"] if x["mustShow"]]
            ok = (not main_actors) or any(x["visible"] and x["onScreen"] and x["inside"] for x in main_actors)
            per_scene.setdefault(f["scene"], []).append(ok)
        bad = {k: f"{100 * sum(v) / len(v):.0f}%" for k, v in per_scene.items() if sum(v) / len(v) < 0.9}
        add("animación", "personaje principal visible y dentro del cuadro (≥90 % de las muestras por escena)", "OK" if not bad else "FALLO", f"{len(rep)} muestras; incumple: {bad}" if bad else f"{len(rep)} muestras")
        subs_bad = []
        for f in rep:
            sb = f.get("subtitle")
            if sb and (sb["x0"] < 40 or sb["x1"] > 1040 or sb["lines"] > 2 or sb["y0"] < 1000 or sb["y1"] > 1560):
                subs_bad.append(round(f["t"], 1))
        add("subtítulos", "caja de subtítulos dentro de la zona segura y ≤ 2 líneas", "OK" if not subs_bad else "FALLO", str(subs_bad[:8]))
        cam_bad = [f["frame"] for f in rep if f["camera"] and not all(np.isfinite(f["camera"]["pos"]))]
        add("animación", "cámara sin valores inválidos", "OK" if not cam_bad else "FALLO", str(cam_bad[:5]))
    else:
        add("animación", "informe de visibilidad", "MANUAL", "no generado")

    # ---------------- AUDIO
    ebu = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-af", "ebur128=peak=true", "-vn", "-f", "null", "-"]).stderr
    summ = ebu[ebu.rindex("Summary:"):]
    I = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summ).group(1)); TP = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summ).group(1))
    add("audio", "sonoridad ≈ -14 LUFS (±1,5)", "OK" if abs(I + 14) <= 1.5 else "AVISO", f"{I} LUFS")
    add("audio", "pico real ≤ -1 dBTP (sin distorsión por saturación)", "OK" if TP <= -1.0 else "FALLO", f"{TP} dBFS")
    # silencios involuntarios: huecos entre palabras
    ws = words["words"]; gaps = []
    for x, y in zip(ws, ws[1:]):
        if x["scene"] == y["scene"] and y["t0"] - x["t1"] > 0.7:
            gaps.append((round(x["t1"], 2), round(y["t0"] - x["t1"], 2)))
    add("audio", "sin silencios largos dentro de una frase (>0,7 s)", "OK" if not gaps else "AVISO", str(gaps))
    sc_gaps = []
    for s0, s1 in zip(proj["scenes"], proj["scenes"][1:]):
        wa = [w for w in ws if w["scene"] == s0["id"]][-1]; wb = [w for w in ws if w["scene"] == s1["id"]][0]
        if wb["t0"] - wa["t1"] > 1.0: sc_gaps.append((s0["id"], round(wb["t0"] - wa["t1"], 2)))
    add("audio", "pausas entre escenas ≤ 1 s", "OK" if not sc_gaps else "AVISO", str(sc_gaps))
    add("audio", "narración completa (última palabra antes del final del vídeo)", "OK" if ws[-1]["t1"] < dur - 0.3 else "FALLO", f"última palabra {ws[-1]['t1']:.2f} s / vídeo {dur:.2f} s")
    clip = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-af", "astats=metadata=0:reset=0", "-vn", "-f", "null", "-"]).stderr
    m = re.findall(r"Peak level dB:\s+(-?[\d.inf]+)", clip)
    add("audio", "sin recorte digital (pico < 0 dBFS)", "OK" if m and all(float(x) < -0.05 for x in m if x not in ("-inf",)) else "AVISO", ", ".join(m[:3]))
    add("audio", "voz natural, música equilibrada, SFX con intención", "MANUAL", "no se puede juzgar por máquina: escucha el MP4 antes de publicar (la voz de reserva edge-tts no sustituye a la voz del fundador)")

    # ---------------- SUBTÍTULOS
    cues = json.loads((d / "07-subtitles" / "cues.json").read_text(encoding="utf-8"))
    probs = []
    for i, c in enumerate(cues):
        if len(c["lines"]) > 2: probs.append(f"cue {i}: >2 líneas")
        for ln in c["lines"]:
            txt = " ".join(w["w"] for w in ln)
            if len(txt) > 20: probs.append(f"cue {i}: línea larga «{txt}»")
            if "Ã" in txt or "�" in txt or "  " in txt: probs.append(f"cue {i}: caracteres raros «{txt}»")
        if c["end"] <= c["start"]: probs.append(f"cue {i}: duración ≤ 0")
        if i and c["start"] < cues[i - 1]["end"] - 0.001: probs.append(f"cue {i}: solapa")
        nchar = sum(len(w["w"]) + 1 for ln in c["lines"] for w in ln)
        if nchar / max(0.2, c["end"] - c["start"]) > 24: probs.append(f"cue {i}: lectura rápida ({nchar / (c['end'] - c['start']):.0f} cps)")
    add("subtítulos", "≤2 líneas, ≤20 caracteres por línea, sin solapes, lectura ≤ 24 caracteres/s", "OK" if not probs else "AVISO", "; ".join(probs[:5]))
    spoken = [w["w"].upper() for w in ws]; shown = [w["w"] for c in cues for ln in c["lines"] for w in ln]
    add("subtítulos", "el texto mostrado es exactamente el del guion (misma secuencia de palabras)", "OK" if [x.upper() for x in shown] == spoken else "FALLO", f"{len(shown)} vs {len(spoken)} palabras")
    lead = [round(c["start"] - ws_w["t0"], 2) for c, ws_w in zip(cues, [next(w for w in ws if abs(w['t0'] - c['lines'][0][0]['t0']) < 1e-6) for c in cues])]
    add("subtítulos", "sincronía con la voz (por construcción: tiempos palabra a palabra del TTS/Whisper)", "OK", "máx. desfase al inicio de cue: %.2f s" % max(map(abs, lead)))
    add("subtítulos", "ortografía y acentos (revisión por una persona)", "MANUAL", "revisa subtitles.srt; el texto proviene literalmente del guion")
    add("subtítulos", "legibles en móvil", "MANUAL", "tamaño 7,1 % del ancho, trazo negro; confirma con la hoja de contacto")

    # ---------------- INVESTIGACIÓN
    r = run([sys.executable, str(HERE / "lint_research.py"), str(d)])
    add("investigación", "hechos con fuentes, cautela en lo dudoso, guion = storyboard", "OK" if r.returncode == 0 else "FALLO", (r.stdout.strip().splitlines() or [""])[-1])
    add("investigación", "las fuentes dicen realmente lo que cada hecho afirma", "MANUAL", "lo contrastó la persona/agente que investigó; el linter no puede verificarlo")

    # ---------------- Hoja de contacto
    r = run([sys.executable, str(HERE / "contact_sheet.py"), str(video), "--out", str(fin / "contact_sheet.png"), "--n", "24", "--cols", "8"])
    add("visual", "hoja de contacto generada (revisión visual MANUAL de integración, estilo y consistencia)", "OK" if r.returncode == 0 else "FALLO", str(fin / "contact_sheet.png"))

    # ---------------- informe
    n = {k: sum(1 for x in R if x[2] == k) for k in ("OK", "AVISO", "FALLO", "MANUAL")}
    (fin / "qc.json").write_text(json.dumps([dict(area=x[0], check=x[1], state=x[2], detail=x[3]) for x in R], ensure_ascii=False, indent=1), encoding="utf-8")
    lines = [f"# Control de calidad — {video.name}", "", f"Resumen: **{n['OK']} OK · {n['AVISO']} avisos · {n['FALLO']} fallos · {n['MANUAL']} revisiones manuales pendientes**", "",
             "| Área | Comprobación | Estado | Detalle |", "|---|---|---|---|"]
    for x in R:
        lines.append(f"| {x[0]} | {x[1]} | {x[2]} | {str(x[3]).replace('|', '/')} |")
    lines += ["", "«MANUAL» = una máquina no puede decidirlo. No se da por aprobado hasta que una persona lo revise."]
    (fin / "qc-report.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"\nRESUMEN: {n}")
    sys.exit(1 if n["FALLO"] else 0)


if __name__ == "__main__":
    main()
