/* ============================================================
   NPCS — the people on the island.
   ============================================================
   ALL DIALOGUE IN THIS FILE IS PLACEHOLDER. It's here so every
   system has something to show. The voices are yours to write.

   An NPC has:
     name
     sprite     which sheet they're drawn from (data/characters.js).
                Leave it out and they're a blocky person built from `look`.
     look       colours for the blocky person, used when there's no sprite:
                { skin, hair, shirt, legs }
                Every blocky person shares one body, so `look` only
                changes their colours. Characters with a `sprite` don't
                use it at all.
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
     trade      { offers: [...], pool: [...], show: 2, refresh: 'week' }
                An offer is { give, want }:
                  give   the card id they hand over
                  want   a card id, OR { type: 'water' }, OR { rarity: 'rare' }
                `offers` are ALWAYS available, each one once ever
                  (add  once: false  to an offer to make it repeatable).
                `pool` is a bigger list they ROTATE through. Only `show` of them
                  are on offer at a time, and which ones changes every `refresh`:
                    'day'    a fresh pick every morning (right for the sailor: he's
                             only here some days, so every visit looks different)
                    'week'   a fresh pick every Monday
                  Each pool offer can be taken once per appearance. If the same
                  offer comes round again weeks later, it's available again.
                  The pick is random but FIXED for that day or week: leaving and
                  coming back, or reloading the page, shows the same offers.
                Use either list, or both. To give someone more variety, just
                make their pool longer.

   CONDITIONS are explained in data/story.js.
   ============================================================ */

const NPCS = {


  // Your mom. She's strict, but she loves you. She works part time in the pub.
  mom: {
    name: 'Mom',
    look: { skin: '#635040', hair: '#BACFA3', shirt: '#5D7A42', legs: '#5F427A' },
    home: { map: 'home_downstairs', col: 3, row: 4, facing: 'right' },
    talk: [
      { lines: ["\"Placeholder Lines.\""] },
        ],
      },
  
  
  // Your dad. He works on the sea. He's only home once a week. He tries to bring you back presents whenever he's home.
  dad: {
    name: 'Dad',
    look: { skin: '#BFAC9C', hair: '#C26A30', shirt: '#96BCE3', legs: '#E3E396' },
    home: { map: 'home_downstairs', col: 13, row: 5, facing: 'left' },
    talk: [
        { lines: ["\"Placeholder Lines.\""] },
          ],
      },
  


  // Tate runs the game shop. You can't really figure out how old he is. Maybe around your dad's age. He doesn't seem to like kids that much.
  shopkeep: {
    name: 'Tate',
    sprite: 'shopkeep',
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


  // Ruiha Oyo, a nice old lady who always smells like bread. She lives with her husband Nikau above the bakery.
  oyo: {
    name: 'Mrs. Oyo',
    sprite: 'baker',
    look: { skin: '#8a5a3c', hair: '#d8d4cc', shirt: '#e8e0d0', legs: '#7a5a50' },
    home: { map: 'bakery', col: 3, row: 1, facing: 'down' },
    talk: [
      { if: '!flag:met_oyo', once: true, set: ['met_oyo'],
        lines: ["\"Ah! Small hands. Good for shaping rolls. You want to earn something?\""] },
      { lines: ["\"Mind the trays, they're hot.\""] },
    ],
    job: ['bakery_shift', 'lighthouse_delivery'],
  },


  // Nikau Oyo, an old man who acts grumpy sometimes, but he doesn't really mean it. Lives with his wife Ruiha above the bakery.
  keeper: {
    name: 'Mr. Oyo',          
    sprite: 'keeper',
    look: { skin: '#c49a78', hair: '#9aa0a8', shirt: '#3a4a6a', legs: '#2a2a34' },
    home: { map: 'island_ne', col: 27, row: 10, facing: 'down' },
    talk: [
      { lines: ["\"Wind's turning. You can smell it before you can see it.\""] },
    ],
    job: ['pick_weeds'],
  },


  // Island kid, and your best friend. She's the same age as you; your birthdays are only 4 days apart. Her mother is in the VNPC.
  megan: {
    name: 'Megan',
    sprite: 'megan',
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
        { give: '004', want: { type: 'normal' } },      // always there, once: your first-ever trade
      ],
      pool: [
        { give: '040', want: '025' },
        { give: '061', want: { type: 'grass' } },
        { give: '030', want: { type: 'fire' } },
        { give: '005', want: { rarity: 'uncommon' } },
        { give: '032', want: { type: 'water' } },
      ],
      show: 2, refresh: 'week',
    },
    battle: 'megan',
  },

  megans_mom: {
    name: '',
    sprite: '',
    look: { skin: '', hair: '', shirt: '', legs: '' },
    home: { map: 'island_se', col: 18, row: 1, facing: 'right' },
    talk: [
      { lines: ["\"Placeholder Lines.\""] },
        ],
      },
  

  // Island Kid. They're younger than you and live next door with their older brother, Liass. Their dad works on the mainland and sends money to them.
  rolepa: {
    name: 'Rolepa',
    sprite: 'dock_kid',
    look: { skin: '#6a4a36', hair: '#1e1a18', shirt: '#c8504a', legs: '#3a4a6a' },
    home: { map: 'island_sw', col: 23, row: 17, facing: 'down' },
    talk: [
      { lines: ["\"I only collect fire types. Everything else is boring.\""] },
    ],
    trade: {
      pool: [
        { give: { rarity: 'common' }, want: { type: 'fire' } },
        { give: { rarity: 'uncommon' }, want: { type: 'fire' } },
        { give: { rarity: 'common' }, want: { type: 'fire' } },
        { give: { rarity: 'common' }, want: { type: 'fire' } },
      ],
      show: 1, refresh: 'day',
    },
    battle: 'rolepa',
  },

  // Ropela's older brother, a teenager. Your mom helps look after them. Wants to test into a homestay in Wilpena, resents Rolepa for keeping him here.
  liass: {
    name: '',
    look: { skin: '', hair: '', shirt: '', legs: '' },
    home: { map: 'island_ne', col: 25, row: 27, facing: 'right' },
    talk: [
      { lines: ["\"Placeholder Lines.\""] },
        ],
      },
  

  // Payu calls herself a retired adventurer. Island Finds is open when she feels like being open. Sometimes she leaves the island for days at a time. She doesn't seem to have any family.
  finds_keeper: {
    name: 'Payu',
    sprite: 'finds_keeper',
    look: { skin: '#d8a880', hair: '#c8c0b0', shirt: '#7a5a8a', legs: '#4a4a3a' },
    home: { map: 'finds', col: 4, row: 1, facing: 'down' },
    talk: [
      { if: '!flag:met_finds', once: true, set: ['met_finds'],
        lines: ["\"Anything the tide leaves, I'll buy. Anything you need to go get it, I'll sell.\""] },
      { if: 'item:pearl', lines: ["Her eyes go straight to your pocket. \"Is that what I think it is?\""] },
      { lines: ["\"Low tide's the time for digging. Not that I'm telling you anything.\""] },
    ],
    shop: 'island_finds',
  },


  // Sailor on a ship that comes in twice a week with food from Waipoeroa. You and Megan have pestered him so much, he's become sort of like a big brother to you.
  // The boat itself is a `prop`
  sailor: {
    name: 'Laut',                     
    sprite: 'sailor',
    look: { skin: '#a87a58', hair: '#2a2a2a', shirt: '#f0ece2', legs: '#2f4a6a' },
    home: { map: 'island_se', col: 17, row: 23, facing: 'right' },
    presentIf: 'day:Tue,Sat',
    talk: [
      { if: '!flag:met_sailor', once: true, set: ['met_sailor'],
        lines: ["He's counting something in his palm. Not coins. Cards.",
                "\"Different ports, different printings, kid. Want to see?\""] },
      { lines: ["\"Tide's at four. I'm gone by then.\""] },
    ],
    // He's only on the island Tuesdays and Saturdays, so refreshing every 'day'
    // means every visit brings a different pair of offers.
    trade: {
      pool: [
        { give: { rarity: 'uncommon' }, want: { rarity: 'uncommon' } },
        { give: '030', want: { rarity: 'rare' } },
        { give: '046', want: { type: 'dark' } },
        { give: '035', want: { rarity: 'uncommon' } },
        { give: '016', want: { type: 'psychic' } },
        { give: '063', want: { rarity: 'rare' } },
        { give: '021', want: { type: 'steel' } },
      ],
      show: 1, refresh: 'day',
    },
    job: 'unload_boat',
    battle: 'sailor',
  },
};
