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
      if (!focusTarget.hasAttribute('tabindex')) focusTarget.setAttribute('tabindex', '-1');
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

    // Crossing the breakpoint (including by zooming) must not strand an open
    // panel bound to a now-hidden toggle.
    let wasNarrow = window.matchMedia('(max-width: 720px)').matches;
    window.addEventListener('resize', () => {
      const narrow = window.matchMedia('(max-width: 720px)').matches;
      if (wasNarrow && !narrow && root.classList.contains('nav-open')) setNav(false);
      wasNarrow = narrow;
    }, { passive: true });
  }

  // --header-h feeds the sticky sidebar offset and every anchor's
  // scroll-margin. The header grows when its row wraps (high zoom, long
  // labels), so measure it rather than trusting the 60px default.
  const headerEl = document.querySelector('.site-header');
  if (headerEl) {
    let queued = false;
    const syncHeaderH = () => {
      queued = false;
      const h = Math.round(headerEl.getBoundingClientRect().height);
      if (h > 0) root.style.setProperty('--header-h', h + 'px');
    };
    syncHeaderH();
    window.addEventListener('resize', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(syncHeaderH);
    }, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncHeaderH);
  }

  // ---- Theme toggle ----
  // Stored choice wins; no stored value means follow the system (the CSS
  // media query handles that case with no attribute set). The pre-paint
  // script in <head> has already applied any stored value before first paint.

  const THEME_KEY = 'dc_theme';
  const themeToggle = document.getElementById('theme-toggle');

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
    if (!themeToggle) return;
    const next = activeTheme() === 'dark' ? 'light' : 'dark';
    themeToggle.setAttribute('aria-label', 'Switch to ' + next + ' theme');
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

  if (themeToggle) {
    syncToggleLabel();
    themeToggle.addEventListener('click', () => {
      const next = activeTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      syncToggleLabel();
      syncThemeColor();
    });
  }

  // Follow the system while the user has expressed no preference.
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (!storedTheme()) { syncToggleLabel(); syncThemeColor(); } };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
})();
