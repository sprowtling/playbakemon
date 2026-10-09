// Practice matches against the bots, run right here in the MCP server.
//
// Unlike the table tools in game.js (where the playmat has no rules and everything
// is trust-based), a practice match uses the real rules engine: the very same files
// practice.html loads from ../gameguy/, and the same bots from ../practice-bots.js.
// The engine decides what's legal; the player just picks from numbered choices.
//
// How it fits together: the engine runs a match as one long async loop. Whenever it
// needs a decision from the player it calls the player's controller and waits. Here
// that controller parks the question (`waiting`) and the MCP tools answer it, one
// call at a time. The bot's turns happen in between, instantly.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const ENGINE_FILES = [
  "gameguy/data/battle-rules.js",
  "gameguy/data/moves.js",
  "gameguy/js/battle.js",
  "gameguy/js/battle-ai.js",
  "practice-bots.js",
];
const RARITY_WORDS = { 1: "common", 2: "uncommon", 3: "rare", 4: "double rare", 5: "ultra rare", 6: "legendary" };
const STATUS_LABEL = { asleep: "sleeping" };

/* ---------------- loading the engine ---------------- */

let E = null;            // the engine's world: its functions and data, loaded once
let cardsLoaded = false;

function loadEngine() {
  if (E) return E;
  const ctx = { console: { log() {}, info() {}, warn: console.error, error: console.error }, Math, structuredClone, setTimeout };
  vm.createContext(ctx);
  vm.runInContext("const CARD_BY_ID = {};", ctx);
  for (const f of ENGINE_FILES) {
    const file = path.join(ROOT, f);
    if (!fs.existsSync(file)) throw new Error(`Practice needs ${f} from the Bakemon repo (looked in ${file}). Run the MCP server from inside the repo.`);
    vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: f });
  }
  E = vm.runInContext(`({ CARD_BY_ID, PRACTICE_BOTS, BORROW_DECKS, WEATHER, ITEMS, newBattle, runBattle, makeAI, legalActions,
    cardMoves, zone, bench, other, isBasic, currentWeather })`, ctx);
  return E;
}

// A database row -> the card shape the engine knows (same as practice.html and export-cards.html).
function rowToCard(r) {
  const c = { id: r.card_number, uuid: r.id, name: r.name, kind: r.card_type, rarity: RARITY_WORDS[r.rarity] || null };
  if (r.card_type === "item") { c.itemKind = r.item_kind; c.effect = r.effect_text || ""; }
  else {
    c.stage = r.stage; c.from = r.evolves_from || null; c.hp = r.hp;
    c.types = [r.type_1, r.type_2].filter(Boolean);
    c.weak = [r.weakness_1, r.weakness_2].filter(Boolean);
    c.retreat = r.retreat_cost || 0;
    c.abilities = [1, 2].filter(n => r["ability_" + n + "_name"]).map(n => ({
      name: r["ability_" + n + "_name"], cost: r["ability_" + n + "_cost"] || "",
      text: r["ability_" + n + "_text"] || "", damage: r["ability_" + n + "_damage"],
    }));
  }
  c.image = r.image_filename || null;
  return c;
}

// Cards come live from the database, so new cards work without anyone exporting anything.
async function ensureCards(sb) {
  loadEngine();
  if (cardsLoaded) return;
  const { data, error } = await sb.from("cards").select("*");
  if (error) throw new Error(`Couldn't load cards: ${error.message}`);
  for (const r of data || []) { const c = rowToCard(r); E.CARD_BY_ID[c.id] = c; }
  cardsLoaded = true;
}

/* ---------------- the match ---------------- */

let match = null;
// match = { G, me, bot, botEntry, deckName, borrowed, player, waiting, done, result, error,
//           newLog: [], undoStack: [], undoTurn, notify, saved }

const deckList = cards => Object.entries(cards).flatMap(([id, n]) => Array(n).fill(id));

// Resolves as soon as the engine is waiting on the player again, or the match is over.
function settled() {
  return new Promise(resolve => {
    if (!match || match.waiting || match.done) return resolve();
    match.notify = resolve;
  });
}
function wake() { if (match && match.notify) { const n = match.notify; match.notify = null; n(); } }

function snapshot(G) {
  const controllers = G.players.map(P => P.controller), io = G.io;
  G.players.forEach(P => { P.controller = null; }); G.io = null;
  try { return structuredClone(G); }
  finally { G.players.forEach((P, i) => { P.controller = controllers[i]; }); G.io = io; }
}
function restore(G, snap) {
  const copy = structuredClone(snap);
  for (const k of Object.keys(copy)) if (k !== "players" && k !== "io" && k !== "rules") G[k] = copy[k];
  copy.players.forEach((p, i) => { for (const k of Object.keys(p)) if (k !== "controller") G.players[i][k] = p[k]; });
}

async function startPractice(sb, player, botId, deck) {
  await ensureCards(sb);
  const botEntry = E.PRACTICE_BOTS.find(b => b.id.toLowerCase() === String(botId || "").trim().toLowerCase()
    || b.name.toLowerCase() === String(botId || "").trim().toLowerCase());
  if (!botEntry) throw new Error(`No bot called "${botId}". Bots: ${E.PRACTICE_BOTS.map(b => b.name).join(", ")}`);
  if (!deck.cards.some(E.isBasic)) throw new Error(`"${deck.name}" has no basic Bakemon, so it can't start a match.`);

  const remote = {
    chooseAction: (G, P, actions) => new Promise(resolve => {
      if (match.undoTurn !== G.turnNumber) { match.undoStack = []; match.undoTurn = G.turnNumber; }   // undo reaches back to the start of this turn only
      match.undoStack.push(snapshot(G));
      match.waiting = { kind: "action", actions, resolve };
      wake();
    }),
    ask: (G, P, req) => new Promise(resolve => { match.waiting = { kind: "ask", req, resolve }; wake(); }),
  };
  const G = E.newBattle([
    { name: player.display_name, deck: deck.cards, controller: remote, isHuman: true },
    { name: botEntry.name, deck: deckList(botEntry.cards), controller: E.makeAI({ mistakes: botEntry.mistakes }) },
  ], { rules: { pointsToWin: 4, reshuffleNeedsEmptyHand: true }, io: { show: async (g, e) => { match.newLog.push(e.text); } } });

  match = { G, me: G.players[0], bot: G.players[1], botEntry, deckName: deck.name, borrowed: deck.borrowed, player,
            waiting: null, done: false, result: null, error: null, newLog: [], undoStack: [], undoTurn: -1, notify: null, saved: null };
  match.newLog.push(`${botEntry.name}: "${botEntry.hello || "Let's play."}"`);
  const m = match;
  E.runBattle(G)
    .then(() => { m.done = true; m.result = G.draw ? "draw" : G.winner === m.me ? "win" : "loss"; wake(); })
    .catch(err => { m.done = true; m.result = "broken"; m.error = err; console.error("practice match broke:", err); wake(); });
  await settled();
  await saveIfOver(sb);
  return view();
}

async function choose(sb, n) {
  if (!match) throw new Error("No practice match going. Start one with practice_start.");
  if (match.done) return view();
  if (!match.waiting) await settled();
  const opts = currentOptions();
  const picked = opts[Number(n) - 1];
  if (!picked) throw new Error(`Pick a number from 1 to ${opts.length}.`);
  const w = match.waiting;
  match.waiting = null;
  w.resolve(picked.value);
  await settled();
  await saveIfOver(sb);
  return view();
}

async function undo(sb) {
  if (!match || match.done) throw new Error("No practice match going.");
  if (!match.waiting || match.waiting.kind !== "action") throw new Error("You can only undo while it's your move (not in the middle of answering a question).");
  if (match.undoStack.length < 2) throw new Error("Nothing to undo this turn.");
  match.undoStack.pop();
  restore(match.G, match.undoStack.pop());
  match.newLog.push("You took back your last action.");
  const w = match.waiting;
  match.waiting = null;
  w.resolve({ type: "noop" });
  await settled();
  return view();
}

async function giveUp(sb) {
  if (!match || match.done) throw new Error("No practice match going.");
  if (!match.waiting || match.waiting.kind !== "action") throw new Error("You can give up when it's your move.");
  match.G.winner = match.bot; match.G.t.over = true;
  const w = match.waiting;
  match.waiting = null;
  w.resolve(w.actions.find(a => a.type === "endTurn"));
  await settled();
  await saveIfOver(sb);
  return view();
}

// Finished matches go to the same practice record as the website's (profile: "Recent Practice Matches").
async function saveIfOver(sb) {
  if (!match || !match.done || match.saved !== null || match.result === "broken") return;
  const { error } = await sb.from("practice_matches").insert({
    player_id: match.player.id, bot_id: match.botEntry.id, bot_name: match.botEntry.name,
    bot_difficulty: match.botEntry.difficulty || null, deck_name: match.deckName, borrowed: match.borrowed,
    result: match.result, turns: match.G.turnNumber,
  });
  match.saved = !error;
  if (error) console.error("practice result not saved:", error.message);
}

/* ---------------- describing things in words ---------------- */

function moveInfo(mv) {
  const out = { name: mv.name, cost: mv.cost.total ? Object.entries(mv.cost.types).map(([t, n]) => n + " " + t).concat(mv.cost.any ? [mv.cost.any + " any"] : []).join(" + ") : "free (ability)" };
  if (mv.damage) out.damage = mv.damage;
  if (mv.text) out.text = mv.text;
  if (mv.fx && mv.fx.approx) out.simplified = mv.fx.approx;
  return out;
}
function cardInfo(card) {
  if (!card) return null;
  if (card.kind === "item") {
    const item = E.ITEMS[card.id] || {};
    return { name: card.name, kind: item.equip ? "equippable item (only your active Bakemon can wear one)" : "item (used once, then discarded)", effect: card.effect };
  }
  return { name: card.name, stage: card.stage, evolves_from: card.from || undefined, hp: card.hp, types: card.types.join("/"),
           weak_to: card.weak.join("/") || "nothing", retreat: card.retreat, moves: E.cardMoves(card).map(moveInfo) };
}
const EFFECT_WORDS = { shield: "guarded", flinch: "flinching", cantRetreat: "can't retreat", noEnergy: "can't take energy", missNext: "will miss",
  mustFlip: "must flip to attack", disabled: "a move is disabled", delusion: "delusion", barbed: "barbed", thorns: "thorns",
  retaliate: "retaliates", reflect: "reflects", dmgBuff: "powered up", dmgDebuff: "weakened", splashBench: "focused" };
function monInfo(mon, opts = {}) {
  if (!mon) return null;
  const out = { card: mon.card.name, hp: `${Math.max(0, mon.hp)}/${mon.maxHp}`, energy: mon.energy.length ? mon.energy.join(", ") : "none" };
  const st = Object.keys(mon.status).map(s => STATUS_LABEL[s] || s);
  if (st.length) out.status = st.join(", ");
  const fx = [...new Set(mon.effects.map(e => EFFECT_WORDS[e.kind]).filter(Boolean))];
  if (fx.length) out.effects = fx.join(", ");
  if (mon.equip) out.item = E.CARD_BY_ID[mon.equip].name;
  if (mon.armor) out.armor = mon.armor;
  if (opts.full) Object.assign(out, { types: mon.card.types.join("/"), weak_to: mon.card.weak.join("/") || "nothing", retreat: mon.card.retreat, moves: E.cardMoves(mon.card).map(moveInfo) });
  return out;
}
function monLabel(mon) {
  const G = match.G, mine = E.zone(match.me).includes(mon);
  const where = G.players.some(P => P.active === mon) ? "active" : "bench";
  return `${mine ? "Your" : match.bot.name + "'s"} ${mon.card.name} (${where}, ${Math.max(0, mon.hp)}/${mon.maxHp} HP)`;
}

// The numbered choices right now, whether it's "what do you do?" or a question mid-move.
function currentOptions() {
  const w = match && match.waiting;
  if (!w) return [];
  if (w.kind === "action") return w.actions.map(a => ({ label: actionLabel(a), value: a }));
  const req = w.req;
  return req.options.map(o => req.kind === "mon" ? { label: monLabel(o), value: o } : { label: optionLabel(o), value: o.value });
}
function actionLabel(a) {
  const card = a.cardId ? E.CARD_BY_ID[a.cardId] : null;
  switch (a.type) {
    case "attack": return `ATTACK with ${match.me.active.card.name}: ${a.move.name}${a.move.damage ? " (" + a.move.damage + " damage)" : ""}${a.move.text ? " — " + a.move.text : ""}`;
    case "ability": return `ABILITY: ${a.mon.card.name}'s ${a.move.name}${a.move.text ? " — " + a.move.text : ""}${a.notepad ? " (from the Notepad)" : ""}`;
    case "item": return `${a.label}${card && card.effect ? " — " + card.effect : ""}`;
    case "energy": return "Attach an energy (one per turn): you'll be asked which Bakemon and which type";
    case "retreat": return a.label.replace("Retreat", "RETREAT");
    case "endTurn": return "END your turn";
    default: return a.label;
  }
}
function optionLabel(o) {
  if (o.cardId) { const c = E.CARD_BY_ID[o.cardId]; return o.label + (c && c.kind === "bakemon" ? ` (${c.hp} HP, ${c.types.join("/")})` : ""); }
  return o.label;
}

function view() {
  if (!match) return { practice: "No practice match going. Start one with practice_start." };
  const G = match.G, me = match.me, bot = match.bot;
  const out = {
    vs: `${bot.name} (${match.botEntry.difficulty || "bot"})`,
    turn: G.turnNumber,
    points: { you: me.points, [bot.name]: bot.points, to_win: G.rules.pointsToWin },
    what_happened: match.newLog.splice(0),
  };
  const w = E.currentWeather(G);
  if (w) out.weather = `${(E.WEATHER[w.name] || {}).label || w.name} (from ${w.source.card.name}): ${(E.WEATHER[w.name] || {}).text || ""}`;
  out.your_side = { active: monInfo(me.active, { full: true }), bench: me.bench.filter(Boolean).map(m => monInfo(m, { full: true })),
                    deck: me.deck.length, discard: me.discard.length, hand: me.hand.map(id => cardInfo(E.CARD_BY_ID[id])) };
  out[bot.name + "_side"] = { active: monInfo(bot.active, { full: true }), bench: bot.bench.filter(Boolean).map(m => monInfo(m)),
                    hand: bot.hand.length + " cards (hidden)", deck: bot.deck.length, discard: bot.discard.length };
  if (match.done) {
    const line = match.result === "win" ? match.botEntry.ifYouWin : match.result === "loss" ? match.botEntry.ifYouLose : "";
    out.match_over = { result: match.result === "win" ? "You win!" : match.result === "loss" ? `${bot.name} wins.` : match.result === "draw" ? "A draw." : "The match broke (a card effect hit a bug).",
                       [bot.name + "_says"]: line || undefined,
                       saved_to_profile: match.saved === true ? "yes" : match.result === "broken" ? "no (broken matches aren't recorded)" : "no (couldn't save)" };
    if (match.error) out.match_over.error = String(match.error.message || match.error);
    out.next = "Start another with practice_start whenever you like.";
    return out;
  }
  const wt = match.waiting;
  out.waiting_for_you = wt && wt.kind === "action" ? "Your move. Pick one with practice_choose." : (wt && wt.req.prompt) || "Choose one.";
  out.options = currentOptions().map((o, i) => `${i + 1}. ${o.label}`);
  if (wt && wt.kind === "action") out.can_undo = match.undoStack.length > 1;
  return out;
}

function listBots() {
  loadEngine();
  return {
    bots: E.PRACTICE_BOTS.map(b => ({ id: b.id, name: b.name, difficulty: b.difficulty, about: b.blurb })),
    borrowable_decks: E.BORROW_DECKS.map(d => ({ name: d.name, about: d.blurb })),
    also: "You can bring one of your own decks instead (see list_my_decks).",
  };
}

// One of the player's own decks, or a borrowed one, as a list of card numbers.
async function resolveDeck(sb, player, deckName) {
  await ensureCards(sb);
  const want = String(deckName || "").trim().toLowerCase();
  const borrowed = E.BORROW_DECKS.find(d => d.name.toLowerCase() === want || d.id.toLowerCase() === want);
  if (borrowed) return { name: borrowed.name, cards: deckList(borrowed.cards), borrowed: true };
  const { data: decks, error } = await sb.from("decks").select("id, deck_name").eq("player_id", player.id);
  if (error) throw new Error(`Couldn't load decks: ${error.message}`);
  const mine = (decks || []).find(d => d.deck_name.trim().toLowerCase() === want);
  if (!mine) throw new Error(`No deck called "${deckName}". Your decks: ${(decks || []).map(d => d.deck_name.trim()).join(", ") || "none"}. Borrowable: ${E.BORROW_DECKS.map(d => d.name).join(", ")}.`);
  const { data: rows, error: e2 } = await sb.from("deck_cards").select("card_id, quantity").eq("deck_id", mine.id);
  if (e2) throw new Error(`Couldn't load that deck: ${e2.message}`);
  const byUuid = {}; for (const c of Object.values(E.CARD_BY_ID)) byUuid[c.uuid] = c.id;
  const cards = [];
  for (const r of rows || []) { const num = byUuid[r.card_id]; if (num) for (let i = 0; i < (r.quantity || 1); i++) cards.push(num); }
  return { name: mine.deck_name.trim(), cards, borrowed: false };
}

module.exports = { listBots, resolveDeck, startPractice, choose, undo, giveUp, view, _internals: () => ({ E, match }) };
