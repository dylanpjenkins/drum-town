// src/assets/js/progress.js
// Tiny localStorage wrapper for per-browser lesson progress.
// Stores only the slug of the most-recently-opened lesson. The homepage
// reads this and computes "Up Next" from the embedded lessons-data manifest.

(() => {
  const KEY = 'dc_progress';
  const VERSION = 1;

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { v: VERSION };
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== VERSION) return { v: VERSION };
      return parsed;
    } catch (e) {
      return { v: VERSION };
    }
  }

  function write(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      // localStorage disabled / quota — degrade silently.
    }
  }

  window.DCProgress = {
    getLastVisited() {
      return read().lastVisited || null;
    },
    getVisited() {
      const v = read().visited;
      return Array.isArray(v) ? v.slice() : [];
    },
    setLastVisited(slug) {
      if (!slug || typeof slug !== 'string') return;
      const s = read();
      s.v = VERSION;
      s.lastVisited = slug;
      const visited = Array.isArray(s.visited) ? s.visited : [];
      if (visited.indexOf(slug) === -1) visited.push(slug);
      s.visited = visited;
      write(s);
    },
    clear() {
      try { localStorage.removeItem(KEY); } catch (e) {}
    }
  };
})();
