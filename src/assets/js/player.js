// src/assets/js/player.js
// Tiny client-side drum player. Reads exercise specs from data-spec
// attributes on .play-btn buttons and schedules drum hits via Web Audio.
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

  function scheduleVoice(notes, c, kit, out, startAt, bpm, spec, voiceName) {
    const scale = PatternMath.tupletScales(spec, voiceName, notes.length);
    let t = startAt;
    notes.forEach((note, i) => {
      const ticks = PatternMath.durationTicks(note);
      const dur = (ticks === null ? 1 : ticks) * scale[i] * (60 / bpm);
      if (!note.rest) {
        for (const key of (note.keys || [])) {
          let drum = KEY_TO_DRUM[key];
          if (!drum) continue;
          // Articulation modifiers — currently just `open` to swap the
          // closed-hat voice for the open-hat voice.
          if (drum === 'hat' && note.articulation === 'open') drum = 'openHat';
          if (kit[drum]) kit[drum](c, t, out);
        }
      }
      t += dur;
    });
    return t;
  }

  function schedulePattern(spec, c, kit, out, startAt) {
    const bpm = spec.bpm || 80;
    scheduleVoice(spec.hands || [], c, kit, out, startAt, bpm, spec, 'hands');
    scheduleVoice(spec.feet  || [], c, kit, out, startAt, bpm, spec, 'feet');
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

  function PlaybackSession(c, kit, spec, btn, svg, bounds, line) {
    this.c = c;
    this.kit = kit;
    this.spec = spec;
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
      schedulePattern(this.spec, this.c, this.kit, this.gain, this.scheduledUntil);
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
      const progress = (elapsed % session.patternDuration) / session.patternDuration;
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

    const session = new PlaybackSession(c, kit, spec, btn, svg, bounds, line);
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
