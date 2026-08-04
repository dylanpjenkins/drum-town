// src/assets/js/pattern-math.js
// Pure timing math shared by the client player (browser global `PatternMath`)
// and the Node-side audit/check tools (CommonJS export). All lengths are in
// quarter-note units; seconds come from bpm (which is quarter-note BPM).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.PatternMath = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {

  // 'w'|'h'|'q'|'8'|'16'|'32' (plus legacy 'e'/'s' aliases) → quarter-note
  // units, ×1.5 when dotted. Returns null for unknown durations.
  function durationTicks(note) {
    var base = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25, 8: 0.5, 16: 0.25, 32: 0.125 }[note.duration];
    if (base === undefined) {
      var denom = parseInt(note.duration, 10);
      if (!denom) return null;
      base = 4 / denom;
    }
    return note.dot ? base * 1.5 : base;
  }

  // Per-note-index tuplet scale factors for one voice.
  function tupletScales(spec, voice, length) {
    var scale = [];
    for (var i = 0; i < length; i++) scale.push(1);
    (spec.tuplets || []).forEach(function (t) {
      if (t.voice !== voice) return;
      var f = t.notes_occupied / t.num_notes;
      for (var j = t.start; j < t.start + t.length && j < length; j++) scale[j] = f;
    });
    return scale;
  }

  // Total quarter-note length of one voice; null when empty or unmeasurable.
  function voiceTicks(spec, voice) {
    var arr = spec[voice] || [];
    if (!arr.length) return null;
    var scale = tupletScales(spec, voice, arr.length);
    var sum = 0;
    for (var i = 0; i < arr.length; i++) {
      var tk = durationTicks(arr[i]);
      if (tk === null) return null;
      sum += tk * scale[i];
    }
    return sum;
  }

  // Full pattern length in quarter-note units: the longest measurable voice
  // (multi-bar specs sum to N bars), falling back to one bar of the time
  // signature when no voice is measurable.
  function patternBeats(spec) {
    var beats = Math.max(voiceTicks(spec, 'hands') || 0, voiceTicks(spec, 'feet') || 0);
    if (beats > 0) return beats;
    var parts = (spec.timeSignature || '4/4').split('/');
    return Number(parts[0]) * (4 / Number(parts[1]));
  }

  function patternDurationSecs(spec) {
    return patternBeats(spec) * (60 / (spec.bpm || 80));
  }

  return {
    durationTicks: durationTicks,
    tupletScales: tupletScales,
    voiceTicks: voiceTicks,
    patternBeats: patternBeats,
    patternDurationSecs: patternDurationSecs
  };
});
