#!/usr/bin/env python3
"""Síntesis procedural de SFX y música original (numpy/scipy). Sin descargas, sin licencias de terceros.
Todo el sonido lo genera este código: es obra propia de la skill (puedes usarla comercialmente)."""
from __future__ import annotations

import numpy as np
from scipy import signal

SR = 48000
RNG = np.random.default_rng(7)


def t_axis(d):
    return np.arange(int(d * SR)) / SR


def noise(d, seed=None):
    r = np.random.default_rng(seed) if seed is not None else RNG
    return r.standard_normal(int(d * SR)).astype(np.float32)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x).astype(np.float32)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="low", fs=SR, output="sos"), x).astype(np.float32)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="high", fs=SR, output="sos"), x).astype(np.float32)


def decay(d, rate):
    return np.exp(-t_axis(d) * rate).astype(np.float32)


def sine(f, d, ph=0.0):
    return np.sin(2 * np.pi * f * t_axis(d) + ph).astype(np.float32)


def norm_peak(x, peak=0.9):
    m = np.max(np.abs(x)) or 1.0
    return (x * peak / m).astype(np.float32)


def place(buf, x, at):
    i = int(at * SR)
    if i >= len(buf):
        return
    n = min(len(x), len(buf) - i)
    buf[i:i + n] += x[:n]


# ------------------------------------------------------------------ SFX
def footstep_cobble(d=0.22):
    thump = sine(80, d) * decay(d, 28) * 0.8
    click = bp(noise(d, 1), 1200, 4200) * decay(d, 90) * 0.6
    return norm_peak(thump + click, 0.7)


def footsteps(d=2.0, rate=2.2):
    buf = np.zeros(int(d * SR), np.float32)
    k = 0
    t = 0.0
    while t < d - 0.2:
        s = footstep_cobble() * (0.8 + 0.2 * ((k % 2)))
        place(buf, s, t); t += 1 / rate; k += 1
    return buf


def knock_wood(d=0.5, n=3):
    buf = np.zeros(int(d * SR), np.float32)
    for k in range(n):
        s = (sine(190 + 15 * k, 0.12) * decay(0.12, 38) + bp(noise(0.12, 5 + k), 500, 2500) * decay(0.12, 70) * 0.5)
        place(buf, s, k * 0.14)
    return norm_peak(buf, 0.8)


def glass_tap(d=0.2):
    s = sine(2300, d) * decay(d, 60) * 0.6 + sine(3450, d) * decay(d, 90) * 0.3 + bp(noise(d, 3), 3000, 7000) * decay(d, 200) * 0.3
    return norm_peak(s, 0.55)


def pea_tic(d=0.08):
    s = sine(3800, d) * decay(d, 160) * 0.5 + hp(noise(d, 9), 3000) * decay(d, 400) * 0.4
    return norm_peak(s, 0.5)


def pea_burst(d=0.9, n=6):
    buf = np.zeros(int(d * SR), np.float32)
    for k in range(n):
        place(buf, pea_tic() * (0.6 + 0.4 * np.random.default_rng(k).random()), 0.03 + k * (d - 0.15) / n)
    return buf


def whoosh(d=0.45):
    x = noise(d, 4)
    t = t_axis(d)
    out = np.zeros_like(x)
    for lo, hi, w in ((300, 900, 0.5), (900, 2800, 0.8), (2800, 6000, 0.4)):
        out += bp(x, lo, hi) * w
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return norm_peak(out * env, 0.6)


def thud(d=0.5):
    s = sine(58, d) * decay(d, 9) * 0.9 + lp(noise(d, 2), 400) * decay(d, 18) * 0.5
    return norm_peak(s, 0.85)


def alarm_bell(d=1.6):
    t = t_axis(d)
    ring = (np.sin(2 * np.pi * 1850 * t) + 0.7 * np.sin(2 * np.pi * 2480 * t)) * (0.55 + 0.45 * np.sign(np.sin(2 * np.pi * 26 * t)))
    gate = (np.sin(2 * np.pi * 3.2 * t) > -0.2).astype(np.float32)
    env = np.minimum(1, t / 0.01) * np.minimum(1, (d - t) / 0.08)
    return norm_peak(ring * gate * env, 0.55)


def bell_ding(d=1.4):
    t = t_axis(d)
    s = np.sin(2 * np.pi * 880 * t) * np.exp(-t * 3.2) + 0.5 * np.sin(2 * np.pi * 1320 * t) * np.exp(-t * 4.2) + 0.25 * np.sin(2 * np.pi * 2217 * t) * np.exp(-t * 6)
    return norm_peak(s, 0.6)


def clock_tick(d=0.1):
    return norm_peak(hp(noise(d, 11), 1800) * decay(d, 120) + sine(1200, d) * decay(d, 80) * 0.3, 0.45)


def paper_rustle(d=0.6):
    x = bp(noise(d, 12), 2500, 9000) * (0.4 + 0.6 * np.abs(lp(noise(d, 13), 18)) * 6)
    return norm_peak(x * np.sin(np.pi * np.clip(t_axis(d) / d, 0, 1)) ** 0.5, 0.4)


def wind(d=6.0):
    x = lp(noise(d, 20), 700) * (0.55 + 0.45 * np.clip(lp(noise(d, 21), 0.6) * 25, -1, 1)) + bp(noise(d, 22), 900, 1800) * 0.18
    return norm_peak(x, 0.35)


def birds(d=4.0):
    buf = np.zeros(int(d * SR), np.float32); r = np.random.default_rng(31)
    for _ in range(int(d * 1.6)):
        f0 = 3200 + r.random() * 1800; dur = 0.06 + r.random() * 0.08
        t = t_axis(dur); f = f0 + 900 * np.sin(2 * np.pi * (6 + r.random() * 6) * t)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / dur)
        place(buf, (s * 0.4).astype(np.float32), r.random() * (d - 0.2))
    return norm_peak(buf, 0.22)


def crowd_murmur(d=6.0):
    x = bp(noise(d, 40), 260, 1700) * (0.6 + 0.4 * np.clip(lp(noise(d, 41), 3) * 14, -1, 1))
    return norm_peak(x, 0.3)


def street_ambience(d=8.0):
    return norm_peak(wind(d) * 0.5 + birds(d) * 0.6 + lp(noise(d, 50), 300) * 0.12, 0.3)


def snore(d=1.6):
    t = t_axis(d); f = 85 + 12 * np.sin(2 * np.pi * 0.6 * t)
    saw = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR).astype(np.float32)
    am = (np.sin(2 * np.pi * 0.62 * t - 1.2) > 0.1).astype(np.float32) * np.abs(np.sin(2 * np.pi * 0.62 * t - 1.2))
    return norm_peak(lp(saw, 600) * am + lp(noise(d, 7), 500) * am * 0.3, 0.5)


def boing(d=0.45):
    t = t_axis(d); f = 220 + 340 * (1 - np.exp(-t * 9)) + 20 * np.sin(2 * np.pi * 30 * t)
    return norm_peak(np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(d, 6), 0.6)


def pop(d=0.12):
    t = t_axis(d); f = 900 * np.exp(-t * 30) + 120
    return norm_peak(np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(d, 35), 0.7)


def sparkle(d=0.9):
    buf = np.zeros(int(d * SR), np.float32); r = np.random.default_rng(3)
    for k in range(9):
        f = 1800 + r.random() * 3500; dd = 0.25
        place(buf, (sine(f, dd) * decay(dd, 14) * 0.5).astype(np.float32), k * 0.07)
    return norm_peak(buf, 0.45)


def bowling_roll(d=1.8):
    t = t_axis(d); x = lp(noise(d, 60), 380) * (0.5 + 0.5 * np.clip(t / d, 0, 1))
    return norm_peak(x * (1 + 0.3 * np.sin(2 * np.pi * 7 * t)), 0.55)


def pin_crash(d=1.4):
    buf = np.zeros(int(d * SR), np.float32); r = np.random.default_rng(8)
    for k in range(18):
        f = 500 + r.random() * 900; dd = 0.12
        place(buf, ((sine(f, dd) * decay(dd, 40) + bp(noise(dd, 70 + k), 800, 4000) * decay(dd, 60) * 0.6) * (0.4 + 0.6 * r.random())).astype(np.float32), r.random() * 0.5)
    place(buf, thud(0.4) * 0.5, 0.0)
    return norm_peak(buf, 0.75)


def door_creak(d=0.9):
    t = t_axis(d); f = 220 - 90 * t / d + 25 * np.sin(2 * np.pi * 9 * t)
    s = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR).astype(np.float32)
    return norm_peak(bp(s, 300, 1500) * np.sin(np.pi * t / d), 0.35)


def yawn_air(d=1.2):
    t = t_axis(d)
    return norm_peak(bp(noise(d, 14), 400, 1400) * np.sin(np.pi * t / d) ** 1.5, 0.3)


def cheer_small(d=1.0):
    return norm_peak(bp(noise(d, 15), 500, 2400) * np.sin(np.pi * t_axis(d) / d), 0.3)


SFX = {k: v for k, v in dict(
    footstep=footstep_cobble, footsteps=footsteps, knock=knock_wood, glass_tap=glass_tap, pea_tic=pea_tic, pea_burst=pea_burst,
    whoosh=whoosh, thud=thud, alarm_bell=alarm_bell, ding=bell_ding, tick=clock_tick, paper=paper_rustle, wind=wind, birds=birds,
    crowd=crowd_murmur, street=street_ambience, snore=snore, boing=boing, pop=pop, sparkle=sparkle, bowling_roll=bowling_roll,
    pin_crash=pin_crash, door_creak=door_creak, yawn_air=yawn_air, cheer=cheer_small).items()}
AMBIENCES = {"street", "wind", "birds", "crowd"}


# ------------------------------------------------------------------ música
NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def midi_f(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def pluck(f, d=0.8, bright=1.0):
    t = t_axis(d)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 5.5) + 0.35 * bright * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t * 16) + 0.15 * bright * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 9)
    s += hp(noise(d, int(f)), 3000) * np.exp(-t * 120) * 0.12
    return (s * np.minimum(1, t / 0.003)).astype(np.float32)


def bass(f, d=0.5):
    t = t_axis(d)
    return ((np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t * 4.5) * np.minimum(1, t / 0.004)).astype(np.float32)


def pad(freqs, d, vol=0.12):
    t = t_axis(d); x = np.zeros_like(t)
    for f in freqs:
        for det in (-0.4, 0.4):
            x += signal.sawtooth(2 * np.pi * (f + det) * t, 0.5).astype(np.float32)
    x = lp(x, 900) * vol / max(1, len(freqs))
    env = np.minimum(1, t / 0.6) * np.minimum(1, (d - t) / 0.8)
    return (x * env).astype(np.float32)


def reverb(x, d=1.4, wet=0.22):
    n = int(d * SR); ir = np.random.default_rng(5).standard_normal(n) * np.exp(-np.arange(n) / SR * 3.8)
    ir = lp(ir.astype(np.float32), 5200)
    y = signal.fftconvolve(x, ir)[:len(x)] * (wet / (np.sqrt(np.sum(ir ** 2)) + 1e-9)) * 4
    return (x * (1 - wet * 0.5) + y).astype(np.float32)


MOODS = {
    "curioso":  {"bpm": 104, "root": "C", "scale": [0, 2, 4, 7, 9], "prog": [[0, 4, 7], [9, 0, 4], [5, 9, 0], [7, 11, 2]], "bass": [0, -3, -7, -5], "pattern": 0.62},
    "misterio": {"bpm": 76,  "root": "A", "scale": [0, 3, 5, 7, 10], "prog": [[0, 3, 7], [8, 0, 3], [5, 8, 0], [7, 10, 2]], "bass": [0, -4, -7, -5], "pattern": 0.34},
    "calido":   {"bpm": 88,  "root": "G", "scale": [0, 2, 4, 7, 9], "prog": [[0, 4, 7], [2, 5, 9], [4, 7, 11], [5, 9, 0]], "bass": [0, 2, 4, 5], "pattern": 0.55},
    "tension":  {"bpm": 92,  "root": "D", "scale": [0, 1, 3, 5, 7], "prog": [[0, 3, 7], [1, 5, 8], [0, 3, 7], [7, 10, 2]], "bass": [0, 1, 0, -5], "pattern": 0.45},
}


def music(mood="curioso", duration=45.0, seed=1, bpm=None):
    m = MOODS.get(mood, MOODS["curioso"]); bpm = bpm or m["bpm"]
    r = np.random.default_rng(seed)
    buf = np.zeros(int((duration + 3) * SR), np.float32)
    beat = 60.0 / bpm; root = 48 + NOTE[m["root"]]
    bars = int(duration / (beat * 4)) + 2
    for bar in range(bars):
        t0 = bar * beat * 4; ch = m["prog"][(bar // 1) % 4]; bs = m["bass"][(bar // 1) % 4]
        chord = [midi_f(root + 12 + x + (12 if x < ch[0] else 0)) for x in ch]
        place(buf, pad([midi_f(root + 12 + x) for x in ch], beat * 4 + 0.6, 0.20), t0)
        for b in (0, 2):
            place(buf, bass(midi_f(root - 12 + bs), beat * 1.6) * 0.55, t0 + b * beat)
        # melodía/arpegio en corcheas sobre la escala del acorde
        for k in range(8):
            if r.random() > m["pattern"] + (0.2 if k % 2 == 0 else 0):
                continue
            deg = r.choice(m["scale"]) + 12 * int(r.choice([1, 1, 2]))
            note = root + 12 + deg
            place(buf, pluck(midi_f(note), 0.7, 1.0) * (0.30 + 0.15 * r.random()), t0 + k * beat * 0.5 + (r.random() - 0.5) * 0.012)
        if mood in ("curioso", "calido"):
            for k in range(4):
                place(buf, hp(noise(0.05, bar * 4 + k), 4500) * decay(0.05, 80) * 0.05, t0 + (k + 0.5) * beat)
    buf = buf[: int((duration + 1.5) * SR)]
    left = reverb(buf, 1.3, 0.25); right = reverb(np.roll(buf, int(0.011 * SR)), 1.5, 0.25)
    st = np.stack([left, right], axis=1)
    fade = np.minimum(1, np.arange(len(st)) / (SR * 0.8))[:, None] * np.minimum(1, (len(st) - np.arange(len(st))) / (SR * 1.5))[:, None]
    return (st * fade).astype(np.float32)
