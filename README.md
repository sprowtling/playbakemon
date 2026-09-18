# Bakemon Island

Double-click `index.html`. That's the whole setup. No install, no build step, no server.
To share it, upload the folder to GitHub Pages like the playmat.

## Where things are

```
index.html          the page. Loads everything below, in order.
data/               THE PART YOU EDIT
  config.js           every tweakable number: speed, zoom, day length, sky colours, starting cards
  tiles.js            sprite names, and what each map letter looks like (outdoor / indoor legends)
  maps.js             the four island quadrants and the interiors, drawn in letters
  npcs.js             people: colours, where they stand, what they say, what they trade
  jobs.js             ways to earn money
  shops.js            shops, packs, rarity
  story.js            flags, conditions, events. The conditions cheat-sheet lives at the top.
  cards.js            GENERATED from the playmat database. Don't hand-edit.
js/                 THE ENGINE, which reads the data
  state.js            what the game remembers; time; conditions; saving
  world.js            maps, collision, who is where, drawing the world, the validator
  ui.js               dialogue, menus, HUD, fades, cards, collection and pack screens
  actions.js          what happens when you press E
  main.js             keyboard, the update loop, title and pause menus
art/
  tileset.png         the spritesheet. 32x32 cells. Paint over anything.
  tileset-guide.png   the same sheet, enlarged and labelled. For reference only.
tools/
  export-cards.html   re-exports cards.js from the playmat database
```

Every data file starts with a comment explaining its vocabulary. Read those first; this
README only points at them.

## The red box

When the page loads, the game reads all the data and looks for hand-editing mistakes: a map row
one character short, a door to a map that doesn't exist, a misspelled job id, a condition it
doesn't understand. Problems appear in a red box above the game, in plain words. If something
you added isn't showing up, look there first. Then open the browser console (F12) for anything
the red box didn't catch.

## First experiments

Each of these is one small edit, then save and refresh. `DEBUG` keys (listed under the game
window) let you skip time and grant money so you don't have to wait to see results.

1. **`data/config.js`**: change `ZOOM` to 3. Change `SPEED` to 200. Change
   `GAME_MINUTES_PER_SECOND` to 20 and watch a day go by, sky and all.
2. **`data/config.js`**: in `SKY_TINT`, change the 18:00 colour to `'255,80,160'`. Pink sunsets.
3. **`data/maps.js`**: in the `home` map, type a `h` (shelf) somewhere along the top wall's floor
   row. Then type a `Z`. Refresh and read the red box.
4. **`data/maps.js`**: delete one character from any island row. Read the red box. Put it back.
5. **`data/npcs.js`**: change Megan's `shirt` colour. Give her a new `talk` entry at the top of
   her list with `if: 'day:Tue'`. Press 4 in game until it's Tuesday.
6. **`data/shops.js`**: set `otherKidsBuy` to 0, or `restockDay` to `'Mon'`. Change the odds of a
   rare. Press 3 in game for free packs and watch what comes out.
7. **`art/tileset.png`**: open it in your image editor and scribble on the tree. Save, refresh.
8. Press **0** in game to see what's solid and where your feet actually are.

## Recipes

**A new tile.** Paint it in an empty cell of `tileset.png` → name the cell in `SPRITES` →
give it a letter in a legend → type the letter into a map. (Details at the top of `tiles.js`.)

**A new room.** Copy the `bakery` map in `maps.js`, rename it, redraw it. Give it an `x` place
whose `to` points back outside. Put a door letter on the island with a `to` pointing in.
The red box tells you if either end lands in a wall.

**A new person.** Copy an entry in `npcs.js`. Change the id, name, colours, `home`.
Everything else is optional.

**A new job.** Copy an entry in `jobs.js`, then add its id to `job:` on an NPC or a place.

**A story beat.** Add an entry to `EVENTS` in `story.js`. Set a flag at the end of it with
`set: ['something_happened']`, then use `if: 'flag:something_happened'` anywhere else: in a
line of dialogue, a door's `openIf`, a job's `availableIf`, a person's `presentIf`.

**New cards on the playmat.** Open `tools/export-cards.html` (needs internet), press the
button, replace `data/cards.js`.

**A bigger island.** Add rows or columns to a quadrant and the neighbour sharing that side,
or add a fifth map and attach it with `edges`. (Details at the top of `maps.js`.)

## What's real, what's a stub, what's a shortcut

Working and tested: walking, four connected quadrants, three interiors, doors with opening
hours, the clock and sky, sleeping, collapsing at 10pm, money, shift and delivery jobs, the
shop with weekly restock and overnight sales, pack opening with real card art, the collection
screen, fixed trades, NPC schedules, the visiting sailor and his boat, flags, events,
save / continue, the validator.

**Stubs** (search the code for `STUB`):
- Battles. The shop tables just link to the playmat.
- The `minigame` job type. It behaves as a shift.
- The sailor's trades don't change between visits.
- The Net Shed, the old signpost in the woods, the lighthouse door: places with nothing behind them yet.
- The `starter` pack exists but no shop sells it.
- No sound. No touch controls.

**Shortcuts** (search for `SHORTCUT`; each says when it will start to hurt):
- People are drawn by code from four colours, not from the spritesheet.
- People don't walk. They're simply elsewhere next time you enter a map.
- In "any water type" trades the game picks which of your cards goes; you don't choose.
- Rarity is guessed from evolution stage, because the database has no rarity column.
- The collection grid uses drawn stand-ins; real art loads only for the large view.
- A work shift can run past bedtime.
- Changing the *shape* of the save means bumping `SAVE_VERSION`, which abandons old saves.

**Placeholder writing.** Every line of dialogue I added is a stand-in, and so are the names
"Shopkeep", "Lighthouse Keeper", "Sailor", "Dockside Kid", and the word "coins". Your original
lines are kept word for word.
