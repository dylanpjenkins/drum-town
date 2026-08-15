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
// MEASURE THE DRAWING, NOT THE ATTRIBUTES (BL-065 horizontal, BL-111 vertical).
// VexFlow draws noteheads, stems, beams, rest glyphs and the tuplet NUMERAL as
// <path> outlines with no x or y attribute at all, so an attribute scan sees
// the stave rect, the annotations and nothing else — it finds no ink outside
// any frame because it cannot see the ink. This gate therefore parses the path
// data on BOTH axes: exact stationary points of every cubic and quadratic,
// sampled arcs, rect and line corners, and a text box built from Arial's own
// metrics. It measures the drawn curve rather than trusting the renderer's
// number.
//
// That independence has already paid for itself twice.
//
//   BL-065. The renderer's first fix sized the frame from VexFlow's
//   `drawOverflow` alone, which looked airtight because it never under-reported
//   across all 932 corpus specs. It is not airtight: a tuplet bracket is a bare
//   <rect> attached to no tickable, so `drawOverflow` cannot see it, and a
//   4-bar spec whose closing tuplet ends in ghost rests puts 13.9 units of
//   bracket outside the frame.
//
//   BL-111. The vertical half of this gate used to re-run the renderer's own
//   two `y="…"` regexes against the renderer's own arithmetic — the exact
//   anti-pattern the paragraph above names. It could only ever fire if the grow
//   formula were deleted outright, and so it printed OK while 332 staves drew up
//   to 14.6 units of ink BELOW their frame and 66 drew up to 21.5 above it: both
//   tuplet "3"s missing from rock-prog#0's feet triplets, the third "3" of four
//   missing from fusion-half-time-shuffle#1, the bottom sheared off a
//   hi-hat-foot X notehead on hi-hat-articulation#4. The same defect the gate
//   was written for, live on the opposite edge, under a green gate. Never
//   measure the output with the thing that produced it.
//
//   Those two counts are this file's own output, which is the point of writing
//   them down here: disable the renderer's `bottom` grow and this gate prints
//   FAIL on 332, disable `top` and it prints 66, run it against the whole
//   pre-fix renderer and it prints 398 — 332 + 66. The item was filed as "292
//   below", from a parser that measured the path CENTERLINE and forgot these
//   paths are stroked; a header number its own gate contradicts by 40 is worse
//   than no number.
//
// WHAT GREEN DOES NOT MEAN. This gate cannot falsify most of the renderer's
// arithmetic. Disable the arc sweep, or the cubic stationary points, or the
// half-stroke inflation on the renderer's side and this file still passes,
// because FRAME_PAD 4 plus outward rounding plus 0.75u of stroke absorbs any
// error under about 5 units. That is the right failure mode for a frame that
// errs outward — but green here certifies "nothing is clipped", not "the
// geometry is computed correctly". Eight of sixteen renderer mutations do turn
// it red, including every one that stops the frame growing.
//
// The renderer has its own, separate ink measurement (notation-renderer.js,
// `_inkExtent`). These two implementations must stay separate: no shared
// module, no shared constants, no shared intermediate number. Where they must
// agree — the text box, which no attribute reports — this file is deliberately
// the TIGHTER of the two (0.88/0.22 em against the renderer's 0.92/0.26), so a
// metric disagreement can never fail a stave the renderer sized correctly,
// while both stay above real Arial ink for the glyphs VexFlow emits here
// (R, L, o, digits: cap height 0.716em, ascender 0.905em, no descenders).

const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { renderPattern } = require(path.join(ROOT, 'tools/notation-renderer.js'));
const lessonContent = require(path.join(ROOT, 'src/_data/lessonContent.js'));

let rudiments = null;
try { rudiments = require(path.join(ROOT, 'src/_data/rudiments.js')); } catch (e) {}

const TOL = 0.5;
// Coverage, asserted rather than printed. A gate that silently measures zero
// staves — a renamed data file, a rudiments require that throws into the catch
// above, an exercises key that moves — passes just as loudly as one that
// measures all of them. 932 = 852 lesson exercises + 80 rudiment specs/cards at
// the time of writing; new content raises it, so this is a floor, not an equal.
// It has zero headroom by design: deleting one exercise turns this gate red with
// a coverage message rather than a frame one. That is the intended trade — a
// deliberate removal is a one-line edit here, a silent one is a hole.
const MIN_STAVES = 932;
// And the specific staves BL-111 was filed on. If the walk stops reaching these
// slugs, the corpus count alone would not notice.
const REQUIRED_LABELS = [
  'rock-prog#0',
  'fusion-half-time-shuffle#1',
  'funk-purdie-shuffle#1',
  'hi-hat-articulation#4',
  'cymbal-voicings#2'
];
// The tallest frame the renderer produces from its own defaults (DEFAULT_HEIGHT
// 130 / STICKING_HEIGHT 140). Only a fallback: an author who pins `spec.height`
// chooses their own baseline, and the dead-space check below reads THAT instead.
// Gating on "taller than 140" alone reported a 400-unit pinned frame as a
// runaway grow when the grow formula had done nothing at all.
const UNGROWN_MAX_HEIGHT = 140;
// A grown edge should sit just past the ink that forced it (the renderer pads by
// 4 and rounds outward, so 4.0–5.0 in practice). 12 never fires on that and
// still catches a grow formula that has run away.
const GROWN_SLACK = 12;

const findings = [];
const seen = new Set();
let checked = 0;

// ---- ink measurement, both axes ------------------------------------------
// Exact range of a cubic/quadratic bezier over t in [0,1] along one axis:
// endpoints plus any interior stationary point. The control hull would be
// simpler and would never under-report, but it over-reports by up to 6 units on
// real glyph outlines, which would fail staves that actually fit.
function cubicRange(p0, p1, p2, p3) {
  let lo = Math.min(p0, p3), hi = Math.max(p0, p3);
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = -p0 + p1;
  const roots = [];
  if (Math.abs(a) < 1e-12) { if (Math.abs(b) > 1e-12) roots.push(-c / b); }
  else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) { const s = Math.sqrt(disc); roots.push((-b + s) / (2 * a), (-b - s) / (2 * a)); }
  }
  for (const t of roots) {
    if (t > 0 && t < 1) {
      const u = 1 - t;
      const v = u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return [lo, hi];
}
function quadRange(p0, p1, p2) {
  let lo = Math.min(p0, p2), hi = Math.max(p0, p2);
  const den = p0 - 2 * p1 + p2;
  if (Math.abs(den) > 1e-12) {
    const t = (p0 - p1) / den;
    if (t > 0 && t < 1) {
      const u = 1 - t;
      const v = u * u * p0 + 2 * u * t * p1 + t * t * p2;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return [lo, hi];
}
// Arcs appear inside glyph outlines. Endpoint -> center parameterization, then
// sampled; 128 steps is well under a tenth of a unit on glyph-scale radii.
function arcRange(x0, y0, rx, ry, rot, laf, sf, x1, y1) {
  const box = [Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1)];
  if (!rx || !ry) return box;
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
    const py = cy + rx * Math.cos(t) * sinP + ry * Math.sin(t) * cosP;
    if (px < box[0]) box[0] = px;
    if (px > box[1]) box[1] = px;
    if (py < box[2]) box[2] = py;
    if (py > box[3]) box[3] = py;
  }
  return box;
}
const ARGC = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
// Returns [minX, maxX, minY, maxY] for one path's `d`.
function pathBounds(d) {
  const toks = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  const box = [Infinity, -Infinity, Infinity, -Infinity];
  const bumpX = v => { if (v < box[0]) box[0] = v; if (v > box[1]) box[1] = v; };
  const bumpY = v => { if (v < box[2]) box[2] = v; if (v > box[3]) box[3] = v; };
  const bumpRange = (rx, ry) => { bumpX(rx[0]); bumpX(rx[1]); bumpY(ry[0]); bumpY(ry[1]); };
  let cx = 0, cy = 0, sx = 0, sy = 0;
  let c2x = null, c2y = null, q1x = null, q1y = null, cmd = null, i = 0;
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
    if (up === 'M') { nx = AX(a[0]); ny = AY(a[1]); sx = nx; sy = ny; bumpX(nx); bumpY(ny); cmd = rel ? 'l' : 'L'; }
    else if (up === 'L') { nx = AX(a[0]); ny = AY(a[1]); bumpX(cx); bumpX(nx); bumpY(cy); bumpY(ny); }
    else if (up === 'H') { nx = AX(a[0]); bumpX(cx); bumpX(nx); bumpY(cy); }
    else if (up === 'V') { ny = AY(a[0]); bumpX(cx); bumpY(cy); bumpY(ny); }
    else if (up === 'C') {
      const x1 = AX(a[0]), y1 = AY(a[1]), x2 = AX(a[2]), y2 = AY(a[3]);
      nx = AX(a[4]); ny = AY(a[5]);
      bumpRange(cubicRange(cx, x1, x2, nx), cubicRange(cy, y1, y2, ny));
      c2x = x2; c2y = y2;
    } else if (up === 'S') {
      const x1 = c2x === null ? cx : 2 * cx - c2x, y1 = c2y === null ? cy : 2 * cy - c2y;
      const x2 = AX(a[0]), y2 = AY(a[1]);
      nx = AX(a[2]); ny = AY(a[3]);
      bumpRange(cubicRange(cx, x1, x2, nx), cubicRange(cy, y1, y2, ny));
      c2x = x2; c2y = y2;
    } else if (up === 'Q') {
      const x1 = AX(a[0]), y1 = AY(a[1]);
      nx = AX(a[2]); ny = AY(a[3]);
      bumpRange(quadRange(cx, x1, nx), quadRange(cy, y1, ny));
      q1x = x1; q1y = y1;
    } else if (up === 'T') {
      const x1 = q1x === null ? cx : 2 * cx - q1x, y1 = q1y === null ? cy : 2 * cy - q1y;
      nx = AX(a[0]); ny = AY(a[1]);
      bumpRange(quadRange(cx, x1, nx), quadRange(cy, y1, ny));
      q1x = x1; q1y = y1;
    } else if (up === 'A') {
      nx = AX(a[5]); ny = AY(a[6]);
      const r = arcRange(cx, cy, a[0], a[1], a[2], a[3], a[4], nx, ny);
      bumpX(r[0]); bumpX(r[1]); bumpY(r[2]); bumpY(r[3]);
    }
    if (up !== 'C' && up !== 'S') { c2x = null; c2y = null; }
    if (up !== 'Q' && up !== 'T') { q1x = null; q1y = null; }
    cx = nx; cy = ny;
  }
  return box;
}
const _attr = (tag, name) => {
  const m = new RegExp('\\s' + name + '="([^"]*)"').exec(tag);
  return m ? m[1] : null;
};
// <text> carries neither width nor height, and its `y` is the BASELINE — the
// letter's ink runs above it. Reading `y` as the top is how 247 sticking staves
// could never be caught hanging below their frame and how 20 staves' annotation
// ink sat above it unnoticed. Conservative Arial bounds per class (upper bounds
// on the real glyphs, lower bounds on the renderer's allowance — see header).
// VexFlow writes font-size in POINTS; inside a viewBox 1pt = 4/3 user units.
function ptToUnits(raw) {
  const m = /([\d.]+)\s*(pt|px)?/.exec(raw || '');
  if (!m) return null;
  return m[2] === 'px' ? parseFloat(m[1]) : parseFloat(m[1]) * (4 / 3);
}
// 438 of the corpus's 3091 <text> elements — the open-hat "o" annotations —
// name no font-size and inherit the root <svg font-size="10pt"> (13.33 units).
// Both this file and the renderer used to guess 12pt/16 units for those. Wrong
// in both, identically, and safe only because 16 > 13.33: a root size above
// 12pt would have made both under-measure in step, and this gate would have
// certified a clipped annotation. Read the root.
function rootFontUnits(svg) {
  const root = /<svg\b[^>]*>/.exec(svg);
  const v = root ? ptToUnits(_attr(root[0], 'font-size')) : null;
  return v === null ? 16 : v; // 16 = the CSS initial, for markup with no root size
}
function textBounds(tag, body, inherited) {
  const x = parseFloat(_attr(tag, 'x') || 'NaN');
  const y = parseFloat(_attr(tag, 'y') || 'NaN');
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  const own = ptToUnits(_attr(tag, 'font-size'));
  const size = own === null ? inherited : own;
  const txt = body.replace(/<[^>]*>/g, '');
  let em = 0;
  for (const ch of txt) em += /[0-9]/.test(ch) ? 0.556 : 0.72;
  const adv = em * size;
  const anchor = _attr(tag, 'text-anchor') || 'start';
  const x0 = anchor === 'end' ? x - adv : anchor === 'middle' ? x - adv / 2 : x;
  return [x0, x0 + adv, y - 0.88 * size, y + 0.22 * size];
}
// A path's `d` is its CENTERLINE, and these paths are stroked, not just filled:
// the stave lines, stems and beams are `fill="none"` and are ENTIRELY stroke.
// Ink therefore runs half a stroke-width past the geometry on every side — up
// to 0.75 units here, against a tightest measured gutter of 1.72. Stroke state
// is inherited (the root sets stroke-width 0.3, a <g> sets 1) and this file
// walks no ancestors, so take the widest stroke-width in the document and halve
// it: an upper bound, which is the only safe direction for a gate. A tighter
// per-element rule would under-report and could certify a clipped stem.
function maxHalfStroke(svg) {
  let widest = 1; // SVG's own default, for a document that never names one
  let seen = false;
  for (const m of svg.matchAll(/\sstroke-width="([\d.]+)"/g)) {
    const v = parseFloat(m[1]);
    if (Number.isNaN(v)) continue;
    if (!seen || v > widest) widest = v;
    seen = true;
  }
  return widest / 2;
}
function inkBox(svg) {
  const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  const src = { minX: '', maxX: '', minY: '', maxY: '' };
  const eat = (b, what) => {
    if (!b || !Number.isFinite(b[0]) || !Number.isFinite(b[2])) return;
    if (b[0] < box.minX) { box.minX = b[0]; src.minX = what; }
    if (b[1] > box.maxX) { box.maxX = b[1]; src.maxX = what; }
    if (b[2] < box.minY) { box.minY = b[2]; src.minY = what; }
    if (b[3] > box.maxY) { box.maxY = b[3]; src.maxY = what; }
  };
  for (const m of svg.matchAll(/<path\b[^>]*\sd="([^"]*)"[^>]*>/g)) eat(pathBounds(m[1]), 'path');
  for (const m of svg.matchAll(/<rect\b[^>]*>/g)) {
    const x = parseFloat(_attr(m[0], 'x') || 'NaN');
    const y = parseFloat(_attr(m[0], 'y') || 'NaN');
    if (Number.isNaN(x) || Number.isNaN(y)) continue;
    const w = parseFloat(_attr(m[0], 'width') || '0');
    const h = parseFloat(_attr(m[0], 'height') || '0');
    eat([x, x + (Number.isNaN(w) ? 0 : w), y, y + (Number.isNaN(h) ? 0 : h)], 'rect');
  }
  // <line> has x1/x2/y1/y2 and matches none of the attribute names the old
  // scan looked for, so it was invisible on the vertical axis entirely.
  for (const m of svg.matchAll(/<line\b[^>]*>/g)) {
    const x1 = parseFloat(_attr(m[0], 'x1') || 'NaN');
    const y1 = parseFloat(_attr(m[0], 'y1') || 'NaN');
    const x2 = parseFloat(_attr(m[0], 'x2') || 'NaN');
    const y2 = parseFloat(_attr(m[0], 'y2') || 'NaN');
    if ([x1, y1, x2, y2].some(Number.isNaN)) continue;
    eat([Math.min(x1, x2), Math.max(x1, x2), Math.min(y1, y2), Math.max(y1, y2)], 'line');
  }
  const inherited = rootFontUnits(svg);
  for (const m of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    eat(textBounds('<text' + m[1] + '>', m[2], inherited), 'text');
  }
  if (Number.isFinite(box.minX) && Number.isFinite(box.minY)) {
    const half = maxHalfStroke(svg);
    box.minX -= half; box.maxX += half;
    box.minY -= half; box.maxY += half;
  }
  return { box, src };
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
  seen.add(label);
  const vx = parseFloat(vb[1]);
  const vy = parseFloat(vb[2]);
  const vw = parseFloat(vb[3]);
  const vh = parseFloat(vb[4]);
  const frameBottom = vy + vh;
  const frameRight = vx + vw;

  // Neither this file nor the renderer composes ancestor transforms. VexFlow
  // emits none today (0 of 932 staves), and every coordinate below is read as
  // if it were in the root user space — so a transform anywhere would make both
  // measurements quietly wrong rather than merely incomplete. Fail on it.
  const tf = /<([a-zA-Z]+)\b[^>]*\stransform="([^"]*)"/.exec(svg);
  if (tf) {
    findings.push(`${label}: <${tf[1]}> carries transform="${tf[2]}" — ink measurement does not compose transforms`);
    return;
  }

  const { box, src } = inkBox(svg);
  if (!Number.isFinite(box.minY) || !Number.isFinite(box.minX)) {
    findings.push(`${label}: no measurable ink in the SVG`);
    return;
  }

  // Ink outside the frame is ink the reader never sees: a clipped notehead, a
  // sheared sticking letter, a missing tuplet "3".
  if (box.minY < vy - TOL) {
    findings.push(
      `${label}: draws ${(vy - box.minY).toFixed(1)}u ABOVE the frame ` +
      `(<${src.minY}> ink to y=${box.minY.toFixed(1)}, frame starts at ${vy.toFixed(1)}) — clipped`
    );
  }
  if (box.maxY > frameBottom + TOL) {
    findings.push(
      `${label}: draws ${(box.maxY - frameBottom).toFixed(1)}u BELOW the frame ` +
      `(<${src.maxY}> ink to y=${box.maxY.toFixed(1)}, frame ends at ${frameBottom.toFixed(1)}) — clipped`
    );
  }
  if (box.minX < vx - TOL) {
    findings.push(
      `${label}: draws ${(vx - box.minX).toFixed(1)}u PAST the left edge ` +
      `(<${src.minX}> ink to x=${box.minX.toFixed(1)}, frame starts at ${vx.toFixed(1)}) — notes clipped`
    );
  }
  if (box.maxX > frameRight + TOL) {
    findings.push(
      `${label}: draws ${(box.maxX - frameRight).toFixed(1)}u PAST the right edge ` +
      `(<${src.maxX}> ink to x=${box.maxX.toFixed(1)}, frame ends at ${frameRight.toFixed(1)}) — notes clipped`
    );
  }

  // A frame that reaches far past the last ink is its own defect: the stave is
  // scaled to its viewBox, so dead space on the right shrinks the notes. The
  // renderer leaves ~7 units of gutter by design; 60 is loose enough never to
  // fire on that and tight enough to catch a runaway grow.
  if (box.maxX < frameRight - 60) {
    findings.push(
      `${label}: frame runs ${(frameRight - box.maxX).toFixed(1)}u past the last ink ` +
      `(ends x=${box.maxX.toFixed(1)}, frame ${frameRight.toFixed(1)}) — stave shrunk by dead space`
    );
  }
  // Vertically the frame the renderer STARTS from has deliberate headroom (the
  // stave is drawn at y=18 inside a 130-unit box, and `spec.height` lets an
  // author ask for as much air as they like), so this can only be applied to an
  // edge that was actually GROWN. There it should land just past the ink that
  // forced it — 4.0 to 5.0 units across the corpus.
  //
  // The top is unambiguous: the renderer's frame starts at y=0, so any negative
  // origin is growth. The bottom is measured against the baseline this spec
  // started from — its own pinned height when it has one, otherwise the taller
  // of the renderer's two defaults.
  const baselineBottom = typeof spec.height === 'number' ? spec.height : UNGROWN_MAX_HEIGHT;
  if (vy < -TOL && box.minY - vy > GROWN_SLACK) {
    findings.push(
      `${label}: frame grown ${(box.minY - vy).toFixed(1)}u above the topmost ink ` +
      `(ink y=${box.minY.toFixed(1)}, frame ${vy.toFixed(1)}) — grow formula overshooting`
    );
  }
  if (frameBottom > baselineBottom + TOL && frameBottom - box.maxY > GROWN_SLACK) {
    findings.push(
      `${label}: frame grown ${(frameBottom - box.maxY).toFixed(1)}u below the lowest ink ` +
      `(ink y=${box.maxY.toFixed(1)}, frame ${frameBottom.toFixed(1)}) — grow formula overshooting`
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

// Coverage is part of the assertion, not a footnote to it.
if (checked < MIN_STAVES) {
  findings.push(`coverage: measured only ${checked} staves, expected at least ${MIN_STAVES} — the corpus walk is missing content`);
}
for (const label of REQUIRED_LABELS) {
  if (!seen.has(label)) findings.push(`coverage: ${label} was never measured — it is one of the staves this gate exists for`);
}

if (findings.length) {
  console.error(`[check-notation-frame] FAIL: ${findings.length} stave(s) draw outside their frame`);
  findings.slice(0, 25).forEach(f => console.error('  ' + f));
  if (findings.length > 25) console.error(`  … and ${findings.length - 25} more`);
  process.exit(1);
}
console.log(`[check-notation-frame] OK — all ${checked} staves (>= ${MIN_STAVES} required) fit inside their viewBox on both axes`);
