// tools/notation-renderer.js
// Render drum-notation specs to static SVG strings at build time.
// Uses jsdom to give VexFlow a DOM to draw into, then extracts the SVG markup.

const { JSDOM } = require('jsdom');

let cachedVF = null;
let cachedDom = null;

// Engraving sizes for the sticking row (system.md §6.5 step 1).
//
// UNITS WARNING: VexFlow 4 reads these numbers as POINTS and writes them to the
// SVG as `font-size="14pt"`, which inside a viewBox is 14 * 4/3 = 18.67 user
// units. The old values (10 / 8) therefore never rendered at 10 and 8 units —
// they rendered at 13.33 and 10.67, and at the 0.55 phone scroll floor that put
// an "R" about 5px tall. Raising them to 14 / 10 is the §6.5 step-1 change; the
// user-unit consequence (18.67 / 13.33) is what the height headroom below and
// the .eleventy.js floor are sized against.
const STICKING_PT = 14;
const GRACE_STICKING_PT = 10;
// A sticking annotation hangs below the stave. At 18.67 user units the letter's
// box reaches further down than the old 130-unit default frame allowed for, so
// staves that carry sticking get 10 more units of floor (§6.5: 130 → 140).
const DEFAULT_HEIGHT = 130;
const STICKING_HEIGHT = 140;

// Width convergence (BL-065). A stave that draws past its own right edge is
// re-rendered wider until it stops. Measured across the corpus, the slowest
// spec converges in 14 retries and the widest fixed point is 1802 units, so
// neither guard binds on real content; both exist so a pathological spec cannot
// spin or grow without limit.
const MAX_RETRY_DEPTH = 20;
const MAX_RENDER_WIDTH = 2400;

// ---------------------------------------------------------------------------
// INK EXTENT (BL-111). What did this stave actually DRAW, in user units?
//
// The frame used to be derived from a scan of `y="…"` attributes: `minY` from
// every `y`, `maxY` from every `y` that also carried a `height`. That reads the
// POSITION of a handful of elements and calls it the drawing. Three things it
// cannot see:
//
//   <path>   glyph outlines — noteheads, stems, beams, rest glyphs and the
//            tuplet NUMERAL — carry no `y` attribute at all. 332 corpus staves
//            shipped with up to 14.6 units of ink below their own frame,
//            including both "3"s over rock-prog#0's feet triplets, and 66 with
//            ink above it, up to 21.5.
//   <text>   a baseline is not the top of a letter, and only <rect> carries
//            `height`, so a sticking letter could never be caught below the
//            frame at all — 247 staves carry one, held in by a hard-coded
//            10-unit floor with nothing measuring it.
//   <line>   `y1`/`y2` do not match `\sy="`, so lines were invisible on this
//            axis. (None in the corpus today; the frame should not depend on
//            that staying true.)
//
// 332 and 66 are the gate's own numbers, not this file's: run
// check-notation-frame against a renderer with the `bottom` grow disabled and it
// prints FAIL on 332, with `top` disabled 66, and against the whole pre-fix
// renderer 398 — 332 + 66. An earlier draft of this comment said 292, from a
// measurement that read the path CENTERLINE and forgot these paths are stroked;
// the half-stroke below is exactly what it was missing.
//
// The frame now bounds the geometry: exact stationary points of every cubic and
// quadratic, sampled arcs, rect and line corners, and a text box built from
// Arial's ascent and descent.
//
// Growing to that moved 382 of the 932 frames. 369 of them grew on measured
// path/rect geometry. The other 13 grew on the <text> box alone, which is a
// deliberate over-estimate: it reserves the full Arial ascender for every
// annotation, and the open-hat "o" only reaches x-height, so those 13 gain about
// 10 units of manuscript air they did not strictly need. Rastering them puts the
// "o"'s real ink 0.83 units INSIDE the old frame — they were never clipping. A
// per-glyph ascent table would recover the air; it would also be a second guess
// table to keep in sync across two files, and reserving air is the harmless
// direction for a frame.
//
// The sibling of this code in tools/checks/check-notation-frame.js is a
// SEPARATE implementation on purpose and must stay one. It re-derives the
// extents from the shipped markup and shares no code, no constants and no
// intermediate number with this file — asserting on the number computed here is
// exactly what made the old vertical gate a tautology. Its text box is
// deliberately tighter than the one below (0.88/0.22 em against 0.92/0.26) so a
// metric disagreement can never fail a stave this file sized correctly, and both
// stay comfortably above real Arial ink for the glyphs VexFlow emits here
// (R, L, o, digits: cap height 0.716em, ascender 0.905em, no descenders).
const FRAME_PAD = 4;
const TEXT_ASCENT_EM = 0.92;
const TEXT_DESCENT_EM = 0.26;
const ARC_SAMPLES = 128;

// Extremes of a bezier along one axis: the endpoints, plus any stationary point
// strictly inside the segment. Solving the derivative rather than taking the
// control hull matters — the hull over-reports by up to 6 units on real VexFlow
// glyph outlines, which would pad every frame with whitespace it does not need.
function _cubicSpan(p0, p1, p2, p3) {
  let lo = Math.min(p0, p3), hi = Math.max(p0, p3);
  const a = 3 * (-p0 + 3 * p1 - 3 * p2 + p3);
  const b = 6 * (p0 - 2 * p1 + p2);
  const c = 3 * (p1 - p0);
  const ts = [];
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) ts.push(-c / b);
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      ts.push((-b + s) / (2 * a), (-b - s) / (2 * a));
    }
  }
  for (const t of ts) {
    if (!(t > 0 && t < 1)) continue;
    const u = 1 - t;
    const v = u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}
function _quadSpan(p0, p1, p2) {
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
// Arcs turn up inside glyph outlines (982 of them in a 120-stave sample).
// Endpoint -> center parameterization per the SVG spec, then sampled; at 128
// steps the sampling error on glyph-scale radii is under a thousandth of a unit.
function _arcSweep(box, x0, y0, rx, ry, rot, laf, sf, x1, y1) {
  if (!rx || !ry) return;
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
  for (let i = 0; i <= ARC_SAMPLES; i++) {
    const t = t0 + (dt * i) / ARC_SAMPLES;
    const ct = Math.cos(t), st = Math.sin(t);
    _point(box, cx + rx * ct * cosP - ry * st * sinP, cy + rx * ct * sinP + ry * st * cosP);
  }
}
function _point(box, x, y) {
  if (x < box.minX) box.minX = x;
  if (x > box.maxX) box.maxX = x;
  if (y < box.minY) box.minY = y;
  if (y > box.maxY) box.maxY = y;
}
function _span(box, xs, ys) {
  _point(box, xs[0], ys[0]);
  _point(box, xs[1], ys[1]);
}
const _PATH_ARGC = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
function _pathInk(box, d) {
  const toks = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  let cx = 0, cy = 0, sx = 0, sy = 0;
  let rcx = null, rcy = null, rqx = null, rqy = null; // reflected control points
  let cmd = null, i = 0;
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) {
      cmd = toks[i]; i++;
      if (cmd === 'Z' || cmd === 'z') { cx = sx; cy = sy; continue; }
    }
    if (cmd === null) { i++; continue; }
    const up = cmd.toUpperCase(), rel = cmd !== up, n = _PATH_ARGC[up];
    if (n === undefined) { i++; continue; }
    const a = [];
    for (let k = 0; k < n; k++) a.push(parseFloat(toks[i + k]));
    if (a.some(Number.isNaN)) break;
    i += n;
    const AX = v => (rel ? cx + v : v), AY = v => (rel ? cy + v : v);
    let nx = cx, ny = cy;
    if (up === 'M') {
      nx = AX(a[0]); ny = AY(a[1]); sx = nx; sy = ny; _point(box, nx, ny);
      cmd = rel ? 'l' : 'L'; // a moveto's extra coordinate pairs are linetos
    } else if (up === 'L') {
      nx = AX(a[0]); ny = AY(a[1]); _point(box, cx, cy); _point(box, nx, ny);
    } else if (up === 'H') {
      nx = AX(a[0]); _point(box, cx, cy); _point(box, nx, cy);
    } else if (up === 'V') {
      ny = AY(a[0]); _point(box, cx, cy); _point(box, cx, ny);
    } else if (up === 'C') {
      const x1 = AX(a[0]), y1 = AY(a[1]), x2 = AX(a[2]), y2 = AY(a[3]);
      nx = AX(a[4]); ny = AY(a[5]);
      _span(box, _cubicSpan(cx, x1, x2, nx), _cubicSpan(cy, y1, y2, ny));
      rcx = x2; rcy = y2;
    } else if (up === 'S') {
      const x1 = rcx === null ? cx : 2 * cx - rcx, y1 = rcy === null ? cy : 2 * cy - rcy;
      const x2 = AX(a[0]), y2 = AY(a[1]);
      nx = AX(a[2]); ny = AY(a[3]);
      _span(box, _cubicSpan(cx, x1, x2, nx), _cubicSpan(cy, y1, y2, ny));
      rcx = x2; rcy = y2;
    } else if (up === 'Q') {
      const x1 = AX(a[0]), y1 = AY(a[1]);
      nx = AX(a[2]); ny = AY(a[3]);
      _span(box, _quadSpan(cx, x1, nx), _quadSpan(cy, y1, ny));
      rqx = x1; rqy = y1;
    } else if (up === 'T') {
      const x1 = rqx === null ? cx : 2 * cx - rqx, y1 = rqy === null ? cy : 2 * cy - rqy;
      nx = AX(a[0]); ny = AY(a[1]);
      _span(box, _quadSpan(cx, x1, nx), _quadSpan(cy, y1, ny));
      rqx = x1; rqy = y1;
    } else if (up === 'A') {
      nx = AX(a[5]); ny = AY(a[6]);
      _point(box, cx, cy); _point(box, nx, ny);
      _arcSweep(box, cx, cy, a[0], a[1], a[2], a[3], a[4], nx, ny);
    }
    if (up !== 'C' && up !== 'S') { rcx = null; rcy = null; }
    if (up !== 'Q' && up !== 'T') { rqx = null; rqy = null; }
    cx = nx; cy = ny;
  }
}
function _tagAttr(tag, name) {
  const m = new RegExp('\\s' + name + '="([^"]*)"').exec(tag);
  return m ? m[1] : null;
}
// VexFlow writes annotation sizes in POINTS ("14pt"), which inside a viewBox is
// 14 * 4/3 user units. Getting this wrong is how the sticking row ended up at
// half the size it was specified at (see STICKING_PT above).
function _ptToUnits(raw) {
  const m = /([\d.]+)\s*(pt|px)?/.exec(raw || '');
  if (!m) return null;
  return m[2] === 'px' ? parseFloat(m[1]) : parseFloat(m[1]) * (4 / 3);
}
// Most annotations name their own size, but the open-hat "o" does not: 438 of
// the corpus's 3091 <text> elements carry no font-size and INHERIT the root
// <svg font-size="10pt"> (13.33 units). Both this file and the gate used to fall
// back on a hard-coded 12pt/16 units for those, which was wrong by 2.67 units
// and safe only because it happened to be the larger number — a root size above
// 12pt would have made both under-measure in step and certified a clipped
// annotation. Read the root instead of guessing.
function _rootFontUnits(markup) {
  const root = /<svg\b[^>]*>/.exec(markup);
  const v = root ? _ptToUnits(_tagAttr(root[0], 'font-size')) : null;
  return v === null ? 16 : v; // 16 = the CSS initial, for markup with no root size
}
function _fontUnits(tag, inherited) {
  const own = _ptToUnits(_tagAttr(tag, 'font-size'));
  return own === null ? inherited : own;
}
// <text> carries neither width nor height. Upper-bound both: Arial advances by
// class for the horizontal, ascent/descent for the vertical.
function _textInk(box, tag, body, inheritedFont) {
  const x = parseFloat(_tagAttr(tag, 'x') || 'NaN');
  const y = parseFloat(_tagAttr(tag, 'y') || 'NaN');
  if (Number.isNaN(x) || Number.isNaN(y)) return;
  const size = _fontUnits(tag, inheritedFont);
  const txt = body.replace(/<[^>]*>/g, '');
  let em = 0;
  for (const ch of txt) em += /[0-9]/.test(ch) ? 0.58 : 0.75;
  const adv = em * size;
  const anchor = _tagAttr(tag, 'text-anchor') || 'start';
  const x0 = anchor === 'end' ? x - adv : anchor === 'middle' ? x - adv / 2 : x;
  _point(box, x0, y - TEXT_ASCENT_EM * size);
  _point(box, x0 + adv, y + TEXT_DESCENT_EM * size);
}
// A path's `d` is its CENTERLINE, and VexFlow strokes as well as fills: the
// stave lines, the stems and the beams are all `fill="none"` paths whose entire
// visible ink is stroke. So real ink runs half a stroke-width past the geometry
// on every side. Stroke state is inherited — the root carries stroke-width 0.3
// and at least one <g> carries 1 — and this file deliberately does not walk
// ancestors (see the transform note below), so bound it instead of resolving
// it: the widest stroke-width anywhere in the document, halved. That
// over-reports for the fill-only glyphs, by at most 0.75 units on today's
// corpus, which costs a unit of frame and cannot hide a clipped notehead.
function _maxHalfStroke(markup) {
  let w = 1; // SVG's own default, for a document that never names one
  let seen = false;
  for (const m of markup.matchAll(/\sstroke-width="([\d.]+)"/g)) {
    const v = parseFloat(m[1]);
    if (Number.isNaN(v)) continue;
    if (!seen || v > w) w = v;
    seen = true;
  }
  return w / 2;
}
// Every element the renderer can emit, measured. Ancestor transforms are NOT
// composed: VexFlow emits none today (verified across all 932 corpus staves),
// and a frame sized by a measurement that quietly ignored one would be the same
// class of silent lie this whole function exists to end. So: refuse to measure,
// which surfaces as a visible .notation-error block and a red gate.
function _inkExtent(markup) {
  if (/<[a-zA-Z][^>]*\stransform="/.test(markup)) {
    throw new Error('SVG carries a transform attribute; ink extent cannot be measured without composing it');
  }
  const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const m of markup.matchAll(/<path\b[^>]*\sd="([^"]*)"[^>]*>/g)) _pathInk(box, m[1]);
  for (const m of markup.matchAll(/<rect\b[^>]*>/g)) {
    const x = parseFloat(_tagAttr(m[0], 'x') || 'NaN');
    const y = parseFloat(_tagAttr(m[0], 'y') || 'NaN');
    if (Number.isNaN(x) || Number.isNaN(y)) continue;
    const w = parseFloat(_tagAttr(m[0], 'width') || '0');
    const h = parseFloat(_tagAttr(m[0], 'height') || '0');
    _point(box, x, y);
    _point(box, x + (Number.isNaN(w) ? 0 : w), y + (Number.isNaN(h) ? 0 : h));
  }
  for (const m of markup.matchAll(/<line\b[^>]*>/g)) {
    const x1 = parseFloat(_tagAttr(m[0], 'x1') || 'NaN');
    const y1 = parseFloat(_tagAttr(m[0], 'y1') || 'NaN');
    const x2 = parseFloat(_tagAttr(m[0], 'x2') || 'NaN');
    const y2 = parseFloat(_tagAttr(m[0], 'y2') || 'NaN');
    if ([x1, y1, x2, y2].some(Number.isNaN)) continue;
    _point(box, x1, y1);
    _point(box, x2, y2);
  }
  const inheritedFont = _rootFontUnits(markup);
  for (const m of markup.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    _textInk(box, '<text' + m[1] + '>', m[2], inheritedFont);
  }
  if (Number.isFinite(box.minX) && Number.isFinite(box.minY)) {
    const half = _maxHalfStroke(markup);
    box.minX -= half; box.maxX += half;
    box.minY -= half; box.maxY += half;
  }
  return box;
}
// ---------------------------------------------------------------------------

// Does any note in this spec carry a sticking label (its own, or on a grace
// note)? Drives the taller default frame.
function _hasSticking(spec) {
  const voices = [spec.hands, spec.feet];
  for (const arr of voices) {
    for (const n of arr || []) {
      if (!n) continue;
      if (n.sticking) return true;
      const graces = n.grace ? (Array.isArray(n.grace) ? n.grace : [n.grace]) : [];
      if (graces.some(g => g && g.sticking)) return true;
    }
  }
  return false;
}

function getVexFlow() {
  if (cachedVF) return { VF: cachedVF, dom: cachedDom };
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    pretendToBeVisual: true
  });
  // VexFlow expects these globals
  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.SVGElement = dom.window.SVGElement;
  const VF = require('vexflow').Flow;
  cachedVF = VF;
  cachedDom = dom;
  return { VF, dom };
}

function makeNote(VF, spec, stemDir) {
  if (spec.rest) {
    // Rests are positioning padding by default (invisible) — they fill
    // voice ticks so notes land on the right beats without visual clutter.
    // Opt into a visible rest with `{ rest: true, visible: true }` for
    // lessons where the rest itself is the pedagogical content.
    if (spec.visible) {
      return new VF.StaveNote({
        keys: [spec.restKey || 'b/4'],
        duration: spec.duration + 'r'
      });
    }
    // Build a hidden stem on the GhostNote so it can sit inside a Tuplet
    // without VexFlow throwing "NoStem". The stem is hidden so the note
    // still renders as a true positioning spacer.
    const ghost = new VF.GhostNote({ duration: spec.duration });
    ghost.buildStem();
    ghost.setStemDirection(stemDir);
    if (ghost.getStem()) ghost.getStem().hide = true;
    return ghost;
  }
  const note = new VF.StaveNote({
    keys: spec.keys,
    duration: spec.duration,
    stem_direction: stemDir
  });
  if (spec.dot) VF.Dot.buildAndAttach([note], { all: true });
  // Drum-chart articulation: "o" above the note means open hi-hat.
  if (spec.articulation === 'open') {
    const ann = new VF.Annotation('o');
    if (VF.Annotation && VF.Annotation.VerticalJustify) {
      ann.setVerticalJustification(VF.Annotation.VerticalJustify.TOP);
    }
    note.addModifier(ann, 0);
  }
  // Sticking: an "R" or "L" (or any short label) drawn below the staff.
  // Opt-in per note for rudiment lessons where the sticking is the lesson.
  // Size: system.md §6.5 step 1. On a rudiment page the sticking row IS the
  // lesson, and at the phone scroll floor a 10pt letter rendered ~5px tall.
  // These sizes are VexFlow points, not user units — see STICKING_PT below.
  if (spec.sticking) {
    const ann = new VF.Annotation(spec.sticking);
    if (VF.Annotation && VF.Annotation.VerticalJustify) {
      ann.setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM);
    }
    if (typeof ann.setFont === 'function') {
      ann.setFont('Arial', STICKING_PT, 'normal');
    }
    note.addModifier(ann, 0);
  }
  // Tremolo slashes through the stem — roll shorthand. `tremolo: 3` draws
  // three slashes (the multiple-bounce / buzz roll glyph).
  if (spec.tremolo) {
    note.addModifier(new VF.Tremolo(spec.tremolo), 0);
  }
  // Accent: the ">" symbol above the note. Renders via VexFlow Articulation.
  if (spec.accent) {
    const art = new VF.Articulation('a>');
    if (VF.Modifier && VF.Modifier.Position) {
      art.setPosition(VF.Modifier.Position.ABOVE);
    }
    note.addModifier(art, 0);
  }
  // Grace notes (flam = 1, drag = 2). `spec.grace` is a single grace spec
  // or an array of them. Each grace inherits its parent's keys/duration
  // unless overridden. The slash is set on the first grace so the engraver
  // shows the canonical "tiny note + slash" flam glyph.
  if (spec.grace) {
    const graces = Array.isArray(spec.grace) ? spec.grace : [spec.grace];
    const graceNotes = graces.map((g, idx) => {
      const gn = new VF.GraceNote({
        keys: g.keys || spec.keys,
        duration: g.duration || '8',
        slash: idx === 0 && graces.length === 1, // single grace = flam glyph
        stem_direction: stemDir
      });
      if (g.sticking) {
        const ann = new VF.Annotation(g.sticking);
        if (VF.Annotation && VF.Annotation.VerticalJustify) {
          ann.setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM);
        }
        if (typeof ann.setFont === 'function') {
          ann.setFont('Arial', GRACE_STICKING_PT, 'normal');
        }
        gn.addModifier(ann, 0);
      }
      return gn;
    });
    const beamGraces = graces.length > 1; // beam two-grace drags
    const grp = new VF.GraceNoteGroup(graceNotes, beamGraces);
    note.addModifier(grp, 0);
  }
  return note;
}

/**
 * Render a drum pattern to an SVG string.
 *
 * spec = {
 *   timeSignature: "4/4",
 *   repeatBegin: bool, repeatEnd: bool,
 *   width: number (optional, default 760),
 *   height: number (optional, default 130; 140 when the spec carries sticking),
 *   hands: [ noteSpec, ... ],
 *   feet:  [ noteSpec, ... ],
 *   tuplets: [ { voice: 'hands'|'feet', start, length, num_notes, notes_occupied } ],
 *   beamGroups: [[num, denom], ...]
 * }
 *
 * beamGroups fractions are measured in ACTUAL played time, after tuplet
 * scaling — so to beam one beat per group, use [1, 4] even when the beat
 * holds a triplet or sextuplet ([3, 8] would span 1.5 real beats there).
 *
 * noteSpec = {
 *   keys: ['c/5', ...],          // VexFlow keys
 *   duration: 'q'|'8'|'16'|...,
 *   rest: bool,                  // ghost rest (positioning), or visible rest
 *   visible: bool,               // make a rest visible
 *   dot: bool,                   // dotted note
 *   articulation: 'open',        // 'o' annotation above (open hi-hat)
 *   sticking: 'R'|'L'|...,       // text annotation below the staff
 *   accent: bool                 // ">" articulation above the note
 * }
 */
// How many quarter-note units does this note consume? Accounts for dot.
const _DURATION_TO_QUARTERS = { 'w': 4, 'h': 2, 'q': 1, '8': 0.5, '16': 0.25, '32': 0.125 };
function _noteQuarters(note) {
  const base = _DURATION_TO_QUARTERS[note.duration];
  if (base === undefined) return 0;
  return note.dot ? base * 1.5 : base;
}

// Compute the number of bars the spec spans. Honors `spec.bars` if provided;
// otherwise infers from the longer of hands/feet ticks (after applying
// tuplet compression).
function _detectBarCount(spec) {
  if (spec.bars && spec.bars > 0) return spec.bars;
  if (!spec.timeSignature) return 1;
  const [num, den] = spec.timeSignature.split('/').map(Number);
  const barQuarters = num * (4 / den);

  function ticksFor(arr, voiceName) {
    let q = 0;
    for (let i = 0; i < (arr || []).length; i++) {
      const note = arr[i];
      const tup = (spec.tuplets || []).find(t => t.voice === voiceName && i >= t.start && i < t.start + t.length);
      const raw = _noteQuarters(note);
      q += tup ? raw * (tup.notes_occupied / tup.num_notes) : raw;
    }
    return q;
  }
  const handsQ = ticksFor(spec.hands, 'hands');
  const feetQ = ticksFor(spec.feet, 'feet');
  const total = Math.max(handsQ, feetQ);
  if (total <= 0) return 1;
  // Round up to the nearest whole bar. Tolerance for floating-point dust.
  const bars = Math.max(1, Math.round(total / barQuarters));
  return bars;
}

// Slice a flat note array into `bars` chunks, where each chunk's tick
// content equals `barQuarters`. Returns array of { notes, originalIndices }
// so callers can re-attach tuplets/beam groups by index.
function _splitNotesIntoBars(notes, barQuarters, voiceName, tuplets) {
  const bars = [];
  let current = [];
  let currentIndices = [];
  let acc = 0;
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const tup = (tuplets || []).find(t => t.voice === voiceName && i >= t.start && i < t.start + t.length);
    const raw = note.rest ? _DURATION_TO_QUARTERS[note.duration] || 0 : _noteQuarters(note);
    const effective = tup ? raw * (tup.notes_occupied / tup.num_notes) : raw;
    current.push(note);
    currentIndices.push(i);
    acc += effective;
    if (acc >= barQuarters - 0.001) {
      bars.push({ notes: current, originalIndices: currentIndices });
      current = [];
      currentIndices = [];
      acc = 0;
    }
  }
  if (current.length) bars.push({ notes: current, originalIndices: currentIndices });
  return bars;
}

function renderPattern(spec, _widthOverride, _depth) {
  const { VF, dom } = getVexFlow();
  const document = dom.window.document;

  // Clean container per render
  const container = document.createElement('div');
  container.id = 'render-target-' + Math.random().toString(36).slice(2, 9);
  document.body.appendChild(container);

  const barCount = _detectBarCount(spec);
  const hasSticking = _hasSticking(spec);
  // An explicit spec.height always wins; otherwise sticking buys extra floor.
  const height = spec.height || (hasSticking ? STICKING_HEIGHT : DEFAULT_HEIGHT);
  // Single-bar staves size to their content — a four-hit bar doesn't need the
  // width of a dense 16th-note bar, and narrower staves fit phones without
  // panning. Explicit spec.width always wins; 760 is the historical ceiling.
  const maxVoiceNotes = Math.max((spec.hands || []).length, (spec.feet || []).length, 1);
  const contentWidth = Math.min(760, Math.max(380, 140 + maxVoiceNotes * 52));
  const baseWidth = spec.width || (barCount > 1 ? 760 : contentWidth);
  // Multi-bar layouts widen proportionally, but we cap so bars stay readable
  // and the layout doesn't go off-screen for very long phrases.
  const width = _widthOverride
    || (barCount > 1 ? Math.min(1400, Math.max(baseWidth, baseWidth + (barCount - 1) * 240)) : baseWidth);

  try {
    const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
    renderer.resize(width, height);
    const ctx = renderer.getContext();

    const [num, den] = spec.timeSignature.split('/').map(Number);
    const barQuarters = num * (4 / den);

    // Build all hand & foot notes once
    const handNotes = (spec.hands || []).map(s => makeNote(VF, s, VF.Stem.UP));
    const footNotes = (spec.feet || []).map(s => makeNote(VF, s, VF.Stem.DOWN));

    // Build tuplets up-front against the original index space; we'll re-key
    // them per bar after splitting.
    const allTupletsByVoice = { hands: [], feet: [] };
    (spec.tuplets || []).forEach(t => {
      const source = t.voice === 'hands' ? handNotes : footNotes;
      const slice = source.slice(t.start, t.start + t.length);
      const tplt = new VF.Tuplet(slice, {
        num_notes: t.num_notes,
        notes_occupied: t.notes_occupied,
        ratioed: false,
        bracketed: true,
        location: t.voice === 'feet' ? VF.Tuplet.LOCATION_BOTTOM : VF.Tuplet.LOCATION_TOP
      });
      allTupletsByVoice[t.voice].push({ tuplet: tplt, start: t.start, end: t.start + t.length });
    });

    // Split each voice into bars
    const handBars = handNotes.length ? _splitNotesIntoBars(spec.hands || [], barQuarters, 'hands', spec.tuplets) : [];
    const footBars = footNotes.length ? _splitNotesIntoBars(spec.feet || [], barQuarters, 'feet', spec.tuplets) : [];
    // Number of bars to draw is the max of either voice's split count, falling
    // back on barCount.
    const bars = Math.max(barCount, handBars.length, footBars.length, 1);

    // Compute stave widths for the layout
    const staveStartX = 8;
    const totalStaveWidth = width - 16;
    const firstBarExtra = 60; // clef + time-sig occupy more space in bar 1
    const innerWidth = totalStaveWidth - firstBarExtra;
    const barWidth = innerWidth / bars;
    const staves = [];

    for (let b = 0; b < bars; b++) {
      const x = staveStartX + (b === 0 ? 0 : firstBarExtra + b * barWidth);
      const w = b === 0 ? firstBarExtra + barWidth : barWidth;
      const s = new VF.Stave(x, 18, w);
      if (b === 0) {
        s.addClef('percussion');
        if (spec.timeSignature) s.addTimeSignature(spec.timeSignature);
        if (spec.repeatBegin) s.setBegBarType(VF.Barline.type.REPEAT_BEGIN);
      }
      if (b === bars - 1 && spec.repeatEnd) {
        s.setEndBarType(VF.Barline.type.REPEAT_END);
      } else if (b < bars - 1) {
        s.setEndBarType(VF.Barline.type.SINGLE);
      }
      s.setContext(ctx).draw();
      staves.push(s);
    }

    const allBeams = [];
    const drawnTuplets = new Set();
    // How far past its own end barline did the widest bar actually draw?
    //
    // A sticking annotation is part of a note's modifier width, so raising it
    // (§6.5 step 1) raises the width the engraver needs. When the slot is too
    // narrow VexFlow does not compress the tail — it draws it past the barline
    // and out of the viewBox, which is the truncation §6.5 forbids. This is
    // MEASURED from the laid-out notes, not predicted: Formatter's
    // getMinTotalWidth() is an ideal, routinely 100+ units above what actually
    // fits, and retrying on it widened 32 staves that were drawing perfectly
    // well (two of them past the deliberate 1400 cap, to 1988 and 3128).
    let drawOverflow = 0;

    for (let b = 0; b < bars; b++) {
      const stave = staves[b];
      const voiceSpecs = [];
      // For each bar, build a fresh Voice with just this bar's notes
      const handChunk = handBars[b];
      const footChunk = footBars[b];
      if (handChunk && handChunk.notes.length) {
        const handsForBar = handChunk.originalIndices.map(i => handNotes[i]);
        const v = new VF.Voice({ num_beats: num, beat_value: den });
        v.setStrict(false);
        v.addTickables(handsForBar);
        voiceSpecs.push({ voice: v, stemDir: VF.Stem.UP, originalIndices: handChunk.originalIndices, voiceName: 'hands' });
      }
      if (footChunk && footChunk.notes.length) {
        const feetForBar = footChunk.originalIndices.map(i => footNotes[i]);
        const v = new VF.Voice({ num_beats: num, beat_value: den });
        v.setStrict(false);
        v.addTickables(feetForBar);
        voiceSpecs.push({ voice: v, stemDir: VF.Stem.DOWN, originalIndices: footChunk.originalIndices, voiceName: 'feet' });
      }
      if (!voiceSpecs.length) continue;
      const voices = voiceSpecs.map(v => v.voice);

      const formatter = new VF.Formatter();
      formatter.joinVoices(voices);
      formatter.format(voices, Math.max(80, stave.getNoteEndX() - stave.getNoteStartX() - 10));

      voiceSpecs.forEach(({ voice, stemDir }) => {
        // Pass the FULL tickable list, rests included. Filtering rests out
        // first made the grouping clock skip their duration, so in any
        // pattern with rests — every shuffle, where the middle triplet is
        // silent — beams ran past the beat and joined two different tuplets.
        // beam_rests:false — a rest ends the beamed run, so the shuffle's
        // note-rest-note beat renders as two flagged 8ths (valid engraving)
        // rather than a beam running into the next beat's triplet.
        // (beam_middle_only, which would beam OVER the internal rest, was
        // tried and produces degenerate output here: VexFlow suppresses the
        // flags for a beam it then fails to draw. See BL-060.)
        const tickables = voice.getTickables();
        if (tickables.some(n => !n.isRest())) {
          const opts = { stem_direction: stemDir, beam_rests: false };
          if (spec.beamGroups) {
            opts.groups = spec.beamGroups.map(g => new VF.Fraction(g[0], g[1]));
          }
          VF.Beam.generateBeams(tickables, opts).forEach(bm => allBeams.push(bm));
        }
      });

      voices.forEach(v => v.draw(ctx, stave));

      // Measured AFTER draw: VexFlow only fills a note's bounding box (and its
      // modifiers' geometry) once it has been rendered.
      //
      // The yardstick is the FRAME edge, not each bar's end barline. Dense
      // multi-bar patterns have always drawn a little past their internal
      // barlines — an engraving nit, but the ink is still inside the viewBox
      // and still on the page. Only ink past `width` is actually cut off, and
      // cutting notes off is the one thing §6.5 refuses to do.
      voices.forEach(v => v.getTickables().forEach(n => {
        try {
          const bb = n.getBoundingBox();
          if (bb) drawOverflow = Math.max(drawOverflow, bb.getX() + bb.getW() - width);
          const m = typeof n.getMetrics === 'function' ? n.getMetrics() : null;
          if (m) {
            const right = n.getAbsoluteX() + (m.notePx || 0) + (m.modRightPx || 0) + (m.rightDisplacedHeadPx || 0);
            drawOverflow = Math.max(drawOverflow, right - width);
          }
        } catch (e) { /* ghost notes and friends have no measurable box */ }
      }));
    }

    allBeams.forEach(bm => bm.setContext(ctx).draw());
    // Draw tuplets from the original index space — they were built against
    // the original notes and VexFlow keeps the geometry tied to the notes'
    // post-format positions.
    ['hands', 'feet'].forEach(voiceName => {
      allTupletsByVoice[voiceName].forEach(({ tuplet }) => {
        if (!drawnTuplets.has(tuplet)) {
          tuplet.setContext(ctx).draw();
          drawnTuplets.add(tuplet);
        }
      });
    });

    const svg = container.querySelector('svg');
    if (!svg) throw new Error('No SVG produced');

    // What did this attempt actually draw past its own right edge?
    //
    // Two measurements, because neither alone is complete:
    //
    //   drawOverflow   VexFlow's note geometry, gathered in the bar loop above.
    //                  Covers noteheads, stems, beams and note modifiers.
    //   rectOverflow   the markup. A TUPLET BRACKET is a bare <rect> with x and
    //                  width, drawn after the bar loop and attached to no
    //                  tickable, so drawOverflow cannot see it at all; the loop
    //                  also swallows ghost rests in its catch. A 4-bar spec whose
    //                  closing tuplet ends in ghost rests puts 13.9 units of
    //                  bracket outside a frame sized from drawOverflow alone.
    //                  Twelve corpus tuplets already end in a rest and are safe
    //                  only because they sit on 760-wide single-bar staves with
    //                  7 units of gutter to spare.
    //
    // Measured AFTER the beams and tuplets are drawn, so the markup is complete.
    let rectOverflow = 0;
    svg.querySelectorAll('rect').forEach(r => {
      const rx = parseFloat(r.getAttribute('x'));
      const rw = parseFloat(r.getAttribute('width'));
      if (!Number.isNaN(rx)) {
        rectOverflow = Math.max(rectOverflow, rx + (Number.isNaN(rw) ? 0 : rw) - width);
      }
    });
    const overflow = Math.max(drawOverflow, rectOverflow);

    // CONVERGE THE WIDTH (BL-065). When a bar's slot is narrower than the
    // engraver's minimum, VexFlow does not compress it — it draws the tail
    // straight through the barline and on top of the next bar. Re-render wider
    // until every bar fits. An author-pinned spec.width is honored as-is.
    //
    // This used to be limited to sticking staves, on the stated grounds that
    // widening "does not converge" for the eight dense multi-bar patterns
    // (rock-dynamics#1–3, jazz-modern-jazz#4, funk-modern-neo-soul#3,
    // funk-modern-r-and-b#3, hiphop-questlove#3, rock-studio-polish#2). That was
    // wrong, and it is worth recording why, because the claim survived dozens of
    // iterations by being quoted rather than re-measured.
    //
    // What was actually happening: those staves were not merely overrunning
    // their LAST barline, they were overrunning EVERY internal barline. Measured
    // on glyph bounding boxes, the eight carried 95 note-on-note collisions
    // spread over 42 of their internal barlines. On hiphop-questlove#3 bar 0's
    // last four sixteenths
    // are drawn on top of bar 1's first four — 90.7 units, about 3.5 noteheads,
    // rendering as eight X-heads at half spacing under two superimposed beams.
    // On rock-dynamics#1, an ACCENT lesson, the pile-up prints doubled ">"
    // accents that are not in the spec, so the page teaches the wrong pattern.
    // The final-bar overrun that made this item visible was the fourth instance
    // of a defect already present three times over; it was just the only one the
    // viewBox happened to clip.
    //
    // Convergence clears 41 of those 42 colliding barlines, taking the eight
    // from 95 collisions to 5. It reaches its fixed point in 2–14 retries at
    // widths of 1043–1802 (funk-modern-r-and-b#3 in 2 retries at 1043,
    // hiphop-questlove#3 in 8 at 1776, rock-studio-polish#2 in 12 at 1802),
    // which is why a depth cap of 3 never got there. It re-engraves exactly the
    // eight and no other stave — 924 of the 932 specs render byte-for-byte
    // identical — and it changes min-width on none of the site's 892 staves,
    // because these staves' density floor is pinned by event count
    // (events × 28px), not by natural width. The one survivor is
    // jazz-modern-jazz#4 bar 5, a bar too dense for a uniform
    // barWidth = innerWidth / bars at any total width. That is a separate bug
    // about even bar division, not about frame size.
    //
    // MAX_RENDER_WIDTH is a stop, not a target: the widest fixed point in the
    // corpus is 1802, so it never binds here and exists only so a pathological
    // spec cannot widen without limit.
    if (!spec.width && overflow > 0.5 && (_depth || 0) < MAX_RETRY_DEPTH) {
      const next = Math.min(MAX_RENDER_WIDTH, Math.ceil(width + overflow + 12));
      if (next > width) {
        container.remove();
        return renderPattern(spec, next, (_depth || 0) + 1);
      }
    }

    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    if (!svg.getAttribute('viewBox')) {
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    // Route all ink through currentColor so the page's CSS owns notation
    // color (tokenized in .notation) instead of hardcoded black — the
    // prerequisite for any dark theme.
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('stroke', 'currentColor');
    svg.querySelectorAll('[fill="black"]').forEach(el => el.setAttribute('fill', 'currentColor'));
    svg.querySelectorAll('[stroke="black"]').forEach(el => el.setAttribute('stroke', 'currentColor'));
    let out = svg.outerHTML;
    // GROW THE FRAME TO THE INK (iter 31, BL-065, BL-111).
    //
    // Tuplet brackets sit above the stave (hands) or below it (feet), beyond the
    // stems and flags, and on unbeamed triplets — every shuffle — they are drawn
    // outside a viewBox pinned to "0 0 w h", so the bracket and the "3" that is
    // the entire point of the exercise get silently clipped. So do the bottoms
    // of hi-hat-foot X noteheads, and the descenders of the sticking row.
    //
    // Measured from the drawn geometry, not from element positions: see
    // _inkExtent above for what the `y="…"` scan this replaced could not see and
    // for the 292 staves that shipped clipped behind it.
    const ink = _inkExtent(out);
    const measured = Number.isFinite(ink.minY) && Number.isFinite(ink.maxY);
    const top = measured && ink.minY < 0 ? Math.floor(ink.minY) - FRAME_PAD : 0;
    const bottom = measured && ink.maxY > height ? Math.ceil(ink.maxY) + FRAME_PAD : height;
    // Sideways (BL-065) the layout fix is the width convergence above; the frame
    // is only a BACKSTOP, for the case convergence cannot resolve — a spec pinned
    // by the author's own spec.width, or one that hits MAX_RENDER_WIDTH. There
    // the notes are still misplaced, but none of them is invisible: clipping a
    // note is the one thing §6.5 refuses to do, and a frame is cheaper to widen
    // than a layout is to fix.
    //
    // Both horizontal terms are no-ops on the current corpus — all 932 specs
    // converge, so `overflow` is 0 by the time we get here, and every stave ends
    // its ink 7.00 units short of its own right edge and starts it 8.00 units
    // in. That matters beyond tidiness: .eleventy.js reads `natW` off this
    // viewBox's WIDTH to size the density floor, so the width is left alone
    // unless ink genuinely escapes it.
    const left = measured && ink.minX < 0 ? Math.floor(ink.minX) - FRAME_PAD : 0;
    const right = Math.max(
      overflow > 0.5 ? Math.ceil(width + overflow) : width,
      measured && ink.maxX > width ? Math.ceil(ink.maxX) + FRAME_PAD : width
    );
    if (top !== 0 || bottom !== height || left !== 0 || right !== width) {
      svg.setAttribute('viewBox', `${left} ${top} ${right - left} ${bottom - top}`);
      out = svg.outerHTML;
    }
    container.remove();
    return out;
  } catch (err) {
    container.remove();
    return `<div class="notation-error">Notation render failed: ${err.message}</div>`;
  }
}

module.exports = { renderPattern };
