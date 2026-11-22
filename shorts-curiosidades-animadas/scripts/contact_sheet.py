#!/usr/bin/env python3
"""Hoja de contacto: rejilla de fotogramas con su tiempo, para revisarla visualmente.

Desde un MP4:   python contact_sheet.py video.mp4 --out sheet.png --n 24 --cols 8
Desde PNG sueltos (los stills de render.py):  python contact_sheet.py --images a.png b.png ... --out sheet.png
"""
from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def font(sz):
    for f in ("C:/Windows/Fonts/seguisb.ttf", "C:/Windows/Fonts/arialbd.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(f, sz)
        except Exception:
            pass
    return ImageFont.load_default()


def probe_dur(p):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)]).decode().strip()
    return float(out)


def extract(video, times, tmp):
    paths = []
    for i, t in enumerate(times):
        p = Path(tmp) / f"f{i:03d}.png"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", str(video), "-frames:v", "1", str(p)], check=True)
        paths.append(p)
    return paths


def build(paths, labels, out, cols=8, tw=270):
    ims = [Image.open(p).convert("RGB") for p in paths]
    th = int(tw * ims[0].height / ims[0].width)
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, rows * (th + 26)), (18, 18, 24))
    d = ImageDraw.Draw(sheet); f = font(18)
    for i, (im, lab) in enumerate(zip(ims, labels)):
        x, y = (i % cols) * tw, (i // cols) * (th + 26)
        sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 26))
        d.text((x + 6, y + 3), lab, fill=(230, 235, 255), font=f)
    sheet.save(out)
    return sheet.size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video", nargs="?")
    ap.add_argument("--images", nargs="*")
    ap.add_argument("--dir", help="carpeta con PNG (orden alfabético)")
    ap.add_argument("--slice", default=None, help="a:b sobre la lista de --dir")
    ap.add_argument("--out", default="contact_sheet.png")
    ap.add_argument("--n", type=int, default=24)
    ap.add_argument("--cols", type=int, default=8)
    ap.add_argument("--width", type=int, default=270)
    a = ap.parse_args()
    if a.dir:
        files = sorted(Path(a.dir).glob('still_*.png'))
        if a.slice:
            i, j = a.slice.split(':'); files = files[int(i or 0):int(j) if j else None]
        a.images = [str(f) for f in files]
    if a.images:
        build([Path(p) for p in a.images], [Path(p).stem for p in a.images], a.out, a.cols, a.width)
        return
    dur = probe_dur(a.video)
    times = [dur * (i + 0.5) / a.n for i in range(a.n)]
    with tempfile.TemporaryDirectory() as tmp:
        paths = extract(a.video, times, tmp)
        size = build(paths, [f"{t:5.1f} s" for t in times], a.out, a.cols, a.width)
    print(f"{a.out} {size}")


if __name__ == "__main__":
    main()
