/* ============================================================
   TEST-MOVES — does each card do what its text says?
   ============================================================
       node tools/test-moves.js

   Each test builds a tiny board, rigs the dice and coins, plays one move
   and checks what happened. When you change a card's wiring in data/moves.js
   (or the rules in js/battle.js), run this to see if you broke anything.
   Exits with an error if any test fails.
   ============================================================ */

const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { console, Math };
vm.createContext(ctx);
const load = f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
for (const f of ['data/cards.js', 'data/battle-rules.js', 'data/moves.js']) load(f);
vm.runInContext('const CARD_BY_ID = {}; for (const c of CARDS) CARD_BY_ID[c.id] = c;', ctx);
load('js/battle.js'); load('js/battle-ai.js');
const E = vm.runInContext('({ CARDS, CARD_BY_ID, zone, bench, other, cardMoves, makeMon, ownerOf, canPay, canEvolveOnto, currentWeather, weatherIs, BATTLE_RULES })', ctx);

/* ---- rigging ---- */
const realRandom = Math.random;
let queue = [];
Math.random = () => (queue.length ? queue.shift() : realRandom());
const HEADS = 0.1, TAILS = 0.9;
const d = (sides, v) => (v - 0.5) / sides;          // the random number that makes a Dn come up v
const rig = (...values) => { queue = values; };

const idOf = name => { const c = E.CARDS.find(c => c.name === name); if (!c) throw new Error('no card ' + name); return c.id; };
const move = (mon, name) => { const m = E.cardMoves(mon.card).find(m => m.name === name); if (!m) throw new Error(mon.card.name + ' has no ' + name); return m; };

function ai(overrides) {
  const a = ctx.makeAI({ mistakes: 0 }), base = a.ask;
  a.ask = (G, P, req) => (overrides && overrides[req.purpose]) ? overrides[req.purpose](G, P, req) : base.call(a, G, P, req);
  return a;
}
// side: { active: 'Name', bench: ['Name'], energy: { Name: ['fire','fire'] }, hand: [ids], equip: { Name: '104' } }
function game(s1, s2, overrides) {
  const deck = Array(8).fill('001');
  const G = ctx.newBattle([
    { name: 'One', deck: deck.slice(), controller: ai(overrides && overrides[0]) },
    { name: 'Two', deck: deck.slice(), controller: ai(overrides && overrides[1]) },
  ], { io: { show: async () => {} } });
  G.turnNumber = 10; G.turn = 0;
  G.t = { over: false, energyUsed: 0, cableUsed: {}, retreats: 0, abilityUsed: {}, canAttack: true, freeEvolves: 0, lockTurn: false, noEnergy: false, attacked: false, amp: null };
  [s1, s2].forEach((s, i) => {
    const P = G.players[i];
    P.active = s.active ? E.makeMon(G, idOf(s.active)) : null;
    (s.bench || []).forEach((n, j) => { P.bench[j] = E.makeMon(G, idOf(n)); });
    for (const m of E.zone(P)) {
      if (s.energy && s.energy[m.card.name]) m.energy = s.energy[m.card.name].slice();
      if (s.equip && s.equip[m.card.name]) m.equip = s.equip[m.card.name];
      if (s.hp && s.hp[m.card.name]) m.hp = s.hp[m.card.name];
      if (s.big && s.big.includes(m.card.name)) m.hp = m.maxHp = 500;          // so a test target survives its beatings
    }
    P.hand = (s.hand || []).slice();
  });
  return G;
}
const attack = (G, i, name, who) => { const P = G.players[i], m = who || P.active; return ctx.resolveAttack(G, P, m, move(m, name)); };
const ability = (G, i, mon, name) => ctx.perform(G, G.players[i], { type: 'ability', mon, move: move(mon, name) });
const act = (G, i) => G.players[i].active;
const bn = (G, i, j) => G.players[i].bench[j || 0];
const log = G => G.log.join(' | ');

/* ---- tiny test framework ---- */
let passed = 0; const failures = [];
async function test(name, fn) {
  queue = [];
  try { await fn(); passed++; } catch (err) { failures.push(name + ': ' + (err && err.message || err)); }
  queue = [];
}
const eq = (actual, expected, what) => { if (actual !== expected) throw new Error((what || 'value') + ' was ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected)); };
const ok = (cond, what) => { if (!cond) throw new Error(what); };

(async () => {

/* ================= dice ================= */
await test('Tail Slap: D6 x 10 damage', async () => {
  const G = game({ active: 'Lemurk' }, { active: 'Poteplant' });
  rig(d(6, 4)); await attack(G, 0, 'Tail Slap');
  eq(act(G, 1).maxHp - act(G, 1).hp, 40, 'damage');
});
await test('Denticle: D3 x 10 damage', async () => {
  const G = game({ active: 'Finlesse' }, { active: 'Raizado' });
  rig(d(3, 2)); await attack(G, 0, 'Denticle');
  eq(act(G, 1).maxHp - act(G, 1).hp, 20, 'damage');
});
await test('Sssss: freezes only on a 3', async () => {
  let G = game({ active: 'Shelby' }, { active: 'Raizado' });
  rig(d(3, 3)); await attack(G, 0, 'Sssss'); ok(act(G, 1).status.frozen, 'should be frozen on 3');
  G = game({ active: 'Shelby' }, { active: 'Raizado' });
  rig(d(3, 2)); await attack(G, 0, 'Sssss'); ok(!act(G, 1).status.frozen, 'should not freeze on 2');
});
await test('Steel Cage: cannot retreat only on 4+', async () => {
  let G = game({ active: 'Alfay' }, { active: 'Raizado' });
  rig(d(6, 4)); await attack(G, 0, 'Steel Cage'); ok(act(G, 1).effects.some(e => e.kind === 'cantRetreat'), 'should be stuck on 4');
  G = game({ active: 'Alfay' }, { active: 'Raizado' });
  rig(d(6, 3)); await attack(G, 0, 'Steel Cage'); ok(!act(G, 1).effects.some(e => e.kind === 'cantRetreat'), 'should not be stuck on 3');
});
await test('Dragon Pulse: 30 per heads until tails', async () => {
  const G = game({ active: 'Allitargetor' }, { active: 'Raizado' });
  rig(HEADS, HEADS, TAILS); await attack(G, 0, 'Dragon Pulse');
  eq(act(G, 1).maxHp - act(G, 1).hp, 60, 'damage');
});

/* ================= statuses ================= */
await test('Flinch: the target cannot attack on its next turn', async () => {
  const G = game({ active: 'Taelong' }, { active: 'Raizado' });
  rig(HEADS); await attack(G, 0, 'Raging Fang');
  ok(act(G, 1).effects.some(e => e.kind === 'flinch'), 'should flinch');
  G.turnNumber = 11; await ctx.startTurn(G, G.players[1]);
  eq(G.t.canAttack, false, 'canAttack on its turn');
  ctx.endTurn && await ctx.endTurn(G, G.players[1]);
  ok(!act(G, 1).effects.some(e => e.kind === 'flinch'), 'flinch should wear off after that turn');
});
await test('Haunted: a 1 sends it to the bench without its energy', async () => {
  const G = game({ active: 'Poteplant', bench: ['Leapod'], energy: { Poteplant: ['grass', 'grass'] } }, { active: 'Raizado' });
  act(G, 0).status.haunted = true;
  const ghost = act(G, 0);
  rig(d(3, 1)); G.turnNumber = 12; await ctx.startTurn(G, G.players[0]);
  ok(act(G, 0) !== ghost, 'a different Bakemon should be active'); eq(ghost.energy.length, 0, 'energy left');
  ok(!ghost.status.haunted, 'haunt should end once it is on the bench');
});
await test('Haunted: a 2 does nothing', async () => {
  const G = game({ active: 'Poteplant', bench: ['Leapod'], energy: { Poteplant: ['grass'] } }, { active: 'Raizado' });
  act(G, 0).status.haunted = true; const ghost = act(G, 0);
  rig(d(3, 2)); G.turnNumber = 12; await ctx.startTurn(G, G.players[0]);
  eq(act(G, 0), ghost, 'still active'); eq(ghost.energy.length, 1, 'energy kept');
});
await test('Quaked: the Bakemon that replaces it takes D3 x 10', async () => {
  const G = game({ active: 'Poteplant', bench: ['Leapod'] }, { active: 'Raizado' });
  act(G, 0).status.quaked = true; const next = bn(G, 0);
  rig(d(3, 2)); await ctx.switchActive(G, G.players[0], next);
  eq(next.maxHp - next.hp, 20, 'damage to the replacement');
});
await test('Quaked: also when it is knocked out', async () => {
  const G = game({ active: 'Poteplant', bench: ['Leapod'] }, { active: 'Raizado' });
  act(G, 0).status.quaked = true; act(G, 0).hp = 0; const next = bn(G, 0);
  rig(d(3, 3)); await ctx.checkKOs(G);
  eq(act(G, 0), next, 'replacement'); eq(next.maxHp - next.hp, 30, 'damage to the replacement');
});
await test('Taunt: wears off after 50 damage', async () => {
  const G = game({ active: 'Glumwyrm' }, { active: 'Raizado' });
  await attack(G, 0, 'Taunt'); ok(act(G, 1).status.taunted, 'taunted');
  await ctx.dealDamage(G, null, act(G, 1), 30, {}); ok(act(G, 1).status.taunted, 'still taunted at 30');
  await ctx.dealDamage(G, null, act(G, 1), 20, {}); ok(!act(G, 1).status.taunted, 'free at 50');
});
await test('Ghostfall: frozen becomes haunted', async () => {
  const G = game({ active: 'Kotora' }, { active: 'Raizado' });
  act(G, 1).status.frozen = true;
  await ability(G, 0, act(G, 0), 'Ghostfall');
  ok(!act(G, 1).status.frozen && act(G, 1).status.haunted, 'frozen should have become haunted');
});

/* ================= weather ================= */
await test('Hailstorm + Scareglare: freezes only while the storm lasts', async () => {
  let G = game({ active: 'Shivent', bench: ['Yukitora'] }, { active: 'Raizado' });
  await attack(G, 0, 'Scareglare'); ok(!act(G, 1).status.frozen, 'no storm, no freeze');
  G = game({ active: 'Yukitora', bench: ['Shivent'] }, { active: 'Raizado' });
  await attack(G, 0, 'Hailstorm'); ok(E.weatherIs(G, 'hailstorm'), 'hailstorm on');
  await ctx.switchActive(G, G.players[0], bn(G, 0));
  await attack(G, 0, 'Scareglare'); ok(act(G, 1).status.frozen, 'storm active, so frozen');
});
await test('Weather ends when its maker is knocked out', async () => {
  const G = game({ active: 'Yukitora', bench: ['Poteplant'] }, { active: 'Raizado' });
  await attack(G, 0, 'Hailstorm'); ok(E.weatherIs(G, 'hailstorm'), 'on');
  act(G, 0).hp = 0; await ctx.checkKOs(G); ok(!E.weatherIs(G, 'hailstorm'), 'gone');
});
await test('A newer weather replaces the old one', async () => {
  const G = game({ active: 'Yukitora' }, { active: 'Draquaduct' });
  await attack(G, 0, 'Hailstorm'); await attack(G, 1, 'Hydrosurge');
  ok(E.weatherIs(G, 'hydrosurge') && !E.weatherIs(G, 'hailstorm'), 'only hydrosurge');
});
await test('Hydrosurge: water attacks hit 20 harder, for BOTH sides', async () => {
  const water = { name: 'Splash', damage: 30, cost: { types: { water: 1 }, any: 0, total: 1 }, ops: [], fx: {}, isAbility: false };
  const calm = game({ active: 'Poteplant', big: ['Poteplant'] }, { active: 'Leapod', big: ['Leapod'] });
  await ctx.resolveAttack(calm, calm.players[1], act(calm, 1), water);
  const plain = act(calm, 0).maxHp - act(calm, 0).hp;
  const G = game({ active: 'Draquaduct', big: ['Draquaduct'] }, { active: 'Leapod', big: ['Leapod'] });
  await attack(G, 0, 'Hydrosurge');
  const hp = act(G, 0).hp; await ctx.resolveAttack(G, G.players[1], act(G, 1), water);
  ok(!act(G, 0).card.weak.includes('water'), 'test assumes Draquaduct is not weak to water');
  eq(hp - act(G, 0).hp, plain + 20, "the opponent's water attack");
});
await test('Starfall: damage to a fairy-type is cut by a D6', async () => {
  const G = game({ active: 'Tytania' }, { active: 'Raizado' });
  G.weather = { name: 'starfall', source: act(G, 0) };
  const fairy = act(G, 0); ok(fairy.card.types.includes('fairy'), 'Tytania should be fairy');
  rig(d(6, 4)); await ctx.dealDamage(G, null, fairy, 30, {});
  eq(fairy.maxHp - fairy.hp, 26, 'damage after a roll of 4');
  const other = act(G, 1); rig(d(6, 4)); await ctx.dealDamage(G, null, other, 30, {});
  eq(other.maxHp - other.hp, 30, 'non-fairy takes the full 30');
});
await test('Frost: a Bakemon put in the active slot may freeze', async () => {
  let G = game({ active: 'Cryodyr' }, { active: 'Poteplant', bench: ['Leapod'], big: ['Poteplant'] });
  await attack(G, 0, 'Glaciabolt'); ok(E.weatherIs(G, 'frost'), 'frost on');
  rig(d(3, 1)); await ctx.switchActive(G, G.players[1], bn(G, 1)); ok(act(G, 1).status.frozen, 'frozen on a 1');
  G = game({ active: 'Cryodyr' }, { active: 'Poteplant', bench: ['Leapod'], big: ['Poteplant'] });
  await attack(G, 0, 'Glaciabolt');
  rig(d(3, 2)); await ctx.switchActive(G, G.players[1], bn(G, 1)); ok(!act(G, 1).status.frozen, 'safe on a 2');
});

/* ================= defence ================= */
await test('Brigitte: block one attack, then the shield breaks', async () => {
  const G = game({ active: 'Lemurk', energy: { Lemurk: ['normal', 'normal'] } }, { active: 'Raizado', equip: { Raizado: '104' } });
  const hp = act(G, 1).hp; rig(d(6, 6));
  await attack(G, 0, 'Tail Slap');
  eq(act(G, 1).hp, hp, 'blocked'); eq(act(G, 1).equip, null, 'shield broken'); ok(G.players[1].discard.includes('104'), 'in discard');
});
await test('Lightning Rod: an electric attack can be sent elsewhere', async () => {
  const G = game({ active: 'Sparkeet' }, { active: 'Poteplant', bench: ['Bulbark'] }, [null, { redirect: (G, P, req) => req.options.find(o => o.value && o.value.card.name === 'Bulbark').value }]);
  await attack(G, 0, 'Spark Gust');
  eq(act(G, 1).hp, act(G, 1).maxHp, 'active untouched'); ok(bn(G, 1).hp < bn(G, 1).maxHp, 'Bulbark hit');
});
await test('Ground Dasher: a ground attack heals Vipere', async () => {
  const G = game({ active: 'Poteplant' }, { active: 'Vipere', hp: { Vipere: 10 } });
  const m = E.cardMoves(act(G, 0).card)[0];
  const ground = { name: 'Test Quake', damage: 30, cost: { types: { ground: 2 }, any: 0, total: 2 }, ops: [], fx: {}, isAbility: false };
  const hp = act(G, 1).hp; await ctx.resolveAttack(G, G.players[0], act(G, 0), ground);
  ok(act(G, 1).hp > hp, 'Vipere should have healed, not been hurt');
});
await test('Immovable: blocks a D6 x 10 rolled when hit', async () => {
  const G = game({ active: 'Pebbpoddle' }, { active: 'Raizado' });
  await attack(G, 0, 'Immovable');
  const hit = { name: 'Big', damage: 50, cost: { types: {}, any: 1, total: 1 }, ops: [], fx: {}, isAbility: false };
  rig(d(6, 3)); await ctx.resolveAttack(G, G.players[1], act(G, 1), hit);
  eq(act(G, 0).maxHp - act(G, 0).hp, 20, 'damage after blocking 30');
});
await test('Barbed Coil: the next attacker takes D3 x 10', async () => {
  const G = game({ active: 'Pitric' }, { active: 'Raizado' });
  await attack(G, 0, 'Barbed Coil');
  const hit = { name: 'Big', damage: 20, cost: { types: {}, any: 1, total: 1 }, ops: [], fx: {}, isAbility: false };
  rig(d(3, 2)); await ctx.resolveAttack(G, G.players[1], act(G, 1), hit);
  eq(act(G, 1).maxHp - act(G, 1).hp, 20, 'recoil'); ok(!act(G, 0).effects.some(e => e.kind === 'barbed'), 'only once');
});
await test('Delusion: send damage back, and haunt if under 30', async () => {
  let G = game({ active: 'Poteplant' }, { active: 'Elfdyr' }, [null, null]);
  G.players[1].active.effects.push({ kind: 'delusion', expires: 99 });
  const big = { name: 'Big', damage: 60, cost: { types: {}, any: 1, total: 1 }, ops: [], fx: {}, isAbility: false };
  const ex = { delusionAmount: (G, P, req) => 0 };
  G = game({ active: 'Poteplant' }, { active: 'Elfdyr' }, [null, ex]);
  act(G, 1).effects.push({ kind: 'delusion', expires: 99 });
  await ctx.resolveAttack(G, G.players[0], act(G, 0), big);
  ok(act(G, 0).status.haunted, 'sending 0 back should haunt the attacker');
  G = game({ active: 'Poteplant' }, { active: 'Elfdyr' }, [null, { delusionAmount: (G, P, req) => 30 }]);
  act(G, 1).effects.push({ kind: 'delusion', expires: 99 });
  await ctx.resolveAttack(G, G.players[0], act(G, 0), big);
  eq(act(G, 0).maxHp - act(G, 0).hp, 30, 'attacker took 30 back'); eq(act(G, 1).maxHp - act(G, 1).hp, 30, 'Elfdyr kept 30'); ok(!act(G, 0).status.haunted, 'no haunt at 30');
});

/* ================= passive auras ================= */
await test('Dark Pulse: dark attacks hit 10 harder, for everyone', async () => {
  const dark = { name: 'Dark', damage: 30, cost: { types: { dark: 1 }, any: 0, total: 1 }, ops: [], fx: {}, isAbility: false };
  let G = game({ active: 'Poteplant' }, { active: 'Raizado' });
  await ctx.resolveAttack(G, G.players[0], act(G, 0), dark); const base = act(G, 1).maxHp - act(G, 1).hp;
  G = game({ active: 'Poteplant' }, { active: 'Raizado', bench: ['Lemurk'] });
  await ctx.resolveAttack(G, G.players[0], act(G, 0), dark); eq(act(G, 1).maxHp - act(G, 1).hp, base + 10, 'with Lemurk on the other side');
});
await test('Hellfire: a fire attack can burn', async () => {
  const fire = { name: 'Fire', damage: 10, cost: { types: { fire: 1 }, any: 0, total: 1 }, ops: [], fx: {}, isAbility: false };
  const G = game({ active: 'Poteplant', bench: ['Pyrdyr'] }, { active: 'Raizado' });
  rig(HEADS); await ctx.resolveAttack(G, G.players[0], act(G, 0), fire); ok(act(G, 1).status.burned, 'burned');
});
await test('Hailstorm switches elemental bonuses off', async () => {
  const dark = { name: 'Dark', damage: 30, cost: { types: { dark: 1 }, any: 0, total: 1 }, ops: [], fx: {}, isAbility: false };
  const G = game({ active: 'Poteplant', bench: ['Lemurk', 'Yukitora'] }, { active: 'Raizado' });
  G.weather = { name: 'hailstorm', source: bn(G, 0, 1) };
  await ctx.resolveAttack(G, G.players[0], act(G, 0), dark);
  const noPulse = act(G, 1).maxHp - act(G, 1).hp;
  const G2 = game({ active: 'Poteplant' }, { active: 'Raizado' });
  await ctx.resolveAttack(G2, G2.players[0], act(G2, 0), dark);
  eq(noPulse, act(G2, 1).maxHp - act(G2, 1).hp, 'same as with no Dark Pulse at all');
});
await test('Frostbite: frozen Bakemon take 20 extra', async () => {
  const G = game({ active: 'Sleetle' }, { active: 'Raizado' });
  act(G, 1).status.frozen = true; await ctx.dealDamage(G, null, act(G, 1), 10, {});
  eq(act(G, 1).maxHp - act(G, 1).hp, 30, 'damage');
});
await test('Ice Eggs: cold damage heals the other side\'s ice-type', async () => {
  const G = game({ active: 'Shelby', hp: { Shelby: 10 } }, { active: 'Raizado' });
  act(G, 1).status.frozen = true;
  const hp = act(G, 0).hp; rig(HEADS); await ctx.startTurn(G, G.players[1]);
  ok(act(G, 0).hp > hp, 'Shelby should heal when the frozen enemy takes cold damage');
});
await test('Heat Lightning: fire pays for electric', async () => {
  const cost = { types: { electric: 2 }, any: 0, total: 2 };
  let G = game({ active: 'Poteplant', energy: { Poteplant: ['fire', 'fire'] } }, { active: 'Raizado' });
  eq(E.canPay(act(G, 0), cost), false, 'without Thundazolt');
  G = game({ active: 'Poteplant', bench: ['Thundazolt'], energy: { Poteplant: ['fire', 'fire'] } }, { active: 'Raizado' });
  eq(E.canPay(act(G, 0), cost), true, 'with Thundazolt');
});
await test('Celestial Bodies: heads boosts fire etc. by 20', async () => {
  const fire = { name: 'Fire', damage: 30, cost: { types: { fire: 1 }, any: 0, total: 1 }, ops: [], fx: {}, isAbility: false };
  const G = game({ active: 'Eclidyr' }, { active: 'Raizado' });
  rig(HEADS); await ability(G, 0, act(G, 0), 'Celestial Bodies');
  await ctx.resolveAttack(G, G.players[0], act(G, 0), fire);
  const w = act(G, 1).card.weak.includes('fire') ? 10 : 0;
  eq(act(G, 1).maxHp - act(G, 1).hp, 30 + 20 + w, 'damage');
});

/* ================= later turns ================= */
await test('Levitate Stone: 20 per stone, each on a random opposing Bakemon', async () => {
  const G = game({ active: 'Rosrock' }, { active: 'Raizado', bench: ['Poteplant'], big: ['Raizado', 'Poteplant'] });
  rig(d(6, 3)); await attack(G, 0, 'Levitate Stone');
  eq(act(G, 1).hp, act(G, 1).maxHp, 'nothing falls yet');
  G.turnNumber = 12; await ctx.startTurn(G, G.players[0]);
  const taken = (act(G, 1).maxHp - act(G, 1).hp) + (bn(G, 1).maxHp - bn(G, 1).hp);
  eq(taken, 60, 'three stones, 20 each, somewhere on their side');
});
await test('Spore Bloom: only Bakemon that have not moved take 60', async () => {
  const G = game({ active: 'Iveldyr' }, { active: 'Raizado', bench: ['Poteplant', 'Leapod'] });
  await attack(G, 0, 'Spore Bloom');
  const stay = act(G, 1), mover = bn(G, 1, 0), idle = bn(G, 1, 1);
  await ctx.switchActive(G, G.players[1], mover);                         // Raizado <-> Poteplant swap slot types
  G.turnNumber = 13; await ctx.startTurn(G, G.players[1]);
  eq(idle.maxHp - idle.hp, 60, 'benched Leapod stayed on the bench'); eq(mover.maxHp - mover.hp, 0, 'Poteplant moved up'); eq(stay.maxHp - stay.hp, 0, 'Raizado moved down');
});
await test('Black Tongue: no damage now, 80 next turn if it has not moved', async () => {
  const G = game({ active: 'Mugini' }, { active: 'Raizado' });
  await attack(G, 0, 'Black Tongue'); eq(act(G, 1).hp, act(G, 1).maxHp, 'nothing yet');
  G.turnNumber = 12; await ctx.startTurn(G, G.players[0]); eq(act(G, 1).maxHp - act(G, 1).hp, 80, 'the tongue lands');
});
await test('Flash Freeze: water turns to ice, then thaws', async () => {
  const G = game({ active: 'Shivent', energy: { Shivent: ['water'] } }, { active: 'Raizado', energy: { Raizado: ['water', 'fire'] } });
  await attack(G, 0, 'Flash Freeze');
  eq(act(G, 1).energy.join(), 'ice,fire', 'frozen'); eq(act(G, 0).energy.join(), 'ice', 'own too');
  G.turnNumber = 12; await ctx.startTurn(G, G.players[0]);
  eq(act(G, 1).energy.join(), 'water,fire', 'thawed');
});

/* ================= streaks and storage ================= */
await test('Lurk: store, then pay back double', async () => {
  const G = game({ active: 'Miremalkin' }, { active: 'Raizado' });
  await ctx.dealDamage(G, null, act(G, 0), 50, {});
  await attack(G, 0, 'Lurk'); eq(act(G, 1).hp, act(G, 1).maxHp, 'no damage on the first use');
  await ctx.dealDamage(G, null, act(G, 0), 50, {});
  G.turnNumber = 12; await attack(G, 0, 'Lurk'); eq(act(G, 1).maxHp - act(G, 1).hp, 100, 'double the stored 50, not compounding');
});
await test('Curl: shield grows each turn in a row', async () => {
  const G = game({ active: 'Envelawn' }, { active: 'Raizado' });
  await attack(G, 0, 'Curl'); eq(act(G, 0).effects.find(e => e.kind === 'shield').amount, 10, 'first');
  act(G, 0).effects = []; G.turnNumber = 12; await attack(G, 0, 'Curl'); eq(act(G, 0).effects.find(e => e.kind === 'shield').amount, 20, 'second');
});
await test('Trample: +20 per consecutive use on the same target', async () => {
  const G = game({ active: 'Metalzoa' }, { active: 'Raizado', big: ['Raizado'] });
  await attack(G, 0, 'Trample'); const first = act(G, 1).maxHp - act(G, 1).hp;
  G.turnNumber = 12; await attack(G, 0, 'Trample'); eq(act(G, 1).maxHp - act(G, 1).hp - first, first + 20, 'second hit is 20 more');
});
await test('Plate Armor: waiting makes it tougher, attacking resets it', async () => {
  const G = game({ active: 'Kafkazoa' }, { active: 'Raizado' });
  await ctx.endTurn(G, G.players[0]); await ctx.endTurn(G, G.players[0]);
  eq(act(G, 0).armor, 20, 'two turns of waiting');
  const hit = { name: 'Big', damage: 50, cost: { types: {}, any: 1, total: 1 }, ops: [], fx: {}, isAbility: false };
  await ctx.resolveAttack(G, G.players[1], act(G, 1), hit); eq(act(G, 0).maxHp - act(G, 0).hp, 30, 'took 20 less');
});
await test('Rascal: on tails, steal the target\'s item', async () => {
  const G = game({ active: 'Gambarue' }, { active: 'Raizado', equip: { Raizado: '105' } });
  rig(TAILS); await attack(G, 0, 'Rascal');
  eq(act(G, 0).equip, '105', 'taken'); eq(act(G, 1).equip, null, 'gone from the target');
});

/* ================= targeting and tricks ================= */
await test('Calming Focus: next attack also hits the bench', async () => {
  const G = game({ active: 'Unstone' }, { active: 'Raizado', bench: ['Poteplant'] });
  await attack(G, 0, 'Calming Focus'); G.turnNumber = 12; await attack(G, 0, 'Rock Garden');
  eq(bn(G, 1).maxHp - bn(G, 1).hp, 10, 'bench splash');
});
await test('Pounce: tails hits the bench', async () => {
  const G = game({ active: 'Taelong' }, { active: 'Raizado', bench: ['Poteplant'] });
  rig(TAILS); await attack(G, 0, 'Pounce');
  eq(act(G, 1).hp, act(G, 1).maxHp, 'active untouched'); ok(bn(G, 1).hp < bn(G, 1).maxHp, 'bench hit');
});
await test('Wutai: drag a benched Bakemon by D3 slot, or fail', async () => {
  let G = game({ active: 'Huangshi' }, { active: 'Raizado', bench: ['Poteplant', 'Leapod'] });
  const target = bn(G, 1, 1); rig(d(3, 2)); await attack(G, 0, 'Wǔtái'); eq(act(G, 1), target, 'dragged out');
  G = game({ active: 'Huangshi' }, { active: 'Raizado', bench: ['Poteplant'] });
  const stay = act(G, 1); rig(d(3, 3)); await attack(G, 0, 'Wǔtái'); eq(act(G, 1), stay, 'empty slot: fails');
});
await test('Head Tilt: copies an attack that fits the roll', async () => {
  const G = game({ active: 'Mushmutt' }, { active: 'Raizado', bench: ['Poteplant'] });
  rig(d(6, 6)); await attack(G, 0, 'Head Tilt');
  ok(act(G, 1).hp < act(G, 1).maxHp || bn(G, 1).hp < bn(G, 1).maxHp || act(G, 0).hp < act(G, 0).maxHp || /copies/.test(log(G)), 'something was copied: ' + log(G));
});
await test('Dǎoyǎn: the chosen move is unavailable next turn', async () => {
  const G = game({ active: 'Huangshi' }, { active: 'Poteplant', energy: { Poteplant: ['grass', 'grass', 'grass'] } });
  const pick = (G, P, req) => req.options.find(o => o.value.mon === act(G, 1) && !o.value.move.isAbility).value;
  G.players[0].controller = ai({ disable: pick });
  await attack(G, 0, 'Dǎoyǎn');
  const names = ctx.legalActions(G, G.players[1]).filter(a => a.type === 'attack').map(a => a.move.index);
  ok(!act(G, 1).effects.some(e => e.kind === 'disabled') || !names.includes(act(G, 1).effects.find(e => e.kind === 'disabled').moveIndex), 'the disabled move must not be offered');
});
await test('Chǒu: only usable on a sleeping target', async () => {
  const G = game({ active: 'Huangshi', energy: { Huangshi: ['normal', 'normal', 'normal'] } }, { active: 'Raizado' });
  const has = () => ctx.legalActions(G, G.players[0]).some(a => a.type === 'attack' && a.move.name === 'Chǒu');
  // Huangshi is stage one; use Huangban's Chou if that is where it lives.
  const holder = E.CARDS.find(c => (c.abilities || []).some(a => a.name === 'Chǒu')).name;
  const G2 = game({ active: holder, energy: { [holder]: ['normal', 'normal', 'normal'] } }, { active: 'Raizado' });
  const has2 = () => ctx.legalActions(G2, G2.players[0]).some(a => a.type === 'attack' && a.move.name === 'Chǒu');
  eq(has2(), false, 'awake'); act(G2, 1).status.asleep = true; eq(has2(), true, 'asleep');
});
await test('Brumate: heals 50 and locks the rest of the turn', async () => {
  const G = game({ active: 'Shython', energy: { Shython: ['ice', 'fairy', 'fairy'] }, hp: { Shython: 20 } }, { active: 'Raizado' });
  await ability(G, 0, act(G, 0), 'Brumate');
  eq(act(G, 0).hp, 70, 'healed 50');
  eq(ctx.legalActions(G, G.players[0]).filter(a => a.type !== 'endTurn' && a.type !== 'retreat').length, 0, 'nothing else allowed');
});
await test('Cling: no attacks or energy this turn, and no damage next turn', async () => {
  const G = game({ active: 'Petrazoa' }, { active: 'Raizado' });
  await ability(G, 0, act(G, 0), 'Cling');
  eq(ctx.legalActions(G, G.players[0]).some(a => a.type === 'attack' || a.type === 'energy'), false, 'locked');
  const hit = { name: 'Big', damage: 50, cost: { types: {}, any: 1, total: 1 }, ops: [], fx: {}, isAbility: false };
  await ctx.resolveAttack(G, G.players[1], act(G, 1), hit); eq(act(G, 0).hp, act(G, 0).maxHp, 'untouched');
});
await test('Twinship: the pair swap places for free', async () => {
  const G = game({ active: 'Jeremo♀', bench: ['Jeremo♂'] }, { active: 'Raizado' });
  const male = bn(G, 0); await ability(G, 0, act(G, 0), 'Twinship');
  eq(act(G, 0), male, 'Jeremo♂ is now active');
});

/* ================= energy tricks ================= */
await test('Voltage Surge: one electric to the target, one to the bench', async () => {
  const G = game({ active: 'Bulbark', bench: ['Poteplant'], energy: { Bulbark: ['electric', 'electric'] } }, { active: 'Raizado' });
  await attack(G, 0, 'Voltage Surge');
  eq(act(G, 0).energy.length, 0, 'gave both away'); eq(act(G, 1).energy.join(), 'electric', 'target'); eq(bn(G, 0).energy.join(), 'electric', 'bench');
});
await test('Talon Pluck: steals energy and heals for damage dealt', async () => {
  const G = game({ active: 'Muaygon', hp: { Muaygon: 30 } }, { active: 'Raizado', energy: { Raizado: ['fire'] } });
  const before = act(G, 0).hp; await attack(G, 0, 'Talon Pluck');
  eq(act(G, 1).energy.length, 0, 'energy taken'); eq(act(G, 0).energy.join(), 'fire', 'now Muaygon\'s');
  ok(act(G, 0).hp > before, 'healed');
});
await test('Co-opt: take an energy from another mushroom Bakemon', async () => {
  const G = game({ active: 'Mushmutt' }, { active: 'Musherus', energy: { Musherus: ['grass'] } });
  await ability(G, 0, act(G, 0), 'Co-opt'); eq(act(G, 0).energy.join(), 'grass', 'taken');
});
await test('Hydraulic Press: steel becomes anything, on another Bakemon', async () => {
  const G = game({ active: 'Current', bench: ['Poteplant'], energy: { Current: ['steel'] } }, { active: 'Raizado' }, [{ energyType: () => 'fire', energyTo: (G, P, req) => req.options.find(m => m.card.name === 'Poteplant') }]);
  await ability(G, 0, act(G, 0), 'Hydraulic Press');
  eq(act(G, 0).energy.length, 0, 'steel gone'); eq(bn(G, 0).energy.join(), 'fire', 'fire on Poteplant');
});
await test('Reorganise: swaps an orb between two enemy Bakemon', async () => {
  const G = game({ active: 'Silooper' }, { active: 'Raizado', bench: ['Poteplant'], energy: { Raizado: ['fire'], Poteplant: ['grass'] } });
  await attack(G, 0, 'Reorganise');
  eq(act(G, 1).energy.join(), 'grass', 'active'); eq(bn(G, 1).energy.join(), 'fire', 'bench');
});
await test('Purify: a status becomes its energy (poison -> dark)', async () => {
  const G = game({ active: 'Ionodyr', bench: ['Poteplant'] }, { active: 'Raizado' });
  act(G, 0).status.poisoned = true;
  await ability(G, 0, act(G, 0), 'Purify');
  ok(!act(G, 0).status.poisoned, 'cleansed');
  const all = E.zone(G.players[0]).concat(E.zone(G.players[1])).flatMap(m => m.energy);
  eq(all.join(), 'dark', 'one dark energy appeared');
});
await test('Purify: confusion becomes a random energy', async () => {
  const G = game({ active: 'Ionodyr' }, { active: 'Raizado' });
  act(G, 0).status.confused = true;
  await ability(G, 0, act(G, 0), 'Purify');
  eq(E.zone(G.players[0]).concat(E.zone(G.players[1])).flatMap(m => m.energy).length, 1, 'one energy of some type');
});
await test('Humidifier: every attack counts as having one more water energy', async () => {
  const cost = { types: { water: 2 }, any: 0, total: 2 };
  let G = game({ active: 'Poteplant', energy: { Poteplant: ['water'] } }, { active: 'Raizado' });
  eq(E.canPay(act(G, 0), cost), false, 'one water is not enough');
  G = game({ active: 'Poteplant', energy: { Poteplant: ['water'] } }, { active: 'Raizado', equip: { Raizado: '111' } });
  eq(E.canPay(act(G, 0), cost), true, 'with a Humidifier anywhere, one water is enough');
  // ...and weakness counts the extra water symbol: Draquaduct-style check against a water-weak target.
  const weakToWater = E.CARDS.find(c => c.kind === 'bakemon' && c.weak.includes('water'));
  const hit = { name: 'Plain', damage: 30, cost: { types: {}, any: 1, total: 1 }, ops: [], fx: {}, isAbility: false };
  const A = game({ active: 'Poteplant', big: ['Poteplant'] }, { active: weakToWater.name, big: [weakToWater.name], equip: { [weakToWater.name]: '111' } });
  await ctx.resolveAttack(A, A.players[0], act(A, 0), hit);
  eq(act(A, 1).maxHp - act(A, 1).hp, 40, 'plain attack gets +10 against a water-weak target while a Humidifier is out');
});
await test('Notepad: copy a move, use it for the same NUMBER of energy, then it is used up', async () => {
  const G = game({ active: 'Poteplant', energy: { Poteplant: ['grass', 'grass'] }, hand: ['112'] }, { active: 'Lemurk', big: ['Lemurk'] });
  await ctx.perform(G, G.players[0], { type: 'item', handIndex: 0, cardId: '112' });
  const mine = act(G, 0);
  ok(mine.notepad && mine.notepad.name === 'Tail Slap', 'copied the enemy move: ' + (mine.notepad && mine.notepad.name));
  const options = ctx.legalActions(G, G.players[0]).filter(a => a.notepad);
  eq(options.length, 1, 'a Notepad attack is offered');
  eq(options[0].move.cost.total, 2, 'it costs 2 energy, of any kind');
  rig(d(6, 3)); await ctx.perform(G, G.players[0], options[0]);
  eq(act(G, 1).maxHp - act(G, 1).hp, 30, 'Tail Slap rolled a 3');
  eq(mine.equip, null, 'the Notepad is discarded'); ok(G.players[0].discard.includes('112'), 'in the discard pile');
});
await test('Notepad: needs the energy', async () => {
  const G = game({ active: 'Poteplant', energy: { Poteplant: ['grass'] }, hand: ['112'] }, { active: 'Lemurk' });
  await ctx.perform(G, G.players[0], { type: 'item', handIndex: 0, cardId: '112' });
  eq(ctx.legalActions(G, G.players[0]).filter(a => a.notepad).length, 0, 'one energy is not enough for a 2-energy move');
});
await test('Eclidyr cannot evolve without five kinds of energy', async () => {
  const G = game({ active: 'Eclidyr', energy: { Eclidyr: ['fire', 'water', 'grass', 'dark'] } }, { active: 'Raizado' });
  const ionodyr = E.CARD_BY_ID[idOf('Ionodyr')];
  act(G, 0).playedTurn = 1;
  eq(E.canEvolveOnto(G, G.players[0], act(G, 0), ionodyr), false, 'four kinds');
  act(G, 0).energy.push('psychic');
  eq(E.canEvolveOnto(G, G.players[0], act(G, 0), ionodyr), true, 'five kinds');
});

await test('Hungry Ghost: 10 less max HP per psychic energy, and it comes back', async () => {
  const G = game({ active: 'Necrozoa' }, { active: 'Raizado' });
  const n = act(G, 0), full = n.maxHp;
  await ctx.dealDamage(G, null, n, 30, {});
  await ctx.attachEnergy(G, n, 'psychic'); await ctx.attachEnergy(G, n, 'psychic');
  eq(n.maxHp, full - 20, 'max HP after two psychic'); eq(n.hp, full - 30 - 20, 'HP keeps the same damage');
  await ctx.attachEnergy(G, n, 'fire'); eq(n.maxHp, full - 20, 'other energy does nothing');
  n.energy.splice(n.energy.indexOf('psychic'), 1); await ctx.checkKOs(G);
  eq(n.maxHp, full - 10, 'one psychic gone'); eq(n.hp, full - 30 - 10, 'HP comes back with it');
});
await test('Secret Frequency: both draw, and the opponent shows theirs', async () => {
  const G = game({ active: 'Octovox' }, { active: 'Raizado' });
  await ability(G, 0, act(G, 0), 'Secret Frequency');
  ok(/shows Poteplant/.test(log(G)), 'the drawn card is named: ' + log(G));
});

await test('Evolving: stage one to stage two must wait a turn', async () => {
  const G = game({ active: 'Poteplant', hand: [idOf('Vasflor'), idOf('Raizado')] }, { active: 'Leapod' });
  const P = G.players[0], mon = act(G, 0);
  mon.playedTurn = 2;                                                 // it has been in play for a while
  const evo = () => ctx.legalActions(G, P).filter(a => a.type === 'evolve');
  eq(evo().length, 1, 'Poteplant can become Vasflor');
  await ctx.perform(G, P, evo()[0]);
  eq(mon.card.name, 'Vasflor', 'evolved');
  eq(evo().length, 0, 'Raizado is NOT offered the same turn');
  G.turnNumber += 2;
  eq(evo().length, 1, 'next turn it is');
});
await test('Contact Zap: the attacker does no damage on its NEXT turn', async () => {
  const G = game({ active: 'Poteplant', big: ['Poteplant'] }, { active: 'Torshock', big: ['Torshock'] });
  G.turn = 0;
  const hit = { name: 'Poke', damage: 30, cost: { types: {}, any: 1, total: 1 }, ops: [], fx: {}, isAbility: false };
  rig(HEADS); await ctx.resolveAttack(G, G.players[0], act(G, 0), hit);
  ok(act(G, 0).status.paralyzed, 'paralyzed');
  await ctx.endTurn(G, G.players[0]);                                 // my turn ends
  G.turnNumber = 11; G.turn = 1; await ctx.endTurn(G, G.players[1]);  // Torshock's turn ends
  G.turnNumber = 12; G.turn = 0;                                      // my next turn
  ok(act(G, 0).effects.some(e => e.kind === 'dmgDebuff' && e.amount >= 999), 'still unable to do damage on my next turn');
  const hp = act(G, 1).hp; await ctx.resolveAttack(G, G.players[0], act(G, 0), hit);
  eq(act(G, 1).hp, hp, 'no damage');
});

await test("Hide: blocks damage through the opponent's next turn, then wears off", async () => {
  const G = game({ active: 'Leapod', big: ['Leapod'] }, { active: 'Poteplant', big: ['Poteplant'] });
  const hit = { name: 'Poke', damage: 30, cost: { types: {}, any: 1, total: 1 }, ops: [], fx: {}, isAbility: false };
  const leapod = act(G, 0);
  G.turn = 0; await attack(G, 0, 'Hide');
  await ctx.endTurn(G, G.players[0]);                                 // Leapod's turn ends
  G.turnNumber += 1; G.turn = 1;                                      // opponent's next turn
  await ctx.resolveAttack(G, G.players[1], act(G, 1), hit);
  await ctx.resolveAttack(G, G.players[1], act(G, 1), hit);
  eq(leapod.maxHp - leapod.hp, 0, 'every hit that turn is avoided');
  await ctx.endTurn(G, G.players[1]);                                 // opponent's turn ends
  G.turnNumber += 1; G.turn = 0;
  ok(!leapod.effects.some(e => e.kind === 'shield'), 'Hide should be gone');
  G.turnNumber += 1; G.turn = 1;
  await ctx.resolveAttack(G, G.players[1], act(G, 1), hit);
  eq(leapod.maxHp - leapod.hp, 30, 'hit normally a turn later');
});

await test('Birthday Boy: each one allows one same-turn evolution', async () => {
  const G = game({ active: 'Poteplant', hand: [idOf('Quetzalil'), '115', idOf('Quexcell'), '115', idOf('Quetzillian')] }, { active: 'Raizado' });
  const P = G.players[0];
  const doIt = async (type, text) => { const a = ctx.legalActions(G, P).find(x => x.type === type && (!text || x.label.includes(text))); ok(a, type + ' ' + (text || '') + ' should be offered'); await ctx.perform(G, P, a); };
  await doIt('playBasic');
  eq(ctx.legalActions(G, P).some(a => a.type === 'evolve'), false, 'no evolving a card played this turn, without help');
  await doIt('item', 'Birthday Boy'); await doIt('evolve', 'Quexcell');
  eq(ctx.legalActions(G, P).some(a => a.type === 'evolve'), false, 'one Birthday Boy, one evolution');
  await doIt('item', 'Birthday Boy'); await doIt('evolve', 'Quetzillian');
  eq(bn(G, 0).card.name, 'Quetzillian', 'all the way up in one turn with two Birthday Boys');
});
await test('Co-opt: Mushmutt chooses which energy to take', async () => {
  const G = game({ active: 'Mushmutt' }, { active: 'Musherus', energy: { Musherus: ['grass', 'water', 'grass'] } }, [{ energyType: (G, P, req) => (ok(req.options.length === 2, 'offered the two kinds'), 'water') }]);
  await ability(G, 0, act(G, 0), 'Co-opt');
  eq(act(G, 0).energy.join(), 'water', 'took the one we chose'); eq(act(G, 1).energy.join(), 'grass,grass', 'the rest stays');
});

await test('Life Cycle: once a turn, like any ability', async () => {
  const G = game({ active: 'Grupix', hand: [idOf('Envelawn'), idOf('Constricturf'), idOf('Poteplant'), idOf('Vasflor')] }, { active: 'Raizado' });
  const P = G.players[0];
  const doIt = async (type, text) => { const a = ctx.legalActions(G, P).find(x => x.type === type && (!text || x.label.includes(text))); ok(a, type + ' ' + (text || '') + ' should be offered'); await ctx.perform(G, P, a); };
  await doIt('playBasic', 'Envelawn'); await doIt('playBasic', 'Poteplant');
  await doIt('evolve', 'Constricturf');
  eq(ctx.legalActions(G, P).some(a => a.type === 'evolve'), false, 'Life Cycle already used this turn, so Poteplant (also grass) waits');
  G.turnNumber += 2; G.t.lifeCycleUsed = false;
  ok(ctx.legalActions(G, P).some(a => a.type === 'evolve' && a.label.includes('Vasflor')), 'next turn it works again');
});

/* ================= items ================= */
await test('Moira: you choose the five discards, and they are named', async () => {
  const G = game({ active: 'Poteplant', bench: ['Leapod'], hand: ['102'] }, { active: 'Raizado' }, [{ discardFromHand: (G, P, req) => req.options[0].value }]);
  const P = G.players[0];
  P.deck = [idOf('Leapol')].concat(Array(7).fill('101'));            // the evolution is 8 cards down (top of deck = end of list)
  await ctx.runOps(G, { P, self: act(G, 0), target: act(G, 1) }, [{ digForEvolution: { penaltyOver: 6, discard: 5 } }]);
  eq(P.discard.length, 5, 'five discarded'); ok(P.hand.includes(idOf('Leapol')), 'kept the card it was digging for');
  ok(/discards Bill/.test(log(G)) && /discards Band-aid/.test(log(G)), 'each discard is named');
});
await test('Energy and retreat accept a choice made in advance', async () => {
  const G = game({ active: 'Poteplant', bench: ['Leapod', 'Musherus'], energy: { Poteplant: ['grass'] } }, { active: 'Raizado' });
  const P = G.players[0], leapod = bn(G, 0, 0), musherus = bn(G, 0, 1);
  await ctx.perform(G, P, { type: 'energy', mon: leapod, energyType: 'water' });
  eq(leapod.energy.join(), 'water', 'attached where and what we said');
  await ctx.perform(G, P, { type: 'retreat', promote: musherus });
  eq(act(G, 0), musherus, 'the chosen Bakemon stepped up');
});
await test('Equipping: only the active Bakemon, and retreating discards it', async () => {
  const G = game({ active: 'Poteplant', bench: ['Leapod'], hand: ['105'] }, { active: 'Raizado' });
  const P = G.players[0];
  ok(ctx.legalActions(G, P).some(a => a.type === 'item'), 'an item can be played with a free active');
  await ctx.perform(G, P, { type: 'item', handIndex: 0, cardId: '105' });
  eq(act(G, 0).equip, '105', 'the active wears it'); eq(bn(G, 0).equip, null, 'the bench does not');
  P.hand = ['109'];
  eq(ctx.legalActions(G, P).some(a => a.type === 'item'), false, 'a second equip has nowhere to go (bench is not allowed)');
  const wearer = act(G, 0);
  await ctx.switchActive(G, P, bn(G, 0));
  eq(wearer.equip, null, 'retreating discards the item'); ok(P.discard.includes('105'), 'into the discard pile');
});

await test('Lyza: draws to a basic, discarding items on the way', async () => {
  const G = game({ active: 'Poteplant' }, { active: 'Raizado' });
  const P = G.players[0]; P.deck = [idOf('Poteplant'), '101', '102', idOf('Vasflor')];      // top of the deck is the END of the list
  const bandAid = '101';
  await ctx.runOps(G, { P, self: act(G, 0), target: act(G, 1) }, [{ drawUntilBasic: true }]);
  ok(P.discard.includes('101') && P.discard.includes('102'), 'items discarded'); ok(P.hand.includes(idOf('Vasflor')), 'drew the stage one on the way'); ok(P.hand.includes(idOf('Poteplant')), 'stopped at the basic');
});
await test('Detect Change: the other side sees your turn\'s draw', async () => {
  const G = game({ active: 'Zephyrzoa' }, { active: 'Raizado' });
  await ctx.drawCards(G, G.players[1], 1, true);
  ok(/just drawn/.test(log(G)), 'revealed');
});

Math.random = realRandom;
console.log(`${passed} passed, ${failures.length} failed.`);
for (const f of failures) console.log('  FAIL ' + f);
process.exit(failures.length ? 1 : 0);
})();
