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
    // Rebuilding the row throws away whatever dot was mid-pulse, and the pill is
    // not rebuilt with it, so a change landing inside a flash left the lamp lit
    // above an empty row. Measured by sweeping a real exercise tempo handoff
    // across a downbeat flash: 10ms to 75ms of the pill showing a downbeat over
    // four dark dots, worst at a press 5ms after the beat. Both faces of the
    // instrument go dark together instead; the next beat lights them both.
    //
    // This does NOT stop the row being wiped mid-pulse, which is a separate and
    // still-open defect: renderBeats runs on every setMeter, including the 817
    // handoff buttons that name the meter the dock is already in.
    clearPulse(pillDot);
  }
  renderBeats();

  function clearPulse(el) {
    if (!el) return;
    el.classList.remove('is-active');
    el.classList.remove('is-downbeat-active');
  }

  // The pill pulses alongside the dock's dots, so the beat stays visible while
  // the dock is collapsed. They have to pulse TOGETHER: one lamp lighting over a
  // dark row is the dock disagreeing with itself in the reader's peripheral
  // vision, which is the one thing the beat row exists to be trusted about.
  //
  // `index` is captured at scheduling time and can outlive its own dot. Up to
  // SCHEDULE_AHEAD of clicks are already committed when the meter changes, so a
  // shrink from 7/8 to 2/4 leaves beats indexed 5 and 6 to fire into a two-dot
  // row. Those clicks are real and audible, so the answer is not to drop them:
  // they are the tail of the outgoing bar, immediately before the new downbeat,
  // and the last dot is where that reads.
  //
  // Clamping cannot invent a downbeat, and the reason is not that index 0 is
  // always in range. Math.min(index, len - 1) returns 0 for index 0, but it also
  // returns 0 for ANY index when len is 1, which would light a lone dot and call
  // it a downbeat. What rules that out is that no row is ever one dot wide:
  // setMeter refuses v < 2, readInt bounds the stored signature to 2..12, and
  // every <option> the dock ships is 2 or more. If a 1/4 option is ever added,
  // this clamp needs revisiting before that option does.
  function flashBeat(index) {
    const downbeat = (index === 0);
    const dot = beatDots.length ? beatDots[Math.min(index, beatDots.length - 1)] : null;
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

  // One path for a meter change whoever asks for it: the select itself, or an
  // exercise handing over its own signature (BL-076). The option lookup guards
  // THIS function's two callers and nothing else — a numerator with no option
  // behind it would leave the control blank and syncPillSig would fall back to
  // numerator + '/4', inventing a denominator the dock cannot play. It is not a
  // global guard on beatsPerBar: the initial readInt(TS_KEY, …, 2, 12) above and
  // the bfcache pageshow restore below both still assign tsSelect.value
  // directly, so a stored 8 through 12 would reach the select unchecked. Nothing
  // writes those values today (this function is the only writer of TS_KEY, and
  // it validates), which is why the bounds are left alone here rather than
  // widened into a second source of truth.
  function setMeter(v) {
    if (!Number.isFinite(v) || v < 2) return;
    if (!tsSelect.querySelector('option[value="' + v + '"]')) return;
    beatsPerBar = v;
    tsSelect.value = String(v);
    writeInt(TS_KEY, v);
    renderBeats();
    syncPillSig();
    if (session) {
      // The PHASE, not just the bar length. beatIndex counts clicks since the
      // session began and scheduleAhead accents beatIndex % beatsPerBar, so
      // carrying the old count into a new meter puts the next accent wherever
      // that counter happens to land: 4 to 6 with beatIndex at 7 gives 7 % 6 = 1
      // and the downbeat is five clicks away. Measured before this line existed:
      // a 2/4 to 7/8 change waited six clicks for its first "1", and a 5/4 to
      // 3/4 change at 30 BPM waited four seconds. Zeroing the count puts the
      // next NEWLY scheduled click on 1, which is what someone who just changed
      // the meter asked to hear.
      //
      // Clicks already handed to the audio clock keep the accent they were
      // given. They are correct for the bar they were scheduled in, and
      // unscheduling them would mean holding a reference to every oscillator.
      // The cost is that the outgoing pattern stays in flight until the last
      // committed click sounds, bounded by SCHEDULE_AHEAD at 500ms and measured
      // as high as 424ms. Three of the check's 13 changes leave an ACCENTED
      // click in that window, so the reader can hear the old "1" and the new one
      // inside a beat of each other. Filed, not fixed here.
      //
      // Only on a real change. adoptTempo calls setMeter on every press of every
      // exercise tempo button, and 817 of the 832 name 4/4, the meter the dock
      // is usually already in, so an unconditional reset would restart the bar
      // under a reader who pressed "Metronome 90" beneath a 4/4 exercise.
      if (v !== session.beatsPerBar) session.beatIndex = 0;
      session.beatsPerBar = v;
    }
  }
  tsSelect.addEventListener('change', () => setMeter(parseInt(tsSelect.value, 10)));

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
          // even if beatsPerBar changes between scheduling and firing. It can
          // therefore point past the end of a row the reader has since shrunk;
          // flashBeat owns that case and keeps the index inside the row.
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
    // preventScroll, and it is load-bearing rather than defensive. Both targets
    // this function is ever handed are permanently on screen — the pill lives in
    // a sticky header pinned to the top, the go button in a fixed dock pinned to
    // the bottom — so scrolling either into view can only ever move the page for
    // no reason. It did: a stylesheet rule gave every element with an id a 74px
    // scroll-margin-top meant for in-page anchors, the pill has an id, and this
    // one call therefore scrolled the reader 65px up the page every time they
    // closed the dock with the chevron (BL-076). The rule is fixed at the
    // source; this stops the same class of bug reaching the reader again, and
    // costs nothing where no scroll was wanted in the first place.
    //
    // Only the chevron path ever showed the bug, because focus() on an element
    // that ALREADY has focus is a no-op: pressing the pill focuses the pill
    // first, so its own focus() call did nothing, while pressing the chevron
    // left focus on a button that display:none then swallowed.
    if (focusEl) focusEl.focus({ preventScroll: true });
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

  // ---- Tempo handoff from an exercise (BL-076) ----
  // The homepage promises that the whole town practices to the same clock, and
  // the dock was the one thing on the page that never heard the exercise it sat
  // under: the pill read 80 while the notation above it said ♩ = 70.
  //
  // It is a HANDOFF, never an adoption. Nothing here runs on scroll, on load or
  // on any event the reader did not aim: someone who deliberately set 60 to
  // practice a fill slowly must not lose it because they scrolled past an
  // exercise marked 120. The tempo moves when, and only when, a reader presses a
  // button that names the tempo it is about to apply.
  //
  // The button also does not start anything. Setting the click and starting it
  // are two different intents, the dock's go button already owns the second one,
  // and one control quietly doing both is the mistake BL-074 was filed for.
  // A button only exists where the dock can be made to agree with the notation
  // exactly, so both attributes are always present and both are always applied —
  // the shortcode decides, nothing is guessed here. See .eleventy.js for the 60
  // exercises that get no button (tempo outside 30-240, or a meter whose beat is
  // not a quarter note).
  function adoptTempo(el) {
    const b     = parseInt(el.getAttribute('data-bpm'), 10);
    const beats = parseInt(el.getAttribute('data-beats'), 10);
    if (Number.isFinite(b)) setBpm(b);
    if (Number.isFinite(beats)) setMeter(beats);
    // Opening the dock is the only way to SHOW what just changed, and it follows
    // the rule the pill already set: an open that really opens lands focus on the
    // play button, because that is the next thing anyone presses. A second press
    // while the dock is already open leaves focus alone — the reader is reading an
    // exercise, not operating the dock, and yanking them to the bottom of the
    // document to re-read a number they can already see is not help.
    //
    // applyCollapsed, NOT setCollapsed, and that is the whole point of the line:
    // setCollapsed persists dc_metro_collapsed, so one tap on a tempo button
    // would durably flip a reader who keeps the dock CLOSED into having it open
    // on all 217 lessons afterwards. They asked for a tempo, not a permanent
    // layout preference. This is the same one-load override applyArmedFromFlag
    // already takes, for the same reason, and it leaves the pill and the chevron
    // to publish the new state via applyCollapsed's aria sync.
    if (root.classList.contains('is-collapsed')) {
      applyCollapsed(false);
      btn.focus({ preventScroll: true });
    }
  }
  // Bound directly rather than delegated: every exercise on this page was
  // rendered at build time, and this script is deferred, so they all exist.
  document.querySelectorAll('[data-exercise-metronome]').forEach(el => {
    el.addEventListener('click', () => adoptTempo(el));
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
