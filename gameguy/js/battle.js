/* ============================================================
   BATTLE — the rules of the Bakemon card game, as code.
   ============================================================
   This file draws nothing and reads no keys. It only knows the
   rules. Two "controllers" plug into it: the screen (for you) and
   the AI (for everyone else), and they see the game the same way:

       legalActions(G, P)   →  everything P is allowed to do right now
       perform(G, P, action)

   Because of that separation, the whole engine can be tested
   without a screen, by letting two AIs play thousands of matches
   against each other and watching for anything that breaks.

   Almost everything here is `async`. WHY: in the middle of
   resolving a card, the rules sometimes need a DECISION ("which
   Bakemon do you heal?"). For the AI that's instant. For you it
   means waiting for a key press, possibly for minutes. `await`
   is how the engine pauses mid-rule and picks up exactly where
   it left off once the answer arrives.

   G  is the whole game.   P  is one player.   A "mon" is a Bakemon
   that is in play (as opposed to a card id sitting in a hand).
   ============================================================ */

/* ---------------- costs and moves ---------------- */

function parseCost(text) {
  const cost = { types: {}, any: 0, total: 0 };
  for (const part of String(text || '').split('+')) {
    const m = part.trim().match(/^(\d+)\s*([a-z]+)$/i);
    if (!m) continue;
    const n = Number(m[1]);
    const type = ENERGY_ALIASES[m[2].toLowerCase()] || m[2].toLowerCase();
    if (type === 'normal') cost.any += n; else cost.types[type] = (cost.types[type] || 0) + n;
    cost.total += n;
  }
  return cost;
}

const movesCache = {};
function cardMoves(card) {
  if (!movesCache[card.id]) {
    movesCache[card.id] = (card.abilities || []).map((a, index) => {
      const fx = (MOVES[card.id] || {})[a.name] || {};
      const cost = parseCost(a.cost);
      return { index, name: a.name, text: a.text || '', damage: a.damage || 0, cost, fx, ops: fx.ops || [],
               isAbility: cost.total === 0 };     // no energy cost = an ability, not an attack
    });
  }
  return movesCache[card.id];
}

// Humidifier: while anyone wears one, every attack in play counts as having one more water energy.
const humidifierOn = G => !!G && G.players.some(Q => zone(Q).some(m => equipTag(m) === 'humidifier'));
const costCount    = (move, type) => (move.cost.types[type] || 0) + (type === 'water' && humidifierOn(ACTIVE_G) ? 1 : 0);
const costIncludes = (move, type) => !!(move && costCount(move, type));

// The battle being played right now. Only used by rules that reach across the whole
// table without being handed G (Heat Lightning's "interchangeable" energy).
let ACTIVE_G = null;

function canPay(mon, cost) {
  const pool = {};
  let extra = 0;
  for (const e of mon.energy) pool[e] = (pool[e] || 0) + 1;
  // Thundazolt's Heat Lightning: while it's in play, fire and electric energy are interchangeable.
  if (humidifierOn(ACTIVE_G)) { pool.water = (pool.water || 0) + 1; extra = 1; }      // the extra water energy pays for the attack too
  const mixed = ACTIVE_G && tagCount(ACTIVE_G, 'heatLightning') > 0;
  if (mixed) {
    const both = (pool.fire || 0) + (pool.electric || 0), need = (cost.types.fire || 0) + (cost.types.electric || 0);
    if (both < need) return false;
    for (const [type, n] of Object.entries(cost.types)) if (type !== 'fire' && type !== 'electric' && (pool[type] || 0) < n) return false;
  } else {
    for (const [type, n] of Object.entries(cost.types)) if ((pool[type] || 0) < n) return false;
  }
  return mon.energy.length + extra >= cost.total;       // whatever's left over covers the "any" part
}

const hasTag   = (mon, tag) => cardMoves(mon.card).some(m => m.fx.tag === tag);
// How many Bakemon in play (on one side, or on both) carry a passive ability with this tag.
const tagCount = (G, tag, P) => (P ? [P] : G.players).reduce((n, Q) => n + zone(Q).filter(m => hasTag(m, tag)).length, 0);
const equipTag = mon => (mon.equip && ITEMS[mon.equip] && ITEMS[mon.equip].equip) || null;

/* ---------------- setting up ---------------- */

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

// players: [{ name, deck: [card ids], controller }, ...]
function newBattle(players, options) {
  options = options || {};
  const G = {
    rules: Object.assign({}, BATTLE_RULES, options.rules || {}),
    io: options.io || { show: async () => {} },
    players: players.map((p, index) => ({
      index, name: p.name, controller: p.controller, isHuman: !!p.isHuman,
      deck: shuffle(p.deck.slice()), hand: [], discard: [], active: null, bench: [], points: 0,
    })),
    turn: 0, turnNumber: 0, t: {}, winner: null, draw: false, log: [], lastAttack: [null, null], uid: 0,
    weather: null,         // { name, source: the Bakemon that keeps it going }. Only one at a time.
    delayed: [],           // things that happen on a later turn (stones falling, spores blooming...)
  };
  ACTIVE_G = G;
  for (const P of G.players) P.bench = new Array(G.rules.benchSize).fill(null);
  return G;
}

const other = (G, P) => G.players[1 - P.index];
const zone  = P => [P.active].concat(P.bench).filter(Boolean);
const bench = P => P.bench.filter(Boolean);
const ownerOf = (G, mon) => G.players.find(P => zone(P).includes(mon));
const isBasic = id => CARD_BY_ID[id].kind === 'bakemon' && CARD_BY_ID[id].stage === 'basic';

// Grammar for the commentary: "Megan draws" but "You draw"; "Megan's turn" but "Your turn".
const BASE_VERB = { has: 'have', goes: 'go', benches: 'bench', reaches: 'reach', wins: 'win' };
const subj = (P, verb) => P.isHuman ? 'You ' + (BASE_VERB[verb] || verb.replace(/s$/, '')) : P.name + ' ' + verb;
const poss = P => P.isHuman ? 'Your' : P.name + "'s";
const their = P => P.isHuman ? 'your' : 'their';

async function say2(G, text, extra) {          // (named say2 because the island already has a say())
  G.log.push(text);
  await G.io.show(G, Object.assign({ text }, extra || {}));
}

function makeMon(G, cardId) {
  const card = CARD_BY_ID[cardId];
  return { uid: ++G.uid, card, stack: [cardId], hp: card.hp, maxHp: card.hp, energy: [], equip: null,
           status: {}, effects: [], auras: [], buff: 0, playedTurn: G.turnNumber, helmet: null };
}

async function flip(G, why) {
  const heads = Math.random() < 0.5;
  await say2(G, (why ? why + ': ' : 'Coin flip: ') + (heads ? 'HEADS' : 'TAILS'), { kind: 'flip', heads });
  return heads;
}

// A D3, D6 or D20, exactly like the dice on the playmat.
async function roll(G, sides, why) {
  const value = 1 + Math.floor(Math.random() * sides);
  await say2(G, (why ? why + ': ' : 'Roll: ') + 'D' + sides + ' \u2192 ' + value, { kind: 'roll', sides, value });
  return value;
}

// Weather lasts as long as the Bakemon that made it stays in play (benched still counts).
// A newer weather simply replaces the old one.
function currentWeather(G) {
  if (G.weather && !G.players.some(Q => zone(Q).includes(G.weather.source))) G.weather = null;
  return G.weather;
}
const weatherIs = (G, name) => { const w = currentWeather(G); return !!w && w.name === name; };
// Hailstorm clears and prevents "elemental effects": every bonus that depends on an attack's element.
const elementalOn = G => !weatherIs(G, 'hailstorm');

// `turnDraw` is true only for the one card you draw at the start of your turn.
// That's the only draw allowed to recycle the discard pile. WHY: otherwise
// "Bill: draw two cards" with an empty deck reshuffles Bill back in, draws it,
// plays it, reshuffles it... forever. (The test matches found this one.)
async function drawCards(G, P, n, turnDraw) {
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    if (turnDraw && !P.deck.length && P.discard.length && (!G.rules.reshuffleNeedsEmptyHand || !P.hand.length)) {
      P.deck = shuffle(P.discard.splice(0));
      await say2(G, subj(P, 'shuffles') + ' the discard pile back into the deck.');
    }
    if (!P.deck.length) break;
    P.hand.push(P.deck.pop()); drawn++;
    // Zephyrzoa's Detect Change: while it's active, the other side gets to see your turn's draw.
    const watcher = other(G, P);
    if (turnDraw && watcher.active && hasTag(watcher.active, 'peekDraw'))
      await say2(G, subj(P, 'shows') + ' ' + CARD_BY_ID[P.hand[P.hand.length - 1]].name + ', the card just drawn.', { cardId: P.hand[P.hand.length - 1] });
  }
  return drawn;
}

async function runBattle(G) {
  // --- opening hands ---
  for (const P of G.players) {
    if (!P.deck.some(isBasic)) { G.winner = other(G, P); await say2(G, subj(P, 'has') + ' no basic Bakemon in the deck.'); return G; }
    await drawCards(G, P, G.rules.handSize);
    while (!P.hand.some(isBasic)) {
      await say2(G, subj(P, 'has') + ' no basic Bakemon. Reshuffling.');
      P.deck = shuffle(P.deck.concat(P.hand.splice(0)));
      await drawCards(G, P, G.rules.handSize);
    }
  }
  // --- placing Bakemon ---
  for (const P of G.players) {
    const basics = () => P.hand.map((id, handIndex) => ({ id, handIndex })).filter(c => isBasic(c.id));
    const first = await P.controller.ask(G, P, { kind: 'option', purpose: 'setupActive', prompt: 'Choose your active Bakemon',
      options: basics().map(c => ({ label: CARD_BY_ID[c.id].name, value: c.handIndex, cardId: c.id })) });
    P.active = makeMon(G, P.hand.splice(first, 1)[0]);
    while (basics().length && P.bench.includes(null)) {
      const pick = await P.controller.ask(G, P, { kind: 'option', purpose: 'setupBench', prompt: 'Put a Bakemon on your bench?',
        options: basics().map(c => ({ label: CARD_BY_ID[c.id].name, value: c.handIndex, cardId: c.id })).concat([{ label: "That's everyone", value: 'done' }]) });
      if (pick === 'done') break;
      P.bench[P.bench.indexOf(null)] = makeMon(G, P.hand.splice(pick, 1)[0]);
    }
  }
  G.turn = (await flip(G, 'Who goes first')) ? 0 : 1;
  await say2(G, subj(G.players[G.turn], 'goes') + ' first.');

  // --- the match ---
  while (!G.winner && !G.draw) {
    const P = G.players[G.turn];
    await startTurn(G, P);
    let actionsTaken = 0;
    while (!G.winner && !G.t.over) {
      const actions = legalActions(G, P);
      const action = (++actionsTaken > 60) ? actions.find(a => a.type === 'endTurn')      // a runaway controller gets its turn ended
                                           : await P.controller.chooseAction(G, P, actions);
      await perform(G, P, action);
    }
    if (!G.winner) await endTurn(G, P);
    if (!G.winner && G.turnNumber >= G.rules.turnLimit) { G.draw = true; await say2(G, 'The match has gone on too long. It is called a draw.'); }
    G.turn = 1 - G.turn;
  }
  return G;
}

/* ---------------- a turn ---------------- */

async function startTurn(G, P) {
  G.turnNumber += 1;
  G.t = { over: false, energyUsed: 0, cableUsed: {}, retreats: 0, abilityUsed: {}, canAttack: true, freeEvolves: 0,
          lockTurn: false, noEnergy: false, attacked: false, amp: null };
  await say2(G, '— ' + poss(P) + ' turn —', { kind: 'turn' });
  await drawCards(G, P, 1, true);
  if (G.turnNumber === 1 && !G.rules.firstPlayerCanAttack) G.t.canAttack = false;

  await runDelayed(G, P);
  if (G.winner) return;

  // Haunted: roll a D3. On a 1 the Bakemon slinks back to the bench and loses all its energy.
  if (P.active && P.active.status.haunted && bench(P).length) {
    const h = P.active;
    if ((await roll(G, 3, h.card.name + ' is haunted')) === 1) {
      h.energy.splice(0);
      await say2(G, h.card.name + ' loses all its energy and flees to the bench.', { mon: h });
      await switchActive(G, P, await pick(G, P, bench(P), 'promote', 'Who steps up?'));
      await checkKOs(G);
    }
  }

  const a = P.active;
  if (!a) return;
  if (a.effects.some(e => e.kind === 'flinch')) { G.t.canAttack = false; await say2(G, a.card.name + ' flinches and cannot attack this turn.'); }
  if (a.status.asleep) {
    if (await flip(G, a.card.name + ' is asleep')) { delete a.status.asleep; await say2(G, a.card.name + ' wakes up.'); }
    else G.t.canAttack = false;
  }
  if (a.status.paralyzed && !(await flip(G, a.card.name + ' is paralyzed'))) G.t.canAttack = false;
  if (a.status.frozen) {
    if (await flip(G, a.card.name + ' is frozen')) await dealDamage(G, null, a, G.rules.frozenDamage, { why: 'the cold', freeze: true });
    else G.t.canAttack = false;
    await checkKOs(G);
  }
}

async function endTurn(G, P) {
  // Kafkazoa's Plate Armor: every turn it waits instead of attacking, it toughens up.
  if (P.active && hasTag(P.active, 'plateArmor') && !G.t.attacked) {
    P.active.armor = (P.active.armor || 0) + 10;
    await say2(G, P.active.card.name + ' hunkers down. It will take ' + P.active.armor + ' less damage.', { mon: P.active });
  }
  for (const mon of zone(P)) {
    if (mon.status.burned)   await dealDamage(G, null, mon, G.rules.burnDamage, { why: 'its burn' });
    if (mon.status.poisoned) {
      const amount = mon.poisonDoubling || G.rules.poisonDamage;
      if (mon.poisonDoubling) mon.poisonDoubling *= 2;
      const dealt = await dealDamage(G, null, mon, amount, { why: 'poison' });
      for (const leech of zone(other(G, P))) if (hasTag(leech, 'healsOnEnemyPoison')) await heal(G, leech, dealt);
    }
    if (mon.status.asleep) {
      if (mon.sleepHeal) await heal(G, mon, mon.sleepHeal);
      if (equipTag(mon) === 'sleepHeals40') await heal(G, mon, 40);
    }
  }
  // Effects that were only meant to last through this turn go away now.
  for (const Q of G.players) for (const mon of zone(Q)) mon.effects = mon.effects.filter(e => e.expires === undefined || e.expires > G.turnNumber);
  await checkKOs(G);
}

/* ---------------- what you're allowed to do ---------------- */

function canEvolveOnto(G, P, mon, card) {
  if (card.kind !== 'bakemon' || card.stage === 'basic' || card.from !== mon.card.name) return false;
  // Normally a Bakemon can't evolve on the turn it was played, or a second time in one turn.
  // Birthday Boy lifts that once per card played; Grupix's Life Cycle lifts it for grass-types.
  if (needsSameTurnPass(G, mon) && !lifeCycleCovers(P, mon) && !(G.t.freeEvolves > 0)) return false;
  // Mugini: needs an energy of the type it's evolving INTO.
  if (hasTag(mon, 'evolveNeedsMatchingEnergy') && !card.types.some(t => mon.energy.includes(t))) return false;
  // Eclidyr: needs five different kinds of energy before it can evolve.
  if (hasTag(mon, 'fiveTypesToEvolve') && new Set(mon.energy).size < 5) return false;
  return true;
}

const needsSameTurnPass = (G, mon) => mon.playedTurn === G.turnNumber || mon.evolvedTurn === G.turnNumber;
// Grupix's Life Cycle is an ability, so like any ability it works once a turn.
const lifeCycleCovers = (P, mon) => !!P.active && hasTag(P.active, 'grassEvolvesSameTurn') && mon.card.types.includes('grass') && !ACTIVE_G.t.lifeCycleUsed;

function energyTargets(G, P) {
  if (G.t.lockTurn || G.t.noEnergy) return [];
  return zone(P).filter(mon => {
    if (mon.effects.some(e => e.kind === 'noEnergy')) return false;
    if (G.t.energyUsed < G.rules.energyPerTurn) return true;
    return equipTag(mon) === 'extraEnergy' && !G.t.cableUsed[mon.uid];     // Power Cable
  });
}

function retreatBlocked(mon) { return mon.status.taunted || mon.effects.some(e => e.kind === 'cantRetreat'); }

function legalActions(G, P) {
  const actions = [];
  const enemy = other(G, P);

  P.hand.forEach((id, handIndex) => {
    const card = CARD_BY_ID[id];
    if (card.kind === 'bakemon') {
      if (card.stage === 'basic') { if (P.bench.includes(null)) actions.push({ type: 'playBasic', handIndex, cardId: id, label: 'Bench ' + card.name }); }
      else for (const mon of zone(P)) if (canEvolveOnto(G, P, mon, card))
        actions.push({ type: 'evolve', handIndex, cardId: id, mon, label: 'Evolve ' + mon.card.name + ' into ' + card.name });
    } else {
      const item = ITEMS[id] || {};
      let ok = !G.t.lockTurn && !item.todo && (item.equip || item.ops);
      if (ok && item.equip) ok = !!P.active && !P.active.equip;      // only the active Bakemon can wear an item (rules page)
      if (ok && item.equip === 'notepad') ok = notepadChoices(other(G, P)).length > 0;
      if (ok && item.ops) ok = item.ops.every(op => itemOpPossible(G, P, op));
      if (ok) actions.push({ type: 'item', handIndex, cardId: id, label: 'Use ' + card.name });
    }
  });

  if (energyTargets(G, P).length) actions.push({ type: 'energy', label: 'Attach energy' });

  for (const mon of zone(P)) for (const move of cardMoves(mon.card)) {
    if (G.t.lockTurn || mon.effects.some(e => e.kind === 'disabled' && e.moveIndex === move.index)) continue;
    if (!move.isAbility || move.fx.ability !== 'activated') continue;
    if (move.fx.oncePerTurn !== false && G.t.abilityUsed[mon.uid + ':' + move.index]) continue;
    if (!move.ops.every(op => abilityOpPossible(G, P, mon, op))) continue;
    actions.push({ type: 'ability', mon, move, label: mon.card.name + ': ' + move.name });
  }

  const a = P.active;
  if (a && bench(P).length && G.t.retreats < G.rules.retreatsPerTurn && !retreatBlocked(a) && a.energy.length >= a.card.retreat)
    actions.push({ type: 'retreat', label: 'Retreat ' + a.card.name + (a.card.retreat ? '  (costs ' + a.card.retreat + ' energy)' : '  (free)') });

  if (a && enemy.active && G.t.canAttack && !G.t.lockTurn) for (const move of cardMoves(a.card)) {
    if (a.effects.some(e => e.kind === 'disabled' && e.moveIndex === move.index)) continue;
    if (move.fx.needsTargetStatus && !enemy.active.status[move.fx.needsTargetStatus]) continue;   // Chou: only on a sleeper
    if (!move.isAbility && canPay(a, move.cost)) actions.push({ type: 'attack', move, label: move.name + (move.damage ? '   ' + move.damage : '') });
  }

  // Notepad: the wearer may use the move it copied, paying the same NUMBER of energy (any kind). Then the Notepad is used up.
  for (const mon of zone(P)) if (mon.notepad && equipTag(mon) === 'notepad' && !G.t.lockTurn) {
    const mv = mon.notepad;
    if (!mv.isAbility) {
      if (mon === a && enemy.active && G.t.canAttack && mon.energy.length >= mv.cost.total)
        actions.push({ type: 'attack', notepad: mon, move: Object.assign({}, mv, { name: mv.name + ' (Notepad)', cost: { types: {}, any: mv.cost.total, total: mv.cost.total } }),
                       label: mv.name + ' (Notepad)' + (mv.damage ? '   ' + mv.damage : '') });
    } else if (mv.ops.every(op => abilityOpPossible(G, P, mon, op))) actions.push({ type: 'ability', notepad: mon, mon, move: mv, label: mon.card.name + ': ' + mv.name + ' (Notepad)' });
  }

  actions.push({ type: 'endTurn', label: 'End turn' });
  return actions;
}

// What a Notepad could copy: any attack or usable ability on the other side of the table.
function notepadChoices(foe) {
  const list = [];
  for (const m of zone(foe)) for (const mv of cardMoves(m.card)) if (!mv.isAbility || mv.fx.ability === 'activated') list.push({ mon: m, move: mv });
  return list;
}
async function copyIntoNotepad(G, P, holder) {
  const options = notepadChoices(other(G, P)).map(c => ({ label: c.mon.card.name + ': ' + c.move.name + (c.move.damage ? '  ' + c.move.damage : ''), value: c.move }));
  if (!options.length) return;
  const mv = await P.controller.ask(G, P, { kind: 'option', purpose: 'copyMove', prompt: 'Copy which move into the Notepad?', options });
  holder.notepad = mv;
  await say2(G, holder.card.name + ' copies down ' + mv.name + '.', { mon: holder });
}
async function useUpNotepad(G, P, mon) {
  if (mon.hp <= 0 || equipTag(mon) !== 'notepad') return;
  P.discard.push(mon.equip); mon.equip = null; mon.notepad = null;
  await say2(G, 'The Notepad is used up.', { mon });
}

// Is there anything for this op to act on? (Stops you wasting a Band-aid on nobody.)
function itemOpPossible(G, P, op) {
  if (op.heal)             return zone(P).some(m => m.hp < m.maxHp);
  if (op.cure)             return candidates(G, P, null, op.who, op).length > 0;
  if (op.freeRetreat)      return !!P.active && bench(P).length > 0 && !retreatBlocked(P.active);
  if (op.moveAllEnergy)    return zone(P).length > 1 && zone(P).some(m => m.energy.length);
  if (op.transmute)        return zone(P).some(m => m.energy.length);
  if (op.removeEnemyEquip) return zone(other(G, P)).some(m => m.equip);
  if (op.digForEvolution)  return bench(P).length > 0 && P.deck.length > 0;
  if (op.drawUntilBasic)   return P.deck.some(isBasic);
  return true;
}
function abilityOpPossible(G, P, mon, op) {
  if (op.addEnergy || op.heal || op.status) return candidates(G, P, mon, op.to || op.who || op.on, op).length > 0;
  if (op.moveEnergy)   return candidates(G, P, mon, op.from, op).some(m => m.energy.some(e => !op.type || e === op.type)) && candidates(G, P, mon, op.to, op).length > 0;
  if (op.convertEnergy) return zone(P).some(m => m.energy.length);
  if (op.dragToActive) return bench(other(G, P)).some(m => m.energy.includes(op.dragToActive.withEnergy));
  if (op.convertStatus) return !!other(G, P).active && !!other(G, P).active.status[op.convertStatus.from];
  if (op.hydraulic)    return mon.energy.includes('steel') && candidates(G, P, mon, 'any_other', {}).length > 0;
  if (op.cling)        return P.active === mon && G.t.energyUsed === 0 && !G.t.attacked;
  if (op.purify)       return G.players.some(Q => zone(Q).some(m => Object.keys(m.status).some(st => PURIFY_ENERGY[st])));
  if (op.swapPartner) {
    const pr = zone(P).find(m => m !== mon && op.swapPartner.names.includes(m.card.name));
    return !!pr && ((P.active === mon && bench(P).includes(pr)) || (P.active === pr && bench(P).includes(mon)));
  }
  return true;
}

/* ---------------- doing it ---------------- */

async function perform(G, P, action) {
  const enemy = other(G, P);
  switch (action.type) {

    case 'playBasic': {
      const mon = makeMon(G, P.hand.splice(action.handIndex, 1)[0]);
      P.bench[P.bench.indexOf(null)] = mon;
      await say2(G, subj(P, 'benches') + ' ' + mon.card.name + '.', { mon });
      await enterPlay(G, P, mon);
      break;
    }

    case 'evolve': {
      const mon = action.mon, card = CARD_BY_ID[P.hand.splice(action.handIndex, 1)[0]];
      if (needsSameTurnPass(G, mon)) {                                   // this evolution needed help: Life Cycle first, else a Birthday Boy
        if (lifeCycleCovers(P, mon)) G.t.lifeCycleUsed = true; else G.t.freeEvolves -= 1;
      }
      await say2(G, mon.card.name + ' evolves into ' + card.name + '!', { mon, kind: 'evolve' });
      const damageTaken = mon.maxHp - mon.hp;
      mon.card = card; mon.stack.push(card.id);
      mon.maxHp = card.hp; mon.hp = Math.max(10, card.hp - damageTaken);       // damage carries over
      // playedTurn stays as it was (when this card stack first entered play: Birthday Boy and
      // Life Cycle bend THAT rule). evolvedTurn is what stops a second evolution this turn.
      mon.evolvedTurn = G.turnNumber;
      mon.auras = []; mon.sleepHeal = 0; mon.hunger = 0;
      if (G.rules.evolveClearsStatus) { mon.status = {}; mon.poisonDoubling = 0; }
      await enterPlay(G, P, mon);
      break;
    }

    case 'energy': {
      // The screen may have asked already (so you could cancel); otherwise ask now.
      const targets = energyTargets(G, P);
      const mon = targets.includes(action.mon) ? action.mon : await pick(G, P, targets, 'energyTo', 'Attach energy to which Bakemon?');
      const type = ENERGY_COLORS[action.energyType] ? action.energyType : await P.controller.ask(G, P, { kind: 'option', purpose: 'energyType', mon, prompt: 'Which type of energy?',
        options: Object.keys(ENERGY_COLORS).map(t => ({ label: t, value: t, energy: t })) });
      if (G.t.energyUsed < G.rules.energyPerTurn) G.t.energyUsed += 1; else G.t.cableUsed[mon.uid] = true;
      await attachEnergy(G, mon, type);
      break;
    }

    case 'item': {
      const id = P.hand.splice(action.handIndex, 1)[0], card = CARD_BY_ID[id], item = ITEMS[id];
      await say2(G, subj(P, 'uses') + ' ' + card.name + '.', { cardId: id });
      if (item.equip) {
        const mon = P.active;
        mon.equip = id;
        if (item.equip === 'notepad') await copyIntoNotepad(G, P, mon);
        if (item.equip === 'blocksWeakness' && mon.card.weak.length) {
          mon.helmet = mon.card.weak.length === 1 ? mon.card.weak[0] : await P.controller.ask(G, P, { kind: 'option', purpose: 'generic',
            prompt: 'Protect against which weakness?', options: mon.card.weak.map(w => ({ label: w, value: w, energy: w })) });
        }
      } else {
        P.discard.push(id);
        await runOps(G, { P, self: P.active, target: enemy.active, move: null }, item.ops);
      }
      await checkKOs(G);
      break;
    }

    case 'ability': {
      G.t.abilityUsed[(action.notepad ? 'np:' : '') + action.mon.uid + ':' + action.move.index] = true;
      await say2(G, action.mon.card.name + ' uses ' + action.move.name + '.', { mon: action.mon });
      await runOps(G, { P, self: action.mon, target: enemy.active, move: action.move }, action.move.ops);
      if (action.notepad) await useUpNotepad(G, P, action.mon);
      await checkKOs(G);
      break;
    }

    case 'retreat': {
      const a = P.active;
      const incoming = bench(P).includes(action.promote) ? action.promote : null;
      for (let i = 0; i < a.card.retreat; i++) await discardEnergyFrom(G, P, a, null);
      G.t.retreats += 1;
      await switchActive(G, P, incoming || await pick(G, P, bench(P), 'promote', 'Who takes its place?'));
      break;
    }

    case 'attack':
      await resolveAttack(G, P, P.active, action.move);
      if (action.notepad) await useUpNotepad(G, P, action.notepad);
      G.t.over = true;                       // attacking ends your turn
      break;

    case 'endTurn':
      G.t.over = true;
      break;

    case 'noop':                             // the screen rewound the game (Undo) and just wants to be asked again
      break;
  }
}

async function enterPlay(G, P, mon) {
  for (const move of cardMoves(mon.card)) if (move.fx.ability === 'enterPlay')
    { await say2(G, mon.card.name + "'s " + move.name + '!'); await runOps(G, { P, self: mon, target: other(G, P).active, move }, move.ops); }
}

async function attachEnergy(G, mon, type) {
  mon.energy.push(type);
  await say2(G, mon.card.name + ' gains ' + type + ' energy.', { mon, kind: 'energy' });
  if (hasTag(mon, 'hungerShrink')) await checkKOs(G);          // Necrozoa: let its max HP catch up
}

// Going to the bench: statuses fall away and equipment is discarded (rules page).
async function switchActive(G, P, incoming) {
  const outgoing = P.active;
  const slot = P.bench.indexOf(incoming);
  // Quaked: whoever steps in behind it (it retreated, fled, or was knocked out) takes D3 x 10.
  const quake = (outgoing && outgoing.status.quaked) || P.quakedKO;
  P.quakedKO = false;
  if (outgoing) {
    outgoing.status = {}; outgoing.poisonDoubling = 0; outgoing.sleepHeal = 0;
    outgoing.effects = outgoing.effects.filter(e => e.kind !== 'cantRetreat');
    outgoing.auras = [];
    if (outgoing.equip) { P.discard.push(outgoing.equip); outgoing.equip = null; outgoing.helmet = null; outgoing.notepad = null; }
  }
  P.bench[slot] = outgoing || null;
  P.active = incoming;
  await say2(G, subj(P, 'sends') + ' out ' + incoming.card.name + '.', { mon: incoming });
  if (outgoing) releaseBorrowed(G, outgoing, P);
  if (quake) await dealDamage(G, null, incoming, 10 * (await roll(G, 3, 'The quake')), { why: 'the quake' });
  // Cryodyr's Glaciabolt: the frost freezes whatever the other side puts in the active slot.
  const w = currentWeather(G);
  if (w && w.name === 'frost' && ownerOf(G, w.source) !== P && incoming.hp > 0 && (await roll(G, 3, 'The frost')) < 2) await applyStatus(G, incoming, 'frozen');
}

// Gambarue's Rascal borrows an item "until the target retreats or is KO'd". Then it goes to the discard pile.
function releaseBorrowed(G, leaver, ownerP) {
  for (const Q of G.players) for (const m of zone(Q)) if (m.borrowedFrom === leaver && m.equip) {
    ownerP.discard.push(m.equip); m.equip = null; m.helmet = null; m.borrowedFrom = null;
  }
}

/* ---------------- attacking ---------------- */

async function resolveAttack(G, P, attacker, move, copied) {
  const enemy = other(G, P);
  await say2(G, attacker.card.name + ' uses ' + move.name + '!', { mon: attacker, kind: 'attack' });
  if (!copied) { G.lastAttack[P.index] = move; G.t.attacked = true; attacker.armor = 0; }       // Plate Armor drops when it attacks

  // Things that can make an attack fail outright.
  const missNext = attacker.effects.find(e => e.kind === 'missNext');
  if (missNext) { attacker.effects.splice(attacker.effects.indexOf(missNext), 1); return say2(G, 'It misses!'); }
  const mustFlip = attacker.effects.find(e => e.kind === 'mustFlip');
  if (mustFlip) { attacker.effects.splice(attacker.effects.indexOf(mustFlip), 1); if (!(await flip(G, 'Can it attack'))) return say2(G, 'It fails!'); }
  if (enemy.active && equipTag(enemy.active) === 'attackersMustFlip' && !(await flip(G, 'Maced! Does the attack land'))) return say2(G, 'It misses!');

  // Using the same move turn after turn (Curl, Trample). Copied attacks don't count.
  const sameMove = !copied && attacker.lastMove === move.name && attacker.lastAttackTurn === G.turnNumber - 2;
  const streak = sameMove ? attacker.streak + 1 : 1;
  const targetStreak = sameMove && enemy.active && attacker.lastTargetUid === enemy.active.uid ? attacker.targetStreak + 1 : 1;

  const ctx = { P, self: attacker, target: enemy.active, move, base: move.damage, bonus: 0, isAttack: true, streak, targetStreak };
  if (attacker.status.confused && !(await flip(G, attacker.card.name + ' is confused'))) { ctx.target = attacker; await say2(G, 'It hurts itself in its confusion!'); }

  const isPre = op => op.pre || op.bonusIfTargetStatus || op.damagePerEnergy || op.chooseDamage || op.copyLastAttack || op.copyAnyAttack
    || op.noBase || op.lurk || op.streakBonus || (op.perHeads && op.perHeads.damage) || (op.roll && op.times && op.times.damage);
  await runOps(G, ctx, move.ops.filter(isPre));
  if (ctx.replaced) return;                                   // Parrot handed the attack over to another move

  // Bulbark's Lightning Rod: the defender may point an electric attack at someone else.
  const tgt0 = ctx.target;
  if (tgt0 && tgt0 !== attacker && costIncludes(move, 'electric')) {
    const D = ownerOf(G, tgt0);
    if (D && D !== P && zone(D).some(m => hasTag(m, 'redirectElectric'))) {
      const others = zone(D).filter(m => m !== tgt0 && m.hp > 0);
      if (others.length) {
        const dest = await D.controller.ask(G, D, { kind: 'option', purpose: 'redirect', target: tgt0, prompt: 'Lightning Rod: redirect the electric attack?',
          options: [{ label: 'Let it hit ' + tgt0.card.name, value: null }].concat(others.map(m => ({ label: 'Send it to ' + m.card.name + ' (' + m.hp + ' HP)', value: m }))) });
        if (dest) { ctx.target = dest; await say2(G, 'The lightning is drawn to ' + dest.card.name + '!', { mon: dest }); }
      }
    }
  }
  // Brigitte's shield: the wearer may block one attack, and the shield breaks.
  const tgt1 = ctx.target;
  if (tgt1 && tgt1 !== attacker && equipTag(tgt1) === 'blocksAttack') {
    const D = ownerOf(G, tgt1);
    if (D && D !== P && await D.controller.ask(G, D, { kind: 'option', purpose: 'optional', prompt: "Block the attack with Brigitte's shield?",
        options: [{ label: 'Block it', value: true }, { label: 'Take the hit', value: false }] })) {
      D.discard.push(tgt1.equip); tgt1.equip = null; tgt1.helmet = null;
      await say2(G, "The shield blocks the attack, and breaks!", { mon: tgt1 });
      await checkKOs(G);
      return;
    }
  }

  const amount = ctx.base + ctx.bonus;
  if (amount > 0 && ctx.target) ctx.dealt = await dealDamage(G, attacker, ctx.target, amount, { attack: true, move, unavoidable: ctx.unavoidable });
  await runOps(G, ctx, move.ops.filter(op => !isPre(op)));

  // Pyrdyr's Hellfire: every fire or dark attack from this side has a coin flip's chance to burn.
  if (ctx.target && ctx.target !== attacker && ctx.target.hp > 0 && elementalOn(G) && tagCount(G, 'hellfire', P) && (costIncludes(move, 'fire') || costIncludes(move, 'dark'))
      && await flip(G, 'Hellfire')) await applyStatus(G, ctx.target, 'burned');

  // Unstone's Calming Focus: the promised extra damage to the opponent's bench.
  for (const e of attacker.effects.filter(e => e.kind === 'splashBench')) {
    attacker.effects.splice(attacker.effects.indexOf(e), 1);
    for (const m of bench(enemy)) await dealDamage(G, null, m, e.amount, { why: 'the pressure' });
  }

  if (!copied) { attacker.lastMove = move.name; attacker.lastAttackTurn = G.turnNumber; attacker.streak = streak; attacker.targetStreak = targetStreak; attacker.lastTargetUid = ctx.target && ctx.target.uid; }
  await checkKOs(G);
}

// The one place HP goes down. Returns how much was actually dealt.
async function dealDamage(G, source, victim, amount, o) {
  o = o || {};
  if (!victim || victim.hp <= 0) return 0;
  const onBench = !G.players.some(Q => Q.active === victim);
  if (o.attack && source) {
    const P = ownerOf(G, source), move = o.move, elemental = elementalOn(G);
    amount += source.buff;
    for (const e of source.effects) { if (e.kind === 'dmgBuff') amount += e.amount; if (e.kind === 'dmgDebuff') amount -= e.amount; }
    if (source.status.enraged) amount += G.rules.enragedBonus;
    if (hasTag(source, 'twinshipBonus') && P && zone(P).some(m => m.card.name === 'Jeremo♀')) amount += 30;
    if (elemental) {
      if (P) for (const m of zone(P)) for (const aura of m.auras) if (costIncludes(move, aura.costIncludes)) amount += aura.damage;
      if (P && P.active && hasTag(P.active, 'fluttershine') && costIncludes(move, 'grass')) amount += 20;
      if (costIncludes(move, 'dark')) amount += 10 * tagCount(G, 'darkPulse');                              // Lemurk: everyone's dark attacks
      if (victim.status.frozen && costIncludes(move, 'electric') && tagCount(G, 'ionCharge')) amount += 10 * move.cost.types.electric;   // Cryodyr
      if (G.t.amp && G.t.amp.types.some(t => costIncludes(move, t))) amount += G.t.amp.amount;                // Eclidyr's Celestial Bodies
    }
    if (weatherIs(G, 'hydrosurge') && costIncludes(move, 'water')) amount += 20;                              // Draquaduct's weather
    // Weakness: +10 for every matching energy symbol in the attack's cost. (Not on the bench: the rules page.)
    if (!onBench) for (const w of victim.card.weak) if (w !== victim.helmet) amount += costCount(move, ENERGY_ALIASES[w] || w) * G.rules.weaknessBonus;

    if (victim.status.enraged) amount -= G.rules.enragedBonus;
    if (hasTag(victim, 'plateArmor')) amount -= victim.armor || 0;
    const ring = G.players.some(Q => zone(Q).some(m => hasTag(m, 'aquaRing')));
    if (ring && victim.card.types.includes('water') && ['fire', 'fighting', 'dragon'].some(t => costIncludes(move, t))) amount -= 20;

    // Vipere's Ground Dasher: a ground attack heals it instead.
    if (hasTag(victim, 'groundAbsorb') && costIncludes(move, 'ground') && amount > 0) {
      await say2(G, victim.card.name + ' soaks it up!', { mon: victim });
      await heal(G, victim, amount);
      return 0;
    }

    if (!o.unavoidable) for (const shield of victim.effects.filter(e => e.kind === 'shield')) {
      if (shield.onlyFrom && !costIncludes(move, shield.onlyFrom)) continue;
      const blocked = shield.roll ? (await roll(G, shield.roll, victim.card.name + ' braces')) * shield.mult : shield.amount;
      amount = blocked === 'all' ? 0 : amount - blocked;
      if (shield.lasts === 'nextHit') victim.effects.splice(victim.effects.indexOf(shield), 1);
    }

    // Elfdyr's Delusion: the owner may send part of the blow back at the attacker, and the rest anywhere on their own side.
    if (victim.effects.some(e => e.kind === 'delusion') && amount > 0 && !o.redirected) {
      const V = ownerOf(G, victim), A = ownerOf(G, source);
      if (V && A && V !== A && A.active) {
        const choices = []; for (let d = 0; d <= Math.floor(amount / 2); d += 10) choices.push({ label: d ? 'Send ' + d + ' back at ' + A.active.card.name : 'Keep it all on my side', value: d });
        const toThem = choices.length > 1 ? await V.controller.ask(G, V, { kind: 'option', purpose: 'delusionAmount', prompt: 'Delusion: how much of the ' + amount + ' damage goes back at the attacker?', options: choices }) : 0;
        const mine = zone(V).filter(m => m.hp > 0);
        const keep = amount - toThem;
        const home = !keep || mine.length < 2 ? victim : await V.controller.ask(G, V, { kind: 'mon', purpose: 'delusionOwn', prompt: 'Delusion: which of your Bakemon takes the other ' + keep + '?', options: mine });
        await say2(G, victim.card.name + "'s Delusion bends the blow!", { mon: victim });
        if (toThem) await dealDamage(G, null, A.active, toThem, { why: 'Delusion', redirected: true });
        if (home !== victim && keep) await dealDamage(G, null, home, keep, { why: 'Delusion', redirected: true });
        if (toThem < 30 && A.active.hp > 0) await applyStatus(G, A.active, 'haunted');
        amount = home === victim ? keep : 0;
      }
    }
  }
  // Sleetle's Frostbite and Tytania's Starfall touch every kind of damage, not just attacks.
  if (amount > 0 && victim.status.frozen && tagCount(G, 'frostbite')) amount += 20;
  if (amount > 0 && victim.card.types.includes('fairy') && weatherIs(G, 'starfall')) amount -= await roll(G, 6, 'Starfall softens the blow');

  amount = Math.max(0, Math.round(amount));
  victim.hp -= amount;
  if (amount > 0) victim.lastHit = amount;
  await say2(G, amount ? victim.card.name + ' takes ' + amount + (o.why ? ' from ' + o.why : '') + '.' : victim.card.name + ' takes no damage.', { mon: victim, kind: 'damage', amount });

  // A taunt that wears off after enough punishment (Glumwyrm).
  if (amount > 0 && victim.status.taunted && victim.tauntLeft) {
    victim.tauntLeft -= amount;
    if (victim.tauntLeft <= 0) { delete victim.status.taunted; victim.tauntLeft = 0; await say2(G, victim.card.name + ' shakes off the taunt.'); }
  }
  // Shelby's Ice Eggs: cold damage to one side heals an ice-type on the other.
  if (o.freeze && amount > 0) {
    const V = ownerOf(G, victim);
    for (const Q of G.players) if (Q !== V && tagCount(G, 'iceEggs', Q)) {
      const mon = await pick(G, Q, candidates(G, Q, null, 'own_any', { ofType: 'ice', damagedOnly: true }), 'heal', 'Heal which ice-type?');
      if (mon) await heal(G, mon, amount);
    }
  }

  if (o.attack && source && amount > 0 && source !== victim) {
    const P = ownerOf(G, victim);
    if (equipTag(victim) === 'burnsAttackers') await applyStatus(G, source, 'burned');
    for (const e of victim.effects.slice()) {
      if (e.kind === 'retaliate') await applyStatus(G, source, e.status);
      if (e.kind === 'reflect' && amount - e.minus > 0) await dealDamage(G, null, source, amount - e.minus, { why: 'the reflection' });
      if (e.kind === 'thorns') await dealDamage(G, null, source, e.amount, { why: 'the thorns' });
      if (e.kind === 'barbed') {
        victim.effects.splice(victim.effects.indexOf(e), 1);
        const n = await roll(G, 3, 'Barbed Coil');
        await dealDamage(G, null, source, n * 10, { why: 'the barbs' });
      }
    }
    for (const move of cardMoves(victim.card)) if (move.fx.ability === 'whenHit' && (!move.fx.onlyBelowHp || victim.hp < move.fx.onlyBelowHp)) {
      await say2(G, victim.card.name + "'s " + move.name + '!');
      await runOps(G, { P, self: victim, target: source, attacker: source, move }, move.ops);
    }
  }
  return amount;
}

async function heal(G, mon, amount) {
  if (!mon || mon.hp <= 0 || amount <= 0) return;
  const healed = Math.min(amount, mon.maxHp - mon.hp);
  mon.hp += healed;
  if (healed) await say2(G, mon.card.name + ' heals ' + healed + '.', { mon, kind: 'heal', amount: healed });
}

async function applyStatus(G, mon, name, op) {
  if (!mon || mon.hp <= 0) return;
  mon.status[name] = true;
  if (op && op.doubling) mon.poisonDoubling = op.doubling;
  if (name === 'taunted') mon.tauntLeft = (op && op.tauntDamage) || 0;       // 0 = until it leaves the active slot
  await say2(G, mon.card.name + ' is now ' + name + '.', { mon, kind: 'status', status: name });
}

async function discardEnergyFrom(G, P, mon, type) {
  let i = type ? mon.energy.indexOf(type) : -1;
  if (i < 0 && type) return false;
  if (i < 0) {
    if (!mon.energy.length) return false;
    const kinds = [...new Set(mon.energy)];
    const chosen = kinds.length === 1 ? kinds[0] : await P.controller.ask(G, P, { kind: 'option', purpose: 'discardEnergy', mon,
      prompt: 'Discard which energy from ' + mon.card.name + '?', options: kinds.map(k => ({ label: k, value: k, energy: k })) });
    i = mon.energy.indexOf(chosen);
  }
  const gone = mon.energy.splice(i, 1)[0];
  await say2(G, mon.card.name + ' loses ' + gone + ' energy.', { mon });
  return true;
}

/* ---------------- knock-outs and winning ---------------- */

// Necrozoa's Hungry Ghost: 10 less max HP for every psychic energy on it. The damage it has
// taken stays the same, so its HP moves with its max HP, and both come back when the energy goes.
async function syncHunger(G) {
  for (const Q of G.players) for (const m of zone(Q)) {
    const want = hasTag(m, 'hungerShrink') ? 10 * m.energy.filter(e => e === 'psychic').length : 0;
    const change = want - (m.hunger || 0);
    if (!change) continue;
    m.maxHp -= change; m.hp -= change; m.hunger = want;
    await say2(G, m.card.name + (change > 0 ? ' withers. Max HP ' : ' recovers. Max HP ') + m.maxHp + '.', { mon: m });
  }
}

async function checkKOs(G) {
  if (G.winner) return;
  await syncHunger(G);
  const hadWeather = currentWeather(G);
  for (const P of G.players) {
    for (const mon of zone(P)) if (mon.hp <= 0) {
      await say2(G, mon.card.name + ' is knocked out!', { mon, kind: 'ko' });
      P.discard.push(...mon.stack); if (mon.equip) P.discard.push(mon.equip);
      if (P.active === mon) { if (mon.status.quaked) P.quakedKO = true; P.active = null; } else P.bench[P.bench.indexOf(mon)] = null;
      releaseBorrowed(G, mon, P);
      other(G, P).points += 1;
    }
  }
  if (hadWeather && !currentWeather(G)) await say2(G, 'The ' + (WEATHER[hadWeather.name] ? WEATHER[hadWeather.name].label : hadWeather.name) + ' fades away.');
  // Whose turn it is wins ties, which can only happen when both sides go down at once.
  const order = [G.players[G.turn], G.players[1 - G.turn]];
  for (const P of order) if (P.points >= G.rules.pointsToWin) return declare(G, P, subj(P, 'reaches') + ' ' + P.points + ' points.');
  for (const P of order) if (!P.active) {
    if (bench(P).length) await switchActive(G, P, await pick(G, P, bench(P), 'promote', 'Who steps up?'));
    else if (G.rules.noBakemonLeftLoses) return declare(G, other(G, P), subj(P, 'has') + ' no Bakemon left.');
  }
  // A quake can knock out the Bakemon that just stepped up. Look again.
  if (G.players.some(Q => zone(Q).some(m => m.hp <= 0))) await checkKOs(G);
}

async function declare(G, P, why) { G.winner = P; G.t.over = true; await say2(G, why + ' ' + subj(P, 'wins') + '!', { kind: 'win' }); }

/* ---------------- choosing a Bakemon ---------------- */

function candidates(G, P, self, selector, op) {
  const enemy = other(G, P);
  let list = {
    self: [self], enemy_active: [enemy.active],
    own_bench: bench(P), own_other: zone(P).filter(m => m !== self), own_any: zone(P),
    enemy_bench: bench(enemy), enemy_any: zone(enemy), any: zone(P).concat(zone(enemy)),
    any_other: zone(P).concat(zone(enemy)).filter(m => m !== self),
  }[selector || 'self'] || [];
  list = list.filter(m => m && m.hp > 0);
  if (op && op.damagedOnly) list = list.filter(m => m.hp < m.maxHp);
  if (op && op.names)      list = list.filter(m => op.names.includes(m.card.name));
  if (op && op.ofType)     list = list.filter(m => m.card.types.includes(op.ofType));
  if (op && op.activeOnly) list = list.filter(m => G.players.some(Q => Q.active === m));
  if (op && op.withStatus) list = list.filter(m => op.withStatus === 'any' ? Object.keys(m.status).length : m.status[op.withStatus]);
  return list;
}

async function pick(G, P, list, purpose, prompt) {
  if (list.length <= 1) return list[0] || null;
  return P.controller.ask(G, P, { kind: 'mon', purpose, prompt, options: list });
}

async function selectMon(G, ctx, selector, op, purpose, prompt) {
  if (selector === 'target')   return ctx.target && ctx.target.hp > 0 ? ctx.target : null;
  if (selector === 'attacker') return ctx.attacker || null;
  return pick(G, ctx.P, candidates(G, ctx.P, ctx.self, selector, op), purpose, prompt);
}

/* ---------------- the ops ----------------
   One `if` per word of the vocabulary in data/moves.js.
   To teach the game a new kind of effect: add an `if` here, describe
   it in the comment at the top of data/moves.js, and use it on a card. */

async function runOps(G, ctx, ops) {
  const P = ctx.P, enemy = other(G, P), me = ctx.self;
  const until = turns => G.turnNumber + turns;

  for (const op of ops || []) {
    if (G.winner) return;

    if (op.optional) {
      const yes = await P.controller.ask(G, P, { kind: 'option', purpose: 'optional', prompt: op.optional, options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] });
      if (yes) await runOps(G, ctx, op.ops);
    }

    else if (op.flip || op.flipPerOwnEnergy || op.flipUntilTails) {
      const n = op.flipUntilTails ? 0 : op.flipPerOwnEnergy ? me.energy.length : op.flip;
      let heads = 0;
      if (op.flipUntilTails) { while (heads < 40 && await flip(G, 'Until tails')) heads++; }
      for (let i = 0; i < n; i++) if (await flip(G, op.flipper === 'opponent' ? subj(enemy, 'flips') : '')) heads++;
      if (op.replaceBase) ctx.base = 0;
      if (op.perHeads) {
        const per = op.perHeads;
        if (per.damage) ctx.bonus += per.damage * heads;
        if (per.heal)   await heal(G, me, per.heal * heads + fluttershineBonus(P, ctx.move));
        if (per.shield && heads) me.effects.push({ kind: 'shield', amount: per.shield * heads, lasts: 'nextTurn', expires: until(1) });
        if (per.discardEnemyEnergy) for (let i = 0; i < heads; i++) {
          const victim = zone(enemy).filter(m => m.energy.length).sort((a, b) => (b === enemy.active) - (a === enemy.active))[0];
          if (victim) await discardEnergyFrom(G, P, victim, null);
        }
      }
      if (op.atLeast && heads >= op.atLeast.n) await runOps(G, ctx, op.atLeast.ops);
      if (op.heads && n === 1 && heads)  await runOps(G, ctx, op.heads);
      if (op.tails && n === 1 && !heads) await runOps(G, ctx, op.tails);
    }

    else if (op.heal) {
      const mon = await selectMon(G, Object.assign({}, ctx, { self: me }), op.who || 'self', Object.assign({ damagedOnly: true }, op), 'heal', 'Heal which Bakemon?');
      await heal(G, mon, op.heal + fluttershineBonus(P, ctx.move));
    }
    else if (op.healPerEnergy) await heal(G, me, op.healPerEnergy * me.energy.filter(e => e === op.type).length + fluttershineBonus(P, ctx.move));
    else if (op.sleepHeal) me.sleepHeal = op.sleepHeal;

    else if (op.status) await applyStatus(G, await selectMon(G, ctx, op.on || 'target', op, 'hurt', ''), op.status, op);
    else if (op.cure) {
      const mon = await selectMon(G, ctx, op.who, op, 'cure', 'Which Bakemon?');
      if (mon) { if (op.cure === 'all') { mon.status = {}; mon.poisonDoubling = 0; } else for (const s of op.cure) delete mon.status[s]; await say2(G, mon.card.name + ' recovers.', { mon }); }
    }

    else if (op.bonusIfTargetStatus) { if (ctx.target && ctx.target.status[op.bonusIfTargetStatus]) ctx.bonus += op.damage; }
    else if (op.damagePerEnergy) {
      const mons = op.where === 'zone' ? zone(P) : [me];
      const count = mons.reduce((n, m) => n + m.energy.filter(e => e === op.type).length, 0);
      if (op.replaceBase) ctx.base = 0;
      ctx.bonus += op.damagePerEnergy * count;
    }
    else if (op.chooseDamage) {
      const choices = []; for (let d = op.chooseDamage.step; d <= op.chooseDamage.max; d += op.chooseDamage.step) choices.push({ label: d + ' damage', value: d });
      ctx.base = await P.controller.ask(G, P, { kind: 'option', purpose: 'chooseDamage', self: me, target: ctx.target, prompt: 'How much damage? ' + me.card.name + ' takes the same.', options: choices });
      if (op.chooseDamage.recoil) ctx.recoil = ctx.base;
    }
    else if (op.copyLastAttack) {
      const theirs = G.lastAttack[enemy.index];
      ctx.replaced = true;
      if (!theirs || theirs.ops.some(o => o.copyLastAttack)) await say2(G, 'There is nothing to copy.');
      else { await say2(G, me.card.name + ' copies ' + theirs.name + '!'); await resolveAttack(G, P, me, theirs, true); }
    }

    else if (op.retarget) {
      const mon = await selectMon(G, ctx, op.retarget, op, 'hurt', 'Hit which Bakemon?');
      if (mon) ctx.target = mon;               // with nobody on the bench, it just hits the active one
      if (op.unavoidable) ctx.unavoidable = true;
    }
    else if (op.damageBench) {
      const targets = op.pick === 'all' ? bench(enemy) : [await pick(G, P, bench(enemy), 'hurt', 'Hit which benched Bakemon?')];
      for (const mon of targets) if (mon) await dealDamage(G, null, mon, op.damageBench, {});
    }
    else if (op.selfDamage)      await dealDamage(G, null, me, op.selfDamage, { why: 'the recoil' });
    else if (op.selfDamageIfHit) { if (ctx.dealt > 0) await dealDamage(G, null, me, op.selfDamageIfHit, { why: 'the recoil' }); }

    else if (op.shield) {
      const mon = await selectMon(G, ctx, op.who || 'self', op, 'protect', 'Protect which Bakemon?');
      if (mon) mon.effects.push({ kind: 'shield', amount: op.grows ? op.shield * (ctx.streak || 1) : op.shield, lasts: op.lasts, onlyFrom: op.onlyFrom, expires: op.lasts === 'nextTurn' ? until(1) : undefined });
    }
    else if (op.shieldRoll) me.effects.push({ kind: 'shield', roll: op.shieldRoll.sides, mult: op.shieldRoll.mult, lasts: 'nextTurn', expires: until(1) });
    else if (op.reflect)   me.effects.push({ kind: 'reflect', minus: op.reflect.minus, expires: until(1) });
    else if (op.retaliate) me.effects.push({ kind: 'retaliate', status: op.retaliate.status, expires: until(1) });
    else if (op.aura)      me.auras.push(op.aura);
    else if (op.buffSelf)  { if (op.lasts === 'forever') me.buff += op.buffSelf; else me.effects.push({ kind: 'dmgBuff', amount: op.buffSelf, expires: until(2) }); }

    else if (op.debuffTarget || op.targetMisses || op.targetMustFlip || op.cantRetreat || op.noEnergy) {
      const mon = await selectMon(G, ctx, op.on || 'target', op, 'hurt', '');
      if (!mon) continue;
      const theirTurnNow = G.players[G.turn] === ownerOf(G, mon);         // e.g. Contact Zap fires while they're attacking
      if (op.debuffTarget)   mon.effects.push({ kind: 'dmgDebuff', amount: op.debuffTarget, expires: until(2 * op.turns - (theirTurnNow ? 0 : 1)) });
      if (op.targetMisses)   mon.effects.push({ kind: 'missNext', expires: until(1) });
      if (op.targetMustFlip) mon.effects.push({ kind: 'mustFlip', expires: until(1) });
      if (op.cantRetreat)    mon.effects.push({ kind: 'cantRetreat', expires: until(1) });
      if (op.noEnergy)       mon.effects.push({ kind: 'noEnergy', expires: until(1) });
    }

    else if (op.discardEnergy) {
      const mon = await selectMon(G, ctx, op.from, op, 'hurt', '');
      for (let i = 0; mon && i < op.discardEnergy; i++) await discardEnergyFrom(G, P, mon, op.type || null);
    }
    else if (op.discardAllEnergy) { while (me.energy.includes(op.discardAllEnergy)) await discardEnergyFrom(G, P, me, op.discardAllEnergy); }
    else if (op.discardZoneEnergy) {
      const side = op.side === 'own' ? P : enemy;
      for (let i = 0; i < op.discardZoneEnergy; i++) {
        const mon = zone(side).find(m => m.energy.some(e => op.types.includes(e)));
        if (mon) await discardEnergyFrom(G, P, mon, mon.energy.find(e => op.types.includes(e)));
      }
    }
    else if (op.liquidation) {
      const spec = op.liquidation, lost = new Set();
      for (let i = 0; i < spec.count; i++) {
        const mon = zone(enemy).find(m => m.energy.some(e => spec.types.includes(e)));
        if (mon) { await discardEnergyFrom(G, P, mon, mon.energy.find(e => spec.types.includes(e))); lost.add(mon); }
      }
      for (const mon of zone(enemy)) if (!lost.has(mon)) await dealDamage(G, null, mon, spec.otherwise, {});
    }

    else if (op.addEnergy) {
      const mon = await selectMon(G, ctx, op.to, op, 'energyTo', 'Give energy to which Bakemon?');
      if (!mon) continue;
      const type = op.addEnergy !== 'choose' ? op.addEnergy : await P.controller.ask(G, P, { kind: 'option', purpose: 'energyType', mon, prompt: 'Which type of energy?',
        options: Object.keys(ENERGY_COLORS).map(t => ({ label: t, value: t, energy: t })) });
      await attachEnergy(G, mon, type);
    }
    else if (op.moveEnergy) {
      const hasIt = m => m.energy.some(e => !op.type || e === op.type);
      const from = op.from === 'self' ? me : await pick(G, P, candidates(G, P, me, op.from, op).filter(hasIt), 'energyFrom', 'Take energy from which Bakemon?');
      const to = op.to === 'target' ? ctx.target : op.to === 'self' ? me : await pick(G, P, candidates(G, P, me, op.to, {}).filter(m => m !== from), 'energyTo', 'Move it to which Bakemon?');
      if (!from || !to || !hasIt(from) || to.hp <= 0) continue;
      const kinds = [...new Set(from.energy)];
      const type = op.type || (kinds.length === 1 ? kinds[0] : await P.controller.ask(G, P, { kind: 'option', purpose: 'energyType', mon: to,
        prompt: 'Take which energy from ' + from.card.name + '?', options: kinds.map(k => ({ label: k, value: k, energy: k })) }));
      from.energy.splice(from.energy.indexOf(type), 1);
      await say2(G, 'One ' + type + ' energy moves from ' + from.card.name + ' to ' + to.card.name + '.');
      await attachEnergySilently(G, to, type);
    }
    else if (op.stealEnergy) {
      if (!ctx.target || !ctx.target.energy.length) continue;
      const type = ctx.target.energy.pop();
      const to = await pick(G, P, zone(P), 'energyTo', 'Give the stolen ' + type + ' energy to which Bakemon?');
      await say2(G, me.card.name + ' steals ' + type + ' energy!');
      await attachEnergySilently(G, to, type);
    }
    else if (op.convertEnergy) {
      const mon = await pick(G, P, candidates(G, P, me, op.on, {}).filter(m => m.energy.length), 'convert', 'Change energy on which Bakemon?');
      if (!mon) continue;
      const askType = (prompt, types) => types.length === 1 ? types[0] : P.controller.ask(G, P, { kind: 'option', purpose: 'energyType', mon, prompt, options: types.map(t => ({ label: t, value: t, energy: t })) });
      const from = await askType('Change which energy?', [...new Set(mon.energy)]);
      const to = op.convertEnergy !== 'choose' ? op.convertEnergy : await askType('Into what?', Object.keys(ENERGY_COLORS));
      mon.energy[mon.energy.indexOf(from)] = to;
      await say2(G, mon.card.name + "'s " + from + ' energy becomes ' + to + '.', { mon });
    }
    else if (op.transmute) {
      const mon = await pick(G, P, zone(P).filter(m => m.energy.length), 'convert', 'Transmute energy on which Bakemon?');
      const askType = (prompt, types) => types.length === 1 ? types[0] : P.controller.ask(G, P, { kind: 'option', purpose: 'energyType', mon, prompt, options: types.map(t => ({ label: t, value: t, energy: t })) });
      const from = await askType('Change ALL of which type?', [...new Set(mon.energy)]);
      const to = await askType('Into what?', Object.keys(ENERGY_COLORS));
      mon.energy = mon.energy.map(e => e === from ? to : e);
      await say2(G, 'All of ' + mon.card.name + "'s " + from + ' energy becomes ' + to + '.', { mon });
    }
    else if (op.moveAllEnergy) {
      const from = await pick(G, P, zone(P).filter(m => m.energy.length), 'energyFrom', 'Take all the energy from which Bakemon?');
      const to = await pick(G, P, zone(P).filter(m => m !== from), 'energyTo', 'Give it to which Bakemon?');
      if (!from || !to) continue;
      await say2(G, 'All of ' + from.card.name + "'s energy moves to " + to.card.name + '.');
      for (const e of from.energy.splice(0)) await attachEnergySilently(G, to, e);
    }

    else if (op.draw)     await say2(G, subj(P, 'draws') + ' ' + (await drawCards(G, P, op.draw)) + '.');
    else if (op.bothDraw) {
      await drawCards(G, P, op.bothDraw);
      const got = await drawCards(G, enemy, op.bothDraw);
      const shown = enemy.hand.slice(enemy.hand.length - got);                // the opponent must show theirs
      await say2(G, 'Both players draw. ' + subj(enemy, 'shows') + ' ' + (shown.map(id => CARD_BY_ID[id].name).join(', ') || 'nothing') + '.', shown[0] ? { cardId: shown[0] } : {});
    }
    else if (op.opponentDiscards) for (let i = 0; i < op.opponentDiscards && enemy.hand.length; i++) {
      const id = enemy.hand.splice(Math.floor(Math.random() * enemy.hand.length), 1)[0];
      enemy.discard.push(id); await say2(G, subj(enemy, 'discards') + ' ' + CARD_BY_ID[id].name + '.', { cardId: id });
    }
    else if (op.opponentShufflesHandAway) {
      if (G.turnNumber === 0) continue;                                   // not during setup (see data/moves.js)
      enemy.deck = shuffle(enemy.deck.concat(enemy.hand.splice(0)));
      await say2(G, subj(enemy, 'shuffles') + ' ' + their(enemy) + ' whole hand back into ' + their(enemy) + ' deck.');
    }
    else if (op.newHand) {
      const who = await P.controller.ask(G, P, { kind: 'option', purpose: 'whoseHand', prompt: 'Whose hand gets reshuffled?', options: [{ label: 'Mine', value: P.index }, { label: enemy.name + "'s", value: enemy.index }] });
      const Q = G.players[who];
      Q.deck = shuffle(Q.deck.concat(Q.hand.splice(0)));
      await drawCards(G, Q, op.newHand);
      await say2(G, subj(Q, 'shuffles') + ' ' + their(Q) + ' hand away and ' + (Q.isHuman ? 'draw ' : 'draws ') + op.newHand + '.');
    }
    else if (op.reshuffleDiscard) {
      const who = await P.controller.ask(G, P, { kind: 'option', purpose: 'whoseDiscard', prompt: 'Whose discard pile goes back in the deck?', options: [{ label: 'Mine', value: P.index }, { label: enemy.name + "'s", value: enemy.index }] });
      const Q = G.players[who];
      Q.deck = shuffle(Q.deck.concat(Q.discard.splice(0)));
      await say2(G, subj(Q, 'shuffles') + ' ' + their(Q) + ' discard pile into ' + their(Q) + ' deck.');
    }
    else if (op.digForEvolution) {
      const wanted = id => bench(P).some(m => CARD_BY_ID[id].from === m.card.name);
      let drawn = 0;
      while (P.deck.length) { const id = P.deck.pop(); P.hand.push(id); drawn++; if (wanted(id)) break; }
      await say2(G, subj(P, 'draws') + ' ' + drawn + ' card' + (drawn === 1 ? '' : 's') + '.');
      if (drawn > op.digForEvolution.penaltyOver) {
        const n = Math.min(op.digForEvolution.discard, P.hand.length);
        await say2(G, 'That was more than ' + op.digForEvolution.penaltyOver + ' cards, so ' + (P.isHuman ? 'you' : P.name) + ' must discard ' + n + '.');
        for (let i = 0; i < n; i++) {
          const idx = P.hand.length === 1 ? 0 : await P.controller.ask(G, P, { kind: 'option', purpose: 'discardFromHand', prompt: 'Discard a card from your hand (' + (i + 1) + ' of ' + n + ')',
            options: P.hand.map((id, handIndex) => ({ label: CARD_BY_ID[id].name, value: handIndex, cardId: id })) });
          const id = P.hand.splice(idx, 1)[0];
          P.discard.push(id);
          await say2(G, subj(P, 'discards') + ' ' + CARD_BY_ID[id].name + '.', { cardId: id });
        }
      }
    }
    else if (op.evolveFreelyThisTurn) { G.t.freeEvolves = (G.t.freeEvolves || 0) + 1; await say2(G, subj(P, 'may') + ' evolve a Bakemon played this turn.'); }
    else if (op.freeRetreat) { if (bench(P).length) await switchActive(G, P, await pick(G, P, bench(P), 'promote', 'Who comes out instead?')); }
    else if (op.removeEnemyEquip) {
      const mon = await pick(G, P, zone(enemy).filter(m => m.equip), 'hurt', 'Wash the item off which Bakemon?');
      if (mon) { await say2(G, mon.card.name + ' loses its ' + CARD_BY_ID[mon.equip].name + '.'); enemy.discard.push(mon.equip); mon.equip = null; mon.helmet = null; }
    }
    else if (op.forceSwitch) { if (bench(enemy).length) await switchActive(G, enemy, await pick(G, enemy, bench(enemy), 'promote', 'You must switch. Who comes out?')); ctx.target = enemy.active; }
    else if (op.dragToActive) {
      const mon = await pick(G, P, bench(enemy).filter(m => m.energy.includes(op.dragToActive.withEnergy)), 'hurt', 'Drag which Bakemon into the active slot?');
      if (mon) { await switchActive(G, enemy, mon); ctx.target = enemy.active; }
    }
    /* ---- dice, weather, and the newer vocabulary ---- */
    else if (op.roll) {
      const v = await roll(G, op.roll, op.why || (me ? me.card.name : ''));
      ctx.lastRoll = v;
      if (op.times) {
        if (op.replaceBase) ctx.base = 0;
        if (op.times.damage) ctx.bonus += op.times.damage * v;
        if (op.times.heal)   await heal(G, me, op.times.heal * v);
      }
      if (op.min !== undefined) await runOps(G, ctx, v >= op.min ? op.then : op.otherwise);
      if (op.table && op.table[v]) await runOps(G, ctx, op.table[v]);
    }
    else if (op.weather) {
      G.weather = { name: op.weather, source: me };
      await say2(G, 'The weather changes: ' + (WEATHER[op.weather] ? WEATHER[op.weather].label : op.weather) + '!', { kind: 'weather' });
    }
    else if (op.ifWeather) { if (weatherIs(G, op.ifWeather)) await runOps(G, ctx, op.then); }
    else if (op.flinch) {
      const mon = await selectMon(G, ctx, op.on || 'target', op, 'hurt', '');
      if (mon) { mon.effects.push({ kind: 'flinch', expires: until(1) }); await say2(G, mon.card.name + ' flinches!', { mon }); }
    }
    else if (op.thorns)      me.effects.push({ kind: 'thorns', amount: op.thorns, expires: until(1) });
    else if (op.barbed)      me.effects.push({ kind: 'barbed' });
    else if (op.splashBench) me.effects.push({ kind: 'splashBench', amount: op.splashBench, expires: until(2) });
    else if (op.healByDealt) { if (ctx.dealt > 0) await heal(G, me, ctx.dealt); }
    else if (op.noBase)      ctx.base = 0;
    else if (op.lurk) {            // Miremalkin: first use stores the last hit it took, the next use pays it back double
      ctx.base = 0;
      if (me.lurkStored !== undefined) { ctx.bonus += 2 * me.lurkStored; await say2(G, me.card.name + ' strikes back for double the ' + me.lurkStored + ' it stored!', { mon: me }); delete me.lurkStored; }
      else { me.lurkStored = me.lastHit || 0; await say2(G, me.card.name + ' lies in wait, storing ' + me.lurkStored + ' damage.', { mon: me }); }
    }
    else if (op.streakBonus) ctx.bonus += op.streakBonus * ((op.sameTarget ? ctx.targetStreak : ctx.streak) - 1);
    else if (op.lockTurn)    { G.t.lockTurn = true; await say2(G, me.card.name + ' settles in. Nothing else can be done this turn.'); }
    else if (op.cling) {
      me.effects.push({ kind: 'shield', amount: 'all', lasts: 'nextTurn', expires: until(1) });
      G.t.canAttack = false; G.t.noEnergy = true;
      await say2(G, me.card.name + ' clings to the ceiling.', { mon: me });
    }
    else if (op.amplify) {
      const heads = await flip(G, me.card.name);
      G.t.amp = { types: heads ? op.amplify.heads : op.amplify.tails, amount: op.amplify.amount };
      await say2(G, G.t.amp.types.join(', ') + ' attacks hit ' + op.amplify.amount + ' harder this turn.');
    }
    else if (op.convertStatus) {
      const mon = enemy.active, c = op.convertStatus;
      if (mon && mon.status[c.from]) { delete mon.status[c.from]; mon.status[c.to] = true; await say2(G, mon.card.name + ' is no longer ' + c.from + '. It is ' + c.to + '!', { mon, kind: 'status', status: c.to }); }
    }
    else if (op.purify) {
      const options = [];
      for (const Q of G.players) for (const m of zone(Q)) for (const st of Object.keys(m.status)) if (PURIFY_ENERGY[st])
        options.push({ label: m.card.name + ': ' + st + '  (becomes ' + PURIFY_ENERGY[st] + ' energy)', value: { mon: m, status: st } });
      if (!options.length) continue;
      const c = await P.controller.ask(G, P, { kind: 'option', purpose: 'purify', prompt: 'Cleanse which status?', options });
      delete c.mon.status[c.status]; if (c.status === 'poisoned') c.mon.poisonDoubling = 0;
      let type = PURIFY_ENERGY[c.status];
      if (type === 'random') type = Object.keys(ENERGY_COLORS)[Math.floor(Math.random() * Object.keys(ENERGY_COLORS).length)];
      await say2(G, c.mon.card.name + ' is cleansed. The ' + c.status + ' becomes ' + type + ' energy.', { mon: c.mon });
      const to = await pick(G, P, zone(P).concat(zone(enemy)), 'energyTo', 'Attach the ' + type + ' energy to which Bakemon?');
      if (to) await attachEnergy(G, to, type);
    }
    else if (op.flashFreeze) {
      const entries = [];
      for (const Q of G.players) for (const m of zone(Q)) {
        const n = m.energy.filter(e => e === 'water').length;
        if (n) { m.energy = m.energy.map(e => e === 'water' ? 'ice' : e); entries.push({ mon: m, n }); }
      }
      await say2(G, entries.length ? 'Every water energy freezes into ice until the next turn.' : 'There is no water energy to freeze.');
      if (entries.length) G.delayed.push({ kind: 'thaw', at: G.turnNumber + 2, owner: P.index, entries });
    }
    else if (op.stones) {
      const n = await roll(G, 6, 'Stones rise');
      await say2(G, n + ' stone' + (n === 1 ? '' : 's') + ' hang in the air above ' + their(enemy) + ' side.');
      G.delayed.push({ kind: 'stones', at: G.turnNumber + 2, owner: P.index, n, each: op.stones });
    }
    else if (op.sporeBloom) {
      const marks = zone(enemy).map(m => ({ mon: m, slot: slotOf(G, m) }));
      await say2(G, 'Spores begin to grow across ' + their(enemy) + ' side.');
      G.delayed.push({ kind: 'spores', at: G.turnNumber + 3, owner: P.index, marks, damage: op.sporeBloom.damage, heal: op.sporeBloom.heal, names: MUSHROOMS });
    }
    else if (op.delayHit) {
      const mon = await pick(G, P, zone(enemy), 'hurt', 'Declare which Bakemon as your target?');
      if (mon) { await say2(G, mon.card.name + ' is marked.', { mon }); G.delayed.push({ kind: 'tongue', at: G.turnNumber + 2, owner: P.index, mon, slot: slotOf(G, mon), damage: op.delayHit }); }
    }
    else if (op.retreatSelf) {
      const spec = op.retreatSelf === true ? {} : op.retreatSelf;
      if (P.active !== me || me.hp <= 0) continue;
      const options = bench(P).filter(m => !spec.ofType || m.card.types.includes(spec.ofType));
      if (!options.length) { await say2(G, 'There is nobody to take its place.'); continue; }
      await switchActive(G, P, await pick(G, P, options, 'promote', 'Who takes its place?'));
    }
    else if (op.copyAnyAttack) {
      const v = await roll(G, op.copyAnyAttack, me.card.name);
      const options = [];
      for (const Q of G.players) for (const m of zone(Q)) for (const mv of cardMoves(m.card))
        if (!mv.isAbility && mv.cost.total <= v && !mv.ops.some(o => o.copyAnyAttack || o.copyLastAttack))
          options.push({ label: m.card.name + ': ' + mv.name + (mv.damage ? '  ' + mv.damage : ''), value: mv });
      ctx.replaced = true;
      if (!options.length) { await say2(G, 'There is nothing to copy with ' + v + ' energy.'); continue; }
      const chosen = await P.controller.ask(G, P, { kind: 'option', purpose: 'copyMove', prompt: 'Copy which attack? (up to ' + v + ' energy)', options });
      await say2(G, me.card.name + ' copies ' + chosen.name + '!');
      await resolveAttack(G, P, me, chosen, true);
    }
    else if (op.dragBenchSlot) {
      const mon = enemy.bench[(await roll(G, 3, me.card.name)) - 1];
      if (!mon) { await say2(G, 'That slot is empty. The attack fails.'); continue; }
      await say2(G, mon.card.name + ' is dragged onto the stage!', { mon });
      await switchActive(G, enemy, mon); ctx.target = enemy.active;
    }
    else if (op.swapEnemyEnergy) {
      const a = await pick(G, P, zone(enemy).filter(m => m.energy.length), 'hurt', 'Take an energy orb from which Bakemon?');
      const b = a && await pick(G, P, zone(enemy).filter(m => m !== a), 'hurt', 'Swap it with which Bakemon?');
      if (!a || !b) continue;
      const ea = a.energy.pop(), eb = b.energy.length ? b.energy.pop() : null;
      await say2(G, a.card.name + "'s " + ea + ' energy and ' + b.card.name + (eb ? "'s " + eb + ' energy trade places.' : ' trade places.'));
      await attachEnergySilently(G, b, ea); if (eb) await attachEnergySilently(G, a, eb);
    }
    else if (op.disableMove) {
      const options = [];
      for (const m of zone(enemy)) for (const mv of cardMoves(m.card)) options.push({ label: m.card.name + ': ' + mv.name, value: { mon: m, move: mv } });
      if (!options.length) continue;
      const c = await P.controller.ask(G, P, { kind: 'option', purpose: 'disable', prompt: "Disable which of the opponent's moves?", options });
      c.mon.effects.push({ kind: 'disabled', moveIndex: c.move.index, expires: until(1) });
      await say2(G, c.mon.card.name + "'s " + c.move.name + ' is disabled for a turn.', { mon: c.mon });
    }
    else if (op.reveal) {
      const picked = [];
      for (let i = 0; i < op.reveal && enemy.hand.length > picked.length; i++) {
        const left = enemy.hand.map((id, idx) => ({ id, idx })).filter(c => !picked.includes(c.idx));
        picked.push(left.length === 1 || enemy.isHuman ? left[Math.floor(Math.random() * left.length)].idx
          : await enemy.controller.ask(G, enemy, { kind: 'option', purpose: 'reveal', prompt: 'Reveal a card from your hand (' + (i + 1) + ' of ' + op.reveal + ')',
              options: left.map(c => ({ label: CARD_BY_ID[c.id].name, value: c.idx, cardId: c.id })) }));
      }
      await say2(G, subj(enemy, 'reveals') + ' ' + (picked.map(i => CARD_BY_ID[enemy.hand[i]].name).join(', ') || 'an empty hand') + '.');
    }
    else if (op.hydraulic) {
      if (!me.energy.includes('steel')) continue;
      const to = await pick(G, P, candidates(G, P, me, 'any_other', {}), 'energyTo', 'Send the energy to which Bakemon?');
      if (!to) continue;
      const type = await P.controller.ask(G, P, { kind: 'option', purpose: 'energyType', mon: to, prompt: 'Turn the steel energy into what?', options: Object.keys(ENERGY_COLORS).map(t => ({ label: t, value: t, energy: t })) });
      me.energy.splice(me.energy.indexOf('steel'), 1);
      await say2(G, "One of " + me.card.name + "'s steel energy becomes " + type + ' and goes to ' + to.card.name + '.', { mon: to });
      await attachEnergySilently(G, to, type);
    }
    else if (op.swapPartner) {
      const pr = zone(P).find(m => m !== me && op.swapPartner.names.includes(m.card.name));
      if (!pr) continue;
      if (P.active === me && bench(P).includes(pr)) await switchActive(G, P, pr);
      else if (P.active === pr && bench(P).includes(me)) await switchActive(G, P, me);
    }
    else if (op.stealEquip) {
      const t = ctx.target;
      if (!t || !t.equip || me.equip || t === me || P.active !== me) continue;
      if (!(await flip(G, 'Rascal'))) { me.equip = t.equip; me.borrowedFrom = t; t.equip = null; t.helmet = null; await say2(G, me.card.name + ' swipes ' + CARD_BY_ID[me.equip].name + '!', { mon: me }); }
    }
    else if (op.delusion)    me.effects.push({ kind: 'delusion', expires: until(1) });
    else if (op.drawUntilBasic) {
      let n = 0;
      while (P.deck.length) {
        const id = P.deck.pop(); n++;
        if (CARD_BY_ID[id].kind === 'item') P.discard.push(id); else { P.hand.push(id); if (isBasic(id)) break; }
      }
      await say2(G, subj(P, 'draws') + ' ' + n + ' card' + (n === 1 ? '' : 's') + ' looking for a basic Bakemon.');
    }
    else console.warn('The battle engine does not know this op:', op);
  }
  if (ctx.recoil && ctx.dealt !== undefined) { const r = ctx.recoil; ctx.recoil = 0; await dealDamage(G, null, me, r, { why: 'the dive' }); }
}

const fluttershineBonus = (P, move) => (P.active && hasTag(P.active, 'fluttershine') && costIncludes(move, 'grass')) ? 20 : 0;

// Energy that MOVES (rather than being freshly attached) still feeds Necrozoa's hunger.
async function attachEnergySilently(G, mon, type) {
  mon.energy.push(type);

}


/* ---------------- things that happen later ---------------- */

const slotOf = (G, mon) => G.players.some(Q => Q.active === mon) ? 'active' : G.players.some(Q => bench(Q).includes(mon)) ? 'bench' : null;

async function runDelayed(G, P) {
  const due = G.delayed.filter(d => d.at <= G.turnNumber);
  if (!due.length) return;
  G.delayed = G.delayed.filter(d => !due.includes(d));
  for (const d of due) {
    if (G.winner) return;
    const caster = G.players[d.owner], foe = other(G, caster);
    if (d.kind === 'thaw') {
      for (const { mon, n } of d.entries) for (let i = 0, left = n; i < mon.energy.length && left > 0; i++) if (mon.energy[i] === 'ice') { mon.energy[i] = 'water'; left--; }
      await say2(G, 'The ice melts back into water.');
    }
    else if (d.kind === 'stones') {
      await say2(G, d.n + ' stone' + (d.n === 1 ? '' : 's') + ' crash down!');
      for (let i = 0; i < d.n; i++) {                       // the caster aims each stone, active or benched
        const targets = zone(foe).filter(m => m.hp > 0);
        if (!targets.length) break;
        const hit = await pick(G, caster, targets, 'hurt', 'Where does stone ' + (i + 1) + ' of ' + d.n + ' land?');
        await dealDamage(G, null, hit, d.each, { why: 'a falling stone' });
      }
    }
    else if (d.kind === 'tongue') {
      if (d.mon.hp > 0 && slotOf(G, d.mon) === d.slot) { await say2(G, 'The tongue lashes out!'); await dealDamage(G, null, d.mon, d.damage, { why: 'Black Tongue' }); }
      else await say2(G, 'The tongue strikes where ' + d.mon.card.name + ' used to be.');
    }
    else if (d.kind === 'spores') {
      let hit = 0;
      await say2(G, 'The spores bloom!');
      for (const { mon, slot } of d.marks) if (mon.hp > 0 && slotOf(G, mon) === slot) { await dealDamage(G, null, mon, d.damage, { why: 'the spores' }); hit++; }
      if (hit) {
        let left = d.heal;
        for (const m of zone(caster).filter(m => d.names.includes(m.card.name) && m.hp < m.maxHp).sort((a, b) => (b.maxHp - b.hp) - (a.maxHp - a.hp))) {
          const amount = Math.min(left, m.maxHp - m.hp); if (amount > 0) { await heal(G, m, amount); left -= amount; }
        }
      }
    }
    await checkKOs(G);
  }
}

/* ---------------- decks ---------------- */

// Why can't this deck be used? Returns '' if it's fine.
function deckProblem(deck, rules) {
  rules = rules || BATTLE_RULES;
  if (deck.length < rules.deckMin) return 'A deck needs at least ' + rules.deckMin + ' cards. This one has ' + deck.length + '.';
  if (deck.length > rules.deckMax) return 'A deck can have at most ' + rules.deckMax + ' cards.';
  if (!deck.some(isBasic)) return 'A deck needs at least one basic Bakemon.';
  const counts = {};
  for (const id of deck) if ((counts[id] = (counts[id] || 0) + 1) > rules.copiesMax) return 'No more than ' + rules.copiesMax + ' copies of ' + CARD_BY_ID[id].name + '.';
  return '';
}
