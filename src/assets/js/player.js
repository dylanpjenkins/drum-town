// src/assets/js/player.js
// Tiny client-side drum player. Reads exercise specs from data-spec
// attributes on .play-btn buttons and schedules drum hits via Web Audio.
// The same button may carry data-swing (8 or 16), derived from the exercise
// meta at build time; see the Swing block below.
//
// Two kits:
//   electronic — synthesized voices (oscillators + filtered noise)
//   acoustic   — real WAV samples from /assets/audio/acoustic/
//
// Playback model: each click creates a PlaybackSession with its own master
// GainNode. Bars are scheduled 500ms ahead in a 200ms top-up loop and the
// pattern loops indefinitely until the user clicks again to stop. Stop
// fades the master gain to 0 (click-free) and tears down the session.

(() => {
  // Staff-position → voice map. Covers every key used by lessonContent.js
  // (tools/checks/check-player-keys.js enforces full coverage).
  const KEY_TO_DRUM = {
    'g/5/x2': 'hat',      // closed hi-hat (top space, x head)
    'c/5':    'snare',
    'f/4':    'kick',
    'd/4/x2': 'foot',     // hi-hat pedal
    'f/5/x2': 'ride',     // ride bow (top line, x head)
    'e/5/x2': 'bell',     // cowbell / ride bell (Latin bell patterns)
    'a/5/x2': 'crash',
    'b/5/x2': 'china',
    'e/5':    'tomHigh',
    'd/5':    'tomMid',
    'a/4':    'tomFloor'
  };

  // ---- Accent dynamics (BL-097) ----
  // tools/notation-renderer.js draws a ">" over any note with accent: true, and
  // until this existed the audio ignored the flag completely: on
  // funk-ghost-notes#0 — the flagship exercise of the lesson about ghost notes,
  // whose tip asks for "a 4-to-1 ratio between accented and ghosted snare" — all
  // five snare strokes left the speakers at one level. The stave could say loud
  // and the player could not.
  //
  // Three levels. Every note is either left at the level it already played at or
  // LOWERED — nothing is ever scaled up — so no exercise gets louder overall.
  // Measured by rendering all 201 accent-lowering exercises twice, shipped and
  // accent-blind: RMS fell in 201 of 201 (ratio 0.4375 to 0.9973, i.e. -7.2 dB to
  // -0.02 dB) and rose in none.
  //
  // "Nothing gets louder" is true of the exercise and FALSE of individual samples,
  // so do not write the stronger claim here again. Samples are signed and the mix
  // is a linear sum, so lowering one of two partially cancelling contributions can
  // raise |sum|. Measured: 71 of the 201 have at least one note window above its
  // accent-blind level, worst 1.87% (funk-james-brown#3 hands#32, fusion-
  // mahavishnu#2 hands#8), and 4 have a higher buffer peak — hiphop-neo-soul#0 and
  // #1 go 1.54463 -> 1.54519. LOUDER_TOL in
  // tools/checks/check-accent-dynamics.js absorbs exactly that and is load-bearing,
  // not slack: it sits above the 1.019 cancellation ceiling and below the 1.20 an
  // accent-boost mutant produces.
  //
  // The net effect on peaks runs the other way, which is a free win worth keeping:
  // 196 of the 201 already clipped past full scale before this existed (up to
  // 2.172) and lowering the quiet strokes CUTS that — latin-mozambique#1
  // 2.094 -> 1.487, rock-hybrid-grooves#3 2.016 -> 1.545, funk-new-orleans#3
  // 1.850 -> 1.184, rock-train-beat#3 1.819 -> 1.487.
  //
  //   1.00  an accented note, and every note of a voice this spec never accents
  //         (so an exercise that marks no accents is untouched)
  //   0.25  a SNARE or TOM stroke the content marks `ghost: true`, and (by the
  //         legacy inference in noteGain) an unaccented, unlettered stroke of an
  //         accented snare or tom voice. The lessons print this number
  //         themselves — "roughly a quarter of that volume", "a 4-to-1 ratio
  //         between accented and ghosted snare", "if a backbeat is 5 on a
  //         1-to-10 scale the ghosts are between 1 and 1.5" — and that 1-to-10
  //         scale is a linear amplitude reading, so 4-to-1 is 0.25 (about
  //         -12 dB), not the 0.5 a power reading would give.
  //   0.50  an unaccented stroke of an accented CYMBAL or KICK voice, and any
  //         unaccented full stroke (see fullStroke below): one dynamic level
  //         down (-6 dB), the ordinary reading of a ">". A ghost is a specific
  //         SNARE/TOM stroke — fingers, stick an inch off the head — and there is
  //         no such thing on a ride, so the bell-accent exercises
  //         (jazz-bop-vocabulary#1, metal-thrash#1) get a contrast without their
  //         cymbal line dropping to a whisper. `foot` (the hi-hat pedal) is never
  //         accented anywhere in the corpus, so in practice this tier is reached
  //         by hat, ride, bell, crash, china and — in jazz-modern-jazz#2 and one
  //         other — the kick.
  //
  // GHOST_VOICES is keyed by the values of KEY_TO_DRUM but nothing enforces that:
  // add a drum voice there and forget it here and it silently joins the tap tier.
  const GAIN_ACCENT = 1;
  const GAIN_GHOST = 0.25;
  const GAIN_TAP = 0.5;
  const GHOST_VOICES = { snare: 1, tomHigh: 1, tomMid: 1, tomFloor: 1 };

  // ---- Swing (BL-128) ----
  // Until this existed the word "swing" appeared nowhere in this file. 76
  // exercises across 27 lessons — 16 of the site's 21 jazz lessons — print
  // "swing 8ths", "swing 16ths" or "swung 16ths" in their meta and were played
  // in even binary halves, so jazz-ride-pattern taught the jazz ride with a
  // straight-eighths rock ride.
  //
  // WHERE THE NUMBER COMES FROM. `data-swing` on the play button, derived from
  // the meta at build time in .eleventy.js (swingLevelFor), never parsed here.
  // 8 = the beat's second eighth moves; 16 = each eighth's second sixteenth
  // moves and the eighths themselves do NOT. Absent = straight, which is 816 of
  // the 892 buttons.
  //
  // THE RATIO IS 2:1, and the site sets it rather than taste. reading-dotted-
  // rhythms states it outright: "A swung 8th pair is built from a triplet (the
  // long is two-thirds of a beat, the short is one-third)." hi-hat-articulation#3,
  // itself one of the 76: "Treat the swing 8ths as triplets with the middle note
  // rested out." the-shuffle#0, which already notates that as real tuplets: the
  // short note "arrive[s] a third of a beat before the next click." All three put
  // the off-beat at 2/3, and 2/3 is what the corpus's 198 3:2 tuplets already
  // play at.
  //
  // IT IS FLAT, AND THE SITE DOES NOT ENTIRELY AGREE. jazz-ride-pattern's own
  // "Getting the Swing Right" section says "At MEDIUM tempos the skip-note lands
  // like the third note of a triplet" and then "The ratio also breathes with
  // tempo: swing tightens toward even 8ths as things get fast, so trust your ear
  // over any formula." That is true of players (Friberg and Sundstrom measured
  // it) and it is not modelled here, on two grounds and one absence:
  //
  //   * A curve would make one page contradict itself. jazz-modern-jazz#2 and #4
  //     are the same lesson at the same 130 BPM; #4 notates its triplets and #2
  //     does not. Flat 2:1 makes them identical, which is what a reader playing
  //     both expects. A curve makes the tupleted one deeper than its neighbour at
  //     one tempo, and no reader can see why.
  //   * The corpus's whole vocabulary for the feel is the 3:2 tuplet. There is no
  //     second number anywhere in it to interpolate toward.
  //   * "Trust your ear over any formula" is advice to a drummer, not a spec. The
  //     site states no curve, so implementing one would be inventing content.
  //
  // Recorded as the honest weak spot: at jazz-up-tempo#2's 250 BPM a flat 2:1
  // ride is deeper than the page's own prose asks for. Changing it means changing
  // the ratio here, RATIO_TOL in tools/checks/check-swing-feel.js, and the lesson
  // prose, in one move.
  //
  // A PROJECTION, NOT A WARP, AND THAT IS THE WHOLE SAFETY ARGUMENT. swungOnset
  // moves a note only when it sits EXACTLY on the moved subdivision, and the
  // place it moves to is not itself a moved subdivision — the domain (p = cell/2)
  // and the image (p = 2*cell/3) are disjoint. So swungOnset(swungOnset(t)) ===
  // swungOnset(t) for every t: feeding an already-swung timeline through this
  // function changes nothing, and double-swinging is not a thing the code can be
  // made to do. That matters because independence-chapin-method#4 prints
  // "swing 8ths" AND notates the triplets, and it is the one exercise in that
  // lesson that sounds right today. A continuous grid warp — the obvious
  // alternative, and what a DAW groove template does — would have moved its 1/3
  // to 4/9 and its 2/3 to 7/9 and broken it.
  //
  // Three independent things now have to fail before a correct page breaks, and
  // they are NOT equally load-bearing on today's content — say which is which:
  //   1. .eleventy.js refuses to emit data-swing for a spec with any tuplet. This
  //      is the one doing the work in production: it is what keeps
  //      independence-chapin-method#4, jazz-modern-jazz#4 and triplet-feel#3 out
  //      of this function entirely.
  //   2. a note whose tuplet scale is not 1 is never displaced (below). DEFENSE IN
  //      DEPTH, not a live guard. The shape it defends against is a SEXTUPLET,
  //      whose 4th note lands on p = 0.5 by arithmetic and is the only tuplet
  //      shape the projection alone would move — but the corpus's one 6:4,
  //      hiphop-modern-production#1, has a meta of "4/4 (half-time) - quarter =
  //      70" which names no feel, so rule 1 already stops it and no live page
  //      depends on this line. It is reachable only when data-swing is forced on,
  //      which is exactly how check-swing-feel.js exercises it.
  //   3. the projection is idempotent, so even a doubled application is a no-op.
  //
  // DURATIONS DO NOT MOVE. `u` below always advances by the straight length, so
  // the note after a swung one is scheduled from the straight grid, the pattern
  // is exactly as long as PatternMath says, and the loop point is untouched.
  // Swing is where a note SOUNDS, never how long the bar is.
  //
  // THE ACCUMULATOR CHANGED UNITS, AND THAT IS AN IMPROVEMENT, NOT A WASH. This
  // loop used to accumulate SECONDS (t += ticks * scale * 60/bpm); it now
  // accumulates quarter-note beats and multiplies once. Replaying the old loop
  // against this one over all 852 bpm-carrying specs gives a worst onset delta of
  // 2.84e-14 s — sample-identical at 44.1kHz, not bit-identical, and the stronger
  // word should not be written here. Ten of those deltas are half-sample rounding
  // ties in exercises with no feel at all, e.g. latin-comparsa#1 hands[7]
  // 1.8749999999999998 against 1.875, and in every one of the ten THIS value is
  // the exact one: repeated addition of 60/bpm had drifted off the grid and a
  // single multiply does not.
  const SWING_FEELS = {
    8:  { cell: 1 },     // the quarter-note beat
    16: { cell: 0.5 }    // the eighth
  };
  const SWING_LANDING = 2 / 3;   // the off-subdivision's position inside its cell
  const SWING_EPS = 1e-6;        // in quarter-note units: 0.24us at 250 BPM

  function swingFeelFrom(btn) {
    const raw = btn && btn.dataset ? btn.dataset.swing : null;
    return SWING_FEELS[Number(raw)] || null;
  }

  // straight position (quarter-note units from the pattern's start) -> swung.
  function swungOnset(u, feel, tupletScale) {
    if (!feel || tupletScale !== 1) return u;
    const cell = feel.cell;
    const base = Math.floor(u / cell + SWING_EPS) * cell;
    const p = u - base;
    return Math.abs(p - cell / 2) < SWING_EPS ? base + cell * SWING_LANDING : u;
  }

  // The inverse, for the playhead: swung wall-position -> the straight position
  // the STAVE draws. Piecewise-linear through the three points swungOnset fixes
  // inside a cell — 0->0, cell/2 -> cell*2/3, cell -> cell — so at the instant a
  // swung note sounds the cursor is exactly over that note's own notehead, and
  // between notes it interpolates. Both maps read the same two constants, so they
  // cannot drift apart.
  function straightTime(u, feel) {
    if (!feel) return u;
    const cell = feel.cell;
    const base = Math.floor(u / cell + SWING_EPS) * cell;
    const p = u - base;
    const land = cell * SWING_LANDING;
    return p < land
      ? base + p * (cell / 2) / land
      : base + cell / 2 + (p - land) * (cell / 2) / (cell - land);
  }

  const KIT_STORAGE_KEY = 'dc_kit';
  const DEFAULT_KIT = 'electronic';

  function getKitName() {
    try {
      return localStorage.getItem(KIT_STORAGE_KEY) || DEFAULT_KIT;
    } catch (e) {
      return DEFAULT_KIT;
    }
  }
  function setKitName(name) {
    try { localStorage.setItem(KIT_STORAGE_KEY, name); } catch (e) {}
  }

  // ---- AudioContext (lazy, gesture-bound) ----

  let ctx = null;
  function getCtx() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Cached one-second white-noise buffer; reused across voices.
  let noiseBuf = null;
  function getNoiseBuffer(c) {
    if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
    const len = c.sampleRate;
    noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  // ============================================================
  // KIT: ELECTRONIC — synthesized voices
  // Every voice connects to `out` (the session's master gain) so it can
  // be muted instantly on stop without orphaning scheduled nodes.
  // ============================================================

  function kickElectronic(c, t, out) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.0, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.25);
  }

  function snareElectronic(c, t, out) {
    const noise = c.createBufferSource();
    noise.buffer = getNoiseBuffer(c);
    const nf = c.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.value = 1200;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.7, t + 0.003);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    noise.connect(nf).connect(ng).connect(out);
    noise.start(t); noise.stop(t + 0.2);

    const o = c.createOscillator();
    const og = c.createGain();
    o.type = 'triangle';
    o.frequency.value = 210;
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.45, t + 0.003);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(og).connect(out);
    o.start(t); o.stop(t + 0.1);
  }

  function hatElectronic(c, t, out, gainScale) {
    const noise = c.createBufferSource();
    noise.buffer = getNoiseBuffer(c);
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28 * (gainScale || 1), t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    noise.connect(f).connect(g).connect(out);
    noise.start(t); noise.stop(t + 0.07);
  }

  function footElectronic(c, t, out) { hatElectronic(c, t, out, 0.7); }

  // Open hi-hat — same recipe as the closed hat but with a much longer
  // exponential decay (~400ms) and a slightly lower highpass for more
  // "shhh" character.
  function openHatElectronic(c, t, out) {
    const noise = c.createBufferSource();
    noise.buffer = getNoiseBuffer(c);
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    noise.connect(f).connect(g).connect(out);
    noise.start(t); noise.stop(t + 0.45);
  }

  // Ride bow — bright noise wash plus two partials: a high square for the
  // stick attack and a low triangle "ping" fundamental (the 300–800Hz body a
  // real ride has and a hat doesn't).
  function rideElectronic(c, t, out) {
    const noise = c.createBufferSource();
    noise.buffer = getNoiseBuffer(c);
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    noise.connect(f).connect(g).connect(out);
    noise.start(t); noise.stop(t + 0.4);

    const o = c.createOscillator();
    const og = c.createGain();
    o.type = 'square';
    o.frequency.value = 4200;
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.06, t + 0.002);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(og).connect(out);
    o.start(t); o.stop(t + 0.14);

    const ping = c.createOscillator();
    const pg = c.createGain();
    ping.type = 'triangle';
    ping.frequency.value = 410;
    pg.gain.setValueAtTime(0.0001, t);
    pg.gain.exponentialRampToValueAtTime(0.1, t + 0.003);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    ping.connect(pg).connect(out);
    ping.start(t); ping.stop(t + 0.32);
  }

  // Bell (cowbell / ride bell) — two detuned square partials, fast decay.
  function bellElectronic(c, t, out) {
    [[835, 0.22], [1370, 0.12]].forEach(([freq, amp]) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(g).connect(out);
      o.start(t); o.stop(t + 0.25);
    });
  }

  function crashElectronic(c, t, out) {
    const noise = c.createBufferSource();
    noise.buffer = getNoiseBuffer(c);
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 4000;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    noise.connect(f).connect(g).connect(out);
    noise.start(t); noise.stop(t + 1.2);
  }

  // China — trashier and shorter than the crash: bandpassed noise with a
  // fast, aggressive attack.
  function chinaElectronic(c, t, out) {
    const noise = c.createBufferSource();
    noise.buffer = getNoiseBuffer(c);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 3200;
    f.Q.value = 0.6;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    noise.connect(f).connect(g).connect(out);
    noise.start(t); noise.stop(t + 0.6);
  }

  // Toms — same pitch-sweep recipe as the kick, tuned per drum.
  function tomElectronic(c, t, out, startHz, endHz, decay) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(startHz, t);
    o.frequency.exponentialRampToValueAtTime(endHz, t + decay * 0.7);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.8, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + decay + 0.05);
  }
  function tomHighElectronic(c, t, out)  { tomElectronic(c, t, out, 320, 200, 0.25); }
  function tomMidElectronic(c, t, out)   { tomElectronic(c, t, out, 240, 150, 0.28); }
  function tomFloorElectronic(c, t, out) { tomElectronic(c, t, out, 170, 100, 0.35); }

  // ============================================================
  // KIT: ACOUSTIC — sample-based playback
  // ============================================================

  const ACOUSTIC_SAMPLE_URLS = {
    kick:    '/assets/audio/acoustic/kick.wav',
    snare:   '/assets/audio/acoustic/snare.wav',
    hat:     '/assets/audio/acoustic/hat_closed.wav',
    openHat: '/assets/audio/acoustic/hat_open.wav',
    ride:    '/assets/audio/acoustic/ride.wav'
  };

  const acousticArrays = {};
  let acousticFetchPromise = null;
  function preFetchAcoustic() {
    if (acousticFetchPromise) return acousticFetchPromise;
    acousticFetchPromise = Promise.all(
      Object.entries(ACOUSTIC_SAMPLE_URLS).map(async ([name, url]) => {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          acousticArrays[name] = await res.arrayBuffer();
        } catch (err) {
          console.warn('player: failed to fetch ' + url, err);
        }
      })
    );
    return acousticFetchPromise;
  }

  const acousticBuffers = {};
  let acousticDecodePromise = null;
  async function ensureAcousticDecoded(c) {
    if (acousticDecodePromise) return acousticDecodePromise;
    acousticDecodePromise = (async () => {
      await preFetchAcoustic();
      await Promise.all(Object.entries(acousticArrays).map(async ([name, arr]) => {
        try {
          acousticBuffers[name] = await c.decodeAudioData(arr.slice(0));
        } catch (err) {
          console.warn('player: failed to decode ' + name, err);
        }
      }));
    })();
    return acousticDecodePromise;
  }

  function playAcousticSample(name, c, t, out, gainScale) {
    const buf = acousticBuffers[name];
    if (!buf) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    if (gainScale != null && gainScale !== 1) {
      const g = c.createGain();
      g.gain.value = gainScale;
      src.connect(g).connect(out);
    } else {
      src.connect(out);
    }
    src.start(t);
  }

  function kickAcoustic(c, t, out)    { playAcousticSample('kick',    c, t, out); }
  function snareAcoustic(c, t, out)   { playAcousticSample('snare',   c, t, out); }
  function hatAcoustic(c, t, out)     { playAcousticSample('hat',     c, t, out); }
  function openHatAcoustic(c, t, out) { playAcousticSample('openHat', c, t, out); }
  // No dedicated foot sample yet — a quieter closed hat is honestly what a
  // pedaled hat sounds like, so this one substitution stays.
  function footAcoustic(c, t, out)    { playAcousticSample('hat',     c, t, out, 0.55); }
  function rideAcoustic(c, t, out)    { playAcousticSample('ride',    c, t, out); }
  // No bell/crash/china/tom samples exist (ISSUES.md #2). Rate-shifted
  // copies of other cymbals mis-teach the exact contrasts the lessons
  // exist to teach, so the acoustic kit uses the clearly-synthesized
  // voices for these until real samples arrive.
  function bellAcoustic(c, t, out)     { bellElectronic(c, t, out); }
  function crashAcoustic(c, t, out)    { crashElectronic(c, t, out); }
  function chinaAcoustic(c, t, out)    { chinaElectronic(c, t, out); }
  function tomHighAcoustic(c, t, out)  { tomHighElectronic(c, t, out); }
  function tomMidAcoustic(c, t, out)   { tomMidElectronic(c, t, out); }
  function tomFloorAcoustic(c, t, out) { tomFloorElectronic(c, t, out); }

  preFetchAcoustic();

  // ---- Kit registry ----

  const KITS = {
    electronic: {
      kick: kickElectronic, snare: snareElectronic, hat: hatElectronic,
      openHat: openHatElectronic, foot: footElectronic,
      ride: rideElectronic, bell: bellElectronic,
      crash: crashElectronic, china: chinaElectronic,
      tomHigh: tomHighElectronic, tomMid: tomMidElectronic, tomFloor: tomFloorElectronic
    },
    acoustic: {
      kick: kickAcoustic, snare: snareAcoustic, hat: hatAcoustic,
      openHat: openHatAcoustic, foot: footAcoustic,
      ride: rideAcoustic, bell: bellAcoustic,
      crash: crashAcoustic, china: chinaAcoustic,
      tomHigh: tomHighAcoustic, tomMid: tomMidAcoustic, tomFloor: tomFloorAcoustic
    }
  };

  function resolveKitNameFor(btn) {
    const exercise = btn.closest('.exercise');
    const sel = exercise && exercise.querySelector('[data-exercise-kit]');
    return (sel && sel.value) || getKitName();
  }

  // ---- Spec timing helpers ----
  // All note/pattern math lives in PatternMath (pattern-math.js, loaded before
  // this file) so the player, audit, and checks can never disagree. Dotted
  // notes and tuplets are handled there; multi-bar specs report their full
  // length via patternDurationSecs.

  // Which VOICES this spec accents. Two rules, and the corpus forces both.
  //
  // PER VOICE, NOT PER BAR. funk-ghost-notes#0 accents the two backbeats and
  // leaves all sixteen hi-hat 16ths bare, so "every unaccented note in a bar that
  // marks accents is a ghost" would whisper the ostinato the groove rides on.
  // Only a voice that is accented somewhere in the spec has its unaccented
  // strokes lowered — the same convention tools/checks/check-tip-claims.js:133-138
  // already applies when it decides which c/5 hits count as backbeats.
  //
  // AN ACCENT ON A UNISON STEM MOSTLY BELONGS TO THE DRUM. 204 accented notes in
  // the corpus carry a hat and a snare on one stem (keys: ['g/5/x2','c/5']) and
  // the ">" is drawn over the whole stem, so reading it per-key would mark the hat
  // as accented too — and then 93 exercises would ghost their hi-hat line. Mostly
  // the lessons mean the drum: jazz-bop-vocabulary#0 accents ride+snare and its
  // own tip says "Keep the ride absolutely steady; only the snare changes", and
  // snare-voicings#1 accents hat+snare to ask for a rim-shot. So a drum on the
  // stem takes the accent alone; a cymbal is marked only when accented on its own.
  //
  // That is a generalisation, not a law, and it is wrong in at least four places:
  // funk-james-brown#2 says "kick, snare, and accented hat land together",
  // jazz-tony-williams#3 calls for "one sharp snare-and-ride accent", and
  // jazz-modern-jazz#1 and latin-modern-hybrid#1 read the same way. Those lose an
  // accent on the cymbal they wanted it on. It is still the right trade: every
  // counterexample is one omitted accent, against whispering 93 hi-hat ostinati.
  function accentedVoices(spec) {
    const marked = {};
    for (const voiceName of ['hands', 'feet']) {
      for (const note of (spec[voiceName] || [])) {
        if (note.rest || note.accent !== true) continue;
        const drums = [];
        for (const key of (note.keys || [])) {
          const drum = KEY_TO_DRUM[key];
          if (drum) drums.push(drum);
        }
        const ghostable = drums.filter(d => GHOST_VOICES[d]);
        for (const drum of (ghostable.length ? ghostable : drums)) marked[drum] = true;
      }
    }
    return marked;
  }

  // Does this note carry a sticking letter at all? Note what this does NOT ask:
  // whether the letter is upper or lower case. Until BL-078 it did, and the case
  // was the whole discriminator — lowercase meant a ghost, uppercase a full
  // stroke, because four lesson tips said so in prose. That is not drum notation
  // (a letter names a HAND; a ghost is marked by dynamics or a parenthesized
  // notehead) and the corpus had already broken under it: finger-control#2's tip
  // read "Hi-hat 16ths in the right hand, snare 16ths in the left. The r snare
  // hits are all fingers" over notes lettered r. Nothing here reads case now.
  function hasSticking(note) {
    const s = note.sticking;
    return typeof s === 'string' && /[A-Za-z]/.test(s);
  }

  // BL-078 gave the data an explicit marker, so a ghost says it is one:
  //
  //   { keys: ['c/5'], duration: '16', sticking: 'L', ghost: true }
  //
  // Honored on SNARE and TOM keys only. On a unison hat+snare stem — which is how
  // every chorded ghost in the corpus is written — it lowers the snare and leaves
  // the hi-hat ostinato at full level, the same split accentedVoices() applies to
  // a ">" on that stem. It also fires on a spec that accents NOTHING, which the
  // old rule structurally could not: ghost-notes-found#1 and finger-control#0 are
  // sixteen ghost 16ths with no accent anywhere, so `marked` came back empty and
  // all sixteen played at full level under a tip asking for "a soft hum".
  //
  // THE LAST CLAUSE IS A PROXY, NOT A RULE, and it is on its way out. 119
  // exercises across 59 lessons still reach the ghost tier by inference:
  // unaccented snare/tom of an accented voice, carrying no sticking at all.
  // funk-ghost-notes#0 is the flagship. Against them sit 64 accent-tap exercises
  // (the paradiddle family, accent-tap, moeller-stroke, accented-singles,
  // rock-train-beat, fusion-mahavishnu) whose unaccented strokes are real full
  // strokes at 0.5 — paradiddle#0 asks only that its accents be "slightly louder
  // than the rest", and 4-to-1 is not slightly. Every one of those 64 letters its
  // sticking and none of the 119 do, so today a letter's PRESENCE separates the
  // piles.
  //
  // BL-078 asked for that proxy to disappear outright. Measured, it cannot yet:
  // deleting it drops all 119 from 0.25 to 0.5, and marking them instead is an
  // edit to 59 lessons against CLAUDE.md's 10-lesson cap. Marking them is the
  // follow-up, and when the last one is marked this function loses its final two
  // clauses. What did disappear is the case reading.
  function noteGain(note, voice, marked) {
    if (note.accent === true) return GAIN_ACCENT;
    if (note.ghost === true && GHOST_VOICES[voice]) return GAIN_GHOST;
    if (!marked[voice]) return GAIN_ACCENT;
    if (!GHOST_VOICES[voice] || hasSticking(note)) return GAIN_TAP;
    return GAIN_GHOST;
  }

  function scheduleVoice(notes, c, kit, out, startAt, bpm, spec, voiceName, marked, feel) {
    const scale = PatternMath.tupletScales(spec, voiceName, notes.length);
    const secsPerBeat = 60 / bpm;
    // `u` is the STRAIGHT position in quarter-note units and is the only thing
    // that accumulates; the swung time is computed from it per note and thrown
    // away. Swing therefore cannot compound across a bar or shift a loop point.
    let u = 0;
    notes.forEach((note, i) => {
      const ticks = PatternMath.durationTicks(note);
      const len = (ticks === null ? 1 : ticks) * scale[i];
      const t = startAt + swungOnset(u, feel, scale[i]) * secsPerBeat;
      if (!note.rest) {
        for (const key of (note.keys || [])) {
          const voice = KEY_TO_DRUM[key];
          if (!voice) continue;
          let drum = voice;
          // Articulation modifiers — currently just `open` to swap the
          // closed-hat voice for the open-hat voice. The dynamic is decided from
          // the base voice, so an open hat inherits the hat line's marking.
          if (drum === 'hat' && note.articulation === 'open') drum = 'openHat';
          if (!kit[drum]) continue;
          // One gain node per (note, KEY) — not per note. A single stem can carry
          // a ghosted snare and an ostinato hi-hat, and one node per note would
          // have to pick a single level for both. The node is skipped entirely
          // when the level is 1, so a spec that marks no accents builds exactly
          // the graph it built before this code existed.
          const level = noteGain(note, voice, marked);
          let dest = out;
          if (level !== 1) {
            dest = c.createGain();
            dest.gain.value = level;
            dest.connect(out);
          }
          kit[drum](c, t, dest);
        }
      }
      u += len;
    });
    return startAt + u * secsPerBeat;
  }

  function schedulePattern(spec, c, kit, out, startAt, feel) {
    const bpm = spec.bpm || 80;
    const marked = accentedVoices(spec);
    scheduleVoice(spec.hands || [], c, kit, out, startAt, bpm, spec, 'hands', marked, feel);
    scheduleVoice(spec.feet  || [], c, kit, out, startAt, bpm, spec, 'feet', marked, feel);
  }

  // ---- Playhead ----

  function getMusicBounds(svg) {
    const heads = svg.querySelectorAll('g.vf-stavenote g.vf-notehead');
    if (!heads.length) return null;
    const centersSet = new Set();
    heads.forEach(h => {
      let bbox;
      try { bbox = h.getBBox(); } catch (e) { return; }
      if (!bbox || bbox.width === 0) return;
      centersSet.add(Math.round((bbox.x + bbox.width / 2) * 100) / 100);
    });
    const centers = [...centersSet].sort((a, b) => a - b);
    if (centers.length < 2) return null;
    const firstCenter = centers[0];
    const lastCenter  = centers[centers.length - 1];
    const spacing = (lastCenter - firstCenter) / (centers.length - 1);
    return { startX: firstCenter, endX: lastCenter + spacing, y1: 18, y2: 122 };
  }

  function ensurePlayhead(svg, bounds) {
    let line = svg.querySelector('line.playhead');
    if (!line) {
      line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'playhead');
      svg.appendChild(line);
    }
    line.setAttribute('y1', bounds.y1);
    line.setAttribute('y2', bounds.y2);
    line.setAttribute('x1', bounds.startX);
    line.setAttribute('x2', bounds.startX);
    return line;
  }

  // ---- Button state ----

  function setBtnState(btn, state) {
    const icon = btn.querySelector('.play-btn__icon');
    const label = btn.querySelector('.play-btn__label');
    if (state === 'playing') {
      if (icon) icon.textContent = '■';
      if (label) label.textContent = 'Stop';
      btn.setAttribute('aria-label', 'Stop exercise');
    } else if (state === 'loading') {
      if (icon) icon.textContent = '⏳';
      if (label) label.textContent = 'Loading';
      btn.setAttribute('aria-label', 'Loading samples');
    } else {
      if (icon) icon.textContent = '▶';
      if (label) label.textContent = 'Play';
      btn.setAttribute('aria-label', 'Play exercise');
    }
  }

  // ---- Playback session ----
  // Owns its master GainNode, the schedule-ahead timer, and the playhead RAF.
  // stop() ramps gain to 0 over ~20ms (click-free) and clears all timers.

  const SCHEDULE_AHEAD = 0.5;       // schedule this many seconds in the future
  const SCHEDULE_INTERVAL_MS = 200; // top-up cadence
  const STOP_FADE_SECS = 0.02;      // master fade-out on stop

  function PlaybackSession(c, kit, spec, btn, svg, bounds, line, feel) {
    this.c = c;
    this.kit = kit;
    this.spec = spec;
    this.feel = feel || null;
    this.secsPerBeat = 60 / (spec.bpm || 80);
    this.btn = btn;
    this.svg = svg;
    this.container = svg ? svg.closest('.notation') : null;
    this.bounds = bounds;
    this.line = line;
    this.patternDuration = PatternMath.patternDurationSecs(spec);
    this.gain = c.createGain();
    this.gain.gain.value = 1;
    this.gain.connect(c.destination);
    this.scheduledUntil = 0;
    this.timer = null;
    this.rafId = null;
    this.stopped = false;
    this.audioStart = 0;
    // Playhead auto-follow yields to the user. Any scroll we didn't write
    // ourselves marks the view as user-owned; follow resumes only when the
    // playhead walks back into the user's chosen window on its own. The
    // scroll event (not input events) is the signal, so scrollbar drags and
    // keyboard scrolling count in every browser.
    this.userScrolled = false;
    this._progScroll = false;
    this._onScroll = null;
    this.padLeft = 0;
  }

  PlaybackSession.prototype.start = function () {
    if (this.stopped) return;
    const lookahead = 0.06;
    this.audioStart = this.c.currentTime + lookahead;
    this.scheduledUntil = this.audioStart;
    this.scheduleAhead();
    this.timer = setInterval(() => this.scheduleAhead(), SCHEDULE_INTERVAL_MS);
    if (this.container) {
      const session = this;
      this.padLeft = parseFloat(getComputedStyle(this.container).paddingLeft) || 0;
      this._onScroll = () => {
        if (session._progScroll) { session._progScroll = false; return; }
        session.userScrolled = true;
      };
      this.container.addEventListener('scroll', this._onScroll, { passive: true });
    }
    if (this.line && this.bounds) this.startPlayhead();
  };

  PlaybackSession.prototype.scheduleAhead = function () {
    if (this.stopped) return;
    const horizon = this.c.currentTime + SCHEDULE_AHEAD;
    while (this.scheduledUntil < horizon) {
      schedulePattern(this.spec, this.c, this.kit, this.gain, this.scheduledUntil, this.feel);
      this.scheduledUntil += this.patternDuration;
    }
  };

  PlaybackSession.prototype.startPlayhead = function () {
    const session = this;
    const span = this.bounds.endX - this.bounds.startX;
    this.line.classList.add('is-active');
    const tick = () => {
      if (session.stopped) {
        session.rafId = null;
        return;
      }
      const elapsed = Math.max(0, session.c.currentTime - session.audioStart);
      // On a swung exercise the cursor runs on the STAVE's clock, not the
      // speaker's: the notation is straight (correctly — BL-085), so the moment
      // the late eighth sounds the cursor has to be over the notehead drawn at
      // the straight eighth. straightTime is the exact inverse of the offset
      // scheduleVoice applied, so onsets and cursor cannot disagree. Leaving this
      // out would have swapped one lie for another — every off-beat notehead lit
      // up to a sixth of a beat early (125ms at 80 BPM, 71ms at 140).
      //
      // This is the TIME axis only. The separate, older error is BL-143: progress
      // maps to x linearly while VexFlow spaces noteheads by duration, so any bar
      // mixing note values already drifts in the SPACE axis. That is untouched
      // here, and a swung bar is neither better nor worse for it — the same
      // progress value produces the same x it always did.
      const phase = elapsed % session.patternDuration;
      const straightPhase = session.feel
        ? straightTime(phase / session.secsPerBeat, session.feel) * session.secsPerBeat
        : phase;
      const progress = straightPhase / session.patternDuration;
      const x = session.bounds.startX + progress * span;
      session.line.setAttribute('x1', x);
      session.line.setAttribute('x2', x);
      // On staves that overflow their container, keep the playhead in view —
      // unless the user owns the view (they scrolled): then follow stays off
      // until the playhead re-enters their window naturally. x is in viewBox
      // units — convert to CSS px including the container's left padding,
      // which scrollLeft coordinates run through.
      const box = session.container;
      if (box && box.scrollWidth > box.clientWidth + 1) {
        const vb = session.svg.viewBox && session.svg.viewBox.baseVal;
        const scale = (vb && vb.width) ? session.svg.clientWidth / vb.width : 1;
        const px = session.padLeft + x * scale;
        const margin = 36;
        const inView = px >= box.scrollLeft + margin && px <= box.scrollLeft + box.clientWidth - margin;
        if (session.userScrolled) {
          if (inView) session.userScrolled = false;
        } else if (!inView) {
          session._progScroll = true;
          box.scrollLeft = Math.max(0, px - margin);
        }
      }
      session.rafId = requestAnimationFrame(tick);
    };
    session.rafId = requestAnimationFrame(tick);
  };

  PlaybackSession.prototype.stop = function () {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this.container && this._onScroll) {
      this.container.removeEventListener('scroll', this._onScroll);
      this._onScroll = null;
    }

    // Click-free fade on master gain. After it lands at 0, anything still
    // scheduled in the future is effectively muted; we disconnect a tick
    // later to release nodes for GC.
    const now = this.c.currentTime;
    try {
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setValueAtTime(this.gain.gain.value, now);
      this.gain.gain.linearRampToValueAtTime(0, now + STOP_FADE_SECS);
    } catch (e) { /* ignore */ }
    setTimeout(() => {
      try { this.gain.disconnect(); } catch (e) {}
    }, Math.ceil(STOP_FADE_SECS * 1000) + 30);

    if (this.line) {
      this.line.classList.remove('is-active');
      this.line.setAttribute('x1', this.bounds.startX);
      this.line.setAttribute('x2', this.bounds.startX);
    }
    this.btn.classList.remove('is-playing');
    setBtnState(this.btn, 'idle');
    this.btn._session = null;
  };

  // ---- Click handler ----

  async function handlePlayClick(btn) {
    // Click-while-playing → stop.
    if (btn._session) { btn._session.stop(); return; }
    if (btn.classList.contains('is-loading')) return;

    let spec;
    try { spec = JSON.parse(btn.dataset.spec); }
    catch (err) { console.error('player: invalid spec JSON', err); return; }

    const c = getCtx();
    if (!c) return;
    const kitName = resolveKitNameFor(btn);

    // Acoustic kit needs decoded buffers before scheduling.
    if (kitName === 'acoustic') {
      btn.classList.add('is-loading');
      setBtnState(btn, 'loading');
      try { await ensureAcousticDecoded(c); } catch (e) { /* logged */ }
      btn.classList.remove('is-loading');
    }

    const kit = KITS[kitName] || KITS[DEFAULT_KIT];
    const exercise = btn.closest('.exercise');
    const svg = exercise && exercise.querySelector('.notation svg');
    const bounds = svg ? getMusicBounds(svg) : null;
    const line = (svg && bounds) ? ensurePlayhead(svg, bounds) : null;

    const session = new PlaybackSession(c, kit, spec, btn, svg, bounds, line, swingFeelFrom(btn));
    btn._session = session;
    btn.classList.add('is-playing');
    setBtnState(btn, 'playing');
    session.start();
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-exercise-play]');
    if (!btn) return;
    handlePlayClick(btn);
  });

  // ---- Kit selectors (per-exercise) ----

  function initKitSelectors() {
    const last = getKitName();
    document.querySelectorAll('[data-exercise-kit]').forEach(sel => {
      if (KITS[last]) sel.value = last;
      sel.addEventListener('change', () => {
        const name = sel.value;
        if (KITS[name]) setKitName(name);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKitSelectors);
  } else {
    initKitSelectors();
  }
})();
