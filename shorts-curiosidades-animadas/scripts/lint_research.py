#!/usr/bin/env python3
"""Linter de investigación: ¿cada frase del guion se apoya en hechos con fuentes? ¿lo dudoso se dice con cautela?

Uso: python lint_research.py <SHORTS/NNN-nombre>   (código de salida 1 si hay errores)
Comprueba, entre otras cosas:
  - formato de sources.md / facts.md / script.md (ver references/research.md)
  - cada hecho tiene fuentes existentes; «confirmado» exige ≥ 2 fuentes; nada se apoya en fuentes «no accedidas»
  - cada frase del guion cita hechos (F…) que existen; los años del guion aparecen en facts.md
  - los hechos «discutido» / «no_comprobado» se dicen con una marca de cautela en la frase
  - el texto de script.md coincide con la narración de scenes.json
Lo que NO puede comprobar (queda para revisión humana): que la fuente diga realmente lo que el hecho afirma.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

STATES = {"confirmado", "parcial", "discutido", "no_comprobado"}
HEDGE = re.compile(r"según|relatos|titular|se dice|se cuenta|no (?:está|es un dato|han|ha)|comprobad|cifra de|se cree|supuest|presunt|al parecer|posible|quizá|habría", re.I)


def parse_blocks(text, prefix):
    blocks = {}
    for m in re.finditer(rf"^##\s+({prefix}\d+)\b(.*?)(?=^##\s|\Z)", text, re.S | re.M):
        blocks[m.group(1)] = m.group(0)
    return blocks


def field(block, name):
    m = re.search(rf"\*\*{name}[^*]*\*\*:?\s*(.+)", block)
    return m.group(1).strip() if m else ""


def strip_marks(s):
    return s.replace("*", "")


def main():
    d = Path(sys.argv[1])
    r = d / "01-research"
    errs, warns, info = [], [], []
    try:
        src_t = (r / "sources.md").read_text(encoding="utf-8")
        fact_t = (r / "facts.md").read_text(encoding="utf-8")
        script_t = (d / "02-script" / "script.md").read_text(encoding="utf-8")
    except FileNotFoundError as e:
        print("FALTA ARCHIVO:", e); sys.exit(1)
    sources = parse_blocks(src_t, "S"); facts = parse_blocks(fact_t, "F")
    if not sources: errs.append("sources.md no tiene bloques «## S1 — …»")
    if not facts: errs.append("facts.md no tiene bloques «## F1 — …»")
    bad_src = set()
    for sid, b in sources.items():
        if not re.search(r"https?://", b) and not re.search(r"cita(?:da|do)", b.lower()): errs.append(f"{sid}: sin URL (solo se admite sin URL si es una fuente «citada»)")
        est = field(b, "Tipo").lower() + " " + b.lower()
        if "no accedida" in b.lower().split("\n")[0] or "**estado:** no accedida" in b.lower():
            bad_src.add(sid)
        if not re.search(r"leída|citada|citado|no accedida", b.lower()): warns.append(f"{sid}: no indica si fue leída o citada")
    fact_state = {}
    for fid, b in facts.items():
        st = field(b, "Estado").split()[0].lower().strip("·().,") if field(b, "Estado") else ""
        if st not in STATES: errs.append(f"{fid}: estado «{st}» no válido (usa {sorted(STATES)})")
        fact_state[fid] = st
        ids = re.findall(r"\bS\d+\b", field(b, "Fuentes"))
        if not ids: errs.append(f"{fid}: sin fuentes")
        for i in ids:
            if i not in sources: errs.append(f"{fid}: cita {i}, que no existe en sources.md")
            if i in bad_src: errs.append(f"{fid}: se apoya en {i} (no accedida)")
        if st == "confirmado" and len(set(ids)) < 2: errs.append(f"{fid}: «confirmado» exige ≥ 2 fuentes (tiene {len(set(ids))}); usa «parcial»")
    # guion
    lines = re.findall(r"^(S\d\d)\s*\|\s*([^|]*)\|\s*(.+)$", script_t, re.M)
    if not lines: errs.append("script.md no tiene líneas «S01 | F1,F2 | texto»")
    used = set()
    for sc, tags, text in lines:
        t = tags.strip()
        ids = re.findall(r"F\d+", t)
        if not ids:
            warns.append(f"{sc}: sin hechos asociados («—»): solo válido para cierres/opiniones evidentes")
        for i in ids:
            used.add(i)
            if i not in facts: errs.append(f"{sc}: cita {i}, que no existe")
            elif fact_state.get(i) in ("discutido", "no_comprobado") and not HEDGE.search(text):
                errs.append(f"{sc}: usa {i} ({fact_state[i]}) sin marca de cautela en la frase")
        for y in re.findall(r"\b(1[6-9]\d\d|20\d\d)\b", text):
            if y not in fact_t: errs.append(f"{sc}: el año {y} no aparece en facts.md")
    for fid in facts:
        if fid not in used: info.append(f"{fid} no se usa en el guion (válido como contexto)")
    # coherencia con storyboard
    sb_p = d / "03-storyboard" / "scenes.json"
    if sb_p.exists():
        sb = json.loads(sb_p.read_text(encoding="utf-8"))
        nar = {s["id"].upper(): strip_marks(s["narration"]).strip() for s in sb["scenes"]}
        for sc, _, text in lines:
            if nar.get(sc.upper()) != strip_marks(text).strip():
                errs.append(f"{sc}: el texto de script.md no coincide con scenes.json")
        for k in nar:
            if k not in {l[0].upper() for l in lines}: errs.append(f"{k}: escena sin línea en script.md")
    n_words = sum(len(strip_marks(t).split()) for _, _, t in lines)
    out = {"errores": errs, "avisos": warns, "info": info, "hechos": len(facts), "fuentes": len(sources), "palabras_guion": n_words}
    (r / "lint_report.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Hechos: {len(facts)} · Fuentes: {len(sources)} · Palabras del guion: {n_words}")
    for e in errs: print("ERROR  ", e)
    for w in warns: print("AVISO  ", w)
    for i in info: print("info   ", i)
    print("RESULTADO:", "FALLA" if errs else "OK (revisión humana pendiente: que cada fuente diga lo que el hecho afirma)")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
