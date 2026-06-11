// tools/notation-renderer.js
// Render drum-notation specs to static SVG strings at build time.
// Uses jsdom to give VexFlow a DOM to draw into, then extracts the SVG markup.

const { JSDOM } = require('jsdom');

let cachedVF = null;
let cachedDom = null;

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
  if (spec.sticking) {
    const ann = new VF.Annotation(spec.sticking);
    if (VF.Annotation && VF.Annotation.VerticalJustify) {
      ann.setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM);
    }
    if (typeof ann.setFont === 'function') {
      ann.setFont('Arial', 10, 'normal');
    }
    note.addModifier(ann, 0);
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
          ann.setFont('Arial', 8, 'normal');
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
 *   height: number (optional, default 130),
 *   hands: [ noteSpec, ... ],
 *   feet:  [ noteSpec, ... ],
 *   tuplets: [ { voice: 'hands'|'feet', start, length, num_notes, notes_occupied } ],
 *   beamGroups: [[num, denom], ...]
 * }
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

function renderPattern(spec) {
  const { VF, dom } = getVexFlow();
  const document = dom.window.document;

  // Clean container per render
  const container = document.createElement('div');
  container.id = 'render-target-' + Math.random().toString(36).slice(2, 9);
  document.body.appendChild(container);

  const barCount = _detectBarCount(spec);
  const baseWidth = spec.width || 760;
  const height = spec.height || 130;
  // Multi-bar layouts widen proportionally, but we cap so single-bar exercises
  // don't shrink and the layout doesn't go off-screen for very long phrases.
  const width = barCount > 1 ? Math.min(1400, Math.max(baseWidth, baseWidth + (barCount - 1) * 240)) : baseWidth;

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
        const beamable = voice.getTickables().filter(n => !n.isRest());
        if (beamable.length) {
          const opts = { stem_direction: stemDir };
          if (spec.beamGroups) {
            opts.groups = spec.beamGroups.map(g => new VF.Fraction(g[0], g[1]));
          }
          VF.Beam.generateBeams(beamable, opts).forEach(bm => allBeams.push(bm));
        }
      });

      voices.forEach(v => v.draw(ctx, stave));
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
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    if (!svg.getAttribute('viewBox')) {
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    const out = svg.outerHTML;
    container.remove();
    return out;
  } catch (err) {
    container.remove();
    return `<div class="notation-error">Notation render failed: ${err.message}</div>`;
  }
}

module.exports = { renderPattern };
