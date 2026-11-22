#!/usr/bin/env python3
"""Alinea las palabras del guion (ortografía correcta) con palabras cronometradas (edge-tts o Whisper)."""
from __future__ import annotations

import difflib
import re
import unicodedata


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", s.lower())


def assign_times(tokens: list[str], timed: list[dict], seg_start: float, seg_end: float) -> list[dict]:
    """tokens: palabras del guion. timed: [{w,t0,t1}]. Devuelve [{t0,t1}] con len == len(tokens)."""
    a = [norm(t) for t in tokens]
    b = [norm(w["w"]) for w in timed]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    out: list[dict | None] = [None] * len(tokens)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            out[blk.a + k] = {"t0": timed[blk.b + k]["t0"], "t1": timed[blk.b + k]["t1"], "matched": True}
    # rellenar huecos por interpolación proporcional a la longitud de las palabras
    i = 0
    while i < len(out):
        if out[i] is not None:
            i += 1
            continue
        j = i
        while j < len(out) and out[j] is None:
            j += 1
        t_a = out[i - 1]["t1"] if i > 0 else seg_start
        t_b = out[j]["t0"] if j < len(out) else seg_end
        t_b = max(t_b, t_a + 0.05 * (j - i))
        lens = [max(1, len(tokens[k])) for k in range(i, j)]
        tot = sum(lens); acc = 0
        for k, L in zip(range(i, j), lens):
            out[k] = {"t0": t_a + (t_b - t_a) * acc / tot, "t1": t_a + (t_b - t_a) * (acc + L) / tot, "matched": False}
            acc += L
        i = j
    # garantizar monotonía
    last = seg_start
    for o in out:
        o["t0"] = max(o["t0"], last); o["t1"] = max(o["t1"], o["t0"] + 0.04); last = o["t1"]
    return out
