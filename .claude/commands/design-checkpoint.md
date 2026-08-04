---
description: Sync Drum Town UI previews to the Claude Design project (human-present)
---

Run a design checkpoint: regenerate the component previews and sync them to the claude.ai/design project **"Drum Town UI"**. This command assumes Dylan may be present to grant DesignSync permissions; if permission or auth is unavailable, complete the local half and skip the sync gracefully (log `design checkpoint: sync skipped (no auth)` in PROGRESS.md).

## Steps

1. **Regenerate `design-sync/` previews** (committed; they double as local visual-regression artifacts). Each file is fully self-contained: inline the relevant subset of `src/assets/css/style.css` plus the `:root` token block; copy one pre-rendered notation SVG out of `_site/` where needed (build first if `_site` is stale):
   - `tokens.html` — color swatches, type ramp, and spacing scale generated from the `:root` custom properties
   - `exercise-card.html` — one `.exercise` block (header, meta, notation, tip, controls)
   - `lesson-page.html` — lesson layout skeleton (header, sidebar, content column)
   - `metronome-widget.html` — the docked metronome in both desktop and compact states
   - `homepage-card.html` — chapter TOC card + Up Next hero
2. **Read `design-sync/FEEDBACK.md`** (if present). Convert each unprocessed line into a `ui` backlog item in `tools/backlog.json` (use `meta.next_id`), then mark the line processed (`✓` prefix).
3. **Sync**: `DesignSync list_projects` → if "Drum Town UI" is missing, `create_project`. Then `finalize_plan` (writes: `design-sync/**/*.html`, localDir: repo root) → `write_files` with localPath for each preview.
4. **Log** one line in PROGRESS.md (`design checkpoint: synced N previews` or the skip note), commit `improve(ui): design checkpoint [design-sync]`, push per PUSH_POLICY.

Never push secrets or analytics snippets into previews; strip any `<script>` from copied markup.
