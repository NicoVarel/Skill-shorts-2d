// Subtítulos palabra a palabra y etiquetas de contexto (lugar/fecha), dibujados en un canvas 2D encima del 3D.
import { clamp, smooth, easeOut } from './util.js';

const FONT = '"Arial Black","Segoe UI Black","Impact","Helvetica Neue",sans-serif';
export const BRAND = { blue: '#2f7bff', navy: '#0c1a3f', white: '#ffffff', ink: '#070a14' };

function fitFont(g, lines, maxW, size) {
  let s = size;
  for (let k = 0; k < 8; k++) {
    g.font = `900 ${s}px ${FONT}`;
    const w = Math.max(...lines.map((l) => g.measureText(l.map((x) => x.w).join(' ')).width));
    if (w <= maxW) return s;
    s *= 0.93;
  }
  return s;
}

export function drawSubtitles(g, W, H, t, cues, style = {}) {
  const cue = cues.find((c) => t >= c.start - 0.04 && t <= c.end + 0.12);
  if (!cue) return null;
  const size0 = (style.size ?? 0.071) * W;
  const lines = cue.lines;
  const size = fitFont(g, lines, W * 0.9, size0);
  const lineH = size * 1.2;
  const cy = (style.y ?? 0.655) * H;
  const total = lines.length * lineH;
  const y0 = cy - total / 2 + lineH * 0.82;
  g.save();
  g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.miterLimit = 2;
  g.font = `900 ${size}px ${FONT}`;
  const spaceW = g.measureText(' ').width * 1.55 + size * 0.06;
  const rects = [];
  lines.forEach((line, li) => {
    const widths = line.map((w) => g.measureText(w.w).width);
    const lw = widths.reduce((a, b) => a + b, 0) + spaceW * (line.length - 1);
    let x = W / 2 - lw / 2;
    line.forEach((w, wi) => {
      const active = t >= w.t0 && t < w.t1 + 0.02;
      const since = t - w.t0;
      const pop = active ? 1 + 0.13 * easeOut(clamp(since / 0.09)) * (1 - 0.35 * smooth(clamp((since - 0.09) / 0.25))) : 1;
      const cx = x + widths[wi] / 2, y = y0 + li * lineH;
      g.save(); g.translate(cx, y - size * 0.3); g.scale(pop, pop);
      const col = w.hl ? BRAND.blue : BRAND.white;
      g.lineWidth = size * 0.2; g.strokeStyle = BRAND.ink; g.strokeText(w.w, -widths[wi] / 2, size * 0.3);
      g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = size * 0.1; g.shadowOffsetY = size * 0.06;
      g.fillStyle = col; g.fillText(w.w, -widths[wi] / 2, size * 0.3);
      g.shadowColor = 'transparent';
      if (w.hl) { g.lineWidth = size * 0.03; g.strokeStyle = 'rgba(255,255,255,0.0)'; }
      g.restore();
      rects.push({ x0: x, x1: x + widths[wi], y0: y - size, y1: y + size * 0.3, li });
      x += widths[wi] + spaceW;
    });
  });
  g.restore();
  const box = { x0: Math.min(...rects.map((r) => r.x0)), x1: Math.max(...rects.map((r) => r.x1)), y0: Math.min(...rects.map((r) => r.y0)), y1: Math.max(...rects.map((r) => r.y1)), lines: lines.length, size };
  return box;
}

export function drawChip(g, W, H, t, chip) {
  if (t < chip.t0 || t > chip.t1) return;
  const a = smooth(clamp((t - chip.t0) / 0.25)) * smooth(clamp((chip.t1 - t) / 0.25));
  const slide = (1 - a) * 30;
  const size = W * 0.036;
  g.save();
  g.globalAlpha = a; g.font = `900 ${size}px ${FONT}`;
  const sub = chip.sub || '';
  const tw = Math.max(g.measureText(chip.text).width, sub ? g.measureText(sub).width * 0.8 : 0);
  const pw = tw + size * 2.3, ph = size * (sub ? 2.9 : 1.9);
  const x = chip.align === 'left' ? W * 0.07 : (W - pw) / 2, y = (chip.y ?? 0.15) * H - slide;
  g.fillStyle = 'rgba(12,26,63,0.88)';
  g.beginPath(); g.roundRect(x, y, pw, ph, size * 0.45); g.fill();
  g.fillStyle = BRAND.blue; g.beginPath(); g.roundRect(x, y, size * 0.32, ph, [size * 0.45, 0, 0, size * 0.45]); g.fill();
  g.fillStyle = '#fff'; g.textBaseline = 'middle';
  g.fillText(chip.text, x + size * 0.95, y + (sub ? ph * 0.36 : ph / 2));
  if (sub) { g.font = `800 ${size * 0.78}px ${FONT}`; g.fillStyle = '#b9ccff'; g.fillText(sub, x + size * 0.95, y + ph * 0.74); }
  g.restore();
}
