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

const costIncludes = (move, type) => !!(move && move.cost.types[type]);

function canPay(mon, cost) {
  const pool = {};
  for (const e of mon.energy) pool[e] = (pool[e] || 0) + 1;
  for (const [type, n] of Object.entries(cost.types)) if ((pool[type] || 0) < n) return false;
  return mon.energy.length >= cost.total;       // whatever's left over covers the "any" part
}

const hasTag   = (mon, tag) => cardMoves(mon.card).some(m => m.fx.tag === tag);
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
  };
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
  G.t = { over: false, energyUsed: 0, cableUsed: {}, retreats: 0, abilityUsed: {}, canAttack: true, evolveFreely: false };
  await say2(G, '— ' + poss(P) + ' turn —', { kind: 'turn' });
  await drawCards(G, P, 1, true);
  if (G.turnNumber === 1 && !G.rules.firstPlayerCanAttack) G.t.canAttack = false;

  const a = P.active;
  if (!a) return;
  if (a.status.asleep) {
    if (await flip(G, a.card.name + ' is asleep')) { delete a.status.asleep; await say2(G, a.card.name + ' wakes up.'); }
    else G.t.canAttack = false;
  }
  if (a.status.paralyzed && !(await flip(G, a.card.name + ' is paralyzed'))) G.t.canAttack = false;
  if (a.status.frozen) {
    if (await flip(G, a.card.name + ' is frozen')) await dealDamage(G, null, a, G.rules.frozenDamage, { why: 'the cold' });
    else G.t.canAttack = false;
    await checkKOs(G);
  }
}

async function endTurn(G, P) {
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
  const sameTurn = mon.playedTurn === G.turnNumber;
  const lifeCycle = P.active && hasTag(P.active, 'grassEvolvesSameTurn') && mon.card.types.includes('grass');
  if (sameTurn && !G.t.evolveFreely && !lifeCycle) return false;
  // Mugini: needs an energy of the type it's evolving INTO.
  if (hasTag(mon, 'evolveNeedsMatchingEnergy') && !card.types.some(t => mon.energy.includes(t))) return false;
  return true;
}

function energyTargets(G, P) {
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
      let ok = !item.todo && (item.equip || item.ops);
      if (ok && item.equip) ok = zone(P).some(m => !m.equip);
      if (ok && item.ops) ok = item.ops.every(op => itemOpPossible(G, P, op));
      if (ok) actions.push({ type: 'item', handIndex, cardId: id, label: 'Use ' + card.name });
    }
  });

  if (energyTargets(G, P).length) actions.push({ type: 'energy', label: 'Attach energy' });

  for (const mon of zone(P)) for (const move of cardMoves(mon.card)) {
    if (!move.isAbility || move.fx.ability !== 'activated') continue;
    if (move.fx.oncePerTurn !== false && G.t.abilityUsed[mon.uid + ':' + move.index]) continue;
    if (!move.ops.every(op => abilityOpPossible(G, P, mon, op))) continue;
    actions.push({ type: 'ability', mon, move, label: mon.card.name + ': ' + move.name });
  }

  const a = P.active;
  if (a && bench(P).length && G.t.retreats < G.rules.retreatsPerTurn && !retreatBlocked(a) && a.energy.length >= a.card.retreat)
    actions.push({ type: 'retreat', label: 'Retreat ' + a.card.name + (a.card.retreat ? '  (costs ' + a.card.retreat + ' energy)' : '  (free)') });

  if (a && enemy.active && G.t.canAttack) for (const move of cardMoves(a.card)) {
    if (!move.isAbility && canPay(a, move.cost)) actions.push({ type: 'attack', move, label: move.name + (move.damage ? '   ' + move.damage : '') });
  }

  actions.push({ type: 'endTurn', label: 'End turn' });
  return actions;
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
  return true;
}
function abilityOpPossible(G, P, mon, op) {
  if (op.addEnergy || op.heal || op.status) return candidates(G, P, mon, op.to || op.who || op.on, op).length > 0;
  if (op.moveEnergy)   return candidates(G, P, mon, op.from, op).some(m => m.energy.some(e => !op.type || e === op.type)) && candidates(G, P, mon, op.to, op).length > 0;
  if (op.convertEnergy) return zone(P).some(m => m.energy.length);
  if (op.dragToActive) return bench(other(G, P)).some(m => m.energy.includes(op.dragToActive.withEnergy));
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
      await say2(G, mon.card.name + ' evolves into ' + card.name + '!', { mon, kind: 'evolve' });
      const damageTaken = mon.maxHp - mon.hp;
      mon.card = card; mon.stack.push(card.id);
      mon.maxHp = card.hp; mon.hp = Math.max(10, card.hp - damageTaken);       // damage carries over
      mon.playedTurn = G.turnNumber; mon.auras = []; mon.sleepHeal = 0;
      if (G.rules.evolveClearsStatus) { mon.status = {}; mon.poisonDoubling = 0; }
      await enterPlay(G, P, mon);
      break;
    }

    case 'energy': {
      const mon = await pick(G, P, energyTargets(G, P), 'energyTo', 'Attach energy to which Bakemon?');
      const type = await P.controller.ask(G, P, { kind: 'option', purpose: 'energyType', mon, prompt: 'Which type of energy?',
        options: Object.keys(ENERGY_COLORS).map(t => ({ label: t, value: t, energy: t })) });
      if (G.t.energyUsed < G.rules.energyPerTurn) G.t.energyUsed += 1; else G.t.cableUsed[mon.uid] = true;
      await attachEnergy(G, mon, type);
      break;
    }

    case 'item': {
      const id = P.hand.splice(action.handIndex, 1)[0], card = CARD_BY_ID[id], item = ITEMS[id];
      await say2(G, subj(P, 'uses') + ' ' + card.name + '.', { cardId: id });
      if (item.equip) {
        const mon = await pick(G, P, zone(P).filter(m => !m.equip), 'equipTo', 'Equip ' + card.name + ' to which Bakemon?');
        mon.equip = id;
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
      G.t.abilityUsed[action.mon.uid + ':' + action.move.index] = true;
      await say2(G, action.mon.card.name + ' uses ' + action.move.name + '.', { mon: action.mon });
      await runOps(G, { P, self: action.mon, target: enemy.active, move: action.move }, action.move.ops);
      await checkKOs(G);
      break;
    }

    case 'retreat': {
      const a = P.active;
      for (let i = 0; i < a.card.retreat; i++) await discardEnergyFrom(G, P, a, null);
      G.t.retreats += 1;
      await switchActive(G, P, await pick(G, P, bench(P), 'promote', 'Who takes its place?'));
      break;
    }

    case 'attack':
      await resolveAttack(G, P, P.active, action.move);
      G.t.over = true;                       // attacking ends your turn
      break;

    case 'endTurn':
      G.t.over = true;
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
  if (hasTag(mon, 'hurtByEnergy')) { await dealDamage(G, null, mon, 10, { why: 'its hunger' }); await checkKOs(G); }
}

// Going to the bench: statuses fall away and equipment is discarded (rules page).
async function switchActive(G, P, incoming) {
  const outgoing = P.active;
  const slot = P.bench.indexOf(incoming);
  if (outgoing) {
    outgoing.status = {}; outgoing.poisonDoubling = 0; outgoing.sleepHeal = 0;
    outgoing.effects = outgoing.effects.filter(e => e.kind !== 'cantRetreat');
    outgoing.auras = [];
    if (outgoing.equip) { P.discard.push(outgoing.equip); outgoing.equip = null; outgoing.helmet = null; }
  }
  P.bench[slot] = outgoing || null;
  P.active = incoming;
  await say2(G, subj(P, 'sends') + ' out ' + incoming.card.name + '.', { mon: incoming });
}

/* ---------------- attacking ---------------- */

async function resolveAttack(G, P, attacker, move, copied) {
  const enemy = other(G, P);
  await say2(G, attacker.card.name + ' uses ' + move.name + '!', { mon: attacker, kind: 'attack' });
  if (!copied) G.lastAttack[P.index] = move;

  // Things that can make an attack fail outright.
  const missNext = attacker.effects.find(e => e.kind === 'missNext');
  if (missNext) { attacker.effects.splice(attacker.effects.indexOf(missNext), 1); return say2(G, 'It misses!'); }
  const mustFlip = attacker.effects.find(e => e.kind === 'mustFlip');
  if (mustFlip) { attacker.effects.splice(attacker.effects.indexOf(mustFlip), 1); if (!(await flip(G, 'Can it attack'))) return say2(G, 'It fails!'); }
  if (enemy.active && equipTag(enemy.active) === 'attackersMustFlip' && !(await flip(G, 'Maced! Does the attack land'))) return say2(G, 'It misses!');

  const ctx = { P, self: attacker, target: enemy.active, move, base: move.damage, bonus: 0, isAttack: true };
  if (attacker.status.confused && !(await flip(G, attacker.card.name + ' is confused'))) { ctx.target = attacker; await say2(G, 'It hurts itself in its confusion!'); }

  const isPre = op => op.pre || op.bonusIfTargetStatus || op.damagePerEnergy || op.chooseDamage || op.copyLastAttack || (op.perHeads && op.perHeads.damage);
  await runOps(G, ctx, move.ops.filter(isPre));
  if (ctx.replaced) return;                                   // Parrot handed the attack over to another move

  const amount = ctx.base + ctx.bonus;
  if (amount > 0 && ctx.target) ctx.dealt = await dealDamage(G, attacker, ctx.target, amount, { attack: true, move, unavoidable: ctx.unavoidable });
  await runOps(G, ctx, move.ops.filter(op => !isPre(op)));
  await checkKOs(G);
}

// The one place HP goes down. Returns how much was actually dealt.
async function dealDamage(G, source, victim, amount, o) {
  o = o || {};
  if (!victim || victim.hp <= 0) return 0;
  if (o.attack && source) {
    const P = ownerOf(G, source), move = o.move;
    amount += source.buff;
    for (const e of source.effects) { if (e.kind === 'dmgBuff') amount += e.amount; if (e.kind === 'dmgDebuff') amount -= e.amount; }
    if (source.status.enraged) amount += G.rules.enragedBonus;
    if (hasTag(source, 'twinshipBonus') && P && zone(P).some(m => m.card.name === 'Jeremo♀')) amount += 30;
    if (P) for (const m of zone(P)) for (const aura of m.auras) if (costIncludes(move, aura.costIncludes)) amount += aura.damage;
    if (P && P.active && hasTag(P.active, 'fluttershine') && costIncludes(move, 'grass')) amount += 20;
    // Weakness: +10 for every matching energy symbol in the attack's cost.
    for (const w of victim.card.weak) if (w !== victim.helmet) amount += (move.cost.types[ENERGY_ALIASES[w] || w] || 0) * G.rules.weaknessBonus;

    if (victim.status.enraged) amount -= G.rules.enragedBonus;
    const ring = G.players.some(Q => zone(Q).some(m => hasTag(m, 'aquaRing')));
    if (ring && victim.card.types.includes('water') && ['fire', 'fighting', 'dragon'].some(t => costIncludes(move, t))) amount -= 20;

    if (!o.unavoidable) for (const shield of victim.effects.filter(e => e.kind === 'shield')) {
      if (shield.onlyFrom && !costIncludes(move, shield.onlyFrom)) continue;
      amount = shield.amount === 'all' ? 0 : amount - shield.amount;
      if (shield.lasts === 'nextHit') victim.effects.splice(victim.effects.indexOf(shield), 1);
    }
  }
  amount = Math.max(0, Math.round(amount));
  victim.hp -= amount;
  await say2(G, amount ? victim.card.name + ' takes ' + amount + (o.why ? ' from ' + o.why : '') + '.' : victim.card.name + ' takes no damage.', { mon: victim, kind: 'damage', amount });

  if (o.attack && source && amount > 0 && source !== victim) {
    const P = ownerOf(G, victim);
    if (equipTag(victim) === 'burnsAttackers') await applyStatus(G, source, 'burned');
    for (const e of victim.effects) {
      if (e.kind === 'retaliate') await applyStatus(G, source, e.status);
      if (e.kind === 'reflect' && amount - e.minus > 0) await dealDamage(G, null, source, amount - e.minus, { why: 'the reflection' });
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
  await say2(G, mon.card.name + ' is now ' + name + '.', { mon, kind: 'status' });
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

async function checkKOs(G) {
  if (G.winner) return;
  for (const P of G.players) {
    for (const mon of zone(P)) if (mon.hp <= 0) {
      await say2(G, mon.card.name + ' is knocked out!', { mon, kind: 'ko' });
      P.discard.push(...mon.stack); if (mon.equip) P.discard.push(mon.equip);
      if (P.active === mon) P.active = null; else P.bench[P.bench.indexOf(mon)] = null;
      other(G, P).points += 1;
    }
  }
  // Whose turn it is wins ties, which can only happen when both sides go down at once.
  const order = [G.players[G.turn], G.players[1 - G.turn]];
  for (const P of order) if (P.points >= G.rules.pointsToWin) return declare(G, P, subj(P, 'reaches') + ' ' + P.points + ' points.');
  for (const P of order) if (!P.active) {
    if (bench(P).length) await switchActive(G, P, await pick(G, P, bench(P), 'promote', 'Who steps up?'));
    else if (G.rules.noBakemonLeftLoses) return declare(G, other(G, P), subj(P, 'has') + ' no Bakemon left.');
  }
}

async function declare(G, P, why) { G.winner = P; G.t.over = true; await say2(G, why + ' ' + subj(P, 'wins') + '!', { kind: 'win' }); }

/* ---------------- choosing a Bakemon ---------------- */

function candidates(G, P, self, selector, op) {
  const enemy = other(G, P);
  let list = {
    self: [self], enemy_active: [enemy.active],
    own_bench: bench(P), own_other: zone(P).filter(m => m !== self), own_any: zone(P),
    enemy_bench: bench(enemy), enemy_any: zone(enemy), any: zone(P).concat(zone(enemy)),
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

    else if (op.flip || op.flipPerOwnEnergy) {
      const n = op.flipPerOwnEnergy ? me.energy.length : op.flip;
      let heads = 0;
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
      if (mon) mon.effects.push({ kind: 'shield', amount: op.shield, lasts: op.lasts, onlyFrom: op.onlyFrom, expires: op.lasts === 'nextTurn' ? until(1) : undefined });
    }
    else if (op.reflect)   me.effects.push({ kind: 'reflect', minus: op.reflect.minus, expires: until(1) });
    else if (op.retaliate) me.effects.push({ kind: 'retaliate', status: op.retaliate.status, expires: until(1) });
    else if (op.aura)      me.auras.push(op.aura);
    else if (op.buffSelf)  { if (op.lasts === 'forever') me.buff += op.buffSelf; else me.effects.push({ kind: 'dmgBuff', amount: op.buffSelf, expires: until(2) }); }

    else if (op.debuffTarget || op.targetMisses || op.targetMustFlip || op.cantRetreat || op.noEnergy) {
      const mon = await selectMon(G, ctx, op.on || 'target', op, 'hurt', '');
      if (!mon) continue;
      if (op.debuffTarget)   mon.effects.push({ kind: 'dmgDebuff', amount: op.debuffTarget, expires: until(2 * op.turns - 1) });
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
      if (!from || !to || !hasIt(from)) continue;
      const type = op.type || from.energy[from.energy.length - 1];
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
    else if (op.bothDraw) { await drawCards(G, P, op.bothDraw); await drawCards(G, enemy, op.bothDraw); await say2(G, 'Both players draw a card.'); }
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
      if (drawn > op.digForEvolution.penaltyOver) for (let i = 0; i < op.digForEvolution.discard && P.hand.length; i++)
        P.discard.push(P.hand.splice(Math.floor(Math.random() * P.hand.length), 1)[0]);
    }
    else if (op.evolveFreelyThisTurn) G.t.evolveFreely = true;
    else if (op.freeRetreat) await switchActive(G, P, await pick(G, P, bench(P), 'promote', 'Who comes out instead?'));
    else if (op.removeEnemyEquip) {
      const mon = await pick(G, P, zone(enemy).filter(m => m.equip), 'hurt', 'Wash the item off which Bakemon?');
      if (mon) { await say2(G, mon.card.name + ' loses its ' + CARD_BY_ID[mon.equip].name + '.'); enemy.discard.push(mon.equip); mon.equip = null; mon.helmet = null; }
    }
    else if (op.forceSwitch) { if (bench(enemy).length) await switchActive(G, enemy, await pick(G, enemy, bench(enemy), 'promote', 'You must switch. Who comes out?')); ctx.target = enemy.active; }
    else if (op.dragToActive) {
      const mon = await pick(G, P, bench(enemy).filter(m => m.energy.includes(op.dragToActive.withEnergy)), 'hurt', 'Drag which Bakemon into the active slot?');
      if (mon) { await switchActive(G, enemy, mon); ctx.target = enemy.active; }
    }
    else console.warn('The battle engine does not know this op:', op);
  }
  if (ctx.recoil && ctx.dealt !== undefined) { const r = ctx.recoil; ctx.recoil = 0; await dealDamage(G, null, me, r, { why: 'the dive' }); }
}

const fluttershineBonus = (P, move) => (P.active && hasTag(P.active, 'fluttershine') && costIncludes(move, 'grass')) ? 20 : 0;

// Energy that MOVES (rather than being freshly attached) still feeds Necrozoa's hunger.
async function attachEnergySilently(G, mon, type) {
  mon.energy.push(type);
  if (hasTag(mon, 'hurtByEnergy')) await dealDamage(G, null, mon, 10, { why: 'its hunger' });
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
