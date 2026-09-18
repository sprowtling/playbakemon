/* ============================================================
   MAPS — every place you can walk around in.
   ============================================================
   A map is a list of strings. Each character is one tile.
   What a character LOOKS like comes from the map's legend
   (data/tiles.js). What it DOES, if anything, comes from the
   map's own `places` table, right underneath the drawing.

   Each map has:
     title    shown for a moment when you arrive
     legend   'outdoor' or 'indoor'
     edge     the letter the world is "made of" past the map's border
     edges    (optional) which map you walk into off each side
     tiles    the drawing
     places   letters that do something when you face them and press E
     props    (optional) extra sprites that only appear sometimes

   THE ISLAND IS FOUR MAPS: north-west, north-east, south-west,
   south-east. Each is 40 x 30 tiles. Walk off the east side of one
   and you arrive on the west side of its neighbour, at the same
   height. For that to feel right, two rules:
     - neighbouring maps must be the same size along the side they share
     - whatever is at the very edge of one map should continue on the
       very edge of the next (a path in column 39 of the west map meets
       a path in column 0 of the east map, on the same row)
   The game checks the first rule when it starts and tells you if it's
   broken. The second one is on you, and it's only cosmetic.

   TO MAKE THE ISLAND BIGGER: add rows or columns to a quadrant (and to
   the neighbour sharing that side), or add a fifth map and hook it up
   through `edges`. Nothing else needs to change.

   WHAT A PLACE CAN DO (mix and match):
     name        shown in the little "E  Name" prompt
     line        one line of dialogue            lines: ['several', 'pages']
     talk        dialogue that depends on conditions (see data/npcs.js)
     to          { map, col, row, facing }  a door
     openIf      conditions for the door to open     closedLine: what you see otherwise
     talkTo      'npc_id'   pressing E here talks to that NPC (for counters)
     job / shop / trade     see data/jobs.js, data/shops.js, data/npcs.js
     action      'sleep' | 'collection' | 'battle' | 'save'
     sprite, under          what the tile looks like (a sprite NAME from tiles.js,
                            and a legend LETTER to draw beneath it)
     walkOn      true  → triggers by stepping on it instead of pressing E,
                          and doesn't block. (For cave mouths, doormats...)
   Places always block movement unless walkOn is true.
   ============================================================ */

const MAPS = {

  // ------------------------------------------------ NORTH-WEST
  island_nw: {
    title: 'The Woods',
    legend: 'outdoor',
    edge: '~',
    edges: { east: 'island_ne', south: 'island_sw' },
    tiles: [
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~s',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~sssssssssssss',
      '~~~~~~~~~~~~~~~~~~~~~~~~~sssssssT..TT...',
      '~~~~~~~~~~~~~~~~~~~~~~~~ssss.......T....',
      '~~~~~~~~~~~~~~~~~~~~~~~sssT...S...T.TTT.',
      '~~~~~~~~~~~~~~~~~~~~~~sss..............T',
      '~~~~~~~~~~~~~~~~~~~~~sss.T.......T....T.',
      '~~~~~~~~~~~~~~~~~~~~sssTTTT......T.....T',
      '~~~~~~~~~~~~~~~~~~~sss........TTT....u..',
      '~~~~~~~~~~~~~~~~~ssss...^^^^......,,,,,,',
      '~~~~~~~~~~~~~~sssss.....####..T...,,,,,,',
      '~~~~~~~~~~~~~sssTTT...T.#Mo#...T..,,....',
      '~~~~~~~~~~~sssTT...TT....,....TT..,,T...',
      '~~~~~~~~~~~ss.T.TTT...,,,,,,,,,,,,,,..T.',
      '~~~~~~~~~~sss...TTT.T.,,,,,,,,,,,,,....T',
      '~~~~~~~~~~ss.u.T..T...,,............TTT.',
      '~~~~~~~~~~~s.....TTT..,,.TTT...T...T.T..',
      '~~~~~~~~~~~ssrT.u.T..u,,...Tsssssss.....',
      '~~~~~~~~~~~ssT.T..T...,,.r..s~~~~~sTTT..',
      '~~~~~~~~~~~~ssTT.....T,,T..s~~~~~~~s..T.',
      '~~~~~~~~~~~~~s..T.Tr..,,...Ts~~~~~sT..rT',
      '~~~~~~~~~~~~~ss.T.T.TT,,T...sssssss...uT',
      '~~~~~~~~~~~~~~ssTTT.T.,,..T..T.uTT....TT',
      '~~~~~~~~~~~~~~ssT...T.,,.....T.T...TTTT.',
      '~~~~~~~~~~~~~~ssTTT...,,Tu.TuT..TT...TT.'
    ],
    places: {
      M: { name: "Megan's House", sprite: 'door', under: '#',
           talk: [
             { if: 'hour>=17', lines: ["Mrs. Kori opens the door a crack. \"Megan's eating, love. Tomorrow.\""] },
             { lines: ["Your best friend's house. Mrs. Kori says Megan's not home right now."] },
           ] },
      // PLACEHOLDER: something for the clearing. A secret, a meeting spot, a story beat.
      S: { name: 'Old Signpost', sprite: 'sign', under: '.',
           line: "The paint wore off years ago. Someone has scratched a tiny Bakemon into the wood." },
    },
  },

  // ------------------------------------------------ NORTH-EAST
  island_ne: {
    title: 'Lighthouse Point',
    legend: 'outdoor',
    edge: '~',
    edges: { west: 'island_nw', south: 'island_se' },
    tiles: [
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~sssssss~~~~~~~~~~',
      'ssssssssss~~~~~~~~~~~ssss..rssss~~~~~~~~',
      'ssss.T.sssss~~~~~~~sss.T.T..i.Tsss~~~~~~',
      '..T.......ss~~~~~~sss....TT.j...sss~~~~~',
      '.......T...ss~~~~~ss......r.j....ss~~~~~',
      '....r.......ss~~~ss.........L.r.T.ss~~~~',
      '.TT...TT.u.T.s~~~ss.........,,..russ~~~~',
      '.............s~~~ss..TT.....,,....ss~~~~',
      '.............ss~~ss.......T.,,....ss~~~~',
      '........T..T..s~~ss.........,,....ss~~~~',
      ',,,,,,,,,,,,,,,,==,,,,,,,,,,,,...ss~~~~~',
      ',,,,,,,,,,,,,,,,==,,,,,,,,,,,...sss~~~~~',
      '.........T..T..sssss,,.......r.sss~~~~~~',
      'r.T.........u.T..sss,,sss...ssss~~~~~~~~',
      '.............T.T....,,ssssssss~~~~~~~~~~',
      '...T.....T.r.TT.....,,...sss~~~~~~~~~~~~',
      'u......T.....T..T...,,....sss~~~~~~~~~~~',
      'T...................,,.TT..sss~~~~~~~~~~',
      '..Tu................,,u.....sss~~~~~~~~~',
      '......r.r...........,,.......sss~~~~~~~~',
      '.....u.........T....,,......T.sss~~~~~~~',
      '.......T............,,.........sss~~~~~~',
      '..T.....T..........u,,......T...sss~~~~~',
      '..................T.,,..TT......rsss~~~~',
      '.........u....T...p.,,.......u....sss~~~',
      '..............T.....,,..T...r......ss~~~'
    ],
    places: {
      L: { name: 'Lighthouse', sprite: 'door', under: 'j',
           line: "The old lighthouse. Kids aren't supposed to play in here." },
      p: { name: 'Signpost', sprite: 'sign', under: '.',
           line: "NORTH: Lighthouse.   SOUTH: Harbour." },
    },
  },

  // ------------------------------------------------ SOUTH-WEST
  island_sw: {
    title: 'Town',
    legend: 'outdoor',
    edge: '~',
    edges: { north: 'island_nw', east: 'island_se' },
    tiles: [
      '~~~~~~~~~~~~~~ss......,,....u...........',
      '~~~~~~~~~~~~~ss.......,,p.....u.........',
      '~~~~~~~~~~~~ss........,,.........r......',
      '~~~~~~~~~~~~ss........,,.r...u.T........',
      '~~~~~~~~~~~ss.........,,................',
      '~~~~~~~~~~~ss.....^^^^^,u...^^^^........',
      '~~~~~~~~~~sss.....#####,....####........',
      '~~~~~~~~~~sss.....#oGo#,....#Ho#........',
      '~~~~~~~~~~sss.,,,,,,,,,,,,,,,,,,,,,,,,..',
      '~~~~~~~~~~~ss.,,,,,,,,,,,,,,,,,,,,,,,,..',
      '~~~~~~~~~~~ss.,,...........T........,,q.',
      '~~~~~~~~~~~sss,,...........T........,,..',
      '~~~~~~~~~~~~^^^^^...................,,,,',
      '~~~~~~~~~~~~#####....u......T.......,,,,',
      '~~~~~~~~~~~~#oBo#..u........T...........',
      '~~~~~~~~~~~~ss,,,,,,,..T................',
      '~~~~~~~~~~~~ss,,,,,,,....T..........TT..',
      '~~~~~~~~~~~~~ss..Tr........u............',
      '~~~~~~~~~~~~~ss...T.....r...............',
      '~~~~~~~~~~~~~sss.............r.........T',
      '~~~~~~~~~~~~~~sss..T...r.....u.ssssss...',
      '~~~~~~~~~~~~~~ssss...T.....sssssssssssss',
      '~~~~~~~~~~~~~~~~ssssssssssss~~~~~~~~~~ss',
      '~~~~~~~~~~~~~~~~~~ssssss~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
    ],
    places: {
      G: { name: 'Tidepool Games', sprite: 'door', under: '#',
           to: { map: 'shop', col: 6, row: 7, facing: 'up' },
           // The shop being CLOSED matters as much as it being open.
           openIf: ['hour>=9', 'hour<18', '!day:Sun'],
           closedLine: "CLOSED. The sign in the window says: Mon to Sat, 9 till 6. You press your nose to the glass anyway." },
      H: { name: 'Home', sprite: 'door', under: '#',
           to: { map: 'home', col: 4, row: 4, facing: 'up' } },
      B: { name: 'Bakery', sprite: 'door', under: '#',
           to: { map: 'bakery', col: 4, row: 4, facing: 'up' },
           openIf: ['hour<15'],
           closedLine: "The bakery's dark. Mrs. Oyo starts before sunrise and is done by mid-afternoon." },
      p: { name: 'Signpost', sprite: 'sign', under: '.', line: "NORTH: The Woods." },
      q: { name: 'Signpost', sprite: 'sign', under: '.', line: "EAST: Harbour." },
    },
  },

  // ------------------------------------------------ SOUTH-EAST
  island_se: {
    title: 'Harbour',
    legend: 'outdoor',
    edge: '~',
    edges: { north: 'island_ne', west: 'island_sw' },
    tiles: [
      '.........T..T.......,,.....T.......sss~~',
      '.......u............,,.T...........sss~~',
      '.TT........TT.......,,............Tsss~~',
      '...T...T........T...,,............Tsss~~',
      '..........u..T....Tu,,....u.....u..ss~~~',
      '...T.........T......,,.....T...T..ss~~~~',
      '..........T.........,,..........sss~~~~~',
      '....................,,u.......ssss~~~~~~',
      '....................,,......ssss~~~~~~~~',
      '.....T..............,,....ssss~~~~~~~~~~',
      '..........^^^.......,,...sss~~~~~~~~~~~~',
      '........T.#F#.T.....,,..sss~~~~~~~~~~~~~',
      ',,,,,,,,,,,,,,,,,,,,,,..ss~~~~~~~~~~~~~~',
      ',,,,,,,,,,,,,,,,,,,,,...ss~~~~~~~~~~~~~~',
      '................,,.u...ss~~~~~~~~~~~~~~~',
      '..T.............,,.r.T.ss~~~~~~~~~~~~~~~',
      '....T....r......,,....ss~~~~~~~~~~~~~~~~',
      '....r...........,,...sss~~~~~~~~~~~~~~~~',
      '................,,sssss~~~~~~~~~~~~~~~~~',
      'T..........sssss,,sss~~~~~~~~~~~~~~~~~~~',
      '........ssssss~~==~~~~~~~~~~~~~~~~~~~~~~',
      'T....sssss~~~~~~==~~~~~~~~~~~~~~~~~~~~~~',
      'sssssss~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
    ],
    places: {
      // PLACEHOLDER building. Nobody lives here yet.
      F: { name: 'Net Shed', sprite: 'door', under: '#',
           line: "Locked. It smells like rope and old salt." },
    },
    // Props are sprites laid over the map that come and go.
    // The boat is only here when the sailor is (see data/npcs.js).
    props: [
      { sprite: 'boat_l', col: 18, row: 23, showIf: 'day:Tue,Sat', solid: true },
      { sprite: 'boat_r', col: 19, row: 23, showIf: 'day:Tue,Sat', solid: true },
    ],
  },

  // ------------------------------------------------ INTERIORS
  // Interiors are smaller than the screen, so the camera centres them
  // and the dark border makes them feel enclosed.

  shop: {
    title: 'Tidepool Games',
    legend: 'indoor',
    edge: '#',
    tiles: [
      '#############',
      '#hh_______hh#',
      '#+++++k+++++#',
      '#___________#',
      '#_tt_____cc_w',
      '#_tt________w',
      '#___________#',
      '#_____r_____#',
      '######x######',
    ],
    places: {
      x: { name: 'Outside', sprite: 'exit_mat', to: { map: 'island_sw', col: 20, row: 8, facing: 'down' } },
      // The shopkeep stands BEHIND the counter where you can't reach,
      // so the counter tile in front of them passes the conversation on.
      k: { name: 'Counter', sprite: 'counter', under: '_', talkTo: 'shopkeep' },
      c: { name: 'Display', line: "Card sleeves, dice, a dusty binder. Nothing you can afford." },
      t: { name: 'Table', action: 'battle' },
      w: { name: 'Window', line: "It's a nice day outside." },
    },
  },

  home: {
    title: 'Home',
    legend: 'indoor',
    edge: '#',
    tiles: [
      '#########',
      '#b_____d#',
      'w_______#',
      '#___r___#',
      '#_______#',
      '####x####',
    ],
    places: {
      x: { name: 'Outside', sprite: 'exit_mat', to: { map: 'island_sw', col: 29, row: 8, facing: 'down' } },
      b: { name: 'Your bed', action: 'sleep' },
      d: { name: 'Your desk', action: 'collection' },
      w: { name: 'Window', line: "You can see the shop's roof from here. And the sea past it." },
    },
  },

  bakery: {
    title: 'Bakery',
    legend: 'indoor',
    edge: '#',
    tiles: [
      '#########',
      '#vv___hh#',
      '#++k++++#',
      '#_______w',
      '#_______#',
      '####x####',
    ],
    places: {
      x: { name: 'Outside', sprite: 'exit_mat', to: { map: 'island_sw', col: 14, row: 15, facing: 'down' } },
      k: { name: 'Counter', sprite: 'counter', under: '_', talkTo: 'oyo' },
      w: { name: 'Window', line: "Flour on the glass. The sea beyond it." },
    },
  },

};
