# Drum Town — content style guide

The reference for every lesson-content edit: expansions, new sections, and the voice-rewrite passes (BL-022, BL-023, BL-024, BL-026, BL-028, BL-029). The improvement loop consults this before touching `src/_data/lessonContent.js`. Rules here are binding; taste calls default to what reads best aloud.

## Voice and register

Write as a working drummer teaching from the throne, not a textbook. Direct address ("you"), present tense, concrete physical language — sticks, rebound, the click, the backbeat — over abstractions. Confident and warm, never chummy or hype ("insanely powerful" is out). Musical opinions are welcome when they help a learner choose ("the shuffle lives or dies on the middle triplet partial"). Humor is rare and dry.

**Openings.** Never open on a definition reflex ("The single paradiddle is…") — 55 lessons currently start with "The". Open instead on one of:
- the musical problem the lesson solves ("Your fills rush because your hands don't share a clock.")
- the sound ("That dry snap on 2 and 4 in every Motown record — that's a cross-stick.")
- a scene or a claim worth defending ("Half of funk is the notes you barely play.")
Vary across neighboring lessons; two adjacent lessons in a chapter must not open the same way.

**Banned tics** (from the corpus audit): "This is the …" as a sentence opener (148 uses), "That's the whole point" family (9), stacked em-dashes. **Em-dash budget: at most one per paragraph.** Prefer a period; the second-best choice is a comma.

## Structure by lesson size

Every lesson keeps the shape: prose → exercises → (listening) → graduation criteria. Prose beats, in order: **what & why → how it works or feels → how to practice it → where it goes wrong**. Not every beat needs its own paragraph in small lessons, but the order holds.

| Size | When | Prose | Subheads (h2) |
|---|---|---|---|
| S | single-skill lessons (one rudiment, one counting concept) | 3–4 paragraphs | 0–1, only if a real seam exists |
| M | typical kit/groove lesson | 4–6 paragraphs | 1–2, descriptive ("Locking the kick to the ride", never "Overview") |
| L | style studies, capstones | 6+ paragraphs | 2–3 |

`bodyHtml` subheads are `<h2 class="section-label">` (page h1 > section h2 > exercise h3 — fixed in iter 2). Counts and stickings are italicized (`<em>1 e & a</em>`, `<em>R L R R</em>`); named techniques bold on first mention only.

## Mechanics

- **American spelling** (enforced: `content.britishSpellings` must stay 0).
- "bar" not "measure"; "16th notes" not "sixteenth notes" in meta/titles, either in prose; tempo always `♩ = N`.
- Numbers: digits for counts, tempos, and bar numbers; words for casual quantities ("two minutes of clean singles").

## Exercises

- **Titles**: canonical form `N — Title` (`3 — Ghost the "e" and "a"`). Variations of one exercise: `NA / NB — Title`. Named-sequence prefixes ("Build-Up 1 —") are allowed only when the lesson is an explicit build-up sequence; no other schemes. (BL-026 applies this.)
- **Meta**: `TS · subdivision · ♩ = BPM`, where BPM **equals the spec's `bpm`** — the player honors exactly one tempo. Practice-range guidance ("work it 70→100") belongs in the tip, not the meta. (BL-027 applies this.)
- **Tips** carry the coaching: sticking, what to listen for, the one thing that goes wrong first.

### Notation: what a sticking letter means (BL-078)

**A sticking letter names the hand that plays the note. Nothing else.** `R` is the right hand whether the stroke is a 14-inch fortissimo or a 1-inch whisper, and the letter under a loud backbeat and the letter under the ghost beside it are the same letter when it is the same hand. Case is not a dynamic and never was in drum notation — a ghost is marked by dynamics, an accent by `>`. Only two values are legal on a primary note: `R` and `L`.

This rule exists because the corpus broke it. Four lessons had drifted into writing lowercase for "ghost" until `finger-control#2` printed *"Hi-hat 16ths in the right hand, snare 16ths in the left. The **r** snare hits are all fingers"* — a physically impossible instruction inside one sentence — and `ghost-notes-found#3`, `snare-voicings#2` and `finger-control#2` all lettered `r` on notes chorded against a continuous hi-hat, where the free hand is necessarily the left.

**Deriving the hand.** Read it off the exercise, never off a rule of thumb. A continuous cymbal line is played one of two ways and they give opposite answers, so establish which one the exercise means before you letter anything:

- **One hand rides the cymbal.** Then that hand is committed for the whole bar and every drum note chorded against it belongs to the other hand — `R` on the hat, `L` on the snare, loud or ghosted. `snare-voicings#2`, `ghost-notes-found#3` and `finger-control#2` are this shape, and `finger-control#2`'s tip says it outright.
- **Both hands alternate on the cymbal.** Then no hand is free or committed: whichever hand's turn it is takes the drum note, so the letters keep alternating straight through and a ghost can be either hand. `funk-sixteenth-feel#2` and `#3` are this shape — their lesson body says "Continuous 16ths on a single hi-hat are usually played alternating R-L-R-L" — which is why `#2` ghosts `L` on the e-of-1 and `R` on the &-of-2. Both are correct.

The tip must name which model is in play; nothing in the notation distinguishes them, and no check can (`check-sticking-case` reads case, never hand).

Solo-drum exercises keep whatever alternation the notation already establishes; on straight alternating singles every even 16th is `R` and every odd one `L`.

**Ghost notes** carry `ghost: true` on the note. That is the marker the player reads for the 0.25 (4-to-1) ghost tier — `src/assets/js/player.js`, `noteGain()` — so a ghost must be flagged, not implied by a letter. It is honored on snare and tom keys only, which is what lets a hat+snare unison stem drop the snare and leave the hi-hat ostinato alone. Never put `ghost: true` and `accent: true` on the same note. Exercises predating the marker still reach the ghost tier by an inference the player documents and is retiring; new and edited exercises mark it explicitly.

**Grace notes are the one place case still carries meaning**, and there it is standard rudimental notation: the grace of a flam or drag is lowercase, the primary stroke uppercase. Six lesson bodies explain this to the reader. Keep it.

`lR` and `llR` are what the reader *sees* — two glyphs, or three, under one main note. They are never one field. A grace lives in its own object, so a flam is:

```js
{ keys: ['c/5'], duration: 'q', sticking: 'R', accent: true, grace: { sticking: 'l' } }
```

and a drag takes two, which is the `llR` the reader sees:

```js
{ keys: ['c/5'], duration: 'q', sticking: 'R', accent: true, grace: [{ sticking: 'l' }, { sticking: 'l' }] }
```

Writing `sticking: 'lR'` fails `check-sticking-case`, and correctly: the primary field takes one uppercase letter.

`tools/checks/check-sticking-case.js` enforces all of the above.

## Listening sections

2–3 picks per lesson, `{ artist, work, note }`. Picks must be real recordings, verified. Site-wide diversity rule: no single work cited in more than 3 lessons (BL-029). Foundations lessons take canonical, accessible picks; genre lessons dig deeper into the idiom.

**Field contract** (enforced by `tools/checks/check-listening.js`):

- **`artist` is the drummer.** Never the band — that is the whole point of the section. If the note says "Zigaboo's archetypal…", then Zigaboo Modeliste belongs in this field. A band whose name contains the drummer's ("Elvin Jones Trio", "Brian Blade Fellowship") is still a band: write the person, and let `work` carry the group. Two exceptions, and only two:
  - **Ensemble traditions.** Rumba, batucada, comparsa and charanga records are carried by a percussion battery with no single kit player. Name the ensemble (`Los Muñequitos de Matanzas`); there is no individual to credit.
  - **Programmed and produced beats.** When the drum part was built rather than played, the producer is its author: `J Dilla`, `DJ Premier`, `Metro Boomin`. Say so in the note if the distinction matters to the lesson.

  Counted by `content.listeningArtistNotDrummer` in `tools/audit-site.js`, which holds the exception lists; the metric ratchets down and never up. `tools/checks/check-listening.js` only catches a leading "The", so it is not the enforcement here.
- **`work` is shaped by the credit, not by a template.** Use `Credited Act — Title` when the record is credited to someone other than the drummer (`Paul Simon — 50 Ways to Leave Your Lover`); use a bare `Title` when the drummer *is* the credited artist (`Stevie Wonder` → `Superstition`); add a parenthetical for medium or context (`(live)`, `(book)`, `(Kind of Blue)`). Do not flatten these into one shape — a bare title given a band-dash form would invent a band, and `The New Breed (book)` is not a recording at all. The separator, when present, is an em dash with single spaces.
- **`note` says what to listen FOR**, in 1–2 finished sentences ending in a period — the specific device, sectioned or timestamped when it helps ("the hi-hat barks in the intro").

## Graduation criteria

2–4 bullets, each measurable and tempo-anchored ("Ex 3 loops for 2 minutes at ♩ = 92 with no dropped ghost notes"). Never "understand" or "get comfortable".

## Focus chip — controlled vocabulary (24 values)

`focus` takes exactly **one** value from this list (no slashes, no inventions — the chip renders "Focus · X"). Pick the lesson's dominant learning target; when torn between genre flavor and the underlying skill, pick the skill.

Getting Started · Reading · Counting · Rudiments · Sticking · Hand Technique · Foot Technique · Coordination · Independence · Time & Feel · Pocket & Groove · Dynamics · Articulation · Fills · Phrasing & Form · Genre Vocabulary · Clave & Bell Patterns · Odd Meters & Polyrhythm · Linear Playing · Speed & Endurance · Soloing & Improvisation · Listening & Analysis · Practice Method · Studio & Sound

Mapping guidance for the 144 legacy values (BL-024 applies this): `Vocabulary / Genre` combos → **Genre Vocabulary**; `Time-Feel / … / Pocket` salads → **Time & Feel** or **Pocket & Groove** by emphasis; `Rudiment / Sticking` → **Rudiments** (or **Sticking** when the lesson is about the sticking system itself); anatomy/setup/equipment → **Getting Started**; production/studio aesthetics → **Studio & Sound**; folkloric/bell-pattern lessons → **Clave & Bell Patterns**; one-offs like `Speculative / Hybrid / Frontier` → nearest real category.

## Duration chip

`NN min` or `NN–NN min` (en dash). Nothing else.
