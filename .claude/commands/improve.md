---
description: Run one iteration of the Drum Town improvement loop (quality → ui → content)
---

Execute exactly ONE iteration of the site improvement loop. All state lives on disk (`tools/backlog.json`, `PROGRESS.md`, git). Read CLAUDE.md's FORBIDDEN list and Style ledger before editing anything. Work autonomously — never ask questions; park instead.

## Protocol

1. **Preflight.** `git status --porcelain`. If dirty (a prior tick crashed): `git stash push -u -m "improve-salvage"`, note it in PROGRESS.md. Tree must be clean before work.
2. **Build health.** `npm run build`. If it fails, this tick becomes a repair iteration: fix forward (max 2 attempts); if still broken, `git revert --no-edit` the newest commit touching the failing area; verify, commit `improve(loop): repair broken build`, push, and end the tick.
3. **Select.** Read `tools/backlog.json`. If `meta.iteration % 10 == 9` OR no item is `ready`: run the **Discovery pass** below instead. Otherwise pick the first `status=="ready"` item with `dimension == meta.next_dimension`, sorted by `(priority, id)`; if that dimension has none, advance the rotation (max 3 tries).
4. **Scope cap.** Re-read the item's `acceptance`. Limits per tick: ≤10 files / ~300 changed lines for code; ≤10 lessons of semantic prose edits (use the item's `chunk` counter). Mechanical fixed-word-list regex passes over `lessonContent.js` may be file-wide but require all gates plus spot-reading 3 affected slugs. If the item exceeds the cap, split it into a `chunk` plan and do chunk 1.
5. **Implement** the smallest change satisfying acceptance. Match existing code style. Consult the Style ledger.
6. **Verify — all gates for the dimension must pass:**
   - all: `npm run build` exit 0
   - quality: `node tools/audit-lessons.js` (BEAT-COUNT MISMATCHES identical-or-smaller vs `tools/audit-output.txt`) + `node tools/audit-site.js --gate` + any `tools/checks/*.js` named in acceptance
   - ui: `node tools/audit-site.js --gate` + `node tools/checks/dom-smoke.js`
   - content: audit-lessons diff clean + `node tools/audit-site.js --gate`

6b. **Visual verification — any tick whose change affects rendered output (all ui ticks; quality/content ticks that touch templates, CSS, renderer, or lesson HTML).** Start the dev server in the background (`npm start`, poll `http://localhost:8080/` until it responds — never a blind sleep). Screenshot each affected page with headless Edge at desktop (1280) and, for layout-affecting changes, mobile (390):
   `& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --timeout=15000 --window-size=<W>,<H> --screenshot=<scratchpad-path>.png http://localhost:8080/<page>/`
   Do NOT use `--virtual-time-budget` — the dev server's live-reload websocket never settles and it hangs. **Windows headless floor:** Edge/Chrome will not lay out below ~492px no matter what `--window-size` says — it renders at 492 and crops the PNG, so direct sub-500 "mobile" shots are lies. For any width under 500px use `tools/mobile-viewport-harness.html` (`?w=390&pages=/,/lessons/<slug>/` — iframes get a true narrow viewport). Then **Read every screenshot and judge it**: does the change look right, is anything clipped/overlapping/misaligned at either width? A screenshot you didn't look at is not verification. Broken → fix in-tick (this counts as the repair attempt) or park. Screenshots stay in the scratchpad; kill the dev server's port listener when done if you started it.

6c. **Adversarial critique — any tick that changes site output or content.** Spawn a read-only `general-purpose` subagent with a fresh context and a refute-first mandate: give it the diff (`git diff`), the item's acceptance, and any screenshots; instruct it to assume the change is flawed, attack factual claims in content, and return a structured verdict (BLOCKING / DEGRADED / QUESTIONABLE FACTS / PASSES). The critic never sees the author's reasoning — only the artifacts. BLOCKING findings must be fixed in-tick or the item parks; DEGRADED and QUESTIONABLE become new backlog items via `meta.next_id`. At each discovery pass, additionally run a full-sweep critic over everything shipped since the last one.
7. **Pass path.** Update the backlog item (`done`, or `chunk.done += 1`; append a `log` entry: iteration, date, what changed). Bump `meta.iteration`, rotate `meta.next_dimension`. If metrics legitimately improved: `node tools/audit-site.js --write-baseline`; if audit-lessons output legitimately changed: `node tools/audit-lessons.js > tools/audit-output.txt` (PowerShell writes BOM — prefer `node tools/audit-lessons.js | Out-File -Encoding utf8 tools/audit-output.txt` or run via bash). Prepend ONE line to PROGRESS.md's Iteration log with the metric delta. Add Needs-eyes / Needs-ear queue entries for visual/audio changes. Then ONE atomic commit of everything: `improve(<dim>): <summary> [BL-###]` (body: gates run, metric deltas) and `git push origin main`.
8. **Fail path.** One in-tick repair attempt. Still failing: `git restore .`, delete any untracked files the attempt created (individually — never `git clean`), set item `parked`, `attempts += 1`, record why in `log`, still bump iteration/rotation, commit bookkeeping only (`improve(loop): park BL-### after failed gates`), push. If `attempts >= 2` → `blocked-human` and list it in PROGRESS.md.
9. **End of tick — pacing hint for /loop:** more `ready` items remain → next wakeup ~300s (5 min). Backlog empty or everything parked → ~30 min. Two consecutive discovery passes produced zero new items → tell the loop to STOP and write a final summary at the top of PROGRESS.md.

## Discovery pass (replaces steps 4–8 when triggered)

Run `node tools/audit-site.js` and diff counts against the baseline; sweep for new issues (grep TODO/console.log; jsdom link scan over `_site`; re-check heading-order sample; anything Needs-eyes/Needs-ear follow-ups suggest). Review `parked` items — you may re-arm at most one to `ready` if there is genuinely new evidence (this grants a final attempt). Append new backlog items (priority: user-facing broken = 1, a11y/mobile = 2, polish/perf = 3) using `meta.next_id`. Paste a metrics snapshot into PROGRESS.md. Bump iteration, commit `improve(loop): discovery — +N items`, push.

## Hard rules

Everything in CLAUDE.md FORBIDDEN applies verbatim. Never run quarantined scripts; never read `tools/lesson-batches/` as truth; never touch `.env` or the PostHog token; never `npm install`/`npx`; never force-push; never leave a dirty tree; never hand-edit baselines.
