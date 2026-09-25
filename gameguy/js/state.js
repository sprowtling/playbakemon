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

const productKey = p => p.pack || p.item;

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
    shops: {},                       // shop id → { product id → stock }
    inventory: {},                   // goods id → how many (data/goods.js)
    dug: { day: 1, spots: {} },      // tiles already dug up today
    deckEdited: false,               // until you edit your deck by hand, it's "everything you own"
    player: { map: START.map, col: START.col, row: START.row, facing: START.facing },
  };
  for (const id of START.cards) { s.collection[id] = (s.collection[id] || 0) + 1; s.seen[id] = true; }
  for (const [shopId, shop] of Object.entries(SHOPS)) {
    s.shops[shopId] = {};
    for (const p of shop.products) if (p.startStock !== undefined) s.shops[shopId][productKey(p)] = p.startStock;
  }
  return s;
}

/* ---------------- time ---------------- */

const dayIndex  = () => (state.day - 1) % 7;
const dayName   = () => DAY_NAMES[dayIndex()];
const dayShort  = () => dayName().slice(0, 3);
const hourNow   = () => Math.floor(state.minutes / 60);
const weekNow   = () => Math.floor((state.day - 1) / 7) + 1;

/* ---------------- the calendar ----------------
   Nothing new is saved for this. `state.day` already counts up forever
   (1, 2, 3 ... 300), and the date is worked out from it, the same way
   `% 7` above turns day 11 into a Thursday. Here it's `% DAYS_PER_MONTH`
   for the date, and whole months counted from START_MONTH for the month.
   Each of these takes a day number, so the title screen can ask about a
   save that isn't loaded yet. Leave it out and it means today.
   ---------------------------------------------------------------- */

const MONTH_SHORTS = MONTH_NAMES.map(m => m.slice(0, 3));
const startMonth   = Math.max(0, MONTH_SHORTS.indexOf(START_MONTH));
const monthsIn     = (day = state.day) => Math.floor((day - 1) / DAYS_PER_MONTH);      // whole months since the game began
const dateNow      = (day = state.day) => (day - 1) % DAYS_PER_MONTH + 1;               // 1 to 28
const monthIndex   = (day = state.day) => (startMonth + monthsIn(day)) % 12;
const monthName    = (day = state.day) => MONTH_NAMES[monthIndex(day)];
const monthShort   = (day = state.day) => MONTH_SHORTS[monthIndex(day)];
const yearNow      = (day = state.day) => Math.floor((startMonth + monthsIn(day)) / 12) + 1;
const seasonNow    = (day = state.day) => Object.keys(SEASONS).find(s => SEASONS[s].includes(monthShort(day))) || '';

// "Monday, June 3"
const dateText = (day = state.day) => DAY_NAMES[(day - 1) % 7] + ', ' + monthName(day) + ' ' + dateNow(day);

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
  state.dug = { day: state.day, spots: {} };       // the tide fills yesterday's holes

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
      if (p.startStock === undefined) continue;                        // never runs out: nothing to track
      const key = productKey(p);
      if (shelf[key] === undefined) shelf[key] = p.startStock;         // product added after the save was made
      shelf[key] = Math.max(0, shelf[key] - (p.otherKidsBuy || 0));
      const restocks = dayShort() === shop.restockDay || (shop.restockIf !== undefined && check(shop.restockIf));
      if (restocks) shelf[key] = Math.max(shelf[key], p.restockTo);
    }
  }
  return notes;
}

/* ---------------- backpack ---------------- */
// (`|| {}` everywhere because saves made before the backpack existed don't have one.)

const have = id => (state.inventory || {})[id] || 0;
function addGood(id, n)    { if (!state.inventory) state.inventory = {}; state.inventory[id] = have(id) + (n || 1); }
function removeGood(id, n) { state.inventory[id] = Math.max(0, have(id) - (n || 1)); if (!state.inventory[id]) delete state.inventory[id]; }

/* ---------------- repeatable randomness ----------------
   Rotating trades need a pick that LOOKS random but comes out the same
   every time it's asked on the same day: otherwise reloading the page
   would reshuffle what Megan is offering. So instead of Math.random()
   we turn a piece of text ("megan:week3") into a number and use that
   as the starting point for a little number generator. Same text in,
   same "random" numbers out. */

function seededRandom(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// n things from a list, chosen by the seed. Returns their positions in the list.
function seededPick(length, n, seed) {
  const rand = seededRandom(seed), order = [...Array(length).keys()];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order.slice(0, n).sort((a, b) => a - b);
}

/* ---------------- collection ---------------- */

const owned       = id => state.collection[id] || 0;
const uniqueOwned = () => Object.values(state.collection).filter(n => n > 0).length;
const totalOwned  = () => Object.values(state.collection).reduce((a, n) => a + n, 0);

function addCard(id)    { state.collection[id] = owned(id) + 1; state.seen[id] = true; }
function removeCard(id) { if (owned(id) > 0) state.collection[id] -= 1; }

// The card's own rarity, straight from the database export. Falls back to
// RARITY_FALLBACK (data/shops.js) only for a card that doesn't have one yet
// (still being designed) — so an unfinished card never breaks a pack or trade.
function rarityOf(card) {
  return card.rarity || RARITY_FALLBACK;
}

// Does this card satisfy what a trader wants?  want = 'id' | {type} | {rarity}
// A description can combine filters: { rarity: 'uncommon', kind: 'bakemon' }
// means "any uncommon Bakemon, not an item". At least one filter is required.
function cardMatches(card, want) {
  if (typeof want === 'string') return card.id === want;
  if (want.kind   && card.kind !== want.kind) return false;
  if (want.type   && !(card.types || []).includes(want.type)) return false;
  if (want.rarity && rarityOf(card) !== want.rarity) return false;
  return !!(want.kind || want.type || want.rarity);
}

// `give` on a trade offer can be a card id, OR a description like `want` is
// ({ type: 'fire' }, { rarity: 'rare' }) — in which case a matching card is
// picked at random. `seed` keeps that pick stable (see seededPick above):
// the same offer, on the same day, always resolves to the same card.
function resolveGive(give, seed) {
  if (typeof give === 'string') return give;
  const pool = CARDS.filter(c => cardMatches(c, give));
  if (!pool.length) return null;
  const [i] = seededPick(pool.length, 1, seed);
  return pool[i].id;
}

function describeWant(want) {
  if (typeof want === 'string') return CARD_BY_ID[want] ? CARD_BY_ID[want].name : '???';
  const bits = [];
  if (want.rarity) bits.push(want.rarity);
  if (want.type)   bits.push(want.type + '-type');
  bits.push(want.kind === 'bakemon' ? 'Bakemon' : want.kind === 'item' ? 'item' : 'card');
  return 'any ' + bits.join(' ');
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
const CONDITION_NUMBERS = ['hour', 'money', 'daynum', 'week', 'date', 'year', 'cards', 'total'];
const CONDITION_KINDS   = ['flag', 'day', 'month', 'season', 'time', 'has', 'dupe', 'carrying', 'jobdone', 'stock', 'item'];

function conditionLooksValid(cond) {
  const c = String(cond).replace(/^!+/, '');
  const cmp = c.match(/^(\w+)\s*(>=|<=|>|<|=)\s*(\d+)$/);
  if (cmp) return CONDITION_NUMBERS.includes(cmp[1]);
  const parts = c.split(':');
  if (!(parts.length === 2 && parts[1] !== '' && CONDITION_KINDS.includes(parts[0]))) return false;
  // Calendar words have a fixed list of answers, so a typo like "month:Juen" can be caught too.
  const known = { day: DAY_NAMES.map(d => d.slice(0, 3)), month: MONTH_SHORTS, season: Object.keys(SEASONS) }[parts[0]];
  return !known || parts[1].split(',').every(w => known.includes(w));
}

function checkOne(cond) {
  if (cond.startsWith('!')) return !checkOne(cond.slice(1));

  const cmp = cond.match(/^(\w+)\s*(>=|<=|>|<|=)\s*(\d+)$/);
  if (cmp) {
    const values = { hour: hourNow(), money: state.money, daynum: state.day, week: weekNow(),
                     date: dateNow(), year: yearNow(), cards: uniqueOwned(), total: totalOwned() };
    if (!(cmp[1] in values)) return false;      // the validator has already complained about it
    const a = values[cmp[1]], b = Number(cmp[3]);
    return { '>=': a >= b, '<=': a <= b, '>': a > b, '<': a < b, '=': a === b }[cmp[2]];
  }

  const [kind, arg] = cond.split(':');
  switch (kind) {
    case 'flag':     return !!state.flags[arg];
    case 'day':      return arg.split(',').includes(dayShort());
    case 'month':    return arg.split(',').includes(monthShort());
    case 'season':   return arg.split(',').includes(seasonNow());
    case 'time':     return phaseNow() === arg;
    case 'has':      return owned(arg) > 0;
    case 'dupe':     return owned(arg) > 1;
    case 'carrying': return !!state.items[arg];
    case 'item':     return have(arg) > 0;
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

// Fills in {money}, {moneyname}, {moneyone}, {day}, {month}, {date} and {season} inside dialogue text.
function fmt(text, extra) {
  // (`state` is null on the title screen, before a game has been loaded.)
  const values = Object.assign({ moneyname: MONEY_NAME, moneyone: MONEY_NAME_ONE }, state ? { money: state.money, day: dayName(), month: monthName(), date: dateNow(), season: seasonNow() } : {}, extra || {});
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
