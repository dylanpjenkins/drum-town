// src/_data/curriculum.js
// The complete drum curriculum. Foundations → Tracks → Generalist Path → Mastery.
// Each lesson has a slug; lessons with `status: 'ready'` link to a
// fleshed-out page, lessons with `status: 'stub'` show a "coming soon" page.
//
// The Generalist Path is a curated meta-trail: each waypoint references a
// lesson that already lives in a track. It does NOT introduce new content —
// it sequences existing track lessons so a breadth-seeking learner can pick
// up canonical vocabulary from every genre at each difficulty level.

module.exports = {
  foundations: {
    title: "Foundations",
    tagline: "Where the real work happens",
    description: "Foundations is where every drummer's vocabulary actually lives — reading, rudiments, time on the kit, technique, coordination, fills, practice habits. Most of what you'll know as a player is built here. The genre tracks come later, when you're ready to specialize.",
    sections: [
      {
        slug: "getting-started",
        title: "Getting Started",
        tagline: "Before you hit a drum",
        lessons: [
          { slug: "the-drum-kit",         title: "The Kit: What's What",   status: "ready" },
          { slug: "setup-posture",        title: "Setup & Posture",        status: "ready" },
          { slug: "stick-grip",           title: "Stick Grip & Strokes",   status: "ready" },
          { slug: "the-practice-mindset", title: "How to Practice",        status: "ready" }
        ]
      },
      {
        slug: "reading-counting",
        title: "Reading & Counting",
        tagline: "The language of rhythm on paper",
        lessons: [
          { slug: "reading-101",             title: "Reading Music: Note Values", status: "ready" },
          { slug: "reading-time-signatures", title: "Time Signatures",            status: "ready" },
          { slug: "reading-rests",           title: "Rests: The Sound of Silence", status: "ready" },
          { slug: "counting-eighths",        title: "Counting Eighths",           status: "ready" },
          { slug: "counting-sixteenths",     title: "Counting Sixteenths",        status: "ready" },
          { slug: "triplet-feel",            title: "Triplet Feel",               status: "ready" },
          { slug: "counting-subdivision",    title: "Mixed Subdivisions",         status: "ready" },
          { slug: "reading-syncopation",     title: "Reading Syncopation",        status: "ready" },
          { slug: "reading-dotted-rhythms",  title: "Dotted Rhythms",             status: "ready" }
        ]
      },
      {
        slug: "rudiments",
        title: "Rudiments",
        tagline: "The motor patterns underneath everything",
        lessons: [
          { slug: "single-stroke-roll",    title: "The Single Stroke Roll",  status: "ready" },
          { slug: "double-stroke-roll",    title: "The Double Stroke Roll",  status: "ready" },
          { slug: "paradiddle",            title: "The Single Paradiddle",   status: "ready" },
          { slug: "double-paradiddle",     title: "The Double Paradiddle",   status: "ready" },
          { slug: "inverted-paradiddle",   title: "The Inverted Paradiddle", status: "ready" },
          { slug: "paradiddle-diddle",     title: "The Paradiddle-Diddle",   status: "ready" },
          { slug: "flam",                  title: "The Flam",                status: "ready" },
          { slug: "flam-tap",              title: "The Flam Tap",            status: "ready" },
          { slug: "flam-accent",           title: "The Flam Accent",         status: "ready" },
          { slug: "swiss-army-triplet",    title: "The Swiss Army Triplet",  status: "ready" },
          { slug: "drag",                  title: "The Drag",                status: "ready" },
          { slug: "dragadiddle",           title: "The Dragadiddle",         status: "ready" },
          { slug: "accented-singles",      title: "Accented Single Strokes", status: "ready" },
          { slug: "six-stroke-roll-found", title: "The Six-Stroke Roll",     status: "ready" }
        ]
      },
      {
        slug: "time-on-the-kit",
        title: "Time on the Kit",
        tagline: "From bare backbeat to musical drumming",
        lessons: [
          { slug: "first-beat",        title: "Your First Beat",   status: "ready" },
          { slug: "first-beat-kicks",  title: "Kick Variations",   status: "ready" },
          { slug: "first-beat-color",  title: "Backbeat Color",    status: "ready" },
          { slug: "two-bar-phrasing",  title: "Two-Bar Phrasing",  status: "ready" },
          { slug: "the-shuffle",       title: "The Shuffle Feel",  status: "ready" }
        ]
      },
      {
        slug: "foot-technique",
        title: "Foot Technique",
        tagline: "What your feet are actually doing",
        lessons: [
          { slug: "bass-drum-technique", title: "Bass Drum Technique",   status: "ready" },
          { slug: "hi-hat-foot",         title: "Hi-Hat Foot Technique", status: "ready" },
          { slug: "bass-drum-doubles",   title: "Bass Drum Doubles",     status: "ready" }
        ]
      },
      {
        slug: "hand-technique",
        title: "Hand Technique on the Kit",
        tagline: "Sound is what your hands shape",
        lessons: [
          { slug: "snare-voicings",      title: "Snare Voicings",        status: "ready" },
          { slug: "hi-hat-articulation", title: "Hi-Hat Articulation",   status: "ready" },
          { slug: "cymbal-voicings",     title: "Cymbal Voicings",       status: "ready" },
          { slug: "ghost-notes-found",   title: "Ghost Notes",           status: "ready" },
          { slug: "accent-tap",          title: "Accent and Tap",        status: "ready" },
          { slug: "moeller-stroke",      title: "The Moeller Stroke",    status: "ready" },
          { slug: "finger-control",      title: "Finger Control",        status: "ready" },
          { slug: "dynamic-spectrum",    title: "The Dynamic Spectrum",  status: "ready" }
        ]
      },
      {
        slug: "coordination",
        title: "Coordination",
        tagline: "Your four limbs, talking to each other",
        lessons: [
          { slug: "basic-coordination",  title: "Basic Coordination",           status: "ready" },
          { slug: "three-limb-patterns", title: "Three-Limb Patterns",          status: "ready" },
          { slug: "four-way-foundation", title: "Four-Way Independence Basics", status: "ready" },
          { slug: "limb-substitution",   title: "Limb Substitution",            status: "ready" }
        ]
      },
      {
        slug: "independence-systems",
        title: "Independence Systems",
        tagline: "The methodologies drummers actually use to get free",
        lessons: [
          { slug: "independence-singing",        title: "Singing as a Practice Tool",       status: "ready" },
          { slug: "independence-chapin-method",  title: "The Chapin Method",                status: "ready" },
          { slug: "independence-chester-system", title: "The New Breed System",             status: "ready" },
          { slug: "independence-melodic-snare",  title: "Melodic Snare Over Stable Feet",   status: "ready" },
          { slug: "independence-clave-foot",     title: "The Clave-Foot System",            status: "ready" }
        ]
      },
      {
        slug: "fills-transitions",
        title: "Fills & Transitions",
        tagline: "Getting from one section to the next",
        lessons: [
          { slug: "basic-fills",      title: "Basic Fills",          status: "ready" },
          { slug: "pickup-fills",     title: "Pickup Fills",         status: "ready" },
          { slug: "fills-around-kit", title: "Fills Around the Kit", status: "ready" }
        ]
      },
      {
        slug: "practicing",
        title: "Practicing",
        tagline: "How you actually get better",
        lessons: [
          { slug: "warm-ups",           title: "Warm-Ups",                     status: "ready" },
          { slug: "metronome-practice", title: "Practicing with a Metronome",  status: "ready" },
          { slug: "slow-practice",      title: "Slow Practice",                status: "ready" },
          { slug: "recording-yourself", title: "Recording Yourself",           status: "ready" }
        ]
      },
      {
        slug: "putting-it-together",
        title: "Putting It Together",
        tagline: "From exercises to playing music",
        lessons: [
          { slug: "playing-to-a-song", title: "Playing to a Song",  status: "ready" },
          { slug: "two-minute-loops",  title: "The Two-Minute Loop", status: "ready" }
        ]
      }
    ]
  },

  tracks: [
    {
      slug: "rock-pop",
      title: "Rock & Pop",
      tagline: "Backbeats that built modern music",
      description: "From classic rock backbeats to contemporary pop production. The most economical genre — fewer notes, deeper feel.",
      icon: "▮",
      levels: [
        { level: 1, title: "Level 1",     lessons: [
          { slug: "rock-eighth-grooves", title: "Eighth-Note Grooves",       status: "ready" },
          { slug: "rock-quarter-hat",    title: "Quarter-Note Hi-Hat",       status: "ready" },
          { slug: "rock-cross-stick",    title: "Cross-Stick & Ballad Feel", status: "ready" },
          { slug: "rock-basic-fills",    title: "Basic Fills",               status: "ready" },
          { slug: "rock-disco-four",     title: "Four-on-the-Floor",         status: "ready" }
        ]},
        { level: 2, title: "Level 2", lessons: [
          { slug: "rock-sixteenth-hats", title: "Sixteenth-Note Hi-Hat",     status: "ready" },
          { slug: "rock-open-hats",      title: "Open Hats & Syncopation",   status: "ready" },
          { slug: "rock-shuffle-rock",   title: "Shuffle Rock",              status: "ready" },
          { slug: "rock-power-ballad",   title: "Power Ballad Grooves",      status: "ready" },
          { slug: "rock-tom-grooves",    title: "Tom-Driven Grooves",        status: "ready" }
        ]},
        { level: 3, title: "Level 3",     lessons: [
          { slug: "rock-half-time",      title: "Half-Time Feel",            status: "ready" },
          { slug: "rock-train-beat",     title: "Train Beat",                status: "ready" },
          { slug: "rock-linear-fills",   title: "Linear Fills",              status: "ready" },
          { slug: "rock-double-time",    title: "Double-Time Grooves",       status: "ready" },
          { slug: "rock-stadium-anthem", title: "Stadium Anthem",            status: "ready" }
        ]},
        { level: 4, title: "Level 4",       lessons: [
          { slug: "rock-prog",           title: "Prog Rock Vocabulary",      status: "ready" },
          { slug: "rock-odd-meter",      title: "Odd Meters in Rock",        status: "ready" },
          { slug: "rock-hybrid-grooves", title: "Hybrid Grooves",            status: "ready" },
          { slug: "rock-studio-polish",  title: "Studio Polish & Production",status: "ready" },
          { slug: "rock-dynamics",       title: "Dynamic Mastery",           status: "ready" }
        ]}
      ]
    },
    {
      slug: "jazz",
      title: "Jazz",
      tagline: "The language of improvisation",
      description: "Swing, comping, brushes, and the deep tradition of musical conversation. Demanding but enormously rewarding.",
      icon: "♪",
      levels: [
        { level: 1, title: "Level 1",     lessons: [
          { slug: "jazz-ride-pattern",       title: "The Jazz Ride Pattern",     status: "ready" },
          { slug: "jazz-comping-foot",       title: "Hi-Hat Foot on 2 and 4",    status: "ready" },
          { slug: "jazz-brushes-intro",      title: "Brushes — First Steps",     status: "ready" },
          { slug: "jazz-ballad",             title: "Slow Ballad Brushwork",     status: "ready" },
          { slug: "jazz-medium-swing",       title: "Medium Swing Comping",      status: "ready" }
        ]},
        { level: 2, title: "Level 2", lessons: [
          { slug: "jazz-comping-basics",     title: "Comping Basics",            status: "ready" },
          { slug: "jazz-trading-fours",      title: "Trading Fours",             status: "ready" },
          { slug: "jazz-bossa-jazz",         title: "Bossa-Influenced Jazz",     status: "ready" },
          { slug: "jazz-up-tempo-intro",     title: "Intro to Up-Tempo Time",    status: "ready" },
          { slug: "jazz-broken-time-intro",  title: "Intro to Broken Time",      status: "ready" }
        ]},
        { level: 3, title: "Level 3",     lessons: [
          { slug: "jazz-bop-vocabulary",     title: "Bop Vocabulary",            status: "ready" },
          { slug: "jazz-up-tempo",           title: "Up-Tempo Time",             status: "ready" },
          { slug: "jazz-broken-time",        title: "Broken Time",               status: "ready" },
          { slug: "jazz-modal-comping",      title: "Modal Comping (Coltrane)",  status: "ready" },
          { slug: "jazz-comping-vocab",      title: "Comping Vocabulary",        status: "ready" }
        ]},
        { level: 4, title: "Level 4",       lessons: [
          { slug: "jazz-free-jazz",          title: "Free Jazz Concepts",        status: "ready" },
          { slug: "jazz-post-bop",           title: "Post-Bop Independence",     status: "ready" },
          { slug: "jazz-elvin-jones",        title: "Elvin Jones Triplet Vocabulary", status: "ready" },
          { slug: "jazz-tony-williams",      title: "Tony Williams Concepts",    status: "ready" },
          { slug: "jazz-modern-jazz",        title: "Modern Jazz Independence",  status: "ready" }
        ]}
      ]
    },
    {
      slug: "funk",
      title: "Funk",
      tagline: "The pocket is everything",
      description: "Where 16ths, ghost notes, and time-feel become musical content in their own right. The genre where 'how' matters as much as 'what'.",
      icon: "◐",
      levels: [
        { level: 1, title: "Level 1",     lessons: [
          { slug: "funk-ghost-notes",          title: "Ghost Notes & The Pocket",   status: "ready" },
          { slug: "funk-sixteenth-feel",       title: "Sixteenth-Note Feel",        status: "ready" },
          { slug: "funk-pocket-drumming",      title: "Pocket Drumming",            status: "ready" },
          { slug: "funk-clyde-stubblefield",   title: "Clyde Stubblefield (JB)",    status: "ready" },
          { slug: "funk-the-meters-intro",     title: "The Meters — First Steps",   status: "ready" }
        ]},
        { level: 2, title: "Level 2", lessons: [
          { slug: "funk-james-brown",          title: "James Brown Vocabulary",     status: "ready" },
          { slug: "funk-linear-funk",          title: "Linear Funk",                status: "ready" },
          { slug: "funk-the-meters",           title: "Zigaboo & The Meters",       status: "ready" },
          { slug: "funk-purdie-intro",         title: "Bernard Purdie — Intro",     status: "ready" },
          { slug: "funk-ghost-displacement",   title: "Moving Ghost Notes",         status: "ready" }
        ]},
        { level: 3, title: "Level 3",     lessons: [
          { slug: "funk-new-orleans",          title: "New Orleans Second-Line",    status: "ready" },
          { slug: "funk-displacement",         title: "Beat Displacement",          status: "ready" },
          { slug: "funk-purdie-shuffle",       title: "The Purdie Shuffle",         status: "ready" },
          { slug: "funk-david-garibaldi",      title: "David Garibaldi (Tower)",    status: "ready" },
          { slug: "funk-quarter-pulse",        title: "Sparse Quarter-Note Funk",   status: "ready" }
        ]},
        { level: 4, title: "Level 4",       lessons: [
          { slug: "funk-d-angelo",             title: "D'Angelo Time-Feel",         status: "ready" },
          { slug: "funk-modern-neo-soul",      title: "Modern Neo-Soul",            status: "ready" },
          { slug: "funk-questlove",            title: "Questlove Time-Feel",        status: "ready" },
          { slug: "funk-vinnie-funk",          title: "Vinnie's Funk Drumming",     status: "ready" },
          { slug: "funk-modern-r-and-b",       title: "Modern R&B Production",      status: "ready" }
        ]}
      ]
    },
    {
      slug: "latin",
      title: "Latin & Afro-Cuban",
      tagline: "Clave is the law",
      description: "A vast tradition with deep folkloric roots. Each rhythm carries cultural weight; learning these means learning their context.",
      icon: "✦",
      levels: [
        { level: 1, title: "Level 1",     lessons: [
          { slug: "latin-bossa-nova",       title: "Bossa Nova",                status: "ready" },
          { slug: "latin-clave-intro",      title: "Understanding Clave",       status: "ready" },
          { slug: "latin-samba-feel",       title: "Samba on the Kit",          status: "ready" },
          { slug: "latin-cha-cha",          title: "Cha-Cha-Cha",               status: "ready" },
          { slug: "latin-mambo-intro",      title: "Mambo — First Steps",       status: "ready" }
        ]},
        { level: 2, title: "Level 2", lessons: [
          { slug: "latin-songo",            title: "Songo",                     status: "ready" },
          { slug: "latin-mozambique",       title: "Mozambique",                status: "ready" },
          { slug: "latin-merengue",         title: "Merengue",                  status: "ready" },
          { slug: "latin-cumbia",           title: "Cumbia",                    status: "ready" },
          { slug: "latin-cascara",          title: "Cáscara on the Kit",        status: "ready" }
        ]},
        { level: 3, title: "Level 3",     lessons: [
          { slug: "latin-rumba",            title: "Rumba",                     status: "ready" },
          { slug: "latin-6-8-afro-cuban",   title: "6/8 Afro-Cuban",            status: "ready" },
          { slug: "latin-bembe",            title: "Bembé Bell Pattern",        status: "ready" },
          { slug: "latin-guaguanco",        title: "Guaguancó",                 status: "ready" },
          { slug: "latin-comparsa",         title: "Comparsa",                  status: "ready" }
        ]},
        { level: 4, title: "Level 4",       lessons: [
          { slug: "latin-folkloric",        title: "Folkloric Integration",     status: "ready" },
          { slug: "latin-modern-hybrid",    title: "Modern Hybrid Approaches",  status: "ready" },
          { slug: "latin-bata-rhythms",     title: "Batá Rhythms on the Kit",   status: "ready" },
          { slug: "latin-iyesa",            title: "Iyesá",                     status: "ready" },
          { slug: "latin-yoruba",           title: "Yoruba Ceremonial Rhythms", status: "ready" }
        ]}
      ]
    },
    {
      slug: "jazz-fusion",
      title: "Jazz Fusion",
      tagline: "Where complexity meets groove",
      description: "The Weckl, Vinnie, Steve Smith vocabulary. Borrows from jazz, funk, and rock and demands the technical precision of all three.",
      icon: "✸",
      featured: true,
      levels: [
        { level: 1, title: "Level 1",     lessons: [
          { slug: "fusion-coordination-foundation", title: "Jazz Coordination Foundation", status: "ready" },
          { slug: "fusion-six-stroke-roll",         title: "The Six-Stroke Roll",          status: "ready" },
          { slug: "fusion-half-time-shuffle",       title: "Half-Time Shuffle",            status: "ready" },
          { slug: "fusion-linear-basics",           title: "Linear Playing — First Steps", status: "ready" },
          { slug: "fusion-jazz-rock",               title: "Jazz-Rock Crossover",          status: "ready" }
        ]},
        { level: 2, title: "Level 2", lessons: [
          { slug: "fusion-odd-meters",      title: "Odd Meters: 5/4 and 7/8",   status: "ready" },
          { slug: "fusion-linear-vocab",    title: "Linear Vocabulary",         status: "ready" },
          { slug: "fusion-displacement",    title: "Displaced Grooves",         status: "ready" },
          { slug: "fusion-sixteenth",       title: "Sixteenth-Based Fusion",    status: "ready" },
          { slug: "fusion-broken-time",     title: "Broken-Time Fusion",        status: "ready" }
        ]},
        { level: 3, title: "Level 3",     lessons: [
          { slug: "fusion-polyrhythms",         title: "Polyrhythmic Grooves",       status: "ready" },
          { slug: "fusion-soloing",             title: "Fusion Soloing Vocabulary",  status: "ready" },
          { slug: "fusion-superimposition",     title: "Metric Superimposition",     status: "ready" },
          { slug: "fusion-clave-fusion",        title: "Clave-Influenced Fusion",    status: "ready" },
          { slug: "fusion-tony-williams-fusion", title: "Tony Williams Lifetime Style", status: "ready" }
        ]},
        { level: 4, title: "Level 4",       lessons: [
          { slug: "fusion-metric-modulation", title: "Metric Modulation",                 status: "ready" },
          { slug: "fusion-modern-fusion",     title: "Modern Fusion (Guiliana, Nilles)",  status: "ready" },
          { slug: "fusion-prog-fusion",       title: "Prog Fusion (Liquid Tension)",      status: "ready" },
          { slug: "fusion-electronic-fusion", title: "Electronic Fusion",                 status: "ready" },
          { slug: "fusion-mahavishnu",        title: "Mahavishnu Orchestra Style",        status: "ready" }
        ]}
      ]
    },
    {
      slug: "metal",
      title: "Metal",
      tagline: "Speed, power, and architecture",
      description: "Endurance, double bass technique, and rhythmic architecture pushed to their limits. The genre that rewards relentless practice.",
      icon: "▼",
      levels: [
        { level: 1, title: "Level 1",     lessons: [
          { slug: "metal-double-bass-basics", title: "Double Bass Basics",         status: "ready" },
          { slug: "metal-power-grooves",      title: "Power Grooves",              status: "ready" },
          { slug: "metal-headbang",           title: "Headbanger Grooves",         status: "ready" },
          { slug: "metal-quarter-bass",       title: "Quarter-Note Double Bass",   status: "ready" },
          { slug: "metal-eighth-bass",        title: "Eighth-Note Double Bass",    status: "ready" }
        ]},
        { level: 2, title: "Level 2", lessons: [
          { slug: "metal-blast-beats",      title: "Blast Beats",                  status: "ready" },
          { slug: "metal-prog-metal",       title: "Prog Metal Time Feels",        status: "ready" },
          { slug: "metal-d-beat",           title: "D-Beat",                       status: "ready" },
          { slug: "metal-thrash",           title: "Thrash Patterns",              status: "ready" },
          { slug: "metal-groove-metal",     title: "Groove Metal (Pantera-style)", status: "ready" }
        ]},
        { level: 3, title: "Level 3",     lessons: [
          { slug: "metal-extreme",          title: "Extreme Metal Vocabulary",     status: "ready" },
          { slug: "metal-gravity-rolls",    title: "Gravity Rolls",                status: "ready" },
          { slug: "metal-bomb-blasts",      title: "Bomb Blasts",                  status: "ready" },
          { slug: "metal-hyperblasts",      title: "Hyper-Blast Beats",            status: "ready" },
          { slug: "metal-djent",            title: "Djent & Polyrhythmic Grooves", status: "ready" }
        ]},
        { level: 4, title: "Level 4",       lessons: [
          { slug: "metal-tech-death",         title: "Tech-Death Concepts",        status: "ready" },
          { slug: "metal-polymeters",         title: "Complex Polymeters",         status: "ready" },
          { slug: "metal-metric-modulation",  title: "Metric Modulation in Metal", status: "ready" },
          { slug: "metal-mathcore",           title: "Mathcore Concepts",          status: "ready" },
          { slug: "metal-gospel-chops",       title: "Gospel Chops in Metal",      status: "ready" }
        ]}
      ]
    },
    {
      slug: "hip-hop",
      title: "Hip-Hop & R&B",
      tagline: "Programmed feel, played live",
      description: "Translating drum-machine vocabulary to acoustic kit. Late-and-loose feels, J Dilla's slipped time, modern trap on the kit.",
      icon: "◆",
      levels: [
        { level: 1, title: "Level 1",     lessons: [
          { slug: "hiphop-boom-bap",          title: "Boom-Bap",                   status: "ready" },
          { slug: "hiphop-pocket-time",       title: "Pocket Time-Feel",           status: "ready" },
          { slug: "hiphop-classic",           title: "Classic Hip-Hop Drumming",   status: "ready" },
          { slug: "hiphop-r-and-b-basic",     title: "R&B Basics",                 status: "ready" },
          { slug: "hiphop-quiet-storm",       title: "Quiet Storm Style",          status: "ready" }
        ]},
        { level: 2, title: "Level 2", lessons: [
          { slug: "hiphop-trap",              title: "Trap on the Kit",            status: "ready" },
          { slug: "hiphop-neo-soul",          title: "Neo-Soul Feel",              status: "ready" },
          { slug: "hiphop-modern-r-and-b",    title: "Modern R&B",                 status: "ready" },
          { slug: "hiphop-southern",          title: "Southern Rap Drumming",      status: "ready" },
          { slug: "hiphop-questlove",         title: "Questlove Time-Feel",        status: "ready" }
        ]},
        { level: 3, title: "Level 3",     lessons: [
          { slug: "hiphop-studio-translation", title: "Studio Drums to Live Kit",  status: "ready" },
          { slug: "hiphop-displacement",       title: "Programmed Displacement",   status: "ready" },
          { slug: "hiphop-808-translation",    title: "808 Patterns on the Kit",   status: "ready" },
          { slug: "hiphop-chris-dave",         title: "Chris Dave Concepts",       status: "ready" },
          { slug: "hiphop-anderson-paak",      title: "Anderson .Paak Style",      status: "ready" }
        ]},
        { level: 4, title: "Level 4",       lessons: [
          { slug: "hiphop-j-dilla",            title: "J Dilla Time-Feel",         status: "ready" },
          { slug: "hiphop-modern-production",  title: "Modern Production Feel",    status: "ready" },
          { slug: "hiphop-sampling",           title: "Drumming Around Samples",   status: "ready" },
          { slug: "hiphop-louis-cole",         title: "Louis Cole Drumming",       status: "ready" },
          { slug: "hiphop-future-r-and-b",     title: "Future R&B",                status: "ready" }
        ]}
      ]
    }
  ],

  generalistPath: {
    title: "The Generalist Path",
    tagline: "Breadth before depth — vocabulary from every genre",
    description: "A curated meta-trail for drummers who want versatility over specialization. At each level, you pick up canonical vocabulary from across the tracks, in an order that respects prerequisites (rock 8ths before funk 16ths, backbeat before swing, basic clave before 6/8 Afro-Cuban). Each waypoint links to a lesson that lives in its track — this is navigation, not new content.",
    levels: [
      { level: 1, title: "Level 1", waypoints: [
        { track: "rock-pop", slug: "rock-eighth-grooves" },
        { track: "funk",     slug: "funk-ghost-notes" },
        { track: "hip-hop",  slug: "hiphop-boom-bap" },
        { track: "jazz",     slug: "jazz-ride-pattern" },
        { track: "latin",    slug: "latin-bossa-nova" },
        { track: "metal",    slug: "metal-double-bass-basics" }
      ]},
      { level: 2, title: "Level 2", waypoints: [
        { track: "rock-pop",    slug: "rock-sixteenth-hats" },
        { track: "funk",        slug: "funk-james-brown" },
        { track: "hip-hop",     slug: "hiphop-trap" },
        { track: "jazz",        slug: "jazz-comping-basics" },
        { track: "latin",       slug: "latin-songo" },
        { track: "metal",       slug: "metal-blast-beats" },
        { track: "jazz-fusion", slug: "fusion-odd-meters" }
      ]},
      { level: 3, title: "Level 3", waypoints: [
        { track: "rock-pop",    slug: "rock-half-time" },
        { track: "funk",        slug: "funk-displacement" },
        { track: "hip-hop",     slug: "hiphop-studio-translation" },
        { track: "jazz",        slug: "jazz-bop-vocabulary" },
        { track: "latin",       slug: "latin-6-8-afro-cuban" },
        { track: "metal",       slug: "metal-extreme" },
        { track: "jazz-fusion", slug: "fusion-polyrhythms" }
      ]},
      { level: 4, title: "Level 4", waypoints: [
        { track: "rock-pop",    slug: "rock-prog" },
        { track: "funk",        slug: "funk-d-angelo" },
        { track: "hip-hop",     slug: "hiphop-j-dilla" },
        { track: "jazz",        slug: "jazz-post-bop" },
        { track: "latin",       slug: "latin-folkloric" },
        { track: "metal",       slug: "metal-polymeters" },
        { track: "jazz-fusion", slug: "fusion-metric-modulation" }
      ]}
    ]
  },

  mastery: {
    title: "Other Topics",
    tagline: "Skills that don't fit any single track",
    description: "These topics aren't bound to one genre — they're where techniques across the tracks converge. Polyrhythms, odd meters, soloing, brushwork, four-way independence, reading complex charts. Pick one when it's relevant to what you're working on.",
    lessons: [
      { slug: "polyrhythms-3-2",        title: "Polyrhythms: 3 over 2",          status: "ready" },
      { slug: "polyrhythms-5-4",        title: "Polyrhythms: 5 over 4",          status: "ready" },
      { slug: "odd-meters-9-8",         title: "Odd Meters Beyond 7",            status: "ready" },
      { slug: "soloing-improvisation",  title: "Soloing & Improvisation",        status: "ready" },
      { slug: "brushes-mastery",        title: "Brushes Mastery",                status: "ready" },
      { slug: "four-way-independence",  title: "Four-Way Independence",          status: "ready" },
      { slug: "reading-complex-charts", title: "Reading Complex Charts",         status: "ready" },
      { slug: "solo-drumming",          title: "Solo Drumming as Composition",   status: "ready" },
      { slug: "transcription-method",   title: "Transcribing from Recordings",   status: "ready" },
      { slug: "practice-systems",       title: "Designing Your Practice",        status: "ready" },
      { slug: "accompaniment",          title: "The Art of Accompaniment",       status: "ready" },
      { slug: "clave-as-feel",          title: "Clave as Feel (Beyond Latin)",   status: "ready" }
    ]
  }
};
