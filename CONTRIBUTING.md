# Contributing

Contributions of all kinds are welcome — new lessons, notation fixes, tooling improvements, and bug reports.

## Quick start

```bash
npm install
npm start          # dev server at http://localhost:8080 with live reload
npm run build      # one-off production build → _site/
```

There's no database and no backend — the whole site is data files + templates rendered to static HTML at build time.

## What to work on

- **[ISSUES.md](ISSUES.md)** — known problems (notation bugs, sticking errors, missing assets). Fixing anything here is a great first contribution.
- **[IDEAS.md](IDEAS.md)** — larger feature ideas that are up for grabs. Open an issue to discuss before starting a big one.
- **New lessons** — see [Adding a lesson](README.md#adding-a-lesson) in the README. Lessons are plain JavaScript data in `src/_data/lessonContent.js`; you don't need to touch the build tooling.

## Before you write notation

Read the [Notation specs](README.md#notation-specs) section of the README. The notation has repo-specific conventions — for example, rests are invisible spacers by default and are only drawn when `visible: true` is set.

## Validating your changes

1. `npm run build` must complete without errors.
2. `node tools/audit-lessons.js` checks every exercise's beat count against its time signature. Don't introduce new mismatches — fixing existing ones (listed in `tools/audit-output.txt`) is very welcome.
3. For notation changes, eyeball the rendered output in the dev server and include a screenshot in your PR.

While `npm start` is running, a maintainers' review dashboard is available at `/dev/review/` for tracking which lessons have been proofread. It is dev-server-only and excluded from production builds.

## Content guidelines

- **All lesson prose must be your own original writing.** Citing published books, methods, and recordings (author, title, even page references) is encouraged; reproducing their text, notation pages, or scans is not, and such PRs will be rejected.
- Never commit PDFs, scans, audio rips, or any copyrighted material to the repo.
- Listening recommendations should point to commercially available recordings.
- Follow the curriculum design notes at the end of the README — in particular, a lesson's `prerequisites` list means "you'll be lost without," not "nice to have."

## Pull requests

- Fork, create a topic branch, keep each PR focused (one lesson, one fix, or one feature).
- Confirm the build and the audit script pass.
- Describe *what the learner gains* from a content change, not just what changed.

By contributing, you agree that your contributions are licensed under the project's [MIT License](LICENSE).
