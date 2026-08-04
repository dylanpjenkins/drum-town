// src/_data/env.js
// Build-time environment values. Reads process.env first, then falls back to a
// local .env file (KEY=VALUE lines) so local builds keep analytics without any
// dotenv dependency. Missing values degrade gracefully: no token → no PostHog
// snippet is emitted at all (see base.njk).

const fs = require('fs');
const path = require('path');

function readDotEnv() {
  const p = path.join(__dirname, '..', '..', '.env');
  const out = {};
  try {
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (e) { /* no .env — fine */ }
  return out;
}

const dotenv = readDotEnv();
const get = k => process.env[k] || dotenv[k] || '';

module.exports = {
  posthogToken: get('POSTHOG_PROJECT_TOKEN'),
  posthogHost: get('POSTHOG_HOST') || 'https://us.i.posthog.com'
};
