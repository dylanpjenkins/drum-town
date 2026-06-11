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
  const KEY_TO_DRUM = {
    'g/5/x2': 'hat',
    'c/5':    'snare',
    'f/4':    'kick',
    'd/4/x2': 'foot'
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
  // No dedicated foot sample yet — fall back to a quieter closed hat.
  function footAcoustic(c, t, out)    { playAcousticSample('hat',     c, t, out, 0.55); }

  preFetchAcoustic();

  // ---- Kit registry ----

  const KITS = {
    electronic: {
      kick: kickElectronic, snare: snareElectronic, hat: hatElectronic,
      openHat: openHatElectronic, foot: footElectronic
    },
    acoustic: {
      kick: kickAcoustic, snare: snareAcoustic, hat: hatAcoustic,
      openHat: openHatAcoustic, foot: footAcoustic
    }
  };

  function resolveKitNameFor(btn) {
    const exercise = btn.closest('.exercise');
    const sel = exercise && exercise.querySelector('[data-exercise-kit]');
    return (sel && sel.value) || getKitName();
  }

  // ---- Spec timing helpers ----

  function durationToSecs(d, bpm) {
    const denom = parseInt(d, 10);
    if (!denom) {
      const map = { w: 1, h: 2, q: 4, e: 8, s: 16 };
      return (4 / (map[d] || 4)) * (60 / bpm);
    }
    return (4 / denom) * (60 / bpm);
  }

  function barDurationSecs(spec) {
    const [num, den] = (spec.timeSignature || '4/4').split('/').map(Number);
    const bpm = spec.bpm || 80;
    return num * (4 / den) * (60 / bpm);
  }

  function scheduleVoice(notes, c, kit, out, startAt, bpm, tupletsForVoice) {
    const scale = new Array(notes.length).fill(1);
    (tupletsForVoice || []).forEach(t => {
      const factor = t.notes_occupied / t.num_notes;
      for (let i = t.start; i < t.start + t.length && i < notes.length; i++) {
        scale[i] = factor;
      }
    });
    let t = startAt;
    notes.forEach((note, i) => {
      const dur = durationToSecs(note.duration, bpm) * scale[i];
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

  function scheduleBar(spec, c, kit, out, startAt) {
    const bpm = spec.bpm || 80;
    const tuplets = spec.tuplets || [];
    const handsTuplets = tuplets.filter(t => t.voice === 'hands');
    const feetTuplets  = tuplets.filter(t => t.voice === 'feet');
    scheduleVoice(spec.hands || [], c, kit, out, startAt, bpm, handsTuplets);
    scheduleVoice(spec.feet  || [], c, kit, out, startAt, bpm, feetTuplets);
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
    this.bounds = bounds;
    this.line = line;
    this.barDuration = barDurationSecs(spec);
    this.gain = c.createGain();
    this.gain.gain.value = 1;
    this.gain.connect(c.destination);
    this.scheduledUntil = 0;
    this.timer = null;
    this.rafId = null;
    this.stopped = false;
    this.audioStart = 0;
  }

  PlaybackSession.prototype.start = function () {
    const lookahead = 0.06;
    this.audioStart = this.c.currentTime + lookahead;
    this.scheduledUntil = this.audioStart;
    this.scheduleAhead();
    this.timer = setInterval(() => this.scheduleAhead(), SCHEDULE_INTERVAL_MS);
    if (this.line && this.bounds) this.startPlayhead();
  };

  PlaybackSession.prototype.scheduleAhead = function () {
    if (this.stopped) return;
    const horizon = this.c.currentTime + SCHEDULE_AHEAD;
    while (this.scheduledUntil < horizon) {
      scheduleBar(this.spec, this.c, this.kit, this.gain, this.scheduledUntil);
      this.scheduledUntil += this.barDuration;
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
      const progress = (elapsed % session.barDuration) / session.barDuration;
      const x = session.bounds.startX + progress * span;
      session.line.setAttribute('x1', x);
      session.line.setAttribute('x2', x);
      session.rafId = requestAnimationFrame(tick);
    };
    session.rafId = requestAnimationFrame(tick);
  };

  PlaybackSession.prototype.stop = function () {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }

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
