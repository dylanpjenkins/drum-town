# Improvement loop — progress

Newest first. One line per iteration. Full protocol: `.claude/commands/improve.md` · backlog: `tools/backlog.json`.

## Iteration log

- 2026-08-04 · iter 0 · bootstrap — loop scaffolding, audit-site metrics engine + baseline, backlog seeded (31 items), quarantine, .env untracked

## Blocked on Dylan (the only list you need to read)

- **Rotate the PostHog project token.** `.env` is now untracked and the token no longer ships hardcoded in base.njk, but the old value remains in git history. Rotate it in PostHog settings, then update your local `.env`. (SEC, bootstrap)
- **Getting Started photos** (BL-030 / ISSUES.md #1): stick-grip, setup-posture, the-drum-kit lost their figures because the photos never existed. When you have photos, the loop restores the figure blocks + styles.

## Needs eyes (visual changes awaiting a 5-minute human glance)

_(none yet)_

## Needs ear (audio changes awaiting a listen)

_(none yet)_

## Parked

_(none)_

## Metrics snapshots

_(pasted by each discovery pass)_
