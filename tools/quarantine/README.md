# Quarantine — do not run anything in this directory

`merge-lesson-batches.js.DISABLED` and `patch-lessons.js.DISABLED` were part of the original
content-authoring pipeline. They inline/patch lesson entries from `tools/lesson-batches/*.js`
into `src/_data/lessonContent.js`.

**Running them today would regress live content.** As of 2026-08-04, `tools/lesson-batches/`
is a stale divergent copy: 177 of 193 batch entries and all 16 fixes entries no longer match
the live file — `lessonContent.js` has been edited directly since the batches were merged.
Additionally, `merge-lesson-batches.js` picks up the `fixes-*.js` files as if they were
batches, which would inject duplicate object keys.

- `src/_data/lessonContent.js` is the single source of truth for lesson content.
- The `.DISABLED` suffix is deliberate: `node` cannot execute them at their old paths.
- `lesson-batches-snapshot.zip` (gitignored, local-only) preserves the batch directory
  exactly as it was when quarantined, for forensic comparison only.

If a lesson ever needs to be reconstructed, use git history of `lessonContent.js`, not these.
