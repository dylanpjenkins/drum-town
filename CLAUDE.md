# Drum Town — agent guide

Eleventy 2 static site: `src/` → `_site/` (228 pages). 217 lessons live in **one file**, `src/_data/lessonContent.js` (~1.9 MB), keyed by slug. Curriculum skeleton: `src/_data/curriculum.js`. Rudiments: `src/_data/rudiments.js`. Notation is rendered **at build time** by `tools/notation-renderer.js` (VexFlow + jsdom) via the `notation`/`exercise` shortcodes in `.eleventy.js`. Layout: `src/_includes/base.njk`. One stylesheet: `src/assets/css/style.css`. Client JS: `src/assets/js/{player,metronome,progress}.js` (plain IIFEs, no build step).

## Commands (cwd = repo root)

```
npm run build                 # production-ish build → _site/  (dev pages excluded)
npm start                     # dev server localhost:8080 (+ /dev/review/ dashboard)
node tools/audit-lessons.js   # legacy content audit (baseline: tools/audit-output.txt)
node tools/audit-site.js      # metrics report; --json | --gate | --source-only
node tools/audit-site.js --write-baseline   # regenerate tools/audit-site-baseline.json (the ONLY way)
node tools/checks/<x>.js      # per-item assertion scripts, exit 0/1
```

Windows: `npm run clean` is `rm -rf` and fails in PowerShell — use `Remove-Item -Recurse -Force _site` until BL-005 fixes it. Prefer `node -e` for data introspection. PowerShell 5.1 mangles embedded double quotes when passing arguments to native exes: keep `"` out of `git commit -m` here-strings (or use `git commit -F <file>`).

## Source-of-truth rules

- `src/_data/lessonContent.js` is THE content. Edit lessons there and only there.
- `tools/lesson-batches/` is a **stale, divergent** copy of lesson content (gitignored, local-only). NEVER read it as truth, NEVER merge from it. Forensic comparison is allowed only inside a blocked-human investigation.
- `tools/quarantine/` holds disabled scripts. NEVER run anything in it.
- `tools/audit-output.txt` and `tools/audit-site-baseline.json` are committed baselines. Regenerate only via the exact documented commands, in the same commit as the improvement that changed them. NEVER hand-edit.

## Validation gates (every change)

1. `npm run build` exits 0.
2. `node tools/audit-lessons.js` — the BEAT-COUNT MISMATCHES section must be identical-or-smaller vs `tools/audit-output.txt`.
3. `node tools/audit-site.js --gate` exits 0 (no metric regresses vs baseline; `integrity.*` keys must not change at all).
4. Item-specific `tools/checks/*.js` named in the backlog item's acceptance.

## FORBIDDEN — hard rules for the improvement loop

- NEVER run `tools/quarantine/*` or anything matching `merge-lesson-batches` / `patch-lessons`; NEVER treat `tools/lesson-batches/` as content truth.
- NEVER semantically rewrite more than 10 lessons of `lessonContent.js` in one iteration. Mechanical fixed-word-list regex passes may be file-wide but require all gates plus spot-reading 3 affected slugs afterward.
- NEVER print, rotate, move, or edit the PostHog token value; NEVER touch `.env`. Token rotation is Dylan's task (flagged in PROGRESS.md).
- NEVER `git push --force`; NEVER deploy or publish anywhere.
- NEVER `npm install` or add dependencies; NEVER use `npx`.
- NEVER edit `.claude/settings.json`; NEVER edit CLAUDE.md guardrail sections (appending to the Style ledger below is allowed).
- NEVER `git clean`; NEVER end an iteration with a dirty tree — exactly one atomic commit per completed item, or full restore + parked bookkeeping.
- NEVER implement IDEAS.md features unprompted. ISSUES.md item 1 (photos) is blocked-human.

## Style ledger (append-only; consult before content/UI edits)

- Content prose, exercises, listening, focus vocabulary: **`docs/content-style-guide.md` is the binding reference** for every lessonContent.js edit.
- Spelling: **American** (practice, color, center, internalize).
- Duration metadata format: `NN–NN min` (en dash) or `NN min`.
- Heading hierarchy: h1 = page title; h2 = page sections (incl. bodyHtml subheads); h3 = exercise titles and sub-subsections.
- CSS: font sizes in `rem`; colors via `:root` tokens, no new raw hex/rgba outside the token block.
- Commit format: `improve(quality|ui|content|loop): <imperative summary> [BL-###]` — body lists gates run + metric deltas.
- Em-dash density: at most one per paragraph in new/rewritten prose.

## Loop pointers

- PUSH_POLICY: push-main
- Backlog (machine state): `tools/backlog.json` · Protocol: `.claude/commands/improve.md` · Human log: `PROGRESS.md`
- Design checkpoints: `.claude/commands/design-checkpoint.md` → `design-sync/` previews → claude.ai/design project "Drum Town UI"; owner feedback lands in `design-sync/FEEDBACK.md`.
