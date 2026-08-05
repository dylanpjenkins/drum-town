---
description: Run one iteration of the Drum Town improvement loop (designer → builder → reviewer → personas)
---

Execute exactly ONE iteration of the site improvement loop. All state lives on disk (`tools/backlog.json`, `PROGRESS.md`, `design/`, git). Read CLAUDE.md's FORBIDDEN list and Style ledger before editing anything. Work autonomously — never ask questions; park instead. **Every push to main deploys to drum.town** (Netlify git integration) — the gates below are the only thing between an edit and production.

## Roles (per the agent-loop doc: subagents keep the orchestrator lean — only their final reports enter this context)

- **Orchestrator** (you, the main loop): selects work, runs gates, owns git. Never designs and builds and judges the same change alone.
- **Designer** (fresh-context subagent, effort high): runs at epic phase boundaries, not per tick. Consumes `design/brief.md` + current screenshots; produces direction boards, then the design system spec (`design/system.md` + tokens) and per-page work packages appended to the backlog.
- **Builder** (fresh-context subagent, effort inherit): per tick, implements ONE work package from the spec. Receives the package, the relevant spec sections, and file pointers — not the whole history.
- **Reviewer** (fresh-context subagent, effort high): per output-changing tick, refute-first mandate; gets the diff + screenshots + the spec section the package claims to implement; judges correctness AND design fidelity. Verdicts: BLOCKING / DEGRADED / QUESTIONABLE / PASSES. BLOCKING stops the commit.
- **Persona panel** (3 subagents, effort medium): at milestones (each epic phase end, and every discovery pass). Personas: (1) first-day beginner on a phone, (2) returning intermediate player, (3) keyboard + screen-reader user. Each walks assigned journeys via screenshots + built DOM and files friction reports. Their findings become backlog items; during direction selection they vote.

## Protocol

1. **Preflight.** `git status --porcelain`. If dirty (a prior tick crashed): `git stash push -u -m "improve-salvage"`, note it in PROGRESS.md. Tree must be clean before work.
2. **Build health.** `npm run build`. If it fails, this tick becomes a repair iteration: fix forward (max 2 attempts); if still broken, `git revert --no-edit` the newest commit touching the failing area; verify, commit `improve(loop): repair broken build`, push, and end the tick.
3. **Select.** Read `tools/backlog.json`. Epic phase gates first: if `meta.epic.phase` names a pending designer step (e.g. `directions` with no boards yet, or `spec` after a direction won), run the **Designer step** below. Else if `meta.iteration % 10 == 9` OR no item is `ready`: run the **Discovery pass**. Otherwise pick the first `status=="ready"` item with `dimension == meta.next_dimension`, sorted by `(priority, id)`; if that dimension has none, advance the rotation (max 3 tries). Epic work packages are `ui` items and take normal turns in the rotation.
4. **Scope cap.** ≤10 files / ~300 changed lines per tick; ≤10 lessons of semantic prose edits (use `chunk`). Mechanical fixed-word-list passes may be file-wide with gates + 3-slug spot reads. Too big → split into chunks, do chunk 1.
5. **Implement.** For epic work packages: spawn the **Builder** with the package + spec sections and apply its patch (or implement directly if the package is trivial — one file, cosmetic). For non-epic items the orchestrator may implement directly. Match existing code style; consult the Style ledger.
6. **Verify — all gates must pass:**
   - all: `npm run build` exit 0
   - quality: `node tools/audit-lessons.js` (BEAT-COUNT MISMATCHES identical-or-smaller vs `tools/audit-output.txt`) + `node tools/audit-site.js --gate` + any `tools/checks/*.js` named in acceptance
   - ui: `node tools/audit-site.js --gate` + `node tools/checks/dom-smoke.js`
   - content: audit-lessons diff clean + `node tools/audit-site.js --gate`

6b. **Visual verification — any tick whose change affects rendered output.** Start the dev server in the background (`npm start`, poll `http://localhost:8080/` until it responds — never a blind sleep). Screenshot each affected page with headless Edge at desktop (1280) and, for layout-affecting changes, mobile:
   `& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --timeout=15000 --window-size=<W>,<H> --screenshot=<scratchpad-path>.png http://localhost:8080/<page>/`
   Do NOT use `--virtual-time-budget` (live-reload websocket hangs it). **Windows headless floor:** Edge will not lay out below ~492px — for any width under 500px use `tools/mobile-viewport-harness.html` (`?w=390&pages=/,/lessons/<slug>/`). Then **Read every screenshot and judge it**. A screenshot you didn't look at is not verification. Broken → fix in-tick (counts as the repair attempt) or park. Kill the dev server port listener when done if you started it.

6c. **Adversarial review — any tick that changes site output or content.** Spawn the **Reviewer** (read-only `general-purpose` subagent, fresh context): give it the diff, the item's acceptance, the spec section (for epic packages), and the screenshots; instruct it to assume the change is flawed, attack factual claims, and return BLOCKING / DEGRADED / QUESTIONABLE / PASSES. BLOCKING → fix in-tick or park. DEGRADED/QUESTIONABLE → new backlog items via `meta.next_id`.

7. **Pass path.** Update the backlog item (`done` or `chunk.done += 1`; `log` entry: iteration, date, what changed). Bump `meta.iteration`, rotate `meta.next_dimension`. Metrics improved → `node tools/audit-site.js --write-baseline`; audit-lessons output changed → regenerate via `node tools/audit-lessons.js | Out-File -Encoding utf8 tools/audit-output.txt`. Prepend ONE PROGRESS.md line with the metric/visual delta. ONE atomic commit: `improve(<dim>): <summary> [BL-###]` (body: gates run, reviewer verdict, deltas), `git push origin main` — **this deploys**.
8. **Fail path.** One in-tick repair attempt. Still failing: `git restore .`, delete untracked strays individually (never `git clean`), mark `parked`, `attempts += 1`, log why, bump iteration/rotation, commit bookkeeping, push. `attempts >= 2` → `blocked-human` + PROGRESS listing.
9. **Pacing hint for /loop:** ready items remain → ~300s. Backlog empty/parked → ~30 min. Two consecutive empty discoveries → STOP the loop and write a final PROGRESS summary.

## Designer step (replaces 4–8 when an epic phase needs it)

- Phase `directions`: spawn the Designer with `design/brief.md`, current-site screenshots, and the confirmed-real UX findings. It writes 2–3 self-contained direction boards to `design/directions/<a|b|c>/board.html` (each: homepage hero, lesson-page fragment, nav treatment, tokens) + `rationale.md`. Screenshot every board (1280 + true-390 via the harness), Read them, then convene the **Reviewer + Persona panel** to score against the brief. Winner recorded in `design/DECISION.md` (with the runner-up graft list); phase → `spec`. Commit boards + decision (Dylan can glance at `design/` or PROGRESS to veto — note that in PROGRESS).
- Phase `spec`: spawn the Designer to expand the winning direction into `design/system.md` (tokens, type scale, components, per-page specs) and to append ordered work packages to the backlog (each ≤ one tick of scope, acceptance = "matches spec section X, verified by screenshot"). Phase → `build`. Commit.
- Phase `build`: no designer step — packages flow through the normal tick protocol until the epic's packages are done, then a **Persona panel milestone review** runs on the deployed result; phase → `polish` or `done`.

## Discovery pass (replaces 4–8 when triggered)

Run `node tools/audit-site.js`; diff vs baseline; link scan; TODO/console.log grep; heading sample; **persona panel** walk of the current site; full-sweep Reviewer over everything shipped since the last discovery. Review `parked` (re-arm at most one with new evidence). Append findings (priority: user-facing broken = 1, a11y/mobile = 2, polish/perf = 3) via `meta.next_id`. Metrics snapshot → PROGRESS.md. Commit `improve(loop): discovery`, push.

## Hard rules

Everything in CLAUDE.md FORBIDDEN applies verbatim. Never run quarantined scripts; never read `tools/lesson-batches/` as truth; never touch `.env` or the PostHog token; never `npm install`/`npx` locally; never force-push; never leave a dirty tree; never hand-edit baselines. Pushing to main deploys to production — a change you would not put in front of a visitor does not get pushed.
