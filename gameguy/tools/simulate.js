/* ============================================================
   SIMULATE — let the AI play itself, thousands of times, and see what breaks.
   ============================================================
   Needs Node (nothing else). From the gameguy folder:

       node tools/simulate.js              200 matches
       node tools/simulate.js 2000         2000 matches
       node tools/simulate.js 500 seed     ...and print every card the engine
                                           has never seen resolve cleanly

   It builds random legal decks out of EVERY card in data/cards.js, so it also
   exercises the cards no opponent deck uses yet. It reports:
     - matches that crashed (with the card text it was resolving)
     - matches that hit the turn limit (usually an engine loop)
     - ops the engine doesn't recognise
     - which cards never got played at all
     - rule checks that fail (an item on a benched Bakemon)
   ============================================================ */

const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { console, Math, setTimeout };
vm.createContext(ctx);

const warnings = new Map();
ctx.console = Object.assign(Object.create(console), {
  warn: (...a) => { const k = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); warnings.set(k, (warnings.get(k) || 0) + 1); },
});

const load = (file, extra) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8') + (extra || ''), ctx, { filename: file });
for (const f of ['data/config.js', 'data/cards.js', 'data/battle-rules.js', 'data/moves.js'])
  load(f, f === 'data/config.js' ? '' : '');
vm.runInContext('const CARD_BY_ID = {}; for (const c of CARDS) CARD_BY_ID[c.id] = c;', ctx);
load('js/battle.js');
load('js/battle-ai.js');

const N = Number(process.argv[2]) || 200;
const verbose = process.argv[3] === 'seed';

const played = new Set();
const harness = `
  (function () {
    const ids = CARDS.map(c => c.id);
    const benchEquips = [];
    const pick = list => list[Math.floor(Math.random() * list.length)];
    function randomDeck() {
      const size = 12 + Math.floor(Math.random() * 21);          // 12..32
      const deck = [];
      const basics = ids.filter(isBasic);
      deck.push(pick(basics));
      let guard = 0;
      while (deck.length < size && guard++ < 500) {
        const id = pick(ids);
        if (deck.filter(x => x === id).length < BATTLE_RULES.copiesMax) deck.push(id);
      }
      return deck;
    }
    async function oneMatch(seen) {
      const io = { show: async (G, e) => {
        if (e.cardId) seen.add(e.cardId); if (e.mon) seen.add(e.mon.card.id);
        // Rules check: only the active Bakemon may wear an item.
        for (const P of G.players) for (const m of bench(P)) if (m.equip) benchEquips.push(m.card.name + ' on the bench wearing ' + CARD_BY_ID[m.equip].name + ' (after: ' + e.text + ')');
      } };
      const a = randomDeck(), b = randomDeck();
      const G = newBattle([
        { name: 'A', deck: a, controller: makeAI({ mistakes: 0.1 }) },
        { name: 'B', deck: b, controller: makeAI({ mistakes: 0.1 }) },
      ], { io, rules: { turnLimit: 150 } });
      G.points = null;
      try { await runBattle(G); } catch (err) { return { error: err, G, decks: [a, b] }; }
      return { G, decks: [a, b] };
    }
    return { oneMatch, benchEquips };
  })()`;
const { oneMatch, benchEquips } = vm.runInContext(harness, ctx);

(async () => {
  const stats = { ok: 0, draw: 0, crashed: 0, turns: 0 };
  const crashes = new Map();
  for (let i = 0; i < N; i++) {
    const r = await oneMatch(played);
    if (r.error) {
      stats.crashed++;
      const where = String(r.error.stack || r.error).split('\n').slice(0, 3).join(' | ');
      const last = r.G.log.slice(-3).join(' / ');
      const key = where;
      if (!crashes.has(key)) crashes.set(key, { count: 0, last, decks: r.decks });
      crashes.get(key).count++;
    } else if (r.G.draw) { stats.draw++; if (verbose) console.log('draw:', r.G.log.slice(-4).join(' / ')); }
    else stats.ok++;
    stats.turns += r.G.turnNumber;
  }
  console.log(`${N} matches: ${stats.ok} finished, ${stats.draw} hit the turn limit, ${stats.crashed} crashed. Average ${(stats.turns / N).toFixed(1)} turns.`);
  for (const [k, v] of crashes) console.log(`\nCRASH x${v.count}: ${k}\n  just before: ${v.last}`);
  if (benchEquips.length) console.log(`\nRULE BROKEN ${benchEquips.length}x, e.g. ${benchEquips[0]}`);
  if (warnings.size) { console.log('\nWarnings:'); for (const [k, v] of warnings) console.log(`  x${v}  ${k}`); }
  const never = vm.runInContext('CARDS', ctx).filter(c => !played.has(c.id)).map(c => c.id + ' ' + c.name);
  if (never.length) console.log(`\nNever seen in play (${never.length}): ${never.join(', ')}`);
  process.exit(stats.crashed ? 1 : 0);
})();
