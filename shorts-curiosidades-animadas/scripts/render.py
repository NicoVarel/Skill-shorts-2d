#!/usr/bin/env python3
"""Render del Short: abre el motor 3D en Chrome headless (GPU), captura cada fotograma y lo envía a ffmpeg.

Uso:
  python render.py --project <carpeta con short.json> --audio <mix.wav> --out short.mp4
  python render.py --project <carpeta> --stills 30,120,300 --stills-dir <carpeta>     # solo fotogramas sueltos (PNG)
  python render.py --project <carpeta> --range 0-90 --out prueba.mp4 --scale 0.5       # prueba rápida a media resolución
Mide y guarda los tiempos en render_timing.json (junto al MP4).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cdp import Browser, StaticServer  # noqa: E402

ENGINE = Path(__file__).resolve().parent.parent / "assets" / "engine"


def parse_range(s, total):
    if not s:
        return 0, total
    a, b = s.split("-")
    return int(a), min(total, int(b))


async def open_worker(srv, project_name, W, H, gpu=True):
    b = await Browser(W, H, gpu=gpu).start()
    url = f"http://127.0.0.1:{srv.port}/engine/index.html?project=/project/{project_name}&w={W}&h={H}"
    await b.send("Page.navigate", {"url": url})
    for _ in range(int(240 / 0.25)):
        await asyncio.sleep(0.25)
        err = await b.eval("window.__error || ''", await_promise=False)
        if err:
            raise RuntimeError("Error del motor:\n" + err + "\n" + "\n".join(b.console[-10:]))
        if await b.eval("window.__ready===true", await_promise=False):
            return b
    raise TimeoutError("El motor no arrancó. Consola:\n" + "\n".join(b.console[-15:]))


async def main_async(a):
    t_all = time.time()
    proj = Path(a.project).resolve()
    short_json = proj / a.json
    meta = json.loads(short_json.read_text(encoding="utf-8"))["meta"]
    fps = meta.get("fps", 30)
    total = int(round(meta["duration"] * fps))
    W = int(round(meta.get("width", 1080) * a.scale)); H = int(round(meta.get("height", 1920) * a.scale))
    srv = StaticServer({"engine": ENGINE, "project": proj}).start()
    timing = {"workers": a.workers, "scale": a.scale, "fps": fps}
    t0 = time.time()
    browsers = []
    for _ in range(a.workers):  # arranque secuencial: dos arranques simultáneos se bloqueaban en este equipo
        browsers.append(await open_worker(srv, a.json, W, H, gpu=not a.cpu))
    timing["engine_boot_s"] = round(time.time() - t0, 2)
    try:
        if a.stills:
            out_dir = Path(a.stills_dir or proj); out_dir.mkdir(parents=True, exist_ok=True)
            frames = [int(x) for x in a.stills.split(",")]
            for n, f in enumerate(frames):
                b = browsers[n % len(browsers)]
                await b.eval(f"window.__nv.frame({f})", await_promise=False)
                (out_dir / f"still_{f:05d}.png").write_bytes(await b.screenshot("png"))
            print(f"{len(frames)} fotogramas en {out_dir}")
            return
        f0, f1 = parse_range(a.range, total)
        if a.report:
            res = []
            for f in range(f0, f1, a.report):
                res.append(await browsers[0].eval(f"window.__nv.report({f})"))
            Path(a.report_out).write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
            print(f"informe de {len(res)} fotogramas -> {a.report_out}")
            return
        out = Path(a.out).resolve(); out.parent.mkdir(parents=True, exist_ok=True)
        fmt = "png" if a.fmt == "png" else "jpeg"
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "png" if fmt == "png" else "mjpeg", "-i", "-"]
        if a.audio:
            cmd += ["-i", str(a.audio)]
        cmd += ["-vf", "scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=lanczos,format=yuv420p",
                "-c:v", "libx264", "-preset", a.preset, "-crf", str(a.crf), "-r", str(fps), "-g", str(fps * 2),
                "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]
        if a.audio:
            cmd += ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-map", "0:v:0", "-map", "1:a:0"]
        cmd += ["-t", f"{(f1 - f0) / fps:.4f}", "-movflags", "+faststart", str(out)]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        results: dict[int, bytes] = {}
        nxt = {"i": f0}
        written = {"i": f0}
        cond = asyncio.Condition()
        t_r = time.time()

        async def worker(b):
            while True:
                async with cond:
                    if nxt["i"] >= f1:
                        return
                    while nxt["i"] - written["i"] > 16:  # no adelantarse demasiado
                        await cond.wait()
                    i = nxt["i"]; nxt["i"] += 1
                await b.eval(f"window.__nv.frame({i})", await_promise=False)
                data = await b.screenshot(fmt, a.quality)
                async with cond:
                    results[i] = data
                    cond.notify_all()

        async def writer():
            for i in range(f0, f1):
                async with cond:
                    while i not in results:
                        await cond.wait()
                    data = results.pop(i)
                proc.stdin.write(data)
                written["i"] = i + 1
                async with cond:
                    cond.notify_all()
                if (i - f0) % 60 == 0:
                    el = time.time() - t_r
                    print(f"  fotograma {i - f0 + 1}/{f1 - f0}  ({(i - f0 + 1) / max(el, 1e-6):.1f} fps)", flush=True)
            proc.stdin.close()

        await asyncio.gather(writer(), *[worker(b) for b in browsers])
        rc = proc.wait()
        timing["render_frames_s"] = round(time.time() - t_r, 2)
        timing["frames"] = f1 - f0
        timing["render_fps"] = round((f1 - f0) / timing["render_frames_s"], 2)
        if rc != 0:
            raise RuntimeError(f"ffmpeg terminó con código {rc}")
        print(f"OK -> {out}")
    finally:
        timing["total_s"] = round(time.time() - t_all, 2)
        if not a.stills and not a.report:
            Path(str(Path(a.out).resolve()) + ".timing.json").write_text(json.dumps(timing, indent=1), encoding="utf-8")
            print(json.dumps(timing))
        for b in browsers:
            await b.close()
        srv.stop()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--project", required=True, help="carpeta que contiene short.json (se sirve como /project)")
    p.add_argument("--json", default="short.json")
    p.add_argument("--audio")
    p.add_argument("--out", default="short.mp4")
    p.add_argument("--scale", type=float, default=1.0, help="1.0 = 1080x1920")
    p.add_argument("--range", help="a-b (fotogramas)")
    p.add_argument("--stills"); p.add_argument("--stills-dir")
    p.add_argument("--report", type=int, help="cada N fotogramas guarda el informe de visibilidad")
    p.add_argument("--report-out", default="frame_report.json")
    p.add_argument("--workers", type=int, default=2)
    p.add_argument("--fmt", choices=["png", "jpeg"], default="jpeg", help="jpeg q97 por defecto: capturar PNG cuesta ~560 ms/fotograma frente a ~45 ms (medido)")
    p.add_argument("--quality", type=int, default=97)
    p.add_argument("--crf", type=int, default=16)
    p.add_argument("--preset", default="medium")
    p.add_argument("--cpu", action="store_true", help="sin GPU (muy lento)")
    asyncio.run(main_async(p.parse_args()))


if __name__ == "__main__":
    main()
