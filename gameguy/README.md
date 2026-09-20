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
  battle-rules.js     knobs for the card game: deck size, bench size, points, my ASSUMED rulings
  moves.js            what each card's text DOES, as data. The vocabulary is explained at the top.
  opponents.js        who you can play against: their deck, how sloppy they are, what they say
  goods.js            things for the backpack (tools, finds, bait) and what tools DO (dig, fish)
  characters.js       which sprite sheet each person is drawn from
  cards.js            GENERATED from the playmat database. Don't hand-edit.
js/                 THE ENGINE, which reads the data
  state.js            what the game remembers; time; conditions; saving
  world.js            maps, collision, who is where, drawing the world, the validator
  ui.js               dialogue, menus, HUD, fades, cards, collection and pack screens
  actions.js          what happens when you press E
  battle.js           the rules of the card game. No drawing, no keys: pure rules.
  battle-ai.js        how everyone who isn't you plays
  battle-ui.js        the table on screen, the deck editor, and the glue to the island
  main.js             keyboard, the update loop, title and pause menus
art/
  tileset.png         THE spritesheet. 256x256: 8 cells across, 8 down, 32x32 each.
                      This is the file you edit.
  tileset-guide.png   the same sheet blown up 3x with labels stamped on. REFERENCE ONLY —
                      editing this does nothing. Its checked background is painted on,
                      not transparency.
  items.png           a second sheet, for backpack items. Same 32x32 cells.
  items-guide.png     ...and its labelled guide.
characters/           one sprite sheet per person. 32x32 cells, 4 walk frames x 3 directions.
tools/
  export-cards.html   re-exports cards.js from the playmat database
  regenerate-tileset.html   redraws tileset.png and its guide from code. Only useful if
                      you'd rather tweak a placeholder's code than paint over it.
```

Every data file starts with a comment explaining its vocabulary. Read those first; this
README only points at them.

## Keys

Arrows / WASD walk. **E** talk, choose, confirm. **F** use a tool (a small "F  Dig" label appears
when one would work where you're standing). **C** collection. **I** backpack. **Esc** menu, or back.
In the deck editor: **E** add a copy, **X** take one out, **F** reset to "everything I own".

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
8. **`data/characters.js`**: swap two of the file names and see who becomes whom.
9. Press **0** in game to see what's solid and where your feet actually are.

## Recipes

**A new tile.** Paint it into an empty cell of `art/tileset.png` (cells [5,7], [6,7] and
[7,7] are free) → name the cell in `SPRITES` → give it a letter in a legend → type the
letter into a map. (Details at the top of `tiles.js`.)

Editing the sheet: open `art/tileset.png` in any pixel editor — Piskel and Photopea are
free and run in a browser; Aseprite is the usual paid one. Set the grid to 32x32, turn off
anti-aliasing, and export as PNG **with transparency**. A tile with `under:` in its legend
is drawn on top of another tile, so its empty space must be see-through; a tile without
`under:` covers its whole cell. When you run out of cells, make the PNG taller — 256x288
adds a row — and keep the width at 256.

**Stairs.** The stair tiles are only a picture; nothing in the game knows about floors.
To make them go somewhere, make them a `place` with a `to`, exactly like a door, and put
the upstairs room in `MAPS` as its own map. There's a worked example at the top of
`data/tiles.js`, and a live one: the `D` tile in Home leads to the Tile Demo room.

**A new room.** Copy the `bakery` map in `maps.js`, rename it, redraw it. Give it an `x` place
whose `to` points back outside. Put a door letter on the island with a `to` pointing in.
The red box tells you if either end lands in a wall.

**A new person.** Copy an entry in `npcs.js`. Change the id, name, `sprite`, `home`.
Everything else is optional. To change who looks like whom, swap the file names around in
`data/characters.js` — nothing else refers to them. Anyone with no `sprite` falls back to
the old blocky person built from their four `look` colours, so half-converted is fine.

**Trades that change over time.** Give the person a `pool` of offers, say how many to `show`
at once, and how often to `refresh` ('day' or 'week'). Make the pool longer for more variety.
The full explanation is at the top of `data/npcs.js`; Megan, the Dockside Kid and the sailor
are all set up this way already.

**Something new to carry.** Add it to `GOODS` in `data/goods.js`. Give it a `sell` price and
Island Finds will buy it. To sell it IN a shop, add `{ item: 'its_id', price: 3 }` to that
shop's `products` in `data/shops.js`.

**Something new to find.** Add a line to a `finds` table in `data/goods.js`. A bigger `weight`
means it turns up more often.

**A new tool.** Add the tool to `GOODS` with `tool: true`, then add an entry to `ACTIVITIES`
saying which map letters it works on. A net that works on bushes (`on: ['u'], where: 'facing'`)
and finds bugs would need no engine changes at all.

**A new job.** Copy an entry in `jobs.js`, then add its id to `job:` on an NPC or a place.

**A story beat.** Add an entry to `EVENTS` in `story.js`. Set a flag at the end of it with
`set: ['something_happened']`, then use `if: 'flag:something_happened'` anywhere else: in a
line of dialogue, a door's `openIf`, a job's `availableIf`, a person's `presentIf`.

**New cards on the playmat.** Open `tools/export-cards.html` (needs internet), press the
button, replace `data/cards.js`.

**A bigger island.** Add rows or columns to a quadrant and the neighbour sharing that side,
or add a fifth map and attach it with `edges`. (Details at the top of `maps.js`.)


## The card game

Talk to Megan, the Dockside Kid, the sailor, or sit at a shop table, and choose **Play cards**.
You need a legal deck first: at least 10 cards, at least one basic, at most 3 of any card.
Build it at your desk or from the Esc menu. Press 3 (debug) a few times for free packs.

The engine follows the rules page on the playmat site. Where that page is silent, I made a
ruling and put it in `data/battle-rules.js` marked ASSUMED: one retreat per turn, the first
player may attack on turn one, evolving clears statuses, and you lose if your active is
knocked out with an empty bench. Bench size (3) and the ten energy types come from the
playmat's own code. A cost of "normal" means "any energy", since there is no normal energy.

**How it was tested.** Because the rules engine draws nothing, two AIs can play each other
at full speed. Every change was followed by thousands of such matches with random decks,
checking at each turn that no card had appeared or vanished and no HP was impossible, plus a
"chaos" run where both sides take random legal actions so that every wired effect gets used.
That's how the Bill loop was found (an empty deck reshuffled Bill, drew it, played it,
forever). The worked example on the rules page (Whave takes 50 from Spark Gust) is one of the
fixed checks. None of that proves each card does what YOU meant; it proves nothing crashes and
the books balance. Reading `data/moves.js` against your intent is the real review.

**Adding an opponent.** Copy an entry in `data/opponents.js`, then put `battle: 'their_id'`
on an NPC or a place.

**Wiring a card's effect.** Find or add its entry in `data/moves.js` and describe the effect
with the ops listed at the top of that file. If no existing op fits, that's an engine job:
one new `if` in `runOps()` in `js/battle.js`.

**Matches aren't saved.** SHORTCUT: closing the tab mid-match abandons it, with no penalty.

### Coverage: 112 of 125 card effects are wired

Cards with no effect text just do their damage and aren't counted here. In the deck editor
and at the table, a card with an unwired or simplified effect says so under its picture.

Not wired yet (13). Attacks among these do their printed damage and skip the effect;
the two items can't be played:
- Jeremo♀, Twinship: free swap with Jeremo♂ at any time
- Miremalkin, Lurk: store the damage just received, deal double next turn
- Kotora, Powdered Snow: no move in the set can freeze yet, so there is nothing to boost
- Yukitora, Hailstorm: a lasting weather effect that cancels elemental effects
- Yukitora, Cursed Wind: depends on Hailstorm. Does its 50 damage only.
- Thundazolt, Heat Lightning: fire and electric energy interchangeable everywhere
- Mugini, Black Tongue: delayed hit on a declared target. Does its 80 damage immediately instead.
- Petrazoa, Cling: skip attacking and energy to avoid all damage for a turn
- Metalzoa, Trample: grows by 20 with each consecutive use. Does its 50 only.
- Kafkazoa, Plate Armor: builds defence for each turn it declines to attack
- Gambarue, Rascal: steal the target's equipped item on a coin flip. Does its 10 damage only.
- Humidifier (item): every attack gains +1 water energy
- Notepad (item): copy and later use an opponent's move

Simplified (14):
- Sparkeet, Chain Lightning: assumed once per turn
- Shadopillar, Shuffle: not during setup
- Draquaduct, Quake: damage goes to the bench instead of the active
- Draquaduct, Hydrosurge: "discard Draquaduct at any time" is not offered
- Chipik, Preen: assumed once per turn
- Murkitty, Shed Skin: assumed once per turn
- Glumwyrm, Taunt: does not wear off after 50 damage
- Envelawn, Curl: always 10; does not build up with repeated use
- Necrozoa, Hungry Ghost: takes 10 damage whenever energy is attached
- Octovox, Secret Frequency: the opponent's drawn card is not shown
- Mace to the Face (item): every attack against the wearer needs a coin flip, not just the next one
- Sleeping Bag (item): heals whenever asleep, whoever caused it
- Floppy Disk (item): moves ALL the energy, not "as much as you like"
- Moira (item): the five discards are chosen at random

## What's real, what's a stub, what's a shortcut

Working and tested: walking, four connected quadrants, three interiors, doors with opening
hours, the clock and sky, sleeping, collapsing at 10pm, money, shift and delivery jobs, the
shop with weekly restock and overnight sales, pack opening with real card art, the collection
screen, fixed trades, NPC schedules, the visiting sailor and his boat, flags, events,
save / continue, the validator, card matches against an AI, the deck editor, rotating trades,
the backpack, Island Finds (buying tools, selling finds), digging and fishing.

**Stubs** (search the code for `STUB`):
- The `minigame` job type. It behaves as a shift.
- Digging and fishing are dice rolls. Fishing wants to be a small timing game one day.
- The Net Shed, the old signpost in the woods, the lighthouse door: places with nothing behind them yet.
- The `starter` pack exists but no shop sells it.
- No sound. No touch controls.
- The Tile Demo room off Home exists only to show the placeholder tiles. Delete the `demo`
  map and the `D` place in Home when you don't need it.

**Shortcuts** (search for `SHORTCUT`; each says when it will start to hurt):
- No idle or standing-still animation: characters only move while walking.
- People don't walk. They're simply elsewhere next time you enter a map.
- Fishing loot goes by MAP, not by which water: the north coast of The Woods gives pond fish.
- In "any water type" trades the game picks which of your cards goes; you don't choose.
- Rarity is guessed from evolution stage, because the database has no rarity column.
- The collection grid uses drawn stand-ins; real art loads only for the large view.
- A work shift can run past bedtime.
- Changing the *shape* of the save means bumping `SAVE_VERSION`, which abandons old saves.

**Placeholder writing.** Every line of dialogue I added is a stand-in, and so are the names
"Shopkeep", "Lighthouse Keeper", "Sailor", "Dockside Kid", and the word "coins". Your original
lines are kept word for word.
