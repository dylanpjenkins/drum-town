// src/assets/js/chrome.js
// Site chrome behavior: the mobile nav disclosure and the theme toggle.
// Both are progressive — with JS off the nav panel stays closed but every
// destination remains reachable from the footer, and the theme follows the
// system preference via CSS alone.

(() => {
  const root = document.documentElement;

  // ---- Mobile nav disclosure ----

  const navToggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('site-nav');

  // Natively focusable, i.e. nothing has to be done to it before .focus()
  // works. `tabindex` counts whatever its value, including "-1": an element
  // already carrying one is already programmatically focusable.
  const NATIVELY_FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]';
  function isFocusable(el) {
    return !!el && el.nodeType === 1 && el.matches(NATIVELY_FOCUSABLE);
  }

  // The panel renders below the header but the <nav> precedes the buttons in
  // the DOM, so opening it and pressing Tab would walk into the page behind
  // the panel. Opening therefore moves focus into the panel explicitly, and
  // closing always puts focus somewhere deliberate.
  function setNav(open, focusTarget) {
    root.classList.toggle('nav-open', open);
    if (navToggle) {
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
    }
    if (open) {
      const first = nav && nav.querySelector('a');
      if (first) first.focus();
    } else if (focusTarget) {
      // Only something that cannot already take focus needs the attribute, and
      // getting that test wrong cost the site its mobile navigation (BL-073).
      // The old test was `!hasAttribute('tabindex')`, which is true of every
      // <button> ever written — so Escape-closing the menu stamped
      // tabindex="-1" on #nav-toggle itself and REMOVED the only site-wide nav
      // below 720px from the tab order, on all 228 pages, until a reload.
      // Measured: 230 stops became 229 and Shift+Tab walked straight past the
      // hamburger. Section targets still need the attribute; buttons and links
      // never do.
      if (!isFocusable(focusTarget)) focusTarget.setAttribute('tabindex', '-1');
      focusTarget.focus();
    }
  }

  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      setNav(!root.classList.contains('nav-open'));
    });

    // Activating a link hides the panel — and with it the focused element.
    // Hand focus to the destination (same-page anchors) or back to the
    // toggle, never to <body>.
    nav.addEventListener('click', e => {
      const link = e.target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      const samePageHash = href.startsWith('#')
        || (href.startsWith('/#') && location.pathname === '/');
      const target = samePageHash ? document.querySelector(href.replace(/^\//, '')) : null;
      setNav(false, target || navToggle);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && root.classList.contains('nav-open')) {
        setNav(false, navToggle);
      }
    });

    // Crossing back into the nav-row layout must not strand an open panel bound
    // to a toggle the reader can no longer see. Asked of the hamburger itself
    // rather than of a width: the header's shedding ladder decides when the menu
    // exists, and it does not decide by viewport — it decides by the space the
    // row has, which a raised root font changes without the viewport moving.
    // The width this used to ask about (720px) was not even the width the nav
    // folded at (860px), so a panel opened at 800px stayed "open" all the way up.
    window.addEventListener('resize', () => {
      if (!root.classList.contains('nav-open')) return;
      if (getComputedStyle(navToggle).display === 'none') setNav(false);
    }, { passive: true });
  }

  // ---- Lesson-map disclosure (<=960px only) ----
  // Above 960px the curriculum sidebar is a sticky column and the toggle is
  // display:none — none of this runs and none of it is needed, which is why
  // the panel's visibility there is pure CSS. Below 960px the map used to
  // render its full length ABOVE the lesson, pushing the lesson's own h1 off
  // the first screen (BL-037); it is now a closed disclosure bar.
  //
  // The state is deliberately NOT persisted. A remembered-open map would put
  // the reader back where BL-037 started on the next lesson they open, and the
  // lesson has to own the first screen every time.
  const lessonMap = document.querySelector('.curriculum-sidebar');
  const mapToggle = lessonMap && lessonMap.querySelector('.curriculum-sidebar__toggle');

  if (lessonMap && mapToggle) {
    // Unlike the header nav, the panel FOLLOWS its toggle in the DOM and in
    // paint order, so Tab walks straight into it — moving focus on open would
    // only fight the reader. Closing leaves focus on the toggle, which is
    // where the click or the Enter key already put it.
    // The panel is the scroll container at this width (the aside is not), and
    // it opens 60vh tall onto a curriculum that can run to 60 lessons. Center
    // the current lesson the way the desktop column's inline script does —
    // otherwise opening the map shows lesson one, wherever the reader is.
    // Nothing to center until the panel is displayed, so this runs on open.
    const centerCurrent = () => {
      const panel = lessonMap.querySelector('.curriculum-sidebar__inner');
      const cur = panel && panel.querySelector('.curr-item.is-current');
      if (!panel || !cur || panel.scrollHeight <= panel.clientHeight) return;
      const pr = panel.getBoundingClientRect();
      const cr = cur.getBoundingClientRect();
      panel.scrollTop = Math.max(0, panel.scrollTop + (cr.top - pr.top) - (pr.height / 2 - cr.height / 2));
    };

    const setMap = open => {
      lessonMap.classList.toggle('is-open', open);
      mapToggle.setAttribute('aria-expanded', String(open));
      if (open) centerCurrent();
    };

    mapToggle.addEventListener('click', () => {
      setMap(!lessonMap.classList.contains('is-open'));
    });

    lessonMap.addEventListener('keydown', e => {
      if (e.key === 'Escape' && lessonMap.classList.contains('is-open')) {
        setMap(false);
        mapToggle.focus();
      }
    });

    // Crossing the breakpoint (including by zooming) must not leave the state
    // pinned to a toggle that is no longer rendered.
    let mapNarrow = window.matchMedia('(max-width: 960px)').matches;
    window.addEventListener('resize', () => {
      const narrow = window.matchMedia('(max-width: 960px)').matches;
      if (mapNarrow !== narrow && lessonMap.classList.contains('is-open')) {
        // Closing hides the panel; anyone focused inside it would land on
        // <body> and lose their place. Same contract as setNav above.
        const inside = lessonMap.contains(document.activeElement);
        setMap(false);
        if (inside && narrow) mapToggle.focus();
        else if (inside) lessonMap.querySelector('a, button')?.focus();
      }
      mapNarrow = narrow;
    }, { passive: true });
  }

  // ---- The header row's fit guard (BL-064) ----
  //
  // style.css sheds the header row by rule: an explicit priority order, driven
  // by @container so the thresholds grow with the root font instead of being
  // deaf to it. But those thresholds are constants, summed from the parts this
  // row has TODAY, and a constant cannot know about a control nobody has written
  // yet. That is the whole of BL-064: the last time an item was added to this
  // row — the 63px clock pill — it pushed a sideways scroll onto all 228 pages,
  // and the fix was one more breakpoint.
  //
  // So this measures. It walks the SAME order the stylesheet documents, one step
  // at a time, until the row fits, and it only ever adds to what CSS already
  // did: the classes come off before every measurement, so widening restores
  // whatever the container query is willing to give back, and nothing here can
  // put back a step CSS has taken.
  //
  // The nav fold is deliberately NOT one of these steps. It is a layout change
  // rather than the removal of a control, and it belongs to the container query
  // alone. Nothing is lost by leaving it out: in the nav-row layout the two
  // steps that ARE available free 157px at a 16px root (the meter 43.5px, the
  // wordmark 113.6px), which is three times over the 52px a new 44px control and
  // its gap would cost.
  const headerEl = document.querySelector('.site-header');
  const headerRow = document.querySelector('.site-header__inner');
  // In shedding order. Each pairs with a documented step in style.css.
  const SHED_STEPS = ['hdr-shed-sig', 'hdr-shed-wm', 'hdr-shed-theme'];

  const fitHeader = () => {
    if (!headerEl || !headerRow) return;
    SHED_STEPS.forEach(c => headerEl.classList.remove(c));
    for (const step of SHED_STEPS) {
      // Exactly the test tools/checks/check-header-shed.js fails on
      // (scrollWidth > clientWidth), and deliberately not a pixel looser. It
      // carried a +1 tolerance for one review cycle, which meant that at exactly
      // 1px over this function declared the row fitted while the gate declared it
      // broken — a guard that cannot satisfy its own gate, and no step left to
      // try. Unreachable in the row as it stands, but the next person to add a
      // control here is exactly who would have hit it.
      if (headerRow.scrollWidth <= headerRow.clientWidth) return;
      // The theme toggle may only leave the row while the menu that receives it
      // is itself reachable — that is the difference between shedding a control
      // and deleting one. If the hamburger is not rendered, this step is not
      // available, and the row keeps the toggle even at the cost of the overflow
      // the gates will then report.
      if (step === 'hdr-shed-theme' &&
          (!navToggle || getComputedStyle(navToggle).display === 'none')) return;
      headerEl.classList.add(step);
    }
  };

  // --header-h feeds the sticky sidebar offset and every anchor's
  // scroll-margin. The header grows when its row wraps (high zoom, long
  // labels), so measure it rather than trusting the 60px default. It is
  // measured after fitHeader, never before: shedding can change the height.
  if (headerEl) {
    let queued = false;
    const syncHeaderH = () => {
      queued = false;
      fitHeader();
      const h = Math.round(headerEl.getBoundingClientRect().height);
      if (h > 0) root.style.setProperty('--header-h', h + 'px');
    };
    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(syncHeaderH);
    };
    syncHeaderH();
    window.addEventListener('resize', schedule, { passive: true });

    // A window resize is only ONE of the two ways this row stops fitting, and
    // for a while it was the only one being watched. The other is the row's own
    // contents growing while the window holds still, and the site does that to
    // itself: the clock pill widens by a character when the tempo goes from two
    // digits to three, which is what happens every time a reader drags the
    // dock's tempo slider past 99. Measured on /lessons/paradiddle/ with one
    // extra control in the row: at a 394px viewport the page loads fitted and
    // unshed, the slider goes to 240, and the row sits 5px over with no step
    // taken, because nothing had resized. It stayed that way until the next
    // resize of any kind.
    // The same hole showed at load: this file is deferred BEFORE metronome.js,
    // so the first fit is computed against the static "80" in the markup, and a
    // returning visitor with a three-digit stored tempo only got a correct row
    // if fonts.ready happened to re-fit it.
    // A ResizeObserver on the row alone would not have caught either one — the
    // row is block-level and its own box never changes when a child grows inside
    // it. So the children are observed too. That also covers the case this whole
    // ladder is about: a control added to this row is observed by construction,
    // without anyone remembering to wire it up.
    if (window.ResizeObserver && headerRow) {
      const ro = new ResizeObserver(schedule);
      ro.observe(headerRow);
      for (const child of headerRow.children) ro.observe(child);
    }

    // Fonts land after first paint and every width in this row is a text
    // measurement, so the row has to be re-fitted when they do.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncHeaderH);
  }

  // ---- Theme toggle ----
  // Stored choice wins; no stored value means follow the system (the CSS
  // media query handles that case with no attribute set). The pre-paint
  // script in <head> has already applied any stored value before first paint.

  // Two controls, one setting, and never both on screen: the header toggle and
  // the menu row it sheds into (BL-064 step 4) are gated on the same container
  // query in both directions. They are wired together here rather than being one
  // element moved around, because moving a focused control between containers
  // mid-resize drops focus, and duplicating an id would break both.
  const THEME_KEY = 'dc_theme';
  const themeToggle = document.getElementById('theme-toggle');
  const navThemeToggle = document.getElementById('nav-theme-toggle');

  function storedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  function systemDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function activeTheme() {
    const attr = root.getAttribute('data-theme');
    if (attr === 'dark' || attr === 'light') return attr;
    return systemDark() ? 'dark' : 'light';
  }

  // Action label only — no aria-pressed. A button labeled "Switch to light
  // theme" that also reports "pressed" announces a contradiction ("do this"
  // + "already done"), and on a fresh system-dark visit it would claim a
  // pressed state the visitor never set.
  function syncToggleLabel() {
    const next = activeTheme() === 'dark' ? 'light' : 'dark';
    const label = 'Switch to ' + next + ' theme';
    if (themeToggle) themeToggle.setAttribute('aria-label', label);
    // The menu row carries the same words visibly, which is also its accessible
    // name — one string, so the two can never disagree.
    if (navThemeToggle) navThemeToggle.textContent = label;
  }

  // The UA honours the FIRST theme-color meta whose media matches, so a
  // freshly appended unmediated meta can never win. Point BOTH media-scoped
  // metas at the active theme instead — whichever one matches then reports
  // the right colour.
  function syncThemeColor() {
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    if (!metas.length) return;
    const colour = activeTheme() === 'dark' ? '#211a14' : '#f7f2e9';
    metas.forEach(m => m.setAttribute('content', colour));
  }

  syncToggleLabel();
  [themeToggle, navThemeToggle].forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = activeTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      syncToggleLabel();
      syncThemeColor();
    });
  });

  // Follow the system while the user has expressed no preference.
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (!storedTheme()) { syncToggleLabel(); syncThemeColor(); } };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
})();
