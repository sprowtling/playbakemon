/* ============================================================
   TILES — what every map letter looks like and whether it blocks.
   ============================================================
   Two tables:

   SPRITES  gives each picture in art/tileset.png a NAME, by saying
            which cell of the sheet it sits in: [column, row],
            counting from 0. Open art/tileset-guide.png to see them
            all labelled.

   LEGENDS  says what a LETTER in a map means. There is one legend
            for outdoors and one for indoors, and each map picks one.
            WHY two: the same letter can then mean different things
            in different kinds of place ('r' is a rock outside and a
            rug inside) without the engine needing to know. The old
            prototype had one global list of solid letters and that
            caused a real bug.

   ABOUT STAIRS: the stair tiles are only a PICTURE. Nothing in the game
   knows about floors. To make stairs actually go somewhere, make them a
   place in that map with a `to`, exactly like a door:
       U: { name: 'Upstairs', sprite: 'stairs_up', under: '_',
            to: { map: 'bedroom', col: 3, row: 5, facing: 'down' } }
   The upstairs room is just another map. Put a matching stairs_down place
   up there pointing back.

   TO ADD A NEW TILE:
     1. Paint it into an empty 32x32 cell of art/tileset.png
        (the spare cells are in the bottom rows).
     2. Give the cell a name in SPRITES.
     3. Add a letter for it to a legend.
     4. Type the letter into a map.
   No engine code involved.
   ============================================================ */

const SPRITES = {
  grass1: [0,0], grass2: [1,0], grass3: [2,0], grass_flowers: [3,0],
  sand1:  [4,0], sand2:  [5,0], path1:  [6,0], path2: [7,0],

  water1: [0,1], water2: [1,1], tree: [2,1], rock: [3,1],
  bush:   [4,1], dock:   [5,1], sign: [6,1], crate: [7,1],

  wall:    [0,2], roof:   [1,2], window_ext: [2,2], door:   [3,2],
  lh_wall: [4,2], lh_top: [5,2], boat_l:     [6,2], boat_r: [7,2],

  floor1:   [0,3], floor2: [1,3], wall_in: [2,3], window_int: [3,3],
  exit_mat: [4,3], rug:    [5,3], counter: [6,3], shelf:      [7,3],

  bed: [0,4], desk: [1,4], table: [2,4], display: [3,4], oven: [4,4],

  // Outdoor decoration
  fence_h: [5,4], fence_v: [6,4], gate:  [7,4],
  steps_stone: [0,5], well: [1,5], barrel: [2,5], lamp_post: [3,5],
  bench: [4,5], flowerbed: [5,5], mailbox: [6,5], hedge: [7,5],

  // Indoor furniture
  stairs_up: [0,6], stairs_down: [1,6], tv: [2,6], fridge: [3,6],
  sofa: [4,6], chair: [5,6], houseplant: [6,6], wardrobe: [7,6],
  sink: [0,7], clock: [1,7], poster: [2,7], floor_lamp: [3,7], box: [4,7],
  // cells [5,7], [6,7] and [7,7] are empty. They're yours.
  
  
  // midcentury_modern_room_door_tiles.png — 32px tiles
  walls_middle_divider: [6,1,'walls'],
  walls_bottom_right_corner: [13,3,'walls'],
  walls_bottom_left_corner: [14,3,'walls'],
  walls_top_right_corner: [13,4,'walls'],
  walls_top_left_corner: [14,4,'walls'],
  walls_bottom_edge: [6,5,'walls'],
  walls_left_edge: [13,5,'walls'],
  walls_top_edge: [6,6,'walls'],
  walls_right_edge: [10,6,'walls'],
  walls_peach_striped_wall: [11,7,'walls'],
  walls_bamboo_tile: [5,8,'walls'],
  walls_peach_striped_border: [12,8,'walls'],
  

  // A third value names a DIFFERENT sheet. These live in art/items.png
  // (labelled in art/items-guide.png). Cells [4,1] to [7,1] there are empty.
  shovel:     [0,0,'items'], rod:      [1,0,'items'], worm:   [2,0,'items'], oyster: [3,0,'items'],
  shell:      [4,0,'items'], fish_small: [5,0,'items'], fish_big: [6,0,'items'], bottle: [7,0,'items'],
  boot:       [0,1,'items'], pearl:    [1,1,'items'], old_coin: [2,1,'items'], dug_hole: [3,1,'items'],
};

// The picture files. To add a sheet: put the PNG in art/, name it here, and use
// that name as the third value of a sprite.
const SHEETS = { tiles: 'art/tileset.png', items: 'art/items.png', walls: 'art/midcentury_modern_room_door_tiles.png' };

/* What a legend entry can say:

     sprite: 'tree'                 one picture
     sprite: ['grass1','grass2']    several; the game picks one per tile,
                                    always the same one for the same spot,
                                    so the ground doesn't look stamped
     frames: ['water1','water2']    animation, played in a loop
     fps:    1.5                    ...at this many frames per second
     under:  '.'                    draw this OTHER letter first, underneath.
                                    This is how a tree stands on grass: the
                                    tree picture has a see-through background.
     solid:  true                   you can't walk through it
     size:   [2, 1]                 the object is bigger than one tile — see below
     color:  '#4c9a44'              used ONLY if the picture is missing, so a
                                    half-finished tile still shows up as a
                                    coloured square with its letter on it

   THINGS BIGGER THAN ONE TILE
   ---------------------------
   Bought art is full of furniture drawn two tiles wide or three tall. Say so
   with `size: [across, down]`, and the sprite's [column, row] becomes the
   TOP-LEFT corner of a block that big in the sheet. For instance the boat in
   this sheet is really boat_l and boat_r side by side, so it could be one
   2 x 1 object:

       'L': { sprite: 'boat_l', under: '~', size: [2,1], solid: true }

   In a map you then type that letter ONCE, at the object's top-left corner,
   and leave ordinary floor in the tiles it covers — the object is painted
   over them afterwards. Those covered tiles block you if the object is solid,
   and facing any of them counts as facing the object, so a wide counter still
   passes you to the shopkeep.

   `size` and `solid` are separate: a 2 x 2 rug is big AND walkable.
   A quarter turn swaps an object's width and height, so `rotations` on a
   non-square one only really makes sense at 180. The red box says so.

   tools/sheet_importer.html finds these sizes for you: drop a sheet in and it
   spots which pictures run across several cells and writes the `size` out.
*/
const LEGENDS = {

  outdoor: {
    '~': { frames: ['water1','water2'], fps: 1.5, solid: true, color: '#245e82' },
    // Listing a name more than once makes it more common. One tile in ten has flowers.
    '.': { sprite: ['grass1','grass2','grass3','grass1','grass2','grass3','grass1','grass2','grass3','grass_flowers'], color: '#4c9a44' },
    's': { sprite: ['sand1','sand2'], color: '#dcc08c' },
    ',': { sprite: ['path1','path2'], color: '#bea884' },
    '=': { sprite: 'dock', under: '~', color: '#8a7150' },
    'T': { sprite: 'tree', under: '.', solid: true, color: '#2f6b35' },
    'r': { sprite: 'rock', under: '.', solid: true, color: '#8a9498' },
    'u': { sprite: 'bush', under: '.', solid: true, color: '#3f8442' },
    '#': { sprite: 'wall',       solid: true, color: '#e8e0d0' },
    '^': { sprite: 'roof',       solid: true, color: '#7a8aa5' },
    'o': { sprite: 'window_ext', solid: true, color: '#a8dce8' },
    'i': { sprite: 'lh_top',  under: '.', solid: true, color: '#c8504a' },
    'I': { sprite: 'lh_top',  under: '~', solid: true, color: '#c8504a' },
    'j': { sprite: 'lh_wall', under: 's', solid: true, color: '#f0ece2' },
    'J': { sprite: 'lh_wall', under: '~', solid: true, color: '#f0ece2' },
    'c': { sprite: 'crate',   under: ',', solid: true, color: '#9a7a50' },
    'P': { sprite: ['water1', 'water2'], fps: 0.09, solid: true, color: '#4B8C94' },

    // Decoration. All placeholders: repaint the cells in art/tileset.png.
    'f': { sprite: 'fence_h',   under: '.', solid: true, color: '#9a7a50' },   // fence running east-west
    'v': { sprite: 'fence_v',   under: '.', solid: true, color: '#9a7a50' },   // ...and north-south
    'g': { sprite: 'gate',      under: ',', color: '#b8966a' },                // walkable: a gap in the fence
    'k': { sprite: 'steps_stone', under: '.', color: '#9aa4aa' },              // walkable. See the note below about stairs.
    'w': { sprite: 'well',      under: '.', solid: true, color: '#8a9498' },
    'b': { sprite: 'barrel',    under: ',', solid: true, color: '#8a6444' },
    'l': { sprite: 'lamp_post', under: ',', solid: true, color: '#3a4450' },
    'n': { sprite: 'bench',     under: '.', solid: true, color: '#8a6444' },
    'e': { sprite: 'flowerbed', under: '.', solid: true, color: '#6b4a32' },
    'm': { sprite: 'mailbox',   under: '.', solid: true, color: '#4a6a8a' },
    'y': { sprite: 'hedge',     under: '.', solid: true, color: '#35703a' },
  },

  indoor: {
    '#': { sprite: 'wall_in', solid: true, color: '#cdbfa6' },
    '_': { sprite: ['floor1','floor2'], color: '#ac8961' },
    'r': { sprite: 'rug',        under: '_', color: '#8a6a82' },            // walkable
    'w': { sprite: 'window_int', solid: true, color: '#80c8e0' },
    '+': { sprite: 'counter', under: '_', solid: true, color: '#6f4f34' },
    'h': { sprite: 'shelf',   under: '_', solid: true, color: '#5a4030' },
    'b': { sprite: 'bed',     under: '_', solid: true, color: '#7090b0' },
    'd': { sprite: 'desk',    under: '_', solid: true, color: '#6f4f34' },
    't': { sprite: 'table',   under: '_', solid: true, color: '#7a5a3c' },
    'c': { sprite: 'display', under: '_', solid: true, color: '#a8dce8' },
    'v': { sprite: 'oven',    under: '_', solid: true, color: '#8a5a48' },

    // Furniture. All placeholders.
    'u': { sprite: 'stairs_up',   under: '_', solid: true, color: '#cdbfa6' },   // see the note below
    'n': { sprite: 'stairs_down', under: '_', solid: true, color: '#6a5a44' },
    'y': { sprite: 'tv',         under: '_', solid: true, color: '#2a2a32' },
    'f': { sprite: 'fridge',     under: '_', solid: true, color: '#dfe4e6' },
    's': { sprite: 'sofa',       under: '_', solid: true, color: '#4a6a8a' },
    'a': { sprite: 'chair',      under: '_', solid: true, color: '#7a5a3c' },
    'l': { sprite: 'houseplant', under: '_', solid: true, color: '#3f8442' },
    'q': { sprite: 'wardrobe',   under: '_', solid: true, color: '#6b4a32' },
    'i': { sprite: 'sink',       under: '_', solid: true, color: '#cdbfa6' },
    'o': { sprite: 'clock',      under: '#', solid: true, color: '#f0ece2' },    // on a wall
    'p': { sprite: 'poster',     under: '#', solid: true, color: '#e8d8a0' },    // on a wall
    'm': { sprite: 'floor_lamp', under: '_', solid: true, color: '#e8d8a0' },
    'g': { sprite: 'box',        under: '_', solid: true, color: '#b8966a' },

    // From art/midcentury_modern_room_door_tiles.png (the 'walls' sheet).
    // Gold trim: thin lines on a see-through cell, drawn over the floor.
    'A': { sprite: 'walls_middle_divider',      under: '_', solid: true },
    'C': { sprite: 'walls_bottom_right_corner', under: '_', solid: true },
    'D': { sprite: 'walls_bottom_left_corner',  under: '_', solid: true },
    'E': { sprite: 'walls_top_right_corner',    under: '_', solid: true },
    'K': { sprite: 'walls_top_left_corner',     under: '_', solid: true },
    'N': { sprite: 'walls_bottom_edge',         under: '_', solid: true },
    'O': { sprite: 'walls_left_edge',           under: '_', solid: true },
    'Q': { sprite: 'walls_top_edge',            under: '_', solid: true },
    'U': { sprite: 'walls_right_edge',          under: '_', solid: true },
    // Wall faces fill their whole cell and you can't walk through them.
    'V': { sprite: 'walls_peach_striped_wall',   solid: true },
    'X': { sprite: 'walls_peach_striped_border', solid: true },
    // A floor: walkable.
    'W': { sprite: 'walls_bamboo_tile' },
  },

};
