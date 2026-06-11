// tools/review-middleware.js
//
// =====================================================================
// DEV TOOLING — internal review dashboard
//
// To remove the review dashboard entirely, delete:
//   - this file
//   - tools/review-status.json (if it exists)
//   - src/dev/
//   - the setBrowserSyncConfig block in .eleventy.js that requires this file
//   - the "tools/review-status.json" line in .gitignore
// =====================================================================
//
// Eleventy/BrowserSync middleware that backs the /dev/review/ dashboard.
// Reads and writes tools/review-status.json so approval state persists
// across browsers/machines (the file is gitignored — see .gitignore).
//
// Mounted by .eleventy.js, so it runs inside the same `eleventy --serve`
// process on the same port as the site itself. No separate server needed.
//
// Endpoints:
//   GET  /dev/review/status   → { slug: true, ... }
//   POST /dev/review/status   → body is the full state JSON; overwrites
//                                the file. Responds with { ok, count }.

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'review-status.json');
const ROUTE = '/dev/review/status';

function readState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => {
      buf += c;
      if (buf.length > 1_000_000) reject(new Error('body too large'));
    });
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
}

function reviewMiddleware(req, res, next) {
  // BrowserSync gives us the full URL including any query string.
  const url = (req.url || '').split('?')[0];
  if (url !== ROUTE) return next();

  if (req.method === 'GET') {
    try {
      const state = readState();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.statusCode = 200;
      res.end(JSON.stringify(state));
    } catch (e) {
      res.statusCode = 500;
      res.end('read error: ' + e.message);
    }
    return;
  }

  if (req.method === 'POST') {
    readBody(req).then((body) => {
      let incoming;
      try {
        incoming = JSON.parse(body || '{}');
      } catch (e) {
        res.statusCode = 400;
        res.end('invalid JSON');
        return;
      }
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        res.statusCode = 400;
        res.end('expected JSON object');
        return;
      }
      const clean = {};
      for (const slug of Object.keys(incoming)) {
        if (incoming[slug]) clean[slug] = true;
      }
      try {
        writeState(clean);
      } catch (e) {
        res.statusCode = 500;
        res.end('write error: ' + e.message);
        return;
      }
      const count = Object.keys(clean).length;
      console.log(`[review] saved ${count} approved lesson${count === 1 ? '' : 's'}`);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true, count }));
    }).catch((e) => {
      res.statusCode = 400;
      res.end('bad request: ' + e.message);
    });
    return;
  }

  res.statusCode = 405;
  res.setHeader('Allow', 'GET, POST');
  res.end('method not allowed');
}

module.exports = { reviewMiddleware, ROUTE };
