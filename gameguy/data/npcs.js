/* ============================================================
   NPCS — the people on the island.
   ============================================================
   ALL DIALOGUE IN THIS FILE IS PLACEHOLDER. It's here so every
   system has something to show. The voices are yours to write.

   An NPC has:
     name
     look       colours for the little procedural person:
                { skin, hair, shirt, legs }
                SHORTCUT: people are drawn by code, not from the
                spritesheet. It means a new person costs you four
                colours and no art, but they all share one body.
                When you want real character sprites, that's a job
                for js/world.js → drawPerson().
     home       { map, col, row, facing }  where they stand by default
     schedule   (optional) a list of { if, map, col, row, facing }.
                The FIRST entry whose `if` is true wins; if none are,
                they're at `home`.
                SHORTCUT: people don't walk between spots. They're
                simply somewhere else the next time you enter a map.
                Nobody moves while you're watching.
     presentIf  (optional) conditions for them to be on the island at all
     talk       a list of { if, lines, once, set, give }.
                The FIRST entry whose `if` is true is what they say.
                  once: true       only ever said one time
                  set:  ['flag']   flags to switch on afterwards
                  give: { money: 2 }  or  { card: '004' }
                Put specific entries at the top, the everyday one last.
     job        a job id, or a list of them          (data/jobs.js)
     shop       a shop id                            (data/shops.js)
     battle     an opponent id                       (data/opponents.js)
     trade      { offers: [ { give, want } ] }
                  give   the card id they hand over
                  want   a card id, OR { type: 'water' }, OR { rarity: 'rare' }
                  once   false → can be repeated (default: each offer once)

   CONDITIONS are explained in data/story.js.
   ============================================================ */

const NPCS = {

  shopkeep: {
    name: 'Shopkeep',
    look: { skin: '#B68E6B', hair: '#5a4a3a', shirt: '#2f6b62', legs: '#3a3a44' },
    home: { map: 'shop', col: 6, row: 1, facing: 'down' },
    talk: [
      { if: ['day:Thu', '!flag:saw_first_restock'], once: true, set: ['saw_first_restock'],
        lines: ["\"There you are. Boat came in at six. Fresh box, still taped.\""] },
      { if: 'day:Wed', lines: ["\"Tomorrow. You know it's tomorrow. Go outside.\""] },
      { lines: ["\"Packs come in on the boat Thursday. Same as always.\""] },
    ],
    shop: 'tidepool',
    job: 'sweep_shop',
  },

  oyo: {
    name: 'Mrs. Oyo',
    look: { skin: '#8a5a3c', hair: '#d8d4cc', shirt: '#e8e0d0', legs: '#7a5a50' },
    home: { map: 'bakery', col: 3, row: 1, facing: 'down' },
    talk: [
      { if: '!flag:met_oyo', once: true, set: ['met_oyo'],
        lines: ["\"Ah! Small hands. Good for shaping rolls. You want to earn something?\""] },
      { lines: ["\"Mind the trays, they're hot.\""] },
    ],
    job: ['bakery_shift', 'lighthouse_delivery'],
  },

  keeper: {
    name: 'Lighthouse Keeper',          // PLACEHOLDER name
    look: { skin: '#c49a78', hair: '#9aa0a8', shirt: '#3a4a6a', legs: '#2a2a34' },
    home: { map: 'island_ne', col: 27, row: 10, facing: 'down' },
    talk: [
      { lines: ["\"Wind's turning. You can smell it before you can see it.\""] },
    ],
  },

  megan: {
    name: 'Megan',
    look: { skin: '#e0b48c', hair: '#a8482a', shirt: '#e8c44a', legs: '#5a7a4a' },
    home: { map: 'island_se', col: 14, row: 19, facing: 'down' },     // the beach by the dock
    schedule: [
      { if: ['hour>=12', 'hour<17', '!day:Sun'], map: 'shop', col: 4, row: 4, facing: 'left' },
    ],
    presentIf: 'hour<17',        // after five she's home for dinner (see her door in maps.js)
    talk: [
      { if: '!flag:met_megan', once: true, set: ['met_megan'],
        lines: ["\"There you are! I've been up since six looking for crabs.\"",
                "\"Got any doubles? I've got doubles.\""] },
      { if: 'cards>=20', lines: ["\"Twenty?! Okay, you have to show me the binder.\""] },
      { lines: ["\"Thursday can't come fast enough.\""] },
    ],
    trade: {
      offers: [
        { give: '004', want: { type: 'normal' } },
        { give: '040', want: '025' },
      ],
    },
    battle: 'megan',
  },

  // PLACEHOLDER: the first of "the handful of other kids". Rename, rewrite, move.
  kid1: {
    name: 'Dockside Kid',
    look: { skin: '#6a4a36', hair: '#1e1a18', shirt: '#c8504a', legs: '#3a4a6a' },
    home: { map: 'island_sw', col: 25, row: 10, facing: 'down' },
    talk: [
      { lines: ["\"I only collect fire types. Everything else is boring.\""] },
    ],
    trade: {
      offers: [
        { give: '017', want: { type: 'water' } },
      ],
    },
    battle: 'kid1',
  },

  // Only on the island when his boat is. The boat itself is a `prop`
  // on the island_se map with the same condition.
  sailor: {
    name: 'Sailor',                     // PLACEHOLDER name
    look: { skin: '#a87a58', hair: '#2a2a2a', shirt: '#f0ece2', legs: '#2f4a6a' },
    home: { map: 'island_se', col: 17, row: 23, facing: 'right' },
    presentIf: 'day:Tue,Sat',
    talk: [
      { if: '!flag:met_sailor', once: true, set: ['met_sailor'],
        lines: ["He's counting something in his palm. Not coins. Cards.",
                "\"Different ports, different printings, kid. Want to see?\""] },
      { lines: ["\"Tide's at four. I'm gone by then.\""] },
    ],
    // STUB: the sailor's offers should change each visit. For now they're fixed.
    trade: {
      offers: [
        { give: '061', want: { rarity: 'uncommon' } },
        { give: '037', want: { rarity: 'rare' } },
      ],
    },
    job: 'unload_boat',
    battle: 'sailor',
  },

};
