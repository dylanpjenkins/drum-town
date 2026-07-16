// src/_data/rudiments.js
// The 40 essential drum rudiments (PAS International Drum Rudiments, as
// presented by Vic Firth), grouped into the four standard families. Each
// entry carries a playable notation spec; entries whose rudiment has a full
// lesson on the site link to it via lessonSlug.
//
// Notation conventions match lessonContent.js:
//   - snare = keys ['c/5']; sticking labels 'R'/'L' below the staff
//   - flam  = one grace note  (lowercase sticking, e.g. lR)
//   - drag  = two grace notes (lowercase sticking, e.g. llR)
//   - roll diddles are written out (R R L L as real notes), so the audio
//     player actually plays them
//   - tremolo: 3 draws buzz slashes (multiple bounce roll only)

// ---- note builders ----
function n(sticking, duration, opts = {}) {
  return Object.assign({ keys: ['c/5'], duration, sticking }, opts);
}
function flam(sticking, duration, opts = {}) {
  const g = sticking === 'R' ? 'l' : 'r';
  return Object.assign(
    { keys: ['c/5'], duration, sticking, grace: { sticking: g } },
    opts
  );
}
function drag(sticking, duration, opts = {}) {
  const g = sticking === 'R' ? 'l' : 'r';
  return Object.assign(
    { keys: ['c/5'], duration, sticking, grace: [{ sticking: g }, { sticking: g }] },
    opts
  );
}
function rest(duration) {
  return { rest: true, visible: true, duration };
}
const A = { accent: true };

// ---- tuplet builders (hands voice) ----
// 3 sixteenths in the space of 2 (one 8th) — 16th triplet
function trip16(start) {
  return { voice: 'hands', start, length: 3, num_notes: 3, notes_occupied: 2 };
}
// 3 eighths in the space of 2 (one beat) — 8th triplet
function trip8(start) {
  return { voice: 'hands', start, length: 3, num_notes: 3, notes_occupied: 2 };
}
// 6 sixteenths in the space of 4 (one beat) — sextuplet
function sext(start) {
  return { voice: 'hands', start, length: 6, num_notes: 6, notes_occupied: 4 };
}

const groups = [
  // ============================================================
  // I. ROLL RUDIMENTS  (#1–15)
  // ============================================================
  {
    slug: 'roll-rudiments',
    title: 'Roll Rudiments',
    blurb: 'Fifteen rudiments built from single strokes, multiple-bounce strokes, and double strokes. The double-stroke family — the “numbered” rolls — is named for the total stroke count, roll plus release.',
    rudiments: [
      {
        number: 1,
        name: 'Single Stroke Roll',
        lessonSlug: 'single-stroke-roll',
        description: 'Alternating strokes — R L R L — perfectly even in volume and spacing. Every fill and every fast run around the kit traces back to this motion.',
        meta: '4/4 · ♩ = 90',
        spec: {
          bpm: 90, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: Array.from({ length: 16 }, (_, i) => n(['R', 'L'][i % 2], '16')),
          beamGroups: [[4, 16]]
        }
      },
      {
        number: 2,
        name: 'Single Stroke Four',
        lessonSlug: null,
        description: 'Four alternating strokes phrased as a triplet flowing into a downbeat — R L R L. The classic figure for punctuating the end of a fill.',
        meta: '4/4 · triplet + 8th · ♩ = 80',
        spec: {
          bpm: 80, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            n('R', '16'), n('L', '16'), n('R', '16'), n('L', '8'),
            n('L', '16'), n('R', '16'), n('L', '16'), n('R', '8'),
            n('R', '16'), n('L', '16'), n('R', '16'), n('L', '8'),
            n('L', '16'), n('R', '16'), n('L', '16'), n('R', '8')
          ],
          tuplets: [trip16(0), trip16(4), trip16(8), trip16(12)],
          beamGroups: [[1, 4]]
        }
      },
      {
        number: 3,
        name: 'Single Stroke Seven',
        lessonSlug: null,
        description: 'Seven alternating strokes — a sextuplet flowing into a downbeat. The single stroke four’s bigger sibling, filling a whole beat before it lands.',
        meta: '4/4 · sextuplet + ♩ · ♩ = 80',
        spec: {
          bpm: 80, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            n('R', '16'), n('L', '16'), n('R', '16'), n('L', '16'), n('R', '16'), n('L', '16'), n('R', 'q'),
            n('L', '16'), n('R', '16'), n('L', '16'), n('R', '16'), n('L', '16'), n('R', '16'), n('L', 'q')
          ],
          tuplets: [sext(0), sext(7)],
          beamGroups: [[1, 4]]
        }
      },
      {
        number: 4,
        name: 'Multiple Bounce Roll',
        lessonSlug: null,
        description: 'The buzz roll: each stroke is pressed into the head so the stick bounces many times, and the alternating buzzes overlap into one continuous sound.',
        meta: '4/4 · buzz strokes · ♩ = 80',
        spec: {
          bpm: 80, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            n('R', 'q', { tremolo: 3 }), n('L', 'q', { tremolo: 3 }),
            n('R', 'q', { tremolo: 3 }), n('L', 'q', { tremolo: 3 })
          ],
          tip: 'The slashes mean <em>multiple-bounce strokes</em>, not counted notes. The player sounds only the underlying pulse — on the pad, press each stroke into the head and let the buzzes overlap seamlessly.'
        }
      },
      {
        number: 5,
        name: 'Triple Stroke Roll',
        lessonSlug: null,
        description: 'Three strokes per hand in triplet time — R R R L L L. Builds the controlled multi-rebound behind fast open rolls.',
        meta: '4/4 · 8th triplets · ♩ = 80',
        spec: {
          bpm: 80, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: Array.from({ length: 12 }, (_, i) => n(['R', 'R', 'R', 'L', 'L', 'L'][i % 6], '8')),
          tuplets: [trip8(0), trip8(3), trip8(6), trip8(9)],
          beamGroups: [[1, 4]]
        }
      },
      {
        number: 6,
        name: 'Double Stroke Open Roll',
        lessonSlug: 'double-stroke-roll',
        description: 'Two even strokes per hand — R R L L. The parent of every numbered roll below; the second note of each pair must match the first, not collapse.',
        meta: '4/4 · ♩ = 90',
        spec: {
          bpm: 90, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: Array.from({ length: 16 }, (_, i) => n(['R', 'R', 'L', 'L'][i % 4], '16')),
          beamGroups: [[4, 16]]
        }
      },
      {
        number: 7,
        name: 'Five Stroke Roll',
        lessonSlug: null,
        description: 'Two diddles and an accented release — R R L L R. The shortest numbered roll; the lead alternates so both hands learn to start it.',
        meta: '4/4 · ♩ = 90',
        spec: {
          bpm: 90, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            n('R', '16'), n('R', '16'), n('L', '16'), n('L', '16'), n('R', 'q', A),
            n('L', '16'), n('L', '16'), n('R', '16'), n('R', '16'), n('L', 'q', A)
          ],
          beamGroups: [[4, 16]]
        }
      },
      {
        number: 8,
        name: 'Six Stroke Roll',
        lessonSlug: 'six-stroke-roll-found',
        description: 'A diddled middle framed by two accented singles — R L L R R L. A kit favorite because the accents fall naturally on strong beats.',
        meta: '4/4 · ♩ = 90',
        spec: {
          bpm: 90, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            n('R', '8', A), n('L', '16'), n('L', '16'), n('R', '16'), n('R', '16'), n('L', '8', A),
            n('R', '8', A), n('L', '16'), n('L', '16'), n('R', '16'), n('R', '16'), n('L', '8', A)
          ],
          beamGroups: [[1, 8], [4, 16], [1, 8]]
        }
      },
      {
        number: 9,
        name: 'Seven Stroke Roll',
        lessonSlug: null,
        description: 'Three diddles resolving onto an accent — R R L L R R L. Classically starts on an upbeat and lands on the following downbeat.',
        meta: '4/4 · ♩ = 90',
        spec: {
          bpm: 90, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            n('R', '16'), n('R', '16'), n('L', '16'), n('L', '16'), n('R', '16'), n('R', '16'), n('L', '8', A),
            n('R', '16'), n('R', '16'), n('L', '16'), n('L', '16'), n('R', '16'), n('R', '16'), n('L', '8', A)
          ],
          beamGroups: [[6, 16], [1, 8]]
        }
      },
      {
        number: 10,
        name: 'Nine Stroke Roll',
        lessonSlug: null,
        description: 'Four diddles capped by an accent — two full beats of roll before the release. The workhorse concert roll.',
        meta: '4/4 · ♩ = 90',
        spec: {
          bpm: 90, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            n('R', '16'), n('R', '16'), n('L', '16'), n('L', '16'),
            n('R', '16'), n('R', '16'), n('L', '16'), n('L', '16'),
            n('R', 'q', A), rest('q')
          ],
          beamGroups: [[4, 16]],
          tip: 'Repeat leading with the left as well: <em>L L R R L L R R · L</em>.'
        }
      },
      {
        number: 11,
        name: 'Ten Stroke Roll',
        lessonSlug: null,
        description: 'Four diddles plus two accented singles — R R L L R R L L R L. The double accent at the end gives it its skipping character.',
        meta: '4/4 · ♩ = 90',
        spec: {
          bpm: 90, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            n('R', '16'), n('R', '16'), n('L', '16'), n('L', '16'),
            n('R', '16'), n('R', '16'), n('L', '16'), n('L', '16'),
            n('R', '8', A), n('L', '8', A), rest('q')
          ],
          beamGroups: [[4, 16], [4, 16], [2, 8]]
        }
      },
      {
        number: 12,
        name: 'Eleven Stroke Roll',
        lessonSlug: null,
        description: 'Five diddles resolving to an accent — R R L L R R L L R R L. The odd length flips the lead each repeat, keeping both hands honest.',
        meta: '4/4 · ♩ = 90',
        spec: {
          bpm: 90, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            n('R', '16'), n('R', '16'), n('L', '16'), n('L', '16'),
            n('R', '16'), n('R', '16'), n('L', '16'), n('L', '16'),
            n('R', '16'), n('R', '16'), n('L', '8', A), rest('q')
          ],
          beamGroups: [[4, 16], [4, 16], [2, 16], [1, 8]]
        }
      },
      {
        number: 13,
        name: 'Thirteen Stroke Roll',
        lessonSlug: null,
        description: 'Six diddles and the release — three full beats of roll landing accented on beat four.',
        meta: '4/4 · ♩ = 90',
        spec: {
          bpm: 90, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            n('R', '16'), n('R', '16'), n('L', '16'), n('L', '16'),
            n('R', '16'), n('R', '16'), n('L', '16'), n('L', '16'),
            n('R', '16'), n('R', '16'), n('L', '16'), n('L', '16'),
            n('R', 'q', A)
          ],
          beamGroups: [[4, 16]]
        }
      },
      {
        number: 14,
        name: 'Fifteen Stroke Roll',
        lessonSlug: null,
        description: 'Seven diddles into the accent — a bar-length roll that releases on the final upbeat.',
        meta: '4/4 · ♩ = 90',
        spec: {
          bpm: 90, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            n('R', '16'), n('R', '16'), n('L', '16'), n('L', '16'),
            n('R', '16'), n('R', '16'), n('L', '16'), n('L', '16'),
            n('R', '16'), n('R', '16'), n('L', '16'), n('L', '16'),
            n('R', '16'), n('R', '16'), n('L', '8', A)
          ],
          beamGroups: [[4, 16], [4, 16], [4, 16], [2, 16], [1, 8]]
        }
      },
      {
        number: 15,
        name: 'Seventeen Stroke Roll',
        lessonSlug: null,
        description: 'Eight diddles — two beats of roll at doubled density — released onto an accented downbeat. The longest of the standard rolls.',
        meta: '4/4 · 32nds · ♩ = 80',
        spec: {
          bpm: 80, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            ...Array.from({ length: 16 }, (_, i) => n(['R', 'R', 'L', 'L'][i % 4], '32')),
            n('R', 'q', A), rest('q')
          ],
          beamGroups: [[8, 32]],
          tip: 'Written in 32nds — closed-roll density. Same R R L L hand motion as the other rolls, twice as many per beat.'
        }
      }
    ]
  },

  // ============================================================
  // II. DIDDLE RUDIMENTS  (#16–19)
  // ============================================================
  {
    slug: 'diddle-rudiments',
    title: 'Diddle Rudiments',
    blurb: 'The paradiddle family: singles and doubles mixed inside one phrase. The diddle placement flips or holds the lead hand, which is what makes these patterns so useful for moving accents around the kit.',
    rudiments: [
      {
        number: 16,
        name: 'Single Paradiddle',
        lessonSlug: 'paradiddle',
        description: 'The essential single–double hybrid — R L R R, L R L L — accent on the first note. The diddle flips the lead every group, so accents alternate hands automatically.',
        meta: '4/4 · ♩ = 80',
        spec: {
          bpm: 80, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: Array.from({ length: 16 }, (_, i) =>
            n(['R', 'L', 'R', 'R', 'L', 'R', 'L', 'L'][i % 8], '16', i % 4 === 0 ? A : {})),
          beamGroups: [[4, 16]]
        }
      },
      {
        number: 17,
        name: 'Double Paradiddle',
        lessonSlug: 'double-paradiddle',
        description: 'Four singles and a diddle — R L R L R R — six notes that sit perfectly inside triplet meters and 6/8 grooves.',
        meta: '4/4 · sextuplets · ♩ = 60',
        spec: {
          bpm: 60, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: Array.from({ length: 24 }, (_, i) =>
            n(['R', 'L', 'R', 'L', 'R', 'R', 'L', 'R', 'L', 'R', 'L', 'L'][i % 12], '16', i % 6 === 0 ? A : {})),
          tuplets: [sext(0), sext(6), sext(12), sext(18)],
          beamGroups: [[1, 4]]
        }
      },
      {
        number: 18,
        name: 'Triple Paradiddle',
        lessonSlug: null,
        description: 'Six singles and a diddle — an eight-note paradiddle spanning two full beats. A great drill for carrying an accent across a longer phrase.',
        meta: '4/4 · ♩ = 80',
        spec: {
          bpm: 80, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: Array.from({ length: 16 }, (_, i) =>
            n(['R', 'L', 'R', 'L', 'R', 'L', 'R', 'R', 'L', 'R', 'L', 'R', 'L', 'R', 'L', 'L'][i], '16', i % 8 === 0 ? A : {})),
          beamGroups: [[4, 16]]
        }
      },
      {
        number: 19,
        name: 'Single Paradiddle-Diddle',
        lessonSlug: 'paradiddle-diddle',
        description: 'A paradiddle with a second diddle — R L R R L L. Unlike the single paradiddle it does not flip the lead, so practice it starting from both hands.',
        meta: '4/4 · sextuplets · ♩ = 60',
        spec: {
          bpm: 60, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: Array.from({ length: 24 }, (_, i) =>
            n(['R', 'L', 'R', 'R', 'L', 'L'][i % 6], '16', i % 6 === 0 ? A : {})),
          tuplets: [sext(0), sext(6), sext(12), sext(18)],
          beamGroups: [[1, 4]]
        }
      }
    ]
  },

  // ============================================================
  // III. FLAM RUDIMENTS  (#20–30)
  // ============================================================
  {
    slug: 'flam-rudiments',
    title: 'Flam Rudiments',
    blurb: 'Eleven rudiments decorated with a single grace note. The grace is played low and soft an instant before the main stroke — one thick sound, never two equal notes.',
    rudiments: [
      {
        number: 20,
        name: 'Flam',
        lessonSlug: 'flam',
        description: 'The grace note itself: a soft tap crushed in just before an accented full stroke. Two notes, one fat sound — the basis of the whole family.',
        meta: '4/4 · ♩ = 70',
        spec: {
          bpm: 70, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            flam('R', 'q', A), flam('L', 'q', A), flam('R', 'q', A), flam('L', 'q', A)
          ]
        }
      },
      {
        number: 21,
        name: 'Flam Accent',
        lessonSlug: 'flam-accent',
        description: 'A flam launching each triplet, then two singles — flam-R L R, flam-L R L. The lead alternates every beat.',
        meta: '4/4 · 8th triplets · ♩ = 80',
        spec: {
          bpm: 80, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            flam('R', '8', A), n('L', '8'), n('R', '8'),
            flam('L', '8', A), n('R', '8'), n('L', '8'),
            flam('R', '8', A), n('L', '8'), n('R', '8'),
            flam('L', '8', A), n('R', '8'), n('L', '8')
          ],
          tuplets: [trip8(0), trip8(3), trip8(6), trip8(9)],
          beamGroups: [[1, 4]]
        }
      },
      {
        number: 22,
        name: 'Flam Tap',
        lessonSlug: 'flam-tap',
        description: 'A flammed diddle — the flam plus a tap from the same hand: flam-R R, flam-L L.',
        meta: '4/4 · ♩ = 70',
        spec: {
          bpm: 70, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            flam('R', '8', A), n('R', '8'), flam('L', '8', A), n('L', '8'),
            flam('R', '8', A), n('R', '8'), flam('L', '8', A), n('L', '8')
          ],
          beamGroups: [[2, 8]]
        }
      },
      {
        number: 23,
        name: 'Flamacue',
        lessonSlug: null,
        description: 'Four sixteenths and a flammed downbeat, with the accent tucked onto the second note — the off-axis accent is the whole point.',
        meta: '4/4 · ♩ = 80',
        spec: {
          bpm: 80, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            flam('R', '16'), n('L', '16', A), n('R', '16'), n('L', '16'), flam('R', 'q'),
            flam('L', '16'), n('R', '16', A), n('L', '16'), n('R', '16'), flam('L', 'q')
          ],
          beamGroups: [[4, 16]]
        }
      },
      {
        number: 24,
        name: 'Flam Paradiddle',
        lessonSlug: null,
        description: 'A paradiddle with a flam on the accented first note — flam-R L R R, flam-L R L L.',
        meta: '4/4 · ♩ = 70',
        spec: {
          bpm: 70, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            flam('R', '16', A), n('L', '16'), n('R', '16'), n('R', '16'),
            flam('L', '16', A), n('R', '16'), n('L', '16'), n('L', '16'),
            flam('R', '16', A), n('L', '16'), n('R', '16'), n('R', '16'),
            flam('L', '16', A), n('R', '16'), n('L', '16'), n('L', '16')
          ],
          beamGroups: [[4, 16]]
        }
      },
      {
        number: 25,
        name: 'Single Flammed Mill',
        lessonSlug: null,
        description: 'An inverted flam paradiddle — the diddle comes first: flam-R R L R. Keeping the flammed double clean is the challenge.',
        meta: '4/4 · ♩ = 70',
        spec: {
          bpm: 70, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            flam('R', '16', A), n('R', '16'), n('L', '16'), n('R', '16'),
            flam('L', '16', A), n('L', '16'), n('R', '16'), n('L', '16'),
            flam('R', '16', A), n('R', '16'), n('L', '16'), n('R', '16'),
            flam('L', '16', A), n('L', '16'), n('R', '16'), n('L', '16')
          ],
          beamGroups: [[4, 16]]
        }
      },
      {
        number: 26,
        name: 'Flam Paradiddle-Diddle',
        lessonSlug: null,
        description: 'The paradiddle-diddle with a flammed lead note — flam-R L R R L L — six notes per beat with the flam alternating hands.',
        meta: '4/4 · sextuplets · ♩ = 60',
        spec: {
          bpm: 60, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            flam('R', '16', A), n('L', '16'), n('R', '16'), n('R', '16'), n('L', '16'), n('L', '16'),
            flam('L', '16', A), n('R', '16'), n('L', '16'), n('L', '16'), n('R', '16'), n('R', '16'),
            flam('R', '16', A), n('L', '16'), n('R', '16'), n('R', '16'), n('L', '16'), n('L', '16'),
            flam('L', '16', A), n('R', '16'), n('L', '16'), n('L', '16'), n('R', '16'), n('R', '16')
          ],
          tuplets: [sext(0), sext(6), sext(12), sext(18)],
          beamGroups: [[1, 4]]
        }
      },
      {
        number: 27,
        name: 'Pataflafla',
        lessonSlug: null,
        description: '“Pa-ta-fla-fla”: flams on the first and fourth sixteenths of every group — flam-R L R flam-L — so two flams land back to back across each join.',
        meta: '4/4 · ♩ = 70',
        spec: {
          bpm: 70, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            flam('R', '16', A), n('L', '16'), n('R', '16'), flam('L', '16', A),
            flam('R', '16', A), n('L', '16'), n('R', '16'), flam('L', '16', A),
            flam('R', '16', A), n('L', '16'), n('R', '16'), flam('L', '16', A),
            flam('R', '16', A), n('L', '16'), n('R', '16'), flam('L', '16', A)
          ],
          beamGroups: [[4, 16]]
        }
      },
      {
        number: 28,
        name: 'Swiss Army Triplet',
        lessonSlug: 'swiss-army-triplet',
        description: 'A flammed diddle plus one single in triplet time — flam-R R L. Sounds like the flam accent but stays under one lead hand, which is why it moves faster.',
        meta: '4/4 · 8th triplets · ♩ = 80',
        spec: {
          bpm: 80, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            flam('R', '8', A), n('R', '8'), n('L', '8'),
            flam('R', '8', A), n('R', '8'), n('L', '8'),
            flam('R', '8', A), n('R', '8'), n('L', '8'),
            flam('R', '8', A), n('R', '8'), n('L', '8')
          ],
          tuplets: [trip8(0), trip8(3), trip8(6), trip8(9)],
          beamGroups: [[1, 4]]
        }
      },
      {
        number: 29,
        name: 'Inverted Flam Tap',
        lessonSlug: null,
        description: 'A flam tap turned inside out: the tap comes just before the next flam on the same hand — flam-R L, flam-L R — so the diddle straddles the flam instead of following it.',
        meta: '4/4 · ♩ = 70',
        spec: {
          bpm: 70, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            flam('R', '8', A), n('L', '8'), flam('L', '8', A), n('R', '8'),
            flam('R', '8', A), n('L', '8'), flam('L', '8', A), n('R', '8')
          ],
          beamGroups: [[2, 8]]
        }
      },
      {
        number: 30,
        name: 'Flam Drag',
        lessonSlug: null,
        description: 'A flam accent whose middle note becomes a drag — flam-R, L-L, R inside each triplet. The drag is written out so you can hear it.',
        meta: '4/4 · triplets · ♩ = 70',
        spec: {
          bpm: 70, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            flam('R', '8', A), n('L', '16'), n('L', '16'), n('R', '8'),
            flam('L', '8', A), n('R', '16'), n('R', '16'), n('L', '8'),
            flam('R', '8', A), n('L', '16'), n('L', '16'), n('R', '8'),
            flam('L', '8', A), n('R', '16'), n('R', '16'), n('L', '8')
          ],
          tuplets: [
            { voice: 'hands', start: 0, length: 4, num_notes: 3, notes_occupied: 2 },
            { voice: 'hands', start: 4, length: 4, num_notes: 3, notes_occupied: 2 },
            { voice: 'hands', start: 8, length: 4, num_notes: 3, notes_occupied: 2 },
            { voice: 'hands', start: 12, length: 4, num_notes: 3, notes_occupied: 2 }
          ],
          beamGroups: [[1, 4]]
        }
      }
    ]
  },

  // ============================================================
  // IV. DRAG RUDIMENTS  (#31–40)
  // ============================================================
  {
    slug: 'drag-rudiments',
    title: 'Drag Rudiments',
    blurb: 'Ten rudiments decorated with a two-note grace — the drag (or ruff). The two grace notes are played as a soft diddle by the opposite hand, crushed in just before the main stroke.',
    rudiments: [
      {
        number: 31,
        name: 'Drag',
        lessonSlug: 'drag',
        description: 'The two-note grace itself: a soft diddle crushed in before an accented stroke — ll-R, rr-L. Also called the ruff.',
        meta: '4/4 · ♩ = 70',
        spec: {
          bpm: 70, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            drag('R', 'q', A), drag('L', 'q', A), drag('R', 'q', A), drag('L', 'q', A)
          ]
        }
      },
      {
        number: 32,
        name: 'Single Drag Tap',
        lessonSlug: null,
        description: 'A drag answered by an accented tap on the opposite hand — drag-R, accent L.',
        meta: '4/4 · ♩ = 70',
        spec: {
          bpm: 70, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            drag('R', 'q'), n('L', 'q', A), drag('L', 'q'), n('R', 'q', A)
          ]
        }
      },
      {
        number: 33,
        name: 'Double Drag Tap',
        lessonSlug: null,
        description: 'Two drags before the accented tap — drag-R, drag-R, accent L.',
        meta: '4/4 · ♩ = 70',
        spec: {
          bpm: 70, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            drag('R', '8'), drag('R', '8'), n('L', 'q', A),
            drag('L', '8'), drag('L', '8'), n('R', 'q', A)
          ],
          beamGroups: [[2, 8]]
        }
      },
      {
        number: 34,
        name: 'Lesson 25',
        lessonSlug: null,
        description: 'Named for a page in the 1870 Strube drum manual: a drag into two singles with the accent on the last — drag-R L, accent R.',
        meta: '4/4 · ♩ = 70',
        spec: {
          bpm: 70, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            drag('R', '16'), n('L', '16'), n('R', '8', A),
            drag('L', '16'), n('R', '16'), n('L', '8', A),
            drag('R', '16'), n('L', '16'), n('R', '8', A),
            drag('L', '16'), n('R', '16'), n('L', '8', A)
          ],
          beamGroups: [[4, 16]]
        }
      },
      {
        number: 35,
        name: 'Single Dragadiddle',
        lessonSlug: 'dragadiddle',
        description: 'A paradiddle whose first note is doubled into a drag by the same hand — RR L R R. Unlike a true drag, the double is metered, not crushed.',
        meta: '4/4 · ♩ = 70',
        spec: {
          bpm: 70, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            n('R', '32', A), n('R', '32'), n('L', '16'), n('R', '16'), n('R', '16'),
            n('L', '32', A), n('L', '32'), n('R', '16'), n('L', '16'), n('L', '16'),
            n('R', '32', A), n('R', '32'), n('L', '16'), n('R', '16'), n('R', '16'),
            n('L', '32', A), n('L', '32'), n('R', '16'), n('L', '16'), n('L', '16')
          ],
          beamGroups: [[4, 16]],
          tip: 'The opening double is written as two 32nds — play it as a measured diddle on the lead hand, then finish the paradiddle body.'
        }
      },
      {
        number: 36,
        name: 'Drag Paradiddle #1',
        lessonSlug: null,
        description: 'An accented stroke, then a dragged paradiddle — R, drag-R L R R.',
        meta: '4/4 · ♩ = 80',
        spec: {
          bpm: 80, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            n('R', 'q', A), drag('R', '16'), n('L', '16'), n('R', '16'), n('R', '16'),
            n('L', 'q', A), drag('L', '16'), n('R', '16'), n('L', '16'), n('L', '16')
          ],
          beamGroups: [[4, 16]]
        }
      },
      {
        number: 37,
        name: 'Drag Paradiddle #2',
        lessonSlug: null,
        description: 'An accented stroke and two drags feeding the paradiddle — R, drag-R, drag-R L R R.',
        meta: '4/4 · ♩ = 80',
        spec: {
          bpm: 80, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            n('R', '8', A), drag('R', '8'), drag('R', '16'), n('L', '16'), n('R', '16'), n('R', '16'),
            n('L', '8', A), drag('L', '8'), drag('L', '16'), n('R', '16'), n('L', '16'), n('L', '16')
          ],
          beamGroups: [[2, 8], [4, 16]]
        }
      },
      {
        number: 38,
        name: 'Single Ratamacue',
        lessonSlug: null,
        description: '“Ra-ta-ma-cue”: a dragged triplet resolving onto an accented downbeat — drag-R L R, accent L.',
        meta: '4/4 · triplets · ♩ = 70',
        spec: {
          bpm: 70, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            drag('R', '16'), n('L', '16'), n('R', '16'), n('L', '8', A),
            drag('L', '16'), n('R', '16'), n('L', '16'), n('R', '8', A),
            drag('R', '16'), n('L', '16'), n('R', '16'), n('L', '8', A),
            drag('L', '16'), n('R', '16'), n('L', '16'), n('R', '8', A)
          ],
          tuplets: [trip16(0), trip16(4), trip16(8), trip16(12)],
          beamGroups: [[1, 8]]
        }
      },
      {
        number: 39,
        name: 'Double Ratamacue',
        lessonSlug: null,
        description: 'A drag stacked in front of the single ratamacue — drag-R, drag-R L R, accent L.',
        meta: '4/4 · ♩ = 70',
        spec: {
          bpm: 70, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            drag('R', '8'), drag('R', '16'), n('L', '16'), n('R', '16'), n('L', '8', A),
            drag('L', '8'), drag('L', '16'), n('R', '16'), n('L', '16'), n('R', '8', A),
            rest('q')
          ],
          tuplets: [trip16(1), trip16(6)],
          beamGroups: [[1, 8]]
        }
      },
      {
        number: 40,
        name: 'Triple Ratamacue',
        lessonSlug: null,
        description: 'Three drags before the release — drag-R, drag-R, drag-R L R, accent L. The longest of the drag rudiments.',
        meta: '4/4 · ♩ = 70',
        spec: {
          bpm: 70, timeSignature: '4/4', repeatBegin: true, repeatEnd: true,
          hands: [
            drag('R', '8'), drag('R', '8'), drag('R', '16'), n('L', '16'), n('R', '16'), n('L', '8', A),
            drag('L', '8'), drag('L', '8'), drag('L', '16'), n('R', '16'), n('L', '16'), n('R', '8', A)
          ],
          tuplets: [trip16(2), trip16(8)],
          beamGroups: [[1, 4], [1, 8], [1, 8]]
        }
      }
    ]
  }
];

// Assemble the render-ready card for each rudiment: the exercise spec plus
// the title, meta, description, and lesson link the shortcode folds into
// the card.
groups.forEach(group => {
  group.rudiments.forEach(r => {
    r.card = Object.assign({}, r.spec, {
      title: `${String(r.number).padStart(2, '0')} · ${r.name}`,
      meta: r.meta,
      description: r.description,
      lessonUrl: r.lessonSlug ? `/lessons/${r.lessonSlug}/` : null
    });
  });
});

module.exports = groups;
