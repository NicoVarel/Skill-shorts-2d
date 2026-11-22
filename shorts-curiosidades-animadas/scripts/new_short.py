#!/usr/bin/env python3
"""Crea la carpeta de un Short nuevo: SHORTS/NNN-nombre/ con la estructura y las plantillas.

Uso: python new_short.py "despertadores humanos" [--root <carpeta SHORTS>]
La carpeta raíz se resuelve así: --root > variable NICOVAREL_SHORTS_DIR > <carpeta actual>/SHORTS.
Nunca sobrescribe: si la carpeta existe, no toca nada.
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import unicodedata
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
SUBDIRS = ["01-research", "02-script", "03-storyboard", "04-characters/assets", "05-environments", "06-audio", "07-subtitles", "08-project", "09-final"]
TEMPLATES = {
    "facts.md": "01-research/facts.md", "sources.md": "01-research/sources.md", "script.md": "02-script/script.md",
    "character-bible.md": "04-characters/character-bible.md", "title-description.md": "09-final/title-description.md",
    "scenes.example.json": "03-storyboard/scenes.json", "characters.example.json": "04-characters/characters.json",
}


def slug(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name"); ap.add_argument("--root")
    a = ap.parse_args()
    root = Path(a.root or os.environ.get("NICOVAREL_SHORTS_DIR") or (Path.cwd() / "SHORTS"))
    root.mkdir(parents=True, exist_ok=True)
    nums = [int(m.group(1)) for p in root.iterdir() if (m := re.match(r"(\d{3})-", p.name))]
    nnn = max(nums, default=0) + 1
    d = root / f"{nnn:03d}-{slug(a.name)}"
    if d.exists():
        print("Ya existe, no se toca:", d); return
    for s in SUBDIRS:
        (d / s).mkdir(parents=True)
    for src, dst in TEMPLATES.items():
        shutil.copy(SKILL / "templates" / src, d / dst)
    print("Creado:", d)
    print("Siguiente paso: investigar (01-research), escribir guion (02-script) y storyboard (03-storyboard). Ver SKILL.md.")


if __name__ == "__main__":
    main()
