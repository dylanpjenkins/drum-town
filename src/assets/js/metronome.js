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
//
// A page navigation destroys this document and its AudioContext with it, and no
// browser will let the next document's context make a sound without a user
// gesture ON that document — the tap that navigated belongs to the page that is
// already gone. So the click genuinely cannot follow the reader across a link,
// and code that tried would fail silently on exactly the machines that enforce
// the policy hardest. What follows them instead is the INTENT: dc_metro_running
// (sessionStorage) says a session was playing and the reader never stopped it,
// and the next page comes up ARMED — dock open, message beside the tempo, one
// press of the go button and the click is back at the same tempo and meter.
// BL-091.

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

  // The status line inside the beat field. Empty except while armed; empty is
  // zero-width, so a reader who never started the click sees the dock exactly
  // as it was.
  const statusBox = document.getElementById('metronome-status');
  const ARMED_MESSAGE = 'Paused. Press play.';

  // The pill's lamp, tempo and time signature are all aria-hidden, so this one
  // span IS the button's accessible name. Rebuilt whenever the tempo changes or
  // a session starts, stops or arms; the lamp's color alone would tell a
  // screen-reader user nothing about whether the click is currently running.
  // Three words, because there are three states: a paused click is not a
  // stopped one — the tempo is loaded and one press brings it back.
  let pillRunning = false;
  function syncPillLabel() {
    if (!pillState) return;
    const state = pillRunning ? 'playing' : (armed ? 'paused' : 'stopped');
    pillState.textContent = 'Metronome, ' + bpm + ' beats per minute, ' + state;
  }

  const BPM_KEY = 'dc_metro_bpm';
  const TS_KEY  = 'dc_metro_ts';
  const VOL_KEY = 'dc_metro_vol';
  // sessionStorage, NOT localStorage, and the difference is the whole behaviour.
  // The flag means "a click is running in this tab and the reader has not
  // stopped it", and that is sessionStorage's lifetime: it survives same-tab
  // navigations and dies with the tab. In localStorage the same flag would
  // outlive the visit, so a reader who closed the tab mid-click would meet a
  // dock forcing itself open on every visit afterwards, with no stop button to
  // clear it because nothing is playing. No timestamps, no expiry heuristics.
  //
  // One known and accepted leak: sessionStorage is CLONED into a tab opened
  // from this one, so ctrl-clicking a lesson while the click is running gives a
  // background tab that arms itself and says the click is paused while it is
  // still audible over here. Measured, not theoretical. The honest fix is a
  // cross-tab liveness channel (BroadcastChannel, or a heartbeat in
  // localStorage), which is a lot of machinery and a lot of new failure modes
  // for a state whose entire cost is one wrong word in a tab the reader has not
  // looked at yet — and the moment they do look at it, one press gives them the
  // click they wanted. Left as it is, deliberately.
  const RUNNING_KEY = 'dc_metro_running';
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
  let armed = false;                 // a click is paused by a navigation, not by the reader
  syncPillLabel();                   // the stored tempo, not the markup's 80

  function readRunningFlag() {
    try { return sessionStorage.getItem(RUNNING_KEY) === '1'; } catch (e) { return false; }
  }
  function writeRunningFlag(on) {
    try {
      if (on) sessionStorage.setItem(RUNNING_KEY, '1');
      else sessionStorage.removeItem(RUNNING_KEY);
    } catch (e) {}
  }

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
    syncGoLabel();                   // an armed button names the tempo it will resume at
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
    // Closing an ARMED dock is a dismissal, and it has to be the one the reader
    // is looking for: while armed nothing is playing, so there is no stop button
    // to press, and the resume flag would otherwise survive every navigation for
    // the rest of the tab. On a 217-lesson site that means forcing the dock open
    // again on every page the reader turns to — while their own collapse press
    // has just written dc_metro_collapsed: '1', durably flipping the preference
    // the one-load override exists to protect. `armed` is never true while a
    // session is running, so a reader who collapses a PLAYING dock still keeps
    // both the click and, on the next page, the resume.
    if (collapsed && armed) {
      writeRunningFlag(false);
      setArmed(false);
    }
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

  // The go button's name has to say what pressing it will do, and there are now
  // three answers. Armed also names the tempo: the reader's last instruction to
  // this control was "keep going", and they need to hear that it remembers 90
  // rather than the 80 the markup ships with. "Play" leads, because that is the
  // visible word standing beside the button while it is armed — the same
  // string-containment rule (WCAG 2.5.3) that gives the BPM box a name starting
  // "BPM, ", and the same comma, because screen readers announce an em dash.
  function syncGoLabel() {
    btn.setAttribute('aria-label',
      session ? 'Stop metronome'
              : armed ? 'Play, resume metronome at ' + bpm + ' BPM'
                      : 'Start metronome');
  }

  // Armed is a presentation state, not a stored one: the flag says a click is
  // outstanding, this says the dock is currently showing that fact. They part
  // company for exactly as long as a session is playing.
  function setArmed(on) {
    armed = on;
    root.classList.toggle('is-armed', on);
    if (statusBox) statusBox.textContent = on ? ARMED_MESSAGE : '';
    syncGoLabel();
    syncPillLabel();
  }

  function startSession() {
    const c = getCtx();
    if (!c) return;
    session = new MetroSession(c);
    session.start();
    btn.classList.add('is-playing');
    icon.textContent = '■';
    // Written at the START of the session, not at unload: pagehide is not
    // guaranteed to run, and a flag that only the stop button clears cannot be
    // missed by a tab that is torn down mid-click.
    writeRunningFlag(true);
    setArmed(false);       // relabels the button and the pill on its way through
    setPillRunning(true);
  }

  function stopSession() {
    session.stop();
    session = null;
    btn.classList.remove('is-playing');
    icon.textContent = '▶';
    // The one thing that clears the flag. A reader who has finished must not be
    // nagged on the next page — and this is the only press in the dock that
    // means "finished".
    writeRunningFlag(false);
    setArmed(false);       // relabels the button and the pill on its way through
    setPillRunning(false);
  }

  btn.addEventListener('click', () => {
    if (session) stopSession();
    else startSession();
  });

  // ---- Arm from the flag (BL-091) ----
  // Everything above is wired, so the dock can be put straight into the state
  // the last page left it in.
  function applyArmedFromFlag() {
    setArmed(readRunningFlag());
    // A reader whose click was still running has already asked for this dock;
    // leaving the resume behind a closed disclosure would be the hunt this item
    // exists to remove. The stored collapse preference is deliberately NOT
    // overwritten — this is a one-load override, so the moment the reader stops
    // the click, or closes the dock, it goes back to opening as they left it.
    if (armed && root.classList.contains('is-collapsed')) applyCollapsed(false);
  }
  applyArmedFromFlag();

  // ---- Back and forward ----
  // Every page on this site is bfcache-eligible: no unload handler, nothing
  // served no-store. A Back navigation therefore restores this document whole —
  // DOM, classes, closures, module state — and the script above never runs
  // again. Without this listener the restored dock wears whatever it wore when
  // the reader left it, and that is wrong in both directions: the page they
  // pressed play on comes back reading "Start metronome" with the flag still
  // set (BL-091's original bug, now intermittent), and a page they armed and
  // moved on from comes back still reading "Paused. Press play." after they
  // have stopped the click somewhere else. iOS Safari bfcaches nearly every
  // back navigation, and this component is used on a propped-up phone.
  //
  // event.persisted is the only reliable signal that this is a restore. A
  // document restored WITH a live session keeps its own state untouched: its
  // AudioContext is suspended on the way into the cache and resumed on the way
  // out, so it IS the running click, and the flag is re-asserted to say so.
  window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    if (session) { writeRunningFlag(true); return; }
    // Tempo, meter and volume can all have moved on a later page while this one
    // sat frozen, and an armed button that names a tempo has to name the one it
    // will actually play.
    setBpm(readInt(BPM_KEY, DEFAULT_BPM, MIN_BPM, MAX_BPM));
    const ts = readInt(TS_KEY, DEFAULT_TS, 2, 12);
    if (ts !== beatsPerBar) {
      beatsPerBar = ts;
      tsSelect.value = String(ts);
      renderBeats();
      syncPillSig();
    }
    const vol = readInt(VOL_KEY, DEFAULT_VOL, 0, 100);
    volSlider.value = vol;
    volume = vol / 100;
    applyArmedFromFlag();
  });
})();
