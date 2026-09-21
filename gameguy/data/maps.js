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
     battle      'opponent_id'  a card match (data/opponents.js)
     action      'sleep' | 'desk' | 'collection' | 'deck' | 'playmat' | 'save'
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
      '~~~~~s~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~sssss~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~ss..ss~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~s.rr.ss~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~ssrT..ss~~~~~~~~~~~~~~~~~~~~~~~~~~~~~s',
      '~~~s...rss~~~~~~~~~~~~~~~~~sssssssssssss',
      '~~~~s.sss~~~~~~~~~~~~~~~~sssssss.TT.....',
      '~~~~~ssss~~~~~~~~~~~~~~~ssss....TTT..TT.',
      '~~~~~~ss~~~~~~~~~~~~~~~sss....TT.T..TT..',
      '~~~~~~~~~~~~~~~~~~~~~~sss...TTTTT...T.T.',
      '~~~~~~~~~~~~~~~~~~~~~sss...TTT.TTT......',
      '~~~~~~~~~~~~~~~~~~~~sss.................',
      '~~~~~~~~~~~~~~~~~~~sss....^^^^^^^.....S.',
      '~~~~~~~~~~~~~~~~~ssss..TT.#######..,,,,,',
      '~~~~~~~~~~~~~~sssss...TT..#o#o#o#.,,,,,,',
      '~~~~~~~~~~~~~sss...T......####R##.,,....',
      '~~~~~~~~~~~sss...TTTT.........,...,,.T..',
      '~~~~~~~~~~~ss.....TT...,,,,,,,,,,,,,..T.',
      '~~~~~~~~~~sss.T.......,,,,,,,,,,,,,..T..',
      '~~~~~~~~~~ss.T..^^^^..,,..TT...T....TTT.',
      '~~~~~~~~~~~s....####..,,.TTTT...T....TTT',
      '~~~~~~~~~~~ss.^^#o#o..,,...Tsssssss.T.T.',
      '~~~~~~~~~~~ss.######..,,.T.ssPPPPPss....',
      '~~~~~~~~~~~~ss#oo#M#..,,TT.sPPPPPPPss...',
      '~~~~~~~~~~~~~sueeu,,,,,,...ssPPPPPPPs...',
      '~~~~~~~~~~~~~ss.......,,...TssPPPPPPsTT.',
      '~~~~~~~~~~~~~~ss.T....,,.....sPPPPPPsT..',
      '~~~~~~~~~~~~~~ss..TT..,,...TTTTsTTssTTT.',
      '~~~~~~~~~~~~~~ss.TTT..,,....TTTTTTTTT...',
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
      R: { name: 'Recycling Center', sprite: 'door', under: '#',
           to: { map: 'recycling_center', col: 4, row: 4, facing: 'up' } },     
    },
  },

  // ------------------------------------------------ NORTH-EAST
  island_ne: {
    title: 'Lighthouse Point',
    legend: 'outdoor',
    edge: '~',
    edges: { west: 'island_nw', south: 'island_se' },
    tiles: [
      '~~~~~~~~~~~~~~~~~~~~~~~~~~I~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~J~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~J~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~J~~~~~~~~~~~~~',
      '~~ssssss~~~~~~~~~~~~~~~sssLsss~~~~~~~~~~',
      'ssssssssss~~~~~~~~~~~ssss.,.ssss~~~~~~~~',
      'ssss...sssss~~~~~~~sss....,...Tsss~~~~~~',
      '..........ss~~~~~~sss.....,.....sss~~~~~',
      '...........ss~~~~~ss......,......ss~~~~~',
      '...,,,,,,,,,,,===,,,,,,,,,,...ffT.ss~~~~',
      '...,.^^^^^^..s~~~ss.......,..ueervss~~~~',
      '..,,.######.Ts~~~ss..TT.T.,...eeevss~~~~',
      '..,,u#oo#o#TTss~~ss...TT..,...fffTss~~~~',
      '..,,.###S##...s~~ss.....T.,.......ss~~~~',
      ',,,,,,yy,yy...s~~ss.......,......ss~~~~~',
      ',,,,,,,,,,,...sssss.......,.....sss~~~~~',
      '..,,....,......ss....,,,,,,..r.sss~~~~~~',
      '..,,..T.,.^^^.....T..,......ssss~~~~~~~~',
      '..,,.TT.,.#o#^^..TTT,,..ssssss~~~~~~~~~~',
      '..,,...u,T#####.TTT.,,.^^^ss~~~~~~~~~~~~',
      '..,,..u.,,#l#oo..uT.,,.###.ss~~~~~~~~~~~',
      '..,,.....,,,,ee,,,,,,,.o#ousss~~~~~~~~~~',
      '..,,................,,.#a#u.sss~~~~~~~~~',
      '..,,.T.^^^..T.^^^...,,......Tsss~~~~~~~~',
      '..,,TT^#o#eTeu#o#^..,,.....TT.sss~~~~~~~',
      '..,,.T####ueTe####..,,.......T.sss~~~~~~',
      '..u,..#oR#yyyy#Ho#..,,...........ss~~~~~',
      '...,,,,,,,,,,,,,,,,,,,...........sss~~~~',
      '..................up,,............sss~~~',
      '....................,,.............ss~~~',
    ],
    places: {
      L: { name: 'Lighthouse', sprite: 'door', under: 'j',
           line: "The old lighthouse. Kids aren't supposed to play in here." },
      p: { name: 'Signpost', sprite: 'sign', under: '.',
           line: "NORTH: Lighthouse.   SOUTH: Harbour." },
      H: { name: 'Home', sprite: 'door', under: '#',
           to: { map: 'home_downstairs', col: 4, row: 4, facing: 'up' } },
      R: { name: "Ropera's House", sprite: 'door', under: '#'},
      l: { name: 'Library', sprite: 'door', under: '#' },
      a: { name: 'Abandoned House', sprite: 'door', under: '#' },
      S: { name: 'School', sprite: 'door', under: '#' },
      
    },
  },

  // ------------------------------------------------ SOUTH-WEST
  island_sw: {
    title: 'Town',
    legend: 'outdoor',
    edge: '~',
    edges: { north: 'island_nw', east: 'island_se' },
    tiles: [
      '~~~~~~~~~~~~~~ss......,,................',
      '~~~~~~~~~~~~~ss.......,,p...............',
      '~~~~~~~~~~~~ss........,,..........^^....',
      '~~~~~~~~~~~~ss.r......,,..........##....',
      '~~~~~~~~~~~ss.r.......,,..........oo....',
      '~~~~~~~~~~~ss...^^^^^.,,..^^^^^..^##....',
      '~~~~~~~~~~sss...#####.,,..#####ee#o#....',
      '~~~~~~~~~~sss...#oGo#u,,T.#oIo#yy#+#....',
      '~~~~~~~~~~sss...,,,,,,,,,,,,,,,,,,,,,T..',
      '~~~~~~~~~~~ss..,,,,,,,,,,,,,,,,,,,,,,,..',
      '~~~~~~~~~~~ss..,,T.....^^^..........,,..',
      '~~~~~~~~~~~sss.,,......###..^^..^^..,,q.',
      '~~~~~~~~~~~~ss.,,.^^^^.#o#.^##.^##^.,,,,',
      '~~~~~~~~~~~~ss.,,.####.###.#oo.##oo.,,,,',
      '~~~~~~~~~~~~ss.,,uoBo#.#+o.#+#.#o+#u,,..',
      '~~~~~~~~~~~~ss.,,,,,,,,,,,,,,,,,,,,,,,..',
      '~~~~~~~~~~~~ss..,,,,,,,,,,,,,,,,,,,,,...',
      '~~~~~~~~~~~~~ss.uu........T.............',
      '~~~~~~~~~~~~~ss............T............',
      '~~~~~~sss~~~~sss......r............r....',
      '~~~~ssssss~~~~sss....r.........ssssssrr.',
      '~~~~ssr.ss~~~~ssss.........sssssssssssss',
      '~~~ss..^^ss~~~~~ssssssssssss~~~~~~~~~~ss',
      '~~~ss.T##ss~~~~~~~ssssss~~~~~~~~~~~~~~~~',
      '~~~ssr.#+ss~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~s..ess~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~sssss~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~ssss~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    ],
    places: {
      G: { name: 'Tidepool Games', sprite: 'door', under: '#',
           to: { map: 'shop', col: 6, row: 7, facing: 'up' },
           // The shop being CLOSED matters as much as it being open.
           openIf: ['hour>=9', 'hour<18', '!day:Sun'],
           closedLine: "CLOSED. The sign in the window says: Mon to Sat, 9 till 6. You press your nose to the glass anyway." },
      B: { name: 'Bakery', sprite: 'door', under: '#',
           to: { map: 'bakery', col: 4, row: 4, facing: 'up' },
           openIf: ['hour<15'],
           closedLine: "The bakery's dark. Mrs. Oyo starts before sunrise and is done by mid-afternoon." },
      I: { name: 'Island Finds', sprite: 'door', under: '#',
           to: { map: 'finds', col: 4, row: 5, facing: 'up' },
           openIf: ['hour>=8', 'hour<19'],
           closedLine: "Island Finds is shut. A hand-written card in the door: BACK AT 8." },
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
      '....................,,.............sss~~',
      '....................,,.............sss~~',
      '....................,,.............sss~~',
      '....................,,.............sss~~',
      '....................,,.............ss~~~',
      '....................,,............ss~~~~',
      '....................,,..........sss~~~~~',
      '....................,,........ssss~~~~~~',
      '.............^^^....,,......ssss~~~~~~~~',
      '...........^^###....,,....ssss~~~~~~~~~~',
      '...........##oo#....,,...sss~~~~~~~~~~~~',
      '...........#B###....,,..sss~~~~~~~~~~~~~',
      ',,,,,,,,,,,,,,,,,,,,,,..ss~~~~~~~~~~~~~~',
      ',,,,,,,,,,,,,,,,,,,,,...ss~~~~~~~~~~~~~~',
      '................,,.....ss~~~~~~~~~~~~~~~',
      '................,,.....ss~~~~~~~~~~~~~~~',
      '................,,....ss~~~~~~~~~~~~~~~~',
      '.......^^^......,,...sss~~~~~~~~~~~~~~~~',
      '.......#F#...sss,,sssss~~~~~~~~~~~~~~~~~',
      '.....ssssssssssss,sss~~~~~~~~~~~~~~~~~~~',
      '..ssssssssssss~~==~~~~~~~~~~~~~~~~~~~~~~',
      'ssssssssss~==~~~==~~~~~~~~~~~~~~~~~~~~~~',
      'sssssss~~~~==~~~==~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~==~~~~~==~~~==~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~==~~~~~==~~~==~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~==~~~~~==~~~==~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~==~~~~~==~~~==~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~==~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~' 
    ],
    places: {
      // PLACEHOLDER building. Nobody lives here yet.
      F: { name: 'Net Shed', sprite: 'door', under: '#',
           line: "Locked. It smells like rope and old salt." },
      B: { name: 'Pub', sprite: 'door', under: '#',
           line: "It's always noisy in there when a ship's docked. Dad says you can go in when you're older." }     
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
      // `notReadyLine` is what you get when your deck isn't legal yet (too few cards).
      t: { name: 'Table', battle: 'shop_regular',
           notReadyLine: "You could play cards with other patrons here... if you had enough cards." },
      w: { name: 'Window', line: "It's a nice day outside." },
    },
  },

  home_downstairs: {
    title: 'Home',
    legend: 'indoor',
    edge: '#',
    tiles: [
      '#####o############',
      '#_fi___#__b___yl_#',
      '#______#_________#',
      'w________________#',
      '#______#_________#',
      '#_____z#______d__#',
      '####x#####w###w###',
    ],
    places: {
      x: { name: 'Outside', sprite: 'exit_mat', to: { map: 'island_nw', col: 29, row: 8, facing: 'down' } },
      z: { name: 'Upstairs', sprite: 'stairs_up', to: { map: 'home_upstairs', col: 6, row: 4 , facing: 'left'} }, 
      b: { name: "Mom & Dad's bed", line: "Mom makes it every morning. She doesn't like when you mess it up." },
      d: { name: "Dad's Desk", line: "When dad is here, he stays up late writing stuff." },
      w: { name: 'Window', line: "You can see the shop's roof from here. And the sea past it." },
        },
    },

  home_upstairs: {
    title: 'Home, upstairs',
    legend: 'indoor',
    edge: '#',
    tiles: [
      '##p######',
      '#_____rb#',
      'w_______#',
      '#d______#',
      '#______z#',
      '#########',
    ],
    places: {
      z: { name: 'Downstairs', sprite: 'stairs_down', to: { map: 'home_downstairs', col: 5, row: 5, facing: 'left' } },
      b: { name: 'Your bed', action: 'sleep' },
      d: { name: 'Your desk', action: 'desk' },
      w: { name: 'Window', line: "You can see the shop's roof from here. And the sea past it." },
         },
       },

  finds: {
    title: 'Island Finds',
    legend: 'indoor',
    edge: '#',
    tiles: [
      '#########',
      '#hh___hh#',
      '#+++k+++#',
      '#_______w',
      '#c_____c#',
      '#_______#',
      '####x####',
    ],
    places: {
      x: { name: 'Outside', sprite: 'exit_mat', to: { map: 'island_sw', col: 35, row: 8, facing: 'down' } },
      k: { name: 'Counter', sprite: 'counter', under: '_', talkTo: 'finds_keeper' },
      c: { name: 'Bins', line: "Fish hooks, string, candles, a jar of buttons. Everything costs a little." },
      w: { name: 'Window', line: "Buckets and nets hung outside, turning in the wind." },
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
      x: { name: 'Outside', sprite: 'exit_mat', to: { map: 'island_sw', col: 20, row: 16, facing: 'down' } },
      k: { name: 'Counter', sprite: 'counter', under: '_', talkTo: 'oyo' },
      w: { name: 'Window', line: "Flour on the glass. The sea beyond it." },
    },
  },
  
  
   recycling_center: {
    title: 'Recycling Center',
    legend: 'indoor',
    edge: '#',
    tiles: [
      '#########',
      '#_______#',
      '#_______#',
      '#_______#',
      '#_______#',
      '#####x###',
    ],
    places: {
      x: { name: 'Outside', sprite: 'exit_mat', to: { map: 'island_nw', col: 31, row: 18, facing: 'down' } },
         },
       },
};
