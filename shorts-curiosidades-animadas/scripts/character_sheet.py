#!/usr/bin/env python3
"""Hoja de personajes (poses + expresiones) a PNG, para revisar la biblia visual antes de generar escenas.
Uso: python character_sheet.py <SHORTS/NNN-nombre> [--poses idle,point,surprised,sit,shoot,walk1] [--expr neutral,happy,...]
Salida: 04-characters/assets/character_sheet.png"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cdp import Browser, StaticServer  # noqa: E402

ENGINE = Path(__file__).resolve().parent.parent / "assets" / "engine"


async def main_async(a):
    d = Path(a.short_dir)
    chars = json.loads((d / "04-characters" / "characters.json").read_text(encoding="utf-8"))
    n = len(chars.get("characters", chars))
    npose = len(a.poses.split(","))
    W = max(npose * 396, len(a.expr.split(",")) * 170) + 20
    H = n * (616 + 190 + 40) + 40
    srv = StaticServer({"engine": ENGINE, "project": d / "04-characters"}).start()
    b = await Browser(W, min(H, 16000), gpu=True).start()
    try:
        url = f"http://127.0.0.1:{srv.port}/engine/sheet.html?chars=/project/characters.json&poses={a.poses}&expr={a.expr}"
        await b.send("Page.navigate", {"url": url})
        await b.wait_for("window.__ready===true", 60)
        await b.send("Emulation.setDeviceMetricsOverride", {"width": W, "height": H, "deviceScaleFactor": 1, "mobile": False})
        data = await b.screenshot("png")
        out = d / "04-characters" / "assets" / "character_sheet.png"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(data)
        print("Hoja de personajes:", out)
    finally:
        await b.close(); srv.stop()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("short_dir")
    ap.add_argument("--poses", default="idle,point,surprised,sit,shoot,walk1")
    ap.add_argument("--expr", default="neutral,happy,angry,surprised,sleepy,yawn,smug,sleep")
    asyncio.run(main_async(ap.parse_args()))


if __name__ == "__main__":
    main()
