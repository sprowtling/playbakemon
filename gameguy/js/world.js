/* ============================================================
   WORLD — maps, collision, people, and drawing the world.
   ============================================================
   Two coordinate systems are in play, and mixing them up is the
   classic bug:
     WORLD pixels   where things are on the map. 1 tile = TILE px.
     SCREEN pixels  where things are on the canvas. The world is
                    drawn ZOOM times bigger; menus are not zoomed.
   Everything in this file is in world pixels.
   ============================================================ */

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const VIEW_W = VIEW_COLS * TILE, VIEW_H = VIEW_ROWS * TILE;    // the window onto the world, in world px
canvas.width  = VIEW_W * ZOOM;
canvas.height = VIEW_H * ZOOM;

// One Image per character sheet named in CHARACTERS (data/characters.js).
const charSheets = {};
for (const [name, def] of Object.entries(CHARACTERS)) {
  const img = new Image();
  charSheets[name] = { img, ready: false, layout: Object.assign({}, CHARACTER_LAYOUT, def.layout || {}) };
  img.onload = () => { charSheets[name].ready = true; };
  img.src = 'art/characters/' + def.file;
}

// One Image per sheet named in SHEETS (data/tiles.js).
const sheets = {};
for (const [name, file] of Object.entries(SHEETS)) {
  const img = new Image();
  sheets[name] = { img, ready: false };
  img.onload = () => { sheets[name].ready = true; };
  img.src = file;
}

let current = null, currentName = '';
let COLS = 0, ROWS = 0, WORLD_W = 0, WORLD_H = 0;

const player = { x: 0, y: 0, facing: 'down', walkTimer: 0 };
const camera = { x: 0, y: 0 };

let npcsHere  = [];   // NPCs standing in the current map right now
let propsHere = [];   // props visible in the current map right now

/* ---------------- loading a map ---------------- */

function loadMap(name, col, row, facing) {
  const arrivingSomewhereNew = name !== currentName;
  current = MAPS[name];
  currentName = name;
  COLS = current.tiles[0].length;
  ROWS = current.tiles.length;
  WORLD_W = COLS * TILE;
  WORLD_H = ROWS * TILE;
  if (col !== undefined) { player.x = col * TILE; player.y = row * TILE; }
  if (facing) player.facing = facing;
  refreshPeople();
  updateCamera();
  return arrivingSomewhereNew;
}

// Works out who and what is in the current map. Called on arrival and each
// morning, NOT continuously: that's why nobody pops in or out while you watch.
function refreshPeople() {
  npcsHere = [];
  for (const [id, def] of Object.entries(NPCS)) {
    if (!check(def.presentIf)) continue;
    const spot = (def.schedule || []).find(s => check(s.if)) || def.home;
    if (spot.map !== currentName) continue;
    npcsHere.push({ id, def, col: spot.col, row: spot.row, facing: spot.facing || 'down', homeFacing: spot.facing || 'down' });
  }
  propsHere = (current.props || []).filter(p => check(p.showIf));
}

/* ---------------- what's at a tile ---------------- */

const inBounds = (col, row) => row >= 0 && row < ROWS && col >= 0 && col < COLS;

function letterSolid(map, ch) {
  const place = map.places && map.places[ch];
  if (place) return !place.walkOn;                 // places block, unless you're meant to step on them
  const def = LEGENDS[map.legend][ch];
  return def ? !!def.solid : true;                 // an unknown letter is a wall, so typos are obvious
}

function solidAt(col, row) {
  if (!inBounds(col, row)) {
    // Past the border. If a neighbouring map is attached on that side, ask IT
    // what's there, so you can't stroll off the edge into a neighbour's tree.
    const dx = col < 0 ? -1 : col >= COLS ? 1 : 0;
    const dy = row < 0 ? -1 : row >= ROWS ? 1 : 0;
    if (dx && dy) return true;
    const side = dx < 0 ? 'west' : dx > 0 ? 'east' : dy < 0 ? 'north' : 'south';
    const nb = MAPS[(current.edges || {})[side]];
    if (!nb) return true;
    const c = dx < 0 ? nb.tiles[0].length + col : dx > 0 ? col - COLS : col;
    const r = dy < 0 ? nb.tiles.length + row    : dy > 0 ? row - ROWS : row;
    const line = nb.tiles[r];
    return !line || line[c] === undefined || letterSolid(nb, line[c]);
  }
  if (letterSolid(current, current.tiles[row][col])) return true;
  if (propsHere.some(p => p.solid && p.col === col && p.row === row)) return true;
  if (npcsHere.some(n => n.col === col && n.row === row)) return true;
  return false;
}

// The player collides with a small box at their feet, not their whole
// sprite. That's what lets your head overlap the wall behind you.
const HIT_W = 18, HIT_H = 12;
const hitbox = (x, y) => ({ x: x + (TILE - HIT_W) / 2, y: y + TILE - HIT_H - 3, w: HIT_W, h: HIT_H });

function blocked(x, y) {
  const b = hitbox(x, y);
  const c0 = Math.floor(b.x / TILE), c1 = Math.floor((b.x + b.w - 1) / TILE);
  const r0 = Math.floor(b.y / TILE), r1 = Math.floor((b.y + b.h - 1) / TILE);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solidAt(c, r)) return true;
  return false;
}

function playerTile() {
  const b = hitbox(player.x, player.y);
  return { col: Math.floor((b.x + b.w / 2) / TILE), row: Math.floor((b.y + b.h / 2) / TILE) };
}

// Whatever is one tile ahead of the player: an NPC, a place, or nothing.
function facingTarget() {
  const t = playerTile();
  const [dc, dr] = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] }[player.facing];
  const col = t.col + dc, row = t.row + dr;
  const npc = npcsHere.find(n => n.col === col && n.row === row);
  if (npc) return { npc, def: npc.def, name: npc.def.name };
  if (!inBounds(col, row)) return null;
  const place = current.places && current.places[current.tiles[row][col]];
  if (!place || place.walkOn) return null;
  // A counter that passes you on to the person behind it.
  if (place.talkTo && NPCS[place.talkTo]) {
    const behind = npcsHere.find(n => n.id === place.talkTo);
    if (!behind) return { def: { name: place.name, line: "Nobody's at the counter." }, name: place.name };
    return { npc: behind, def: behind.def, name: behind.def.name, acrossCounter: true };
  }
  return { def: place, name: place.name };
}

/* ---------------- camera ---------------- */

function updateCamera() {
  let cx = player.x + TILE / 2 - VIEW_W / 2;
  let cy = player.y + TILE / 2 - VIEW_H / 2;
  // Bigger than the window: follow, but stop at the edges.
  // Smaller than the window (interiors): sit still, centred.
  cx = WORLD_W > VIEW_W ? Math.max(0, Math.min(cx, WORLD_W - VIEW_W)) : -(VIEW_W - WORLD_W) / 2;
  cy = WORLD_H > VIEW_H ? Math.max(0, Math.min(cy, WORLD_H - VIEW_H)) : -(VIEW_H - WORLD_H) / 2;
  camera.x = Math.round(cx);
  camera.y = Math.round(cy);
}

/* ---------------- drawing ---------------- */

// A repeatable "random" number for a tile: same spot, same answer, every time.
function tileHash(col, row) {
  let h = (col * 374761393 + row * 668265263) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return (h ^ (h >> 16)) & 0x7fffffff;
}

// `size` is optional: menus use it to draw an item icon bigger than one tile.
function drawSprite(name, x, y, size) {
  const cell = SPRITES[name];
  const sheet = cell && sheets[cell[2] || 'tiles'];
  if (!sheet || !sheet.ready) return false;
  ctx.drawImage(sheet.img, cell[0] * TILE, cell[1] * TILE, TILE, TILE, x, y, size || TILE, size || TILE);
  return true;
}

// Which activity (data/goods.js) could be done right here, right now? Or null.
function availableActivity() {
  const t = playerTile();
  const [dc, dr] = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] }[player.facing];
  for (const [id, act] of Object.entries(ACTIVITIES)) {
    if (!have(act.tool)) continue;
    const col = act.where === 'facing' ? t.col + dc : t.col, row = act.where === 'facing' ? t.row + dr : t.row;
    if (!inBounds(col, row) || !act.on.includes(current.tiles[row][col])) continue;
    if (current.places && current.places[current.tiles[row][col]]) continue;            // a place that happens to use that letter
    if (act.oncePerSpot && (state.dug || { spots: {} }).spots[currentName + ':' + col + ',' + row]) continue;
    return { id, act, col, row };
  }
  return null;
}

function drawLetter(map, ch, col, row, time, depth) {
  const place = map.places && map.places[ch];
  const look = (place && place.sprite) ? place : LEGENDS[map.legend][ch];
  const x = col * TILE, y = row * TILE;

  if (look && look.under && (depth || 0) < 3) drawLetter(map, look.under, col, row, time, (depth || 0) + 1);

  let name = null;
  if (look && look.frames)                   name = look.frames[Math.floor(time * (look.fps || 2) + (col + row) % 2) % look.frames.length];
  else if (look && Array.isArray(look.sprite)) name = look.sprite[tileHash(col, row) % look.sprite.length];
  else if (look)                             name = look.sprite;

  if (name && drawSprite(name, x, y)) return;

  // No picture (yet). Show SOMETHING: a coloured square with the letter on it.
  ctx.fillStyle = (look && look.color) || '#d23ad2';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.font = '12px monospace';
  ctx.fillText(ch, x + 12, y + 20);
}

// Everybody on the island is drawn here: you and every NPC.
// With a `sprite` (data/characters.js) they're a picture from a sheet.
// Without one they're the old blocky person, built from four colours.
function drawPerson(px, py, look, facing, walkTimer, sprite) {
  if (sprite && drawCharacter(px, py, sprite, facing, walkTimer)) return;
  drawBlockyPerson(px, py, look, facing, walkTimer);
}

// Picks the right cell of the sheet from which way they face and whether
// they're walking, then draws it (mirrored, for facing left).
function drawCharacter(px, py, name, facing, walkTimer) {
  const sheet = charSheets[name];
  if (!sheet || !sheet.ready) return false;                 // still loading, or a name with no sheet
  const L = sheet.layout;
  const col = walkTimer > 0 ? Math.floor(walkTimer * L.fps) % L.cols : L.standFrame;
  const row = L.rowFor[facing];
  const x = Math.round(px), y = Math.round(py) + L.offsetY;

  ctx.save();
  if (L.flip[facing]) { ctx.translate(x + TILE, y); ctx.scale(-1, 1); }
  else ctx.translate(x, y);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet.img, col * TILE, row * TILE, TILE, TILE, 0, 0, TILE, TILE);
  ctx.restore();
  return true;
}

function drawBlockyPerson(px, py, look, facing, walkTimer) {
  const x = Math.round(px), y = Math.round(py);
  const walking = walkTimer > 0;
  const bob  = walking && Math.floor(walkTimer * 8) % 2 ? 1 : 0;
  const step = walking ? Math.floor(walkTimer * 6) % 2 : 0;

  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.beginPath(); ctx.ellipse(x + 16, y + 30, 7, 3, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = look.legs;
  if (step) { ctx.fillRect(x + 11, y + 26 + bob, 4, 5); ctx.fillRect(x + 17, y + 25 + bob, 4, 5); }
  else      { ctx.fillRect(x + 12, y + 26 + bob, 4, 4); ctx.fillRect(x + 17, y + 26 + bob, 4, 4); }

  ctx.fillStyle = look.shirt;
  ctx.fillRect(x + 10, y + 16 + bob, 12, 11);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(x + 10, y + 16 + bob, 2, 11);

  ctx.fillStyle = look.skin;
  if (facing !== 'left') ctx.fillRect(x + 8,  y + 17 + bob, 3, 7);
  if (facing !== 'right')  ctx.fillRect(x + 21, y + 17 + bob, 3, 7);
  ctx.fillRect(x + 10, y + 6 + bob, 12, 11);

  ctx.fillStyle = look.hair;
  ctx.fillRect(x + 9, y + 4 + bob, 14, 5);
  ctx.fillRect(x + 9, y + 6 + bob, 2, 4);
  ctx.fillRect(x + 21, y + 6 + bob, 2, 4);
  if (facing === 'up') { ctx.fillRect(x + 10, y + 8 + bob, 12, 6); return; }

  ctx.fillStyle = '#2a2018';
  const eyeY = y + 11 + bob;
  const eyes = { left: [11, 15], right: [15, 19], down: [13, 18] }[facing];
  ctx.fillRect(x + eyes[0], eyeY, 2, 2);
  ctx.fillRect(x + eyes[1], eyeY, 2, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(x + 14, y + 14 + bob, 4, 1);
}

function drawWorld(time) {
  updateCamera();
  ctx.save();
  ctx.imageSmoothingEnabled = false;          // keep pixel art sharp when zoomed
  ctx.scale(ZOOM, ZOOM);
  ctx.translate(-camera.x, -camera.y);

  const c0 = Math.floor(camera.x / TILE), r0 = Math.floor(camera.y / TILE);
  for (let r = r0; r <= r0 + VIEW_ROWS; r++) {
    for (let c = c0; c <= c0 + VIEW_COLS; c++) {
      if (inBounds(c, r)) drawLetter(current, current.tiles[r][c], c, r, time);
    }
  }
  for (const p of propsHere) drawSprite(p.sprite, p.col * TILE, p.row * TILE);
  // today's holes in the sand
  for (const [spot, mark] of Object.entries((state.dug || {}).spots || {})) {
    const [map, where] = spot.split(':'), [c, r] = where.split(',').map(Number);
    if (map === currentName) drawSprite(mark, c * TILE, r * TILE);
  }

  // People are drawn top-to-bottom so whoever is lower on screen is in front.
  const people = npcsHere.map(n => ({ y: n.row * TILE, draw: () => drawPerson(n.col * TILE, n.row * TILE, n.def.look, n.facing, 0, n.def.sprite) }));
  people.push({ y: player.y, draw: () => drawPerson(player.x, player.y, PLAYER_LOOK, player.facing, player.walkTimer, PLAYER_SPRITE) });
  people.sort((a, b) => a.y - b.y).forEach(p => p.draw());

  if (DEBUG && showBoxes) {
    const b = hitbox(player.x, player.y);
    ctx.strokeStyle = '#ff3ad2'; ctx.lineWidth = 1;
    ctx.strokeRect(b.x + .5, b.y + .5, b.w - 1, b.h - 1);
    ctx.fillStyle = 'rgba(255,58,210,0.25)';
    for (let r = r0; r <= r0 + VIEW_ROWS; r++) for (let c = c0; c <= c0 + VIEW_COLS; c++)
      if (inBounds(c, r) && solidAt(c, r)) ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
  }
  ctx.restore();
}
let showBoxes = false;

// The colour of the light right now, blended between the entries in SKY_TINT.
function skyTint() {
  const h = state.minutes / 60;
  let a = SKY_TINT[0], b = SKY_TINT[SKY_TINT.length - 1];
  if (h <= a[0]) b = a;
  else if (h >= b[0]) a = b;
  else for (let i = 0; i < SKY_TINT.length - 1; i++) {
    if (h >= SKY_TINT[i][0] && h <= SKY_TINT[i + 1][0]) { a = SKY_TINT[i]; b = SKY_TINT[i + 1]; break; }
  }
  const t = a === b ? 0 : (h - a[0]) / (b[0] - a[0]);
  const ca = a[1].split(',').map(Number), cb = b[1].split(',').map(Number);
  const rgb = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  let strength = a[2] + (b[2] - a[2]) * t;
  if (current.legend === 'indoor') strength *= INDOOR_TINT_STRENGTH;
  return 'rgba(' + rgb.join(',') + ',' + strength.toFixed(3) + ')';
}

/* ============================================================
   THE VALIDATOR
   ============================================================
   Runs once at startup and reads through all the data looking for
   the mistakes that are easy to make by hand: a map row that's one
   character short, a door to a map that doesn't exist, a job id
   with a typo. Problems go in a red box above the game, in plain
   words, instead of being a silent broken thing you have to hunt.

   When you add a new KIND of data, teach the validator about it.
   ============================================================ */

function validateData() {
  const problems = [];
  const say = msg => problems.push(msg);
  const walkable = (map, col, row) => map.tiles[row] && map.tiles[row][col] !== undefined && !letterSolid(map, map.tiles[row][col]);
  const opposite = { north: 'south', south: 'north', east: 'west', west: 'east' };

  const checkConds = (where, conds) => {
    for (const c of [].concat(conds || [])) if (!conditionLooksValid(c)) say(`${where} has a condition the game doesn't understand: "${c}". The kinds it knows are listed at the top of data/story.js.`);
  };

  const checkInteraction = (where, d) => {
    checkConds(where, d.openIf); checkConds(where, d.presentIf);
    for (const t of d.talk || []) checkConds(where + ' (talk)', t.if);
    for (const sp of d.schedule || []) checkConds(where + ' (schedule)', sp.if);
    for (const j of [].concat(d.job || [])) if (!JOBS[j]) say(`${where} offers job "${j}", which isn't in data/jobs.js.`);
    if (d.shop && !SHOPS[d.shop]) say(`${where} runs shop "${d.shop}", which isn't in data/shops.js.`);
    if (d.trade && d.trade.pool && !['day', 'week'].includes(d.trade.refresh)) say(`${where} has a trade pool but its refresh is "${d.trade.refresh}". Use 'day' or 'week'.`);
    for (const o of ((d.trade && d.trade.offers) || []).concat((d.trade && d.trade.pool) || [])) {
      if (!CARD_BY_ID[o.give]) say(`${where} offers to trade away card "${o.give}", which doesn't exist.`);
      if (typeof o.want === 'string' && !CARD_BY_ID[o.want]) say(`${where} wants card "${o.want}", which doesn't exist.`);
    }
    if (d.battle && !OPPONENTS[d.battle]) say(`${where} plays as opponent "${d.battle}", who isn't in data/opponents.js.`);
  };

  for (const [name, map] of Object.entries(MAPS)) {
    const legend = LEGENDS[map.legend];
    if (!legend) { say(`Map "${name}" uses legend "${map.legend}", which doesn't exist in data/tiles.js.`); continue; }
    const width = map.tiles[0].length;
    map.tiles.forEach((line, r) => {
      if (line.length !== width) say(`Map "${name}": row ${r} is ${line.length} characters long, but row 0 is ${width}. Every row must be the same length.`);
      for (const ch of new Set(line)) if (!legend[ch] && !(map.places || {})[ch]) say(`Map "${name}": row ${r} uses the letter "${ch}", which is in neither the ${map.legend} legend nor this map's places.`);
    });
    for (const [ch, place] of Object.entries(map.places || {})) {
      const where = `Map "${name}", place "${ch}" (${place.name || 'unnamed'})`;
      if (!map.tiles.some(line => line.includes(ch))) say(`${where} is defined but the letter never appears in the map.`);
      if (!place.sprite && !legend[ch]) say(`${where} has no look: give it a sprite, or add "${ch}" to the ${map.legend} legend.`);
      if (place.sprite && !SPRITES[place.sprite]) say(`${where} uses sprite "${place.sprite}", which isn't named in SPRITES (data/tiles.js).`);
      if (place.under && !legend[place.under]) say(`${where} is drawn over "${place.under}", which isn't in the ${map.legend} legend.`);
      if (place.talkTo && !NPCS[place.talkTo]) say(`${where} passes you to NPC "${place.talkTo}", who isn't in data/npcs.js.`);
      if (place.to) {
        const dest = MAPS[place.to.map];
        if (!dest) say(`${where} leads to map "${place.to.map}", which doesn't exist.`);
        else if (!walkable(dest, place.to.col, place.to.row)) say(`${where} drops you at column ${place.to.col}, row ${place.to.row} of "${place.to.map}", which is solid or off the map.`);
      }
      checkInteraction(where, place);
    }
    for (const [side, nbName] of Object.entries(map.edges || {})) {
      const nb = MAPS[nbName];
      if (!nb) { say(`Map "${name}" has "${nbName}" to its ${side}, which doesn't exist.`); continue; }
      const sameSize = (side === 'east' || side === 'west') ? nb.tiles.length === map.tiles.length : nb.tiles[0].length === width;
      if (!sameSize) say(`Maps "${name}" and "${nbName}" share a ${side} edge but aren't the same size along it.`);
      if ((nb.edges || {})[opposite[side]] !== name) say(`Map "${name}" says "${nbName}" is to its ${side}, but "${nbName}" doesn't say "${name}" is to its ${opposite[side]}.`);
    }
    for (const p of map.props || []) {
      if (!SPRITES[p.sprite]) say(`Map "${name}" has a prop with sprite "${p.sprite}", which isn't named in SPRITES.`);
      checkConds(`Map "${name}", prop "${p.sprite}"`, p.showIf);
    }
  }

  for (const legendName of Object.keys(LEGENDS)) for (const [ch, def] of Object.entries(LEGENDS[legendName])) {
    for (const s of [].concat(def.sprite || [], def.frames || [])) if (!SPRITES[s]) say(`Legend "${legendName}", letter "${ch}": sprite "${s}" isn't named in SPRITES.`);
    if (def.under && !LEGENDS[legendName][def.under]) say(`Legend "${legendName}", letter "${ch}" is drawn over "${def.under}", which isn't in that legend.`);
  }

  for (const [name, def] of Object.entries(CHARACTERS)) {
    const L = Object.assign({}, CHARACTER_LAYOUT, def.layout || {});
    for (const facing of ['up', 'down', 'left', 'right']) if (L.rowFor[facing] === undefined) say(`Character "${name}" has no row for facing ${facing} in its layout (data/characters.js).`);
  }
  if (PLAYER_SPRITE && !CHARACTERS[PLAYER_SPRITE]) say(`PLAYER_SPRITE is "${PLAYER_SPRITE}", which isn't in CHARACTERS (data/characters.js).`);

  for (const [id, npc] of Object.entries(NPCS)) {
    for (const spot of [npc.home].concat(npc.schedule || [])) {
      const map = MAPS[spot.map];
      if (!map) say(`NPC "${id}" is placed in map "${spot.map}", which doesn't exist.`);
      else if (!walkable(map, spot.col, spot.row)) say(`NPC "${id}" stands at column ${spot.col}, row ${spot.row} of "${spot.map}", which is solid or off the map.`);
    }
    if (npc.sprite && !CHARACTERS[npc.sprite]) say(`NPC "${id}" uses sprite "${npc.sprite}", which isn't in CHARACTERS (data/characters.js).`);
    checkInteraction(`NPC "${id}"`, npc);
  }

  for (const [id, job] of Object.entries(JOBS)) {
    if (!['shift', 'delivery', 'minigame'].includes(job.type)) say(`Job "${id}" has type "${job.type}". Known types: shift, delivery, minigame.`);
    checkConds(`Job "${id}"`, job.availableIf);
    if (job.type === 'delivery' && !NPCS[job.deliverTo]) say(`Job "${id}" delivers to NPC "${job.deliverTo}", who doesn't exist.`);
  }
  for (const [id, shop] of Object.entries(SHOPS)) for (const p of shop.products) {
    if (p.pack && !PACKS[p.pack]) say(`Shop "${id}" sells pack "${p.pack}", which isn't in PACKS.`);
    if (p.item && !GOODS[p.item]) say(`Shop "${id}" sells "${p.item}", which isn't in GOODS (data/goods.js).`);
    if (!p.pack && !p.item) say(`Shop "${id}" has a product that is neither a pack nor an item.`);
  }
  for (const [name, cell] of Object.entries(SPRITES)) if (cell[2] && !SHEETS[cell[2]]) say(`Sprite "${name}" is on sheet "${cell[2]}", which isn't in SHEETS (data/tiles.js).`);
  for (const [id, g] of Object.entries(GOODS)) if (g.sprite && !SPRITES[g.sprite]) say(`Goods "${id}" uses sprite "${g.sprite}", which isn't named in SPRITES.`);
  for (const [id, act] of Object.entries(ACTIVITIES)) {
    if (!GOODS[act.tool]) say(`Activity "${id}" needs tool "${act.tool}", which isn't in GOODS.`);
    if (act.bait && !GOODS[act.bait]) say(`Activity "${id}" uses bait "${act.bait}", which isn't in GOODS.`);
    if (act.marks && !SPRITES[act.marks]) say(`Activity "${id}" marks the ground with sprite "${act.marks}", which isn't named in SPRITES.`);
    if (!['standing', 'facing'].includes(act.where)) say(`Activity "${id}" has where: "${act.where}". Use 'standing' or 'facing'.`);
    for (const [mapName, table] of [['', act.finds]].concat(Object.entries(act.findsIn || {}))) {
      if (mapName && !MAPS[mapName]) say(`Activity "${id}" has a loot table for map "${mapName}", which doesn't exist.`);
      for (const f of table || []) {
        if (f.item && !GOODS[f.item]) say(`Activity "${id}" can find "${f.item}", which isn't in GOODS.`);
        if (!(f.weight > 0)) say(`Activity "${id}" has a find with no weight (or a weight of zero), so it can never come up.`);
      }
    }
  }
  // --- the card game ---
  for (const [id, opp] of Object.entries(OPPONENTS)) {
    for (const c of opp.deck) if (!CARD_BY_ID[c]) say(`Opponent "${id}" has card "${c}" in their deck, which doesn't exist.`);
    if (opp.deck.every(c => CARD_BY_ID[c])) { const why = deckProblem(opp.deck); if (why) say(`Opponent "${id}" can't play: ${why}`); }
    checkConds(`Opponent "${id}"`, opp.playIf);
    if (opp.reward && opp.reward.card && !CARD_BY_ID[opp.reward.card]) say(`Opponent "${id}" rewards card "${opp.reward.card}", which doesn't exist.`);
  }
  for (const [cardId, moves] of Object.entries(MOVES)) {
    const card = CARD_BY_ID[cardId];
    if (!card) { say(`data/moves.js has effects for card "${cardId}", which doesn't exist.`); continue; }
    for (const name of Object.keys(moves)) if (!(card.abilities || []).some(a => a.name === name))
      say(`data/moves.js: ${card.name} has no move called "${name}". (Was it renamed on the playmat? The names must match exactly.)`);
  }
  for (const id of Object.keys(ITEMS)) if (!CARD_BY_ID[id] || CARD_BY_ID[id].kind !== 'item') say(`data/moves.js lists item "${id}", which isn't an item card.`);
  // Not a mistake, so not in the red box: cards whose text the island can't act out yet.
  const unwired = [];
  for (const c of CARDS) {
    if (c.kind === 'item') { if (!ITEMS[c.id] || ITEMS[c.id].todo) unwired.push(c.name + ' (item)'); continue; }
    for (const m of cardMoves(c)) if (m.fx.todo || (m.text && !m.ops.length && !m.fx.tag)) unwired.push(c.name + ': ' + m.name);
  }
  if (unwired.length) console.info('Card effects not wired into island matches yet (' + unwired.length + '):\n  ' + unwired.join('\n  '));

  const eventIds = new Set();
  for (const ev of EVENTS) {
    checkConds(`Event "${ev.id}"`, ev.if);
    if (eventIds.has(ev.id)) say(`Two events share the id "${ev.id}". Ids must be unique, or "once" gets confused.`);
    eventIds.add(ev.id);
  }
  for (const id of START.cards) if (!CARD_BY_ID[id]) say(`START.cards (data/config.js) includes "${id}", which isn't a card.`);
  if (!MAPS[START.map]) say(`START.map is "${START.map}", which doesn't exist.`);
  else if (!walkable(MAPS[START.map], START.col, START.row)) say(`The new-game starting tile is solid or off the map.`);

  showProblems(problems);
}

function showProblems(problems) {
  const box = document.getElementById('problems');
  if (!problems.length) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = '<strong>The game found ' + problems.length + (problems.length === 1 ? ' thing' : ' things') + ' to fix in the data:</strong>'
    + '<ul>' + problems.map(p => '<li>' + p.replace(/</g, '&lt;') + '</li>').join('') + '</ul>';
}
