// src/assets/js/metronome.js
// Persistent metronome: a bottom transport dock plus the header clock pill
// that is its collapsed state.
//
// Controls (all in the dock):
//   • Play/stop button
//   • BPM number input + tempo slider (synced)
//   • Time signature dropdown (numerator drives the accent pattern)
//   • Volume slider (scales the click gain)
//   • Beat-dot row that lights up the current beat in the bar
//
// The pill mirrors the live BPM, the time signature and the running beat, so
// collapsing the dock hides the controls but never the state — the metronome
// keeps ticking and stopping it is one tap away.
//
// Persisted in localStorage: bpm, time signature, volume, collapsed state.
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
  const icon        = btn.querySelector('.transport__icon');

  // The pill lives in the header, not in this aside — every lookup is guarded
  // so a page that ever ships the dock without it still works.
  const pill        = document.getElementById('metronome-pill');
  const pillDot     = pill ? pill.querySelector('.clock-pill__dot') : null;
  const pillBpm     = pill ? pill.querySelector('.clock-pill__bpm') : null;
  const pillSig     = pill ? pill.querySelector('.clock-pill__sig') : null;
  const pillState   = document.getElementById('metronome-pill-state');

  // The pill's lamp, tempo and time signature are all aria-hidden, so this one
  // span IS the button's accessible name. Rebuilt whenever the tempo changes or
  // a session starts or stops; the lamp's color alone would tell a screen-reader
  // user nothing about whether the click is currently running.
  let pillRunning = false;
  function syncPillLabel() {
    if (!pillState) return;
    pillState.textContent = 'Metronome, ' + bpm + ' beats per minute, ' + (pillRunning ? 'playing' : 'stopped');
  }

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
  if (pillBpm) pillBpm.textContent = String(initialBpm);

  // ---- State ----
  let bpm = initialBpm;
  let beatsPerBar = initialTs;
  let volume = initialVol / 100;     // 0..1
  syncPillLabel();                   // the stored tempo, not the markup's 80

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
      dot.className = 'transport__beat';
      beatsBox.appendChild(dot);
      beatDots.push(dot);
    }
  }
  renderBeats();

  function clearPulse(el) {
    if (!el) return;
    el.classList.remove('is-active');
    el.classList.remove('is-downbeat-active');
  }

  // The pill pulses alongside the dock's dots, so the beat stays visible while
  // the dock is collapsed. The dot at `index` may be gone if the user shrank
  // the time signature between scheduling and firing — the pill still fires.
  function flashBeat(index) {
    const downbeat = (index === 0);
    const dot = beatDots[index];
    [dot, pillDot].forEach(el => {
      if (!el) return;
      el.classList.add('is-active');
      if (downbeat) el.classList.add('is-downbeat-active');
    });
    setTimeout(() => {
      clearPulse(dot);
      clearPulse(pillDot);
    }, 90);
  }

  // Time signature readout on the pill: the option's own label, so the pill
  // always says what the select says (4/4, 6/8, …) rather than a second,
  // drifting mapping of numerator to denominator.
  function syncPillSig() {
    if (!pillSig) return;
    const opt = tsSelect.options[tsSelect.selectedIndex];
    pillSig.textContent = '· ' + (opt ? opt.textContent.trim() : beatsPerBar + '/4');
  }
  syncPillSig();

  // ---- Input wiring ----

  function setBpm(v, source) {
    bpm = clampBpm(v);
    if (source !== 'input')  bpmInput.value = bpm;
    if (source !== 'slider') slider.value   = bpm;
    if (pillBpm) pillBpm.textContent = String(bpm);
    syncPillLabel();
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
    syncPillSig();
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
    beatDots.forEach(clearPulse);
    clearPulse(pillDot);
  };

  // ---- Collapse / expand ----
  // Collapsed by default at every width: the pill is always in the header, so
  // the dock is one tap away and never occupies a page it was not asked for.
  // An explicit user choice is remembered in dc_metro_collapsed.

  const collapseBtn = document.getElementById('metronome-collapse');
  const COLLAPSED_KEY = 'dc_metro_collapsed';

  function applyCollapsed(collapsed) {
    root.classList.toggle('is-collapsed', collapsed);
    // The body's bottom reserve lives on <html>, so content always scrolls
    // clear of the dock instead of hiding under it.
    document.documentElement.classList.toggle('transport-open', !collapsed);
    if (pill) pill.setAttribute('aria-expanded', String(!collapsed));
    if (collapseBtn) collapseBtn.setAttribute('aria-expanded', String(!collapsed));
  }

  // Focus follows the disclosure: opening lands on the play button, closing
  // returns to the pill that now represents the dock.
  function setCollapsed(collapsed, focusEl) {
    applyCollapsed(collapsed);
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0'); } catch (e) {}
    if (focusEl) focusEl.focus();
  }

  let storedCollapsed = null;
  try { storedCollapsed = localStorage.getItem(COLLAPSED_KEY); } catch (e) {}
  applyCollapsed(storedCollapsed === null ? true : storedCollapsed === '1');

  // A real toggle, not a one-way expander. The pill carries aria-expanded, so
  // pressing it while the dock is already open has to close it — otherwise the
  // control lies about its own state and the press silently throws focus to the
  // far end of the document. Closing keeps focus on the pill; opening moves it
  // to the play button, which is where the next action is.
  if (pill) pill.addEventListener('click', () => {
    const collapsed = root.classList.contains('is-collapsed');
    setCollapsed(!collapsed, collapsed ? btn : pill);
  });
  if (collapseBtn) collapseBtn.addEventListener('click', () => setCollapsed(true, pill));
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') setCollapsed(true, pill);
  });

  // ---- Toggle ----

  let session = null;

  // Running state shows on both faces of the instrument: ■ on the go button —
  // which does stop the click, so the glyph is honest there — and on the pill,
  // whose lamp fills with a neutral ink so the brass offbeats and the brick
  // downbeat read as color changes against it. The pill's border goes brass too:
  // a 14px lamp is easy to miss from across the header (BL-074). No glyph is
  // written into the lamp; the pill's only glyph is the disclosure chevron, and
  // that one is CSS, driven by aria-expanded.
  function setPillRunning(running) {
    pillRunning = running;
    syncPillLabel();
    if (pill) pill.classList.toggle('is-running', running);
    if (!pillDot) return;
    pillDot.classList.toggle('is-running', running);
    if (!running) clearPulse(pillDot);
  }

  btn.addEventListener('click', () => {
    if (session) {
      session.stop();
      session = null;
      btn.classList.remove('is-playing');
      icon.textContent = '▶';
      btn.setAttribute('aria-label', 'Start metronome');
      setPillRunning(false);
      return;
    }
    const c = getCtx();
    if (!c) return;
    session = new MetroSession(c);
    session.start();
    btn.classList.add('is-playing');
    icon.textContent = '■';
    btn.setAttribute('aria-label', 'Stop metronome');
    setPillRunning(true);
  });
})();
