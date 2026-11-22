// Utilidades matemáticas deterministas (todo es función pura del tiempo => render reproducible).
export const D2R = Math.PI / 180;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeOut = (t) => { t = clamp(t); return 1 - (1 - t) * (1 - t); };
export const easeIn = (t) => { t = clamp(t); return t * t; };
export const easeFns = {
  linear: (t) => clamp(t), smooth, smoother, out: easeOut, in: easeIn,
};
export function ease(name, t) { return (easeFns[name] || smooth)(t); }

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// ruido de valor 1D suave y determinista
export function noise1(x, seed = 1) {
  const i = Math.floor(x), f = x - i;
  const r = (n) => mulberry32(n * 7919 + seed * 104729)();
  return lerp(r(i), r(i + 1), smooth(f));
}
export const lerpArr = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

// Interpola una lista de claves [{t, v}] (v número o array) con easing por tramo.
export function sampleKeys(keys, t, getV = (k) => k.v) {
  if (!keys.length) return null;
  if (t <= keys[0].t) return getV(keys[0]);
  const last = keys[keys.length - 1];
  if (t >= last.t) return getV(last);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t >= a.t && t <= b.t) {
      const u = ease(b.ease || 'smooth', (t - a.t) / Math.max(1e-6, b.t - a.t));
      const va = getV(a), vb = getV(b);
      return Array.isArray(va) ? va.map((x, j) => lerp(x, vb[j], u)) : lerp(va, vb, u);
    }
  }
  return getV(last);
}
