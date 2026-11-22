#!/usr/bin/env python3
"""Diagnóstico del equipo para la skill (solo lee; no instala ni cambia nada).
Comprueba: Chrome/Edge, ffmpeg, Python y módulos, Whisper y modelos, GPU en el navegador, disco libre, fuentes.
Uso: python doctor.py [--gpu-test]
"""
from __future__ import annotations

import argparse
import asyncio
import importlib
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
ENGINE = Path(__file__).resolve().parent.parent / "assets" / "engine"


def line(ok, name, detail=""):
    print(f"[{'OK' if ok is True else ('--' if ok is None else 'FALTA')}] {name} {detail}")


async def gpu_test():
    from cdp import Browser
    b = await Browser(200, 200).start()
    try:
        await b.send("Page.navigate", {"url": "about:blank"})
        r = await b.eval("""(()=>{const c=document.createElement('canvas');const g=c.getContext('webgl2');if(!g)return 'sin WebGL2';
          const e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'WebGL2 sin info';})()""", False)
        return r
    finally:
        await b.close()


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--gpu-test", action="store_true"); a = ap.parse_args()
    from cdp import find_chrome
    try:
        line(True, "Chrome/Edge", find_chrome())
    except Exception as e:
        line(False, "Chrome/Edge", str(e))
    for t in ("ffmpeg", "ffprobe"):
        p = shutil.which(t); line(bool(p), t, p or "")
    line(sys.version_info >= (3, 10), "Python", sys.version.split()[0])
    for m, need in (("numpy", True), ("scipy", True), ("PIL", True), ("aiohttp", True), ("edge_tts", False), ("whisper", False)):
        try:
            importlib.import_module(m); line(True, f"módulo {m}")
        except Exception:
            line(False if need else None, f"módulo {m}", "(obligatorio)" if need else "(opcional: voz de reserva / transcripción)")
    wm = Path.home() / ".cache" / "whisper"
    if wm.exists():
        line(True, "modelos Whisper", ", ".join(p.stem for p in wm.glob("*.pt")))
    else:
        line(None, "modelos Whisper", "no descargados (se descargan al usar transcribe.py por primera vez)")
    free = shutil.disk_usage(Path.home()).free / 1e9
    line(free > 5, "espacio libre en disco", f"{free:.1f} GB (un Short usa < 0,5 GB; el render va por tubería, sin carpetas de fotogramas)")
    line((ENGINE / "vendor" / "three.module.js").exists(), "three.js (motor) incluido en la skill", "MIT, sin descarga")
    fonts = Path("C:/Windows/Fonts")
    if fonts.exists():
        line((fonts / "ariblk.ttf").exists(), "fuente Arial Black (subtítulos)", "si falta, usa Segoe UI Black / Impact")
    if a.gpu_test:
        try:
            line(True, "WebGL en el navegador", asyncio.run(gpu_test()))
        except Exception as e:
            line(False, "WebGL en el navegador", str(e))


if __name__ == "__main__":
    main()
