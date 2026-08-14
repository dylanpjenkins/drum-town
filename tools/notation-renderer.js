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
    // Tuplet brackets sit above the stave, above the stems and flags, and on
    // unbeamed triplets (every shuffle) they were drawn at negative y — i.e.
    // outside a viewBox pinned to 0 — so the bracket and its "3" were
    // silently clipped off the top of the frame. Grow the viewBox to whatever
    // was actually drawn.
    // Feet tuplets bracket BELOW the stave and clip the same way, so bound
    // the frame in both directions.
    let minY = 0;
    let maxY = height;
    for (const m of out.matchAll(/\sy="(-?[\d.]+)"/g)) {
      minY = Math.min(minY, parseFloat(m[1]));
    }
    for (const m of out.matchAll(/\sy="(-?[\d.]+)"[^>]*?height="([\d.]+)"/g)) {
      maxY = Math.max(maxY, parseFloat(m[1]) + parseFloat(m[2]));
    }
    const top = minY < 0 ? Math.floor(minY) - 4 : 0;
    const bottom = maxY > height ? Math.ceil(maxY) + 4 : height;
    // Same idea sideways (BL-065), as a BACKSTOP only. Convergence above is what
    // fixes the layout; this exists for the case convergence cannot resolve —
    // a spec pinned by the author's own spec.width, or one that hits
    // MAX_RENDER_WIDTH. In those cases the notes are still misplaced, but at
    // least none of them is invisible: clipping a note is the one thing §6.5
    // refuses to do, and a frame is cheaper to widen than a layout is to fix.
    //
    // On the current corpus this is a no-op — all 932 specs converge, so
    // `overflow` is 0 by the time we get here and the width is left alone.
    const right = overflow > 0.5 ? Math.ceil(width + overflow) : width;
    if (top !== 0 || bottom !== height || right !== width) {
      svg.setAttribute('viewBox', `0 ${top} ${right} ${bottom - top}`);
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
