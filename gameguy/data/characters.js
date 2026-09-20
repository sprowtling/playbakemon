/* ============================================================
   CHARACTERS — the sprite sheets people are drawn from.
   ============================================================
   Each sheet in art/characters/ is a grid of 32x32 cells:
     4 columns   the walk cycle. Columns 1 and 3 are the stepping
                 frames; columns 0 and 2 are standing.
     3 rows      row 0 faces DOWN, row 1 faces RIGHT, row 2 faces UP.
   There is no left-facing row. Left is the right row flipped over,
   which the game does while drawing, so it costs no extra art.

   The drawing itself is drawPerson() in js/world.js.

   TO USE A SHEET: add it here with a name of your choosing, then put
       sprite: 'that_name'
   on a person in data/npcs.js (or on PLAYER_SPRITE in data/config.js).
   Anyone with no `sprite` is still drawn as the old blocky person from
   their four `look` colours, so you can convert people one at a time.

   ROW_FOR / COLS / etc. describe the LAYOUT. If you buy a pack laid out
   differently, give that sheet its own `layout` here rather than editing
   the engine:  { file, cols: 6, rows: 4, rowFor: { down: 0, up: 1, ... } }

   THESE ASSIGNMENTS ARE PLACEHOLDERS. Swap the names around freely —
   nothing else in the game cares which sheet a person uses.
   ============================================================ */

const CHARACTER_LAYOUT = {
  cols: 4,                                     // frames per direction
  rowFor: { down: 0, right: 1, up: 2, left: 1 },
  flip: { left: true },                        // draw the right-facing row mirrored
  fps: 6,                                      // walk animation speed
  standFrame: 0,                               // the frame shown when standing still
  // The art sits low in its cell (feet near the bottom), which is what makes
  // a character line up with the tile they're standing on.
  offsetY: 4,                                  // nudge every character down by this many pixels
};

const CHARACTERS = {
  // name        file (in art/characters/)          who it is right now
  kid:          { file: 'character01-Sheet.png' },  // the player
  megan:        { file: 'character05-Sheet.png' },
  dock_kid:     { file: 'character10-Sheet.png' },
  shopkeep:     { file: 'character02-Sheet.png' },
  baker:        { file: 'character09-Sheet.png' },
  keeper:       { file: 'character08-Sheet.png' },
  sailor:       { file: 'character03-Sheet.png' },
  finds_keeper: { file: 'character04-Sheet.png' },
  spare1:       { file: 'character06-Sheet.png' },  // not used by anyone yet
  spare2:       { file: 'character07-Sheet.png' },
};
