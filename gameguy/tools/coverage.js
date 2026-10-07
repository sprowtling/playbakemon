/* ============================================================
   COVERAGE — which cards can the engine actually referee?
   ============================================================
       node tools/coverage.js

   Reads data/cards.js and data/moves.js and lists every move or item
   whose effect text isn't wired, or is only roughly wired (`approx`).
   ============================================================ */
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = {}; vm.createContext(ctx);
for (const f of ['data/cards.js', 'data/battle-rules.js', 'data/moves.js'])
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const { CARDS, MOVES, ITEMS } = vm.runInContext('({ CARDS, MOVES, ITEMS })', ctx);

const rows = { ok: 0, plain: 0, approx: [], todo: [], unwired: [], stale: [] };
for (const c of CARDS) {
  if (c.kind === 'item') {
    const it = ITEMS[c.id];
    if (!it) rows.unwired.push(`${c.id} ${c.name} (item): ${c.effect}`);
    else if (it.todo) rows.todo.push(`${c.id} ${c.name} (item): ${it.todo}`);
    else if (it.approx) rows.approx.push(`${c.id} ${c.name} (item): ${it.approx}`);
    else rows.ok++;
    continue;
  }
  for (const a of c.abilities) {
    const fx = (MOVES[c.id] || {})[a.name];
    if (!a.text) { rows.plain++; continue; }
    if (!fx) rows.unwired.push(`${c.id} ${c.name}: ${a.name} — ${a.text}`);
    else if (fx.todo) rows.todo.push(`${c.id} ${c.name}: ${a.name} — ${fx.todo}`);
    else if (fx.approx) rows.approx.push(`${c.id} ${c.name}: ${a.name} — ${fx.approx}`);
    else rows.ok++;
  }
}
// Entries in moves.js that match no card (a renamed move, a typo).
for (const [id, moves] of Object.entries(MOVES)) {
  const card = CARDS.find(c => c.id === id);
  if (!card) { rows.stale.push(`${id}: no such card`); continue; }
  for (const name of Object.keys(moves)) if (!card.abilities.some(a => a.name === name)) rows.stale.push(`${id} ${card.name}: no move called "${name}"`);
}
const show = (title, list) => { if (list.length) console.log(`\n${title} (${list.length})\n  ` + list.join('\n  ')); };
console.log(`${rows.ok} moves/items fully wired, ${rows.plain} moves with no effect text.`);
show('NOT WIRED AT ALL', rows.unwired);
show('TODO', rows.todo);
show('SIMPLIFIED (approx)', rows.approx);
show('STALE ENTRIES in moves.js', rows.stale);
