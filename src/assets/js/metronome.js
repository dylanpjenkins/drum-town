// src/assets/js/metronome.js
// Persistent floating metronome.
//
// Controls:
//   • Play/stop button
//   • BPM number input + tempo slider (synced)
//   • Time signature dropdown (numerator drives the accent pattern)
//   • Volume slider (scales the click gain)
//   • Beat-dot row that lights up the current beat in the bar
//
// Persisted in localStorage: bpm, time signature, volume.
// Each page navigation reloads the page, so the playing state resets.

(() => {
  const root = document.getElementById('site-metronome');
  if (!root) return;

  const btn         = document.getElementById('metronome-toggle');
  const bpmInput    = document.getElementById('metronome-bpm');
  const slider      = document.getElementById('metronome-slider');
  const tsSelect    = document.getElementById('metronome-timesig');
  const volSlider   = document.getElementById('metronome-volume');
  const beatsBox    = document.getElementById('metronome-beats');
  const icon        = btn.querySelector('.metronome__icon');

  const BPM_KEY = 'dc_metro_bpm';
  const TS_KEY  = 'dc_metro_ts';
  const VOL_KEY = 'dc_metro_vol';
  const DEFAULT_BPM = 80, MIN_BPM = 30, MAX_BPM = 240;
  const DEFAULT_TS = 4;
  const DEFAULT_VOL = 60;  // percent

  // ---- Persistence: restore saved values ----

  function readInt(key, fallback, min, max) {
    try {
      const v = parseInt(localStorage.getItem(key), 10);
      if (Number.isFinite(v) && v >= min && v <= max) return v;
    } catch (e) {}
    return fallback;
  }
  function writeInt(key, v) {
    try { localStorage.setItem(key, String(v)); } catch (e) {}
  }

  const initialBpm = readInt(BPM_KEY, DEFAULT_BPM, MIN_BPM, MAX_BPM);
  const initialTs  = readInt(TS_KEY,  DEFAULT_TS,  2, 12);
  const initialVol = readInt(VOL_KEY, DEFAULT_VOL, 0, 100);
  bpmInput.value  = initialBpm;
  slider.value    = initialBpm;
  tsSelect.value  = String(initialTs);
  volSlider.value = initialVol;

  // ---- State ----
  let bpm = initialBpm;
  let beatsPerBar = initialTs;
  let volume = initialVol / 100;     // 0..1

  function clampBpm(v) {
    if (!Number.isFinite(v)) return DEFAULT_BPM;
    return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(v)));
  }

  // ---- Beat-dot indicator ----
  // Regenerated whenever beatsPerBar changes. Each <span> represents one beat.

  let beatDots = [];
  function renderBeats() {
    beatsBox.innerHTML = '';
    beatDots = [];
    for (let i = 0; i < beatsPerBar; i++) {
      const dot = document.createElement('span');
      dot.className = 'metronome__beat';
      beatsBox.appendChild(dot);
      beatDots.push(dot);
    }
  }
  renderBeats();

  function flashBeat(index) {
    const dot = beatDots[index];
    if (!dot) return;
    const downbeat = (index === 0);
    dot.classList.add('is-active');
    if (downbeat) dot.classList.add('is-downbeat-active');
    setTimeout(() => {
      dot.classList.remove('is-active');
      dot.classList.remove('is-downbeat-active');
    }, 90);
  }

  // ---- Input wiring ----

  function setBpm(v, source) {
    bpm = clampBpm(v);
    if (source !== 'input')  bpmInput.value = bpm;
    if (source !== 'slider') slider.value   = bpm;
    writeInt(BPM_KEY, bpm);
    if (session) session.bpm = bpm;
  }
  bpmInput.addEventListener('change', () => setBpm(parseInt(bpmInput.value, 10), 'input'));
  slider.addEventListener('input',    () => setBpm(parseInt(slider.value, 10),   'slider'));

  tsSelect.addEventListener('change', () => {
    const v = parseInt(tsSelect.value, 10);
    if (!Number.isFinite(v) || v < 2) return;
    beatsPerBar = v;
    writeInt(TS_KEY, v);
    renderBeats();
    if (session) session.beatsPerBar = v;
  });

  volSlider.addEventListener('input', () => {
    const v = parseInt(volSlider.value, 10);
    volume = Math.max(0, Math.min(100, v)) / 100;
    writeInt(VOL_KEY, Math.round(volume * 100));
  });

  // ---- AudioContext ----

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

  // ---- Click voice ----
  // Volume read at scheduling time so live volume changes apply to upcoming clicks.

  function click(c, t, accent) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = accent ? 1500 : 1000;
    const peak = (accent ? 0.45 : 0.32) * volume;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.07);
  }

  // ---- Session ----

  const SCHEDULE_AHEAD = 0.5;
  const SCHEDULE_INTERVAL_MS = 200;

  function MetroSession(c) {
    this.c = c;
    this.bpm = bpm;
    this.beatsPerBar = beatsPerBar;
    this.beatIndex = 0;
    this.scheduledUntil = 0;
    this.timer = null;
    this.rafId = null;
    this.stopped = false;
    this.beatTimes = [];   // {t, indexInBar, fired}
  }

  MetroSession.prototype.start = function () {
    const lookahead = 0.06;
    this.scheduledUntil = this.c.currentTime + lookahead;
    this.scheduleAhead();
    this.timer = setInterval(() => this.scheduleAhead(), SCHEDULE_INTERVAL_MS);
    this.startVisualPulse();
  };

  MetroSession.prototype.scheduleAhead = function () {
    if (this.stopped) return;
    const horizon = this.c.currentTime + SCHEDULE_AHEAD;
    while (this.scheduledUntil < horizon) {
      const indexInBar = this.beatIndex % this.beatsPerBar;
      const accent = (indexInBar === 0);
      click(this.c, this.scheduledUntil, accent);
      this.beatTimes.push({ t: this.scheduledUntil, indexInBar: indexInBar, fired: false });
      this.scheduledUntil += 60 / this.bpm;
      this.beatIndex++;
    }
    const cutoff = this.c.currentTime - 1;
    this.beatTimes = this.beatTimes.filter(b => b.t > cutoff);
  };

  MetroSession.prototype.startVisualPulse = function () {
    const session = this;
    const tick = () => {
      if (session.stopped) { session.rafId = null; return; }
      const now = session.c.currentTime;
      session.beatTimes.forEach(b => {
        if (!b.fired && b.t <= now && now - b.t < 0.08) {
          b.fired = true;
          // indexInBar is captured at scheduling time, so it stays correct
          // even if beatsPerBar changes between scheduling and firing.
          // But the dot at that index might no longer exist if the user
          // shrank the time signature — guard against that.
          flashBeat(b.indexInBar);
        }
      });
      session.rafId = requestAnimationFrame(tick);
    };
    session.rafId = requestAnimationFrame(tick);
  };

  MetroSession.prototype.stop = function () {
    this.stopped = true;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    beatDots.forEach(d => {
      d.classList.remove('is-active');
      d.classList.remove('is-downbeat-active');
    });
  };

  // ---- Toggle ----

  let session = null;

  btn.addEventListener('click', () => {
    if (session) {
      session.stop();
      session = null;
      btn.classList.remove('is-playing');
      icon.textContent = '▶';
      btn.setAttribute('aria-label', 'Start metronome');
      return;
    }
    const c = getCtx();
    if (!c) return;
    session = new MetroSession(c);
    session.start();
    btn.classList.add('is-playing');
    icon.textContent = '■';
    btn.setAttribute('aria-label', 'Stop metronome');
  });
})();
