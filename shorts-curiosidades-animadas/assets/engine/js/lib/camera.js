// Cámara con intención narrativa: segmentos con easing (orbit/push/pull/lerp) + creep + sacudida de impacto.
import { clamp, lerp, ease, D2R, noise1 } from './util.js';

const rng = (v, u) => (Array.isArray(v) ? lerp(v[0], v[1], u) : v);

export function evalCamera(spec, t, resolve) {
  const segs = (spec.segments || spec).slice().sort((a, b) => a.t0 - b.t0);
  let seg = segs[0];
  for (const s of segs) if (t >= s.t0) seg = s;
  const dur = Math.max(1e-3, seg.t1 - seg.t0);
  const raw = clamp((t - seg.t0) / dur);
  const u = ease(seg.ease || 'smooth', raw);
  let pos, look, fov = rng(seg.fov ?? 38, u), roll = rng(seg.roll ?? 0, u);
  if (seg.kind === 'lerp' || seg.from) {
    const f = seg.from, g = seg.to || seg.from;
    const rp = (x) => resolve(x, t, null);
    const fp = rp(f.pos), gp = rp(g.pos), fl = rp(f.look), gl = rp(g.look);
    pos = [0, 1, 2].map((i) => lerp(fp[i], gp[i], u));
    look = [0, 1, 2].map((i) => lerp(fl[i], gl[i], u));
    if (f.fov !== undefined) fov = lerp(f.fov, g.fov ?? f.fov, u);
    if (f.roll !== undefined) roll = lerp(f.roll, g.roll ?? f.roll, u);
  } else { // orbit alrededor de un objetivo (sigue al personaje si es 'char:')
    const tg = resolve(seg.target, t, [0, 0, 0]);
    const off = seg.offset ? resolve(seg.offset, t, [0, 0, 0]) : [0, 0, 0];
    const az = rng(seg.az ?? 0, u) * D2R, dist = rng(seg.dist ?? 6, u), h = rng(seg.height ?? 1.6, u);
    const ly = rng(seg.lookY ?? 1.3, u);
    const base = [tg[0] + off[0], tg[1], tg[2] + off[2]];
    pos = [base[0] + Math.sin(az) * dist, (seg.absHeight ? h : tg[1] + h), base[2] + Math.cos(az) * dist];
    look = [base[0] + (seg.lookDX ? rng(seg.lookDX, u) : 0), tg[1] + ly, base[2]];
  }
  // creep: avance muy lento para que ningún plano quede congelado
  const creep = seg.creep ?? 0.02;
  if (creep) {
    const dir = [look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]]; const L = Math.hypot(...dir) || 1;
    const k = creep * (t - seg.t0);
    pos = [pos[0] + dir[0] / L * k, pos[1] + dir[1] / L * k, pos[2] + dir[2] / L * k];
  }
  // sacudida de impacto (spec.shakes: [{t, amp, dur}])
  if (spec.shakes) {
    for (const s of spec.shakes) {
      const dt = t - s.t; if (dt < 0 || dt > (s.dur ?? 0.35)) continue;
      const k = (1 - dt / (s.dur ?? 0.35)); const a = (s.amp ?? 0.08) * k * k;
      pos = [pos[0] + (noise1(t * 40, 1) - 0.5) * a, pos[1] + (noise1(t * 40, 2) - 0.5) * a, pos[2]];
      roll += (noise1(t * 33, 3) - 0.5) * a * 18;
    }
  }
  return { pos, look, fov, roll };
}
