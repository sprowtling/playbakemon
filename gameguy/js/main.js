/* ============================================================
   MAIN — keys in, one step of the game, one picture out. Repeat.
   ============================================================
   Sixty times a second:   update(dt)  then  draw().
   `dt` is how long the last frame took, in seconds. Multiplying
   movement by dt is what makes the game run at the same speed
   on a fast computer and a slow one.
   ============================================================ */

/* ---------------- input ---------------- */
// Two questions get asked of the keyboard:
//   holding('left')   is it down right now?        (walking)
//   pressed('action') did it go down THIS frame?   (menus, talking)

const KEYS = {
  up: ['arrowup', 'w'], down: ['arrowdown', 's'], left: ['arrowleft', 'a'], right: ['arrowright', 'd'],
  action: ['e', 'enter', ' '], cancel: ['escape', 'backspace'], collection: ['c'],
  dbg1: ['1'], dbg2: ['2'], dbg3: ['3'], dbg4: ['4'], dbg0: ['0'],
};
const heldKeys = {}, freshKeys = new Set();

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  // Holding a key makes the browser repeat it. Allow that for arrows (nice for
  // scrolling the collection), but never for E: one press, one action.
  const isDirection = ['up', 'down', 'left', 'right'].some(n => KEYS[n].includes(k));
  if (!e.repeat || isDirection) freshKeys.add(k);
  heldKeys[k] = true;
  if (k.startsWith('arrow') || k === ' ' || k === 'backspace') e.preventDefault();   // stop the page scrolling
});
addEventListener('keyup', e => { heldKeys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in heldKeys) heldKeys[k] = false; });    // alt-tabbing shouldn't leave you walking

const holding = name => KEYS[name].some(k => heldKeys[k]);
const pressed = name => KEYS[name].some(k => freshKeys.has(k));

/* ---------------- update ---------------- */

let sleepyWarnedOnDay = 0;
let lastWalkOn = '';

function update(dt) {
  // Whoever is on top gets the keys. Everything underneath waits, clock included.
  if (ui.fade)          updateFade(dt);
  else if (ui.dialogue) updateDialogue(dt);
  else if (ui.menu)     updateMenu();
  else if (ui.screen && ui.screen.kind === 'collection') updateCollection();
  else if (ui.screen && ui.screen.kind === 'pack')       updatePack(dt);
  else if (state && !ui.screen)                          updateWorld(dt);
  freshKeys.clear();
}

function updateWorld(dt) {
  // --- the clock ---
  if (advanceMinutes(dt * GAME_MINUTES_PER_SECOND)) return collapse();
  if (hourNow() >= SLEEPY_HOUR && sleepyWarnedOnDay !== state.day) { sleepyWarnedOnDay = state.day; toast("It's getting dark. Time to head home."); }

  // --- walking ---
  let dx = 0, dy = 0;
  if (holding('left'))  { dx -= 1; player.facing = 'left';  }
  if (holding('right')) { dx += 1; player.facing = 'right'; }
  if (holding('up'))    { dy -= 1; player.facing = 'up';    }
  if (holding('down'))  { dy += 1; player.facing = 'down';  }
  if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }        // so diagonals aren't faster

  // Try each direction separately. That's what lets you slide along a wall
  // when you walk into it at an angle, instead of sticking to it.
  const step = SPEED * dt;
  if (dx && !blocked(player.x + dx * step, player.y)) player.x += dx * step;
  if (dy && !blocked(player.x, player.y + dy * step)) player.y += dy * step;
  player.walkTimer = (dx || dy) ? player.walkTimer + dt : 0;

  // --- walked off the side of the map? ---
  const t = playerTile();
  if (!inBounds(t.col, t.row)) {
    const side = t.col < 0 ? 'west' : t.col >= COLS ? 'east' : t.row < 0 ? 'north' : 'south';
    const nb = (current.edges || {})[side];
    if (nb) return crossEdge(side, nb);
  } else {
    // --- stepped on a walkOn place? (only triggers on arriving at the tile) ---
    const ch = current.tiles[t.row][t.col], place = current.places && current.places[ch];
    const here = currentName + ':' + t.col + ',' + t.row;
    if (place && place.walkOn && here !== lastWalkOn) { lastWalkOn = here; return interact({ def: place, name: place.name }); }
    if (!place || !place.walkOn) lastWalkOn = '';
  }

  // --- keys ---
  if (pressed('action')) { const target = facingTarget(); if (target) return interact(target); }
  if (pressed('collection')) return openCollection();
  if (pressed('cancel')) return openPauseMenu();

  if (DEBUG) {
    if (pressed('dbg1')) { advanceMinutes(60); refreshPeople(); toast(clockText()); }
    if (pressed('dbg2')) { state.money += 5; toast('+' + moneyText(5) + ' (debug)'); }
    if (pressed('dbg3')) { const ids = rollPack('booster'); const wasNew = ids.map(id => { const n = owned(id) === 0; addCard(id); return n; }); openPackScreen('booster', ids, wasNew, () => fireEvent('pack_opened')); }
    if (pressed('dbg4')) goToSleep(false);
    if (pressed('dbg0')) showBoxes = !showBoxes;
  }
}

/* ---------------- draw ---------------- */

function drawPrompt() {
  const target = facingTarget();
  if (!target || !target.name) return;
  setFont(20);
  const text = 'E   ' + target.name;
  const w = ctx.measureText(text).width + 24;
  const x = Math.round((player.x + TILE / 2 - camera.x) * ZOOM - w / 2);
  const y = Math.round((player.y - camera.y) * ZOOM - 30);
  roundRect(x, y, w, 30, 8); ctx.fillStyle = COLOR.panel; ctx.fill();
  ctx.fillStyle = COLOR.sand; ctx.fillText(text, x + 12, y + 22);
}

let lastFrameDt = 0;
function draw(time) {
  ctx.fillStyle = '#0a161b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const kind = ui.screen && ui.screen.kind;
  if (kind === 'title') drawTitle(time);
  else if (state) {
    drawWorld(time);
    ctx.fillStyle = skyTint(); ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!kind) { if (!ui.dialogue && !ui.menu && !ui.fade) drawPrompt(); drawHud(lastFrameDt); }
    if (kind === 'collection') drawCollection();
    if (kind === 'pack')       drawPack(time);
  }
  if (ui.dialogue) drawDialogue();
  if (ui.menu)     drawMenu();
  if (ui.fade)     drawFade();
}

/* ---------------- title & pause ---------------- */

function showTitle() {
  state = null;
  ui.screen = { kind: 'title' };
  const save = readSave();
  const begin = saved => fadeThrough(() => startGame(saved), { dur: 0.4, then: () => { banner(current.title); if (!saved) fireEvent('newgame'); } });

  const options = [];
  if (save) options.push({ label: 'Continue', hint: DAY_NAMES[(save.day - 1) % 7] + ', day ' + save.day + '.   ' + Object.values(save.collection).filter(n => n > 0).length + ' cards found.', run: () => begin(save) });
  options.push({ label: 'New game', hint: save ? 'This replaces your saved game.' : '', run: () => {
    if (!save) return begin(null);
    choose('Start over and lose the saved game?', [{ label: 'Keep my save', run: showTitle }, { label: 'Start over', run: () => { eraseSave(); begin(null); } }], showTitle);
  } });
  choose('', options, showTitle);
}

function startGame(saved) {
  state = saved || newState();
  ui.screen = null;
  let p = state.player;
  // If the map was edited since the save and the old spot is now inside a wall
  // (or the map is gone), fall back to the starting position.
  const ok = MAPS[p.map] && MAPS[p.map].tiles[p.row] && MAPS[p.map].tiles[p.row][p.col] !== undefined && !letterSolid(MAPS[p.map], MAPS[p.map].tiles[p.row][p.col]);
  if (!ok) p = START;
  loadMap(p.map, p.col, p.row, p.facing);
}

function openPauseMenu() {
  choose('Paused', [
    { label: 'Back to the island' },
    { label: 'Collection', run: () => openCollection() },
    { label: 'Save', run: () => toast(saveGame() ? 'Saved.' : "Couldn't save in this browser.") },
    { label: 'Save and go to the title', run: () => { saveGame(); fadeThrough(showTitle, { dur: 0.3 }); } },
  ]);
}

/* ---------------- boot ---------------- */

let lastTime = performance.now();
function frame(now) {
  // dt is capped: if the tab was in the background for a minute, we do NOT
  // want one giant step that walks you through a wall.
  lastFrameDt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  update(lastFrameDt);
  draw(now / 1000);
  requestAnimationFrame(frame);
}

validateData();
if (document.fonts && document.fonts.load) document.fonts.load('24px "Patrick Hand"').catch(() => {});
showTitle();
requestAnimationFrame(frame);
