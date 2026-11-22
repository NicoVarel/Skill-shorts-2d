#!/usr/bin/env python3
"""Genera 03-storyboard/storyboard.md (tabla legible) a partir de scenes.json y, si existe, short.json (duraciones reales).
Uso: python export_storyboard.py <SHORTS/NNN-nombre>"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def short(o, n=70):
    s = json.dumps(o, ensure_ascii=False) if not isinstance(o, str) else o
    return s if len(s) <= n else s[: n - 1] + "…"


def describe_actions(ch):
    kinds = {}
    for a in ch.get("actions", []):
        k = a.get("do")
        v = a.get("name") or a.get("item") or ""
        kinds.setdefault(k, []).append(str(v) if v else "")
    return "; ".join(f"{k}{'(' + ','.join(x for x in v if x) + ')' if any(v) else ''}" for k, v in kinds.items())


def main():
    d = Path(sys.argv[1])
    sb = json.loads((d / "03-storyboard" / "scenes.json").read_text(encoding="utf-8"))
    dur = {}
    pj = d / "08-project" / "short.json"
    if pj.exists():
        for s in json.loads(pj.read_text(encoding="utf-8"))["scenes"]:
            dur[s["id"]] = (s["start"], s["end"])
    out = [f"# Storyboard — {sb.get('title', '')}", "", "Generado desde `scenes.json` (fuente de verdad). No edites este archivo a mano.", ""]
    for s in sb["scenes"]:
        a, b = dur.get(s["id"], (None, None))
        t = f"{a:.1f}–{b:.1f} s ({b - a:.1f} s)" if a is not None else "(sin cronometrar)"
        out += [f"## {s['id'].upper()} · {t}", "",
                f"- **Narración:** {s['narration'].replace('*', '')}",
                f"- **Escenario:** `{s['set']['name']}` {short(s['set'].get('params', {}), 90)} · **Luz:** `{s.get('light')}`"]
        chars = s.get("characters", [])
        if chars:
            out.append("- **Personajes y acciones:**")
            for c in chars:
                out.append(f"  - `{c['id']}` (diseño `{c.get('char', c['id'])}`) → {describe_actions(c) or 'en pose inicial «' + c.get('start', {}).get('pose', 'idle') + '»'}")
        cams = s.get("camera", {}).get("segments", [])
        out.append("- **Cámara:** " + " → ".join(
            (f"orbit {c['target']} az {c.get('az')} dist {c.get('dist')} fov {c.get('fov')}" if 'target' in c else f"travelling/panorámica (fov {c.get('from', {}).get('fov')}→{c.get('to', {}).get('fov')})") for c in cams))
        if s.get("props"): out.append("- **Objetos extra:** " + ", ".join(p["kind"] for p in s["props"]))
        if s.get("fx"): out.append("- **Efectos:** " + ", ".join(f["type"] for f in s["fx"]))
        if s.get("chips"): out.append("- **Etiquetas en pantalla:** " + " | ".join(f"{c['text']} ({c.get('sub', '')})" for c in s["chips"]))
        out.append("- **Subtítulos:** palabra a palabra, ≤ 2 líneas, azul de marca en las palabras marcadas")
        sfx = [f"{x['name']}" for x in s.get("sfx", [])] + [f"amb:{x['name']}" for x in s.get("ambience", [])]
        out.append("- **SFX:** " + (", ".join(sfx) if sfx else "—"))
        tr = s.get("transition", {})
        out += [f"- **Transición a la siguiente:** {tr.get('type', 'cut')} {tr.get('dur', '')}".rstrip(), ""]
    (d / "03-storyboard" / "storyboard.md").write_text("\n".join(out), encoding="utf-8")
    print("storyboard.md escrito")


if __name__ == "__main__":
    main()
