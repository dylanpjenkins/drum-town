// tools/checks/check-notation-frame.js
// Nothing a stave draws may fall outside its viewBox.
//
// Tuplet brackets sit above the stave (hands) or below it (feet), beyond the
// stems and flags. With the viewBox pinned to "0 0 w h" those brackets were
// drawn at negative y and silently clipped, so every shuffle lesson rendered
// without the "3" that is the entire point of the exercise (iter 31). The
// renderer now grows the frame to the drawn content; this gate proves it
// stays that way. Exit 0 = clean.
//
// VERTICAL vs HORIZONTAL (BL-065). The vertical half reads `y=` attributes,
// which is enough because the things that clip upward are <text> (the tuplet
// "3") and <rect>. That trick does not transfer sideways: the things that clip
// rightward are noteheads, stems and beams, and VexFlow draws all three as
// <path> glyph outlines with no `x=` attribute at all. A y-style attribute scan
// finds only the stave rect and concludes everything fits, which is exactly why
// eight staves drew up to 78 units past their frame for dozens of iterations
// with this gate green. The horizontal half therefore parses the path data:
// exact cubic and quadratic extremes, sampled arcs, so it measures the drawn
// curve rather than trusting the renderer's own number.
//
// That independence has already paid for itself. The renderer's first fix for
// BL-065 sized the frame from VexFlow's `drawOverflow` alone, which looked
// airtight because it never under-reported across all 932 corpus specs. It is
// not airtight: a tuplet bracket is a bare <rect> attached to no tickable, so
// `drawOverflow` cannot see it, and a 4-bar spec whose closing tuplet ends in
// ghost rests puts 13.9 units of bracket outside the frame. This gate catches
// that spec; a gate asserting with the renderer's own number would have
// certified it. Never measure the output with the thing that produced it.

const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { renderPattern } = require(path.join(ROOT, 'tools/notation-renderer.js'));
const lessonContent = require(path.join(ROOT, 'src/_data/lessonContent.js'));

let rudiments = null;
try { rudiments = require(path.join(ROOT, 'src/_data/rudiments.js')); } catch (e) {}

const TOL = 0.5;
const findings = [];
let checked = 0;

// ---- rightmost-ink measurement -------------------------------------------
// Exact max of a cubic/quadratic bezier's x over t in [0,1]. Endpoints plus any
// interior stationary point; the hull would over-report and could fail a stave
// that actually fits.
function cubicMaxX(x0, x1, x2, x3) {
  let m = Math.max(x0, x3);
  const a = -x0 + 3 * x1 - 3 * x2 + x3;
  const b = 2 * (x0 - 2 * x1 + x2);
  const c = -x0 + x1;
  const roots = [];
  if (Math.abs(a) < 1e-12) { if (Math.abs(b) > 1e-12) roots.push(-c / b); }
  else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) { const s = Math.sqrt(disc); roots.push((-b + s) / (2 * a), (-b - s) / (2 * a)); }
  }
  for (const t of roots) {
    if (t > 0 && t < 1) {
      const u = 1 - t;
      const x = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
      if (x > m) m = x;
    }
  }
  return m;
}
function quadMaxX(x0, x1, x2) {
  let m = Math.max(x0, x2);
  const den = x0 - 2 * x1 + x2;
  if (Math.abs(den) > 1e-12) {
    const t = (x0 - x1) / den;
    if (t > 0 && t < 1) { const u = 1 - t; const x = u * u * x0 + 2 * u * t * x1 + t * t * x2; if (x > m) m = x; }
  }
  return m;
}
// Arcs appear inside glyph outlines. Endpoint -> center parameterization, then
// sampled; 128 steps is well under a tenth of a unit on glyph-scale radii.
function arcMaxX(x0, y0, rx, ry, rot, laf, sf, x1, y1) {
  let m = Math.max(x0, x1);
  if (!rx || !ry) return m;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (rot * Math.PI) / 180, cosP = Math.cos(phi), sinP = Math.sin(phi);
  const dx2 = (x0 - x1) / 2, dy2 = (y0 - y1) / 2;
  const xp = cosP * dx2 + sinP * dy2, yp = -sinP * dx2 + cosP * dy2;
  const lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
  const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
  const den = rx * rx * yp * yp + ry * ry * xp * xp;
  let co = den === 0 ? 0 : Math.sqrt(Math.max(0, num / den));
  if (laf === sf) co = -co;
  const cxp = (co * rx * yp) / ry, cyp = (-co * ry * xp) / rx;
  const cx = cosP * cxp - sinP * cyp + (x0 + x1) / 2;
  const cy = sinP * cxp + cosP * cyp + (y0 + y1) / 2;
  const ang = (ux, uy, vx, vy) => {
    const d = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let c = d === 0 ? 1 : (ux * vx + uy * vy) / d;
    c = Math.min(1, Math.max(-1, c));
    const a = Math.acos(c);
    return ux * vy - uy * vx < 0 ? -a : a;
  };
  const t0 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!sf && dt > 0) dt -= 2 * Math.PI;
  if (sf && dt < 0) dt += 2 * Math.PI;
  for (let i = 0; i <= 128; i++) {
    const t = t0 + (dt * i) / 128;
    const px = cx + rx * Math.cos(t) * cosP - ry * Math.sin(t) * sinP;
    if (px > m) m = px;
  }
  return m;
}
const ARGC = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
function pathMaxX(d) {
  const toks = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  let max = -Infinity, cx = 0, cy = 0, sx = 0, sy = 0, c2x = null, q1x = null, cmd = null, i = 0;
  const bump = v => { if (v > max) max = v; };
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) {
      cmd = toks[i]; i++;
      if (cmd === 'Z' || cmd === 'z') { cx = sx; cy = sy; continue; }
    }
    if (cmd === null) { i++; continue; }
    const up = cmd.toUpperCase(), rel = cmd !== up, n = ARGC[up];
    if (n === undefined) { i++; continue; }
    const a = [];
    for (let k = 0; k < n; k++) a.push(parseFloat(toks[i + k]));
    if (a.some(Number.isNaN)) break;
    i += n;
    const AX = v => (rel ? cx + v : v), AY = v => (rel ? cy + v : v);
    let nx = cx, ny = cy;
    if (up === 'M') { nx = AX(a[0]); ny = AY(a[1]); sx = nx; sy = ny; bump(nx); cmd = rel ? 'l' : 'L'; }
    else if (up === 'L') { nx = AX(a[0]); ny = AY(a[1]); bump(Math.max(cx, nx)); }
    else if (up === 'H') { nx = AX(a[0]); bump(Math.max(cx, nx)); }
    else if (up === 'V') { ny = AY(a[0]); bump(cx); }
    else if (up === 'C') { const x1 = AX(a[0]), x2 = AX(a[2]); nx = AX(a[4]); ny = AY(a[5]); bump(cubicMaxX(cx, x1, x2, nx)); c2x = x2; }
    else if (up === 'S') { const x1 = c2x === null ? cx : 2 * cx - c2x, x2 = AX(a[0]); nx = AX(a[2]); ny = AY(a[3]); bump(cubicMaxX(cx, x1, x2, nx)); c2x = x2; }
    else if (up === 'Q') { const x1 = AX(a[0]); nx = AX(a[2]); ny = AY(a[3]); bump(quadMaxX(cx, x1, nx)); q1x = x1; }
    else if (up === 'T') { const x1 = q1x === null ? cx : 2 * cx - q1x; nx = AX(a[0]); ny = AY(a[1]); bump(quadMaxX(cx, x1, nx)); q1x = x1; }
    else if (up === 'A') { nx = AX(a[5]); ny = AY(a[6]); bump(arcMaxX(cx, cy, a[0], a[1], a[2], a[3], a[4], nx, ny)); }
    if (up !== 'C' && up !== 'S') c2x = null;
    if (up !== 'Q' && up !== 'T') q1x = null;
    cx = nx; cy = ny;
  }
  return max;
}
const _attr = (tag, name) => {
  const m = new RegExp('\\s' + name + '="([^"]*)"').exec(tag);
  return m ? m[1] : null;
};
// <text> carries no width. Conservative Arial advances (upper bounds per class)
// so a sticking letter that really does cross the frame is caught; the corpus's
// widest annotation is a single "R", ~13.4 units at the 14pt sticking size.
function textRight(tag, body) {
  const x = parseFloat(_attr(tag, 'x') || 'NaN');
  if (Number.isNaN(x)) return -Infinity;
  const fs = /([\d.]+)\s*(pt|px)?/.exec(_attr(tag, 'font-size') || '12pt');
  const size = fs ? (fs[2] === 'px' ? parseFloat(fs[1]) : parseFloat(fs[1]) * (4 / 3)) : 16;
  let em = 0;
  for (const ch of body.replace(/<[^>]*>/g, '')) em += /[0-9]/.test(ch) ? 0.556 : 0.72;
  const adv = em * size;
  const anchor = _attr(tag, 'text-anchor') || 'start';
  return anchor === 'end' ? x : anchor === 'middle' ? x + adv / 2 : x + adv;
}
function inkRight(svg) {
  let max = -Infinity, src = '';
  const bump = (v, what) => { if (v > max) { max = v; src = what; } };
  for (const m of svg.matchAll(/<path\b[^>]*\sd="([^"]*)"[^>]*>/g)) {
    const v = pathMaxX(m[1]);
    if (Number.isFinite(v)) bump(v, 'path');
  }
  for (const m of svg.matchAll(/<rect\b[^>]*>/g)) {
    const x = parseFloat(_attr(m[0], 'x') || 'NaN');
    const w = parseFloat(_attr(m[0], 'width') || '0');
    if (!Number.isNaN(x)) bump(x + (Number.isNaN(w) ? 0 : w), 'rect');
  }
  for (const m of svg.matchAll(/<line\b[^>]*>/g)) {
    for (const nm of ['x1', 'x2']) {
      const v = parseFloat(_attr(m[0], nm) || 'NaN');
      if (!Number.isNaN(v)) bump(v, 'line');
    }
  }
  for (const m of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    bump(textRight('<text' + m[1] + '>', m[2]), 'text');
  }
  return { max, src };
}
// ---------------------------------------------------------------------------

function inspect(label, spec) {
  if (!spec || !spec.timeSignature) return;
  let svg;
  try { svg = renderPattern(spec); } catch (e) { findings.push(`${label}: render threw — ${e.message}`); return; }
  if (/notation-error/.test(svg)) { findings.push(`${label}: renderer returned an error block`); return; }
  const vb = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!vb) { findings.push(`${label}: no parsable viewBox`); return; }
  checked++;
  const vx = parseFloat(vb[1]);
  const vy = parseFloat(vb[2]);
  const vw = parseFloat(vb[3]);
  const vh = parseFloat(vb[4]);
  const frameBottom = vy + vh;
  const frameRight = vx + vw;

  let minY = Infinity;
  let maxY = -Infinity;
  for (const m of svg.matchAll(/\sy="(-?[\d.]+)"/g)) minY = Math.min(minY, parseFloat(m[1]));
  for (const m of svg.matchAll(/\sy="(-?[\d.]+)"[^>]*?height="([\d.]+)"/g)) {
    maxY = Math.max(maxY, parseFloat(m[1]) + parseFloat(m[2]));
  }
  if (minY !== Infinity && minY < vy - TOL) {
    findings.push(`${label}: draws ${(vy - minY).toFixed(0)}px ABOVE the frame (bracket clipped)`);
  }
  if (maxY !== -Infinity && maxY > frameBottom + TOL) {
    findings.push(`${label}: draws ${(maxY - frameBottom).toFixed(0)}px BELOW the frame (bracket clipped)`);
  }

  // Horizontal (BL-065). Ink past the right edge is a note the reader never
  // sees, so the frame must reach it.
  const ink = inkRight(svg);
  if (Number.isFinite(ink.max) && ink.max > frameRight + TOL) {
    findings.push(
      `${label}: draws ${(ink.max - frameRight).toFixed(1)}u PAST the right edge ` +
      `(<${ink.src}> ink to x=${ink.max.toFixed(1)}, frame ends at ${frameRight.toFixed(1)}) — notes clipped`
    );
  }
  // A frame that reaches far past the last ink is its own defect: the stave is
  // scaled to its viewBox, so dead space on the right shrinks the notes. The
  // renderer leaves ~7 units of gutter by design; 60 is loose enough never to
  // fire on that and tight enough to catch a runaway grow.
  if (Number.isFinite(ink.max) && ink.max < frameRight - 60) {
    findings.push(
      `${label}: frame runs ${(frameRight - ink.max).toFixed(1)}u past the last ink ` +
      `(ends x=${ink.max.toFixed(1)}, frame ${frameRight.toFixed(1)}) — stave shrunk by dead space`
    );
  }
}

for (const [slug, lesson] of Object.entries(lessonContent)) {
  (lesson.exercises || []).forEach((ex, i) => inspect(`${slug}#${i}`, ex));
}
if (rudiments) {
  for (const group of Object.values(rudiments)) {
    const list = Array.isArray(group) ? group : (group && group.rudiments) || [];
    for (const r of list) {
      if (r && r.spec) inspect(`rudiment:${r.slug || r.name || '?'}.spec`, r.spec);
      if (r && r.card) inspect(`rudiment:${r.slug || r.name || '?'}.card`, r.card);
    }
  }
}

if (findings.length) {
  console.error(`[check-notation-frame] FAIL: ${findings.length} stave(s) draw outside their frame`);
  findings.slice(0, 25).forEach(f => console.error('  ' + f));
  if (findings.length > 25) console.error(`  … and ${findings.length - 25} more`);
  process.exit(1);
}
console.log(`[check-notation-frame] OK — all ${checked} staves fit inside their viewBox (both axes)`);
