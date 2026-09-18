/* ============================================================
   STATE — everything the game remembers, and the rules for time.
   ============================================================
   `state` is one plain object. Saving the game is nothing more
   than writing that object to the browser's storage, and loading
   is reading it back. That only works because NOTHING else holds
   information that matters: if you add a new system, keep what
   it needs to remember inside `state`.
   ============================================================ */

let state = null;

const CARD_BY_ID = {};
for (const c of CARDS) CARD_BY_ID[c.id] = c;

function newState() {
  const s = {
    version: SAVE_VERSION,
    day: 1,                          // 1 = first Monday
    minutes: DAY_START_HOUR * 60,    // minutes since midnight
    money: START.money,
    collection: {},                  // card id → how many you own
    seen: {},                        // card id → true, once you've laid eyes on it
    flags: {},
    done: {},                        // one-time things that have happened (events, 'once' lines, trades)
    items: {},                       // delivery items being carried
    jobsToday: {},                   // job id → times done today
    shops: {},                       // shop id → { pack id → stock }
    player: { map: START.map, col: START.col, row: START.row, facing: START.facing },
  };
  for (const id of START.cards) { s.collection[id] = (s.collection[id] || 0) + 1; s.seen[id] = true; }
  for (const [shopId, shop] of Object.entries(SHOPS)) {
    s.shops[shopId] = {};
    for (const p of shop.products) s.shops[shopId][p.pack] = p.startStock;
  }
  return s;
}

/* ---------------- time ---------------- */

const dayIndex  = () => (state.day - 1) % 7;
const dayName   = () => DAY_NAMES[dayIndex()];
const dayShort  = () => dayName().slice(0, 3);
const hourNow   = () => Math.floor(state.minutes / 60);
const weekNow   = () => Math.floor((state.day - 1) / 7) + 1;

function phaseNow() {
  const h = hourNow();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 20) return 'evening';
  return 'night';
}

function clockText() {
  const h = hourNow(), m = Math.floor(state.minutes % 60);
  const h12 = ((h + 11) % 12) + 1;
  // Rounded down to ten minutes: a kid's sense of time, and it stops the
  // clock flickering every second.
  return h12 + ':' + String(Math.floor(m / 10) * 10).padStart(2, '0') + (h < 12 ? ' am' : ' pm');
}

// Moves the clock forward. Returns true if it's now past collapse time,
// so whoever called can decide what to do about that.
function advanceMinutes(n) {
  state.minutes += n;
  return state.minutes >= COLLAPSE_HOUR * 60;
}

// Everything that changes overnight. Returns lines to show in the morning.
function startNewDay() {
  const notes = [];
  state.day += 1;
  state.minutes = DAY_START_HOUR * 60;
  state.jobsToday = {};

  // Undelivered things don't keep.
  for (const job of Object.values(JOBS)) {
    if (job.type === 'delivery' && state.items[job.item]) {
      delete state.items[job.item];
      notes.push("You never delivered " + job.itemName + ". It didn't keep.");
    }
  }

  // Shops: other kids buy overnight, then the boat restocks.
  for (const [shopId, shop] of Object.entries(SHOPS)) {
    const shelf = state.shops[shopId] || (state.shops[shopId] = {});
    for (const p of shop.products) {
      if (shelf[p.pack] === undefined) shelf[p.pack] = p.startStock;   // product added after the save was made
      shelf[p.pack] = Math.max(0, shelf[p.pack] - (p.otherKidsBuy || 0));
      if (dayShort() === shop.restockDay) shelf[p.pack] = Math.max(shelf[p.pack], p.restockTo);
    }
  }
  return notes;
}

/* ---------------- collection ---------------- */

const owned       = id => state.collection[id] || 0;
const uniqueOwned = () => Object.values(state.collection).filter(n => n > 0).length;
const totalOwned  = () => Object.values(state.collection).reduce((a, n) => a + n, 0);

function addCard(id)    { state.collection[id] = owned(id) + 1; state.seen[id] = true; }
function removeCard(id) { if (owned(id) > 0) state.collection[id] -= 1; }

function rarityOf(card) {
  return RARITY_OVERRIDES[card.id]
      || (card.kind === 'item' ? RARITY_BY_ITEM_KIND[card.itemKind] : RARITY_BY_STAGE[card.stage])
      || 'common';
}

// Does this card satisfy what a trader wants?  want = 'id' | {type} | {rarity}
function cardMatches(card, want) {
  if (typeof want === 'string') return card.id === want;
  if (want.type)   return (card.types || []).includes(want.type);
  if (want.rarity) return rarityOf(card) === want.rarity;
  return false;
}

function describeWant(want) {
  if (typeof want === 'string') return CARD_BY_ID[want] ? CARD_BY_ID[want].name : '???';
  if (want.type)   return 'any ' + want.type + ' type';
  if (want.rarity) return 'any ' + want.rarity + ' card';
  return '???';
}

function rollPack(packId) {
  const pack = PACKS[packId];
  const pool = CARDS.filter(c => !(pack.exclude || []).includes(c.id));
  const pick = rarity => {
    let options = pool.filter(c => rarityOf(c) === rarity);
    if (!options.length) options = pool;       // never hand over an empty slot
    return options[Math.floor(Math.random() * options.length)].id;
  };
  const out = [];
  for (const slot of pack.slots) {
    for (let i = 0; i < slot.count; i++) {
      let rarity = slot.rarity;
      if (slot.odds) {
        let roll = Math.random();
        for (const [r, chance] of Object.entries(slot.odds)) { rarity = r; if ((roll -= chance) < 0) break; }
      }
      out.push(pick(rarity));
    }
  }
  return out;
}

/* ---------------- flags & conditions ---------------- */

const setFlag = name => { state.flags[name] = true; };

// The words a condition may start with. The validator uses this to catch
// typos at startup; add to BOTH lists if you invent a new kind of condition.
const CONDITION_NUMBERS = ['hour', 'money', 'daynum', 'week', 'cards', 'total'];
const CONDITION_KINDS   = ['flag', 'day', 'time', 'has', 'dupe', 'carrying', 'jobdone', 'stock'];

function conditionLooksValid(cond) {
  const c = String(cond).replace(/^!+/, '');
  const cmp = c.match(/^(\w+)\s*(>=|<=|>|<|=)\s*(\d+)$/);
  if (cmp) return CONDITION_NUMBERS.includes(cmp[1]);
  const parts = c.split(':');
  return parts.length === 2 && parts[1] !== '' && CONDITION_KINDS.includes(parts[0]);
}

function checkOne(cond) {
  if (cond.startsWith('!')) return !checkOne(cond.slice(1));

  const cmp = cond.match(/^(\w+)\s*(>=|<=|>|<|=)\s*(\d+)$/);
  if (cmp) {
    const values = { hour: hourNow(), money: state.money, daynum: state.day, week: weekNow(),
                     cards: uniqueOwned(), total: totalOwned() };
    if (!(cmp[1] in values)) return false;      // the validator has already complained about it
    const a = values[cmp[1]], b = Number(cmp[3]);
    return { '>=': a >= b, '<=': a <= b, '>': a > b, '<': a < b, '=': a === b }[cmp[2]];
  }

  const [kind, arg] = cond.split(':');
  switch (kind) {
    case 'flag':     return !!state.flags[arg];
    case 'day':      return arg.split(',').includes(dayShort());
    case 'time':     return phaseNow() === arg;
    case 'has':      return owned(arg) > 0;
    case 'dupe':     return owned(arg) > 1;
    case 'carrying': return !!state.items[arg];
    case 'jobdone':  return (state.jobsToday[arg] || 0) > 0;
    case 'stock':    return Object.values(state.shops[arg] || {}).some(n => n > 0);
  }
  return false;                                 // unknown kind: the validator has already complained
}

// Accepts nothing (always true), one condition, or a list (all must hold).
function check(conds) {
  if (!conds) return true;
  return (Array.isArray(conds) ? conds : [conds]).every(checkOne);
}

// "1 coin", "3 coins".
const moneyText = n => n + ' ' + (n === 1 ? MONEY_NAME_ONE : MONEY_NAME);

// Fills in {money}, {moneyname}, {moneyone} and {day} inside dialogue text.
function fmt(text, extra) {
  // (`state` is null on the title screen, before a game has been loaded.)
  const values = Object.assign({ moneyname: MONEY_NAME, moneyone: MONEY_NAME_ONE }, state ? { money: state.money, day: dayName() } : {}, extra || {});
  return String(text).replace(/\{(\w+)\}/g, (whole, key) => (key in values ? values[key] : whole));
}

/* ---------------- save / load ---------------- */
// localStorage can be unavailable (private windows, some file:// setups),
// so every touch is wrapped. A game that can't save should still play.

function saveGame() {
  try {
    // Store the player's position as a tile, not pixels: tiles survive map edits better.
    const b = hitbox(player.x, player.y);
    state.player = { map: currentName,
                     col: Math.floor((b.x + b.w / 2) / TILE), row: Math.floor((b.y + b.h / 2) / TILE),
                     facing: player.facing };
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (err) { console.warn('Could not save:', err); return false; }
}

function readSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    return (s && s.version === SAVE_VERSION) ? s : null;
  } catch (err) { return null; }
}

function eraseSave() { try { localStorage.removeItem(SAVE_KEY); } catch (err) {} }
