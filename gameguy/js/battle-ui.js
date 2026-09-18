/* ============================================================
   BATTLE UI — the card table on screen, your deck, and the glue
   between the island and the rules engine.
   ============================================================
   js/battle.js asks questions ("what do you do?", "which Bakemon?").
   This file turns each question into something on screen, waits
   for your keys, and hands the answer back. It never decides what
   is LEGAL; it only shows what the engine says is legal.

   Two kinds of question arrive from the engine:
     chooseAction → the command menu (Attack, Play a card, ...)
     ask          → a follow-up: pick from a list, or point at a Bakemon
   ============================================================ */

let bs = null;     // "battle screen": everything the table view needs while a match is on

/* ---------------- your deck ---------------- */

function deckList() {
  // Until you've edited the deck yourself it simply tracks the shoebox, so a kid
  // who has never opened the deck editor can still sit down and play.
  if (!state.deck || !state.deckEdited) state.deck = autoDeck();
  const list = [];
  for (const [id, n] of Object.entries(state.deck)) {
    const count = Math.min(n, owned(id), BATTLE_RULES.copiesMax);       // traded a card away? the deck shrinks with it
    if (count > 0) state.deck[id] = count; else delete state.deck[id];
    for (let i = 0; i < count; i++) list.push(id);
  }
  return list;
}

// Everything you own, Bakemon first, up to the limits.
function autoDeck() {
  const deck = {}; let size = 0;
  const ids = CARDS.filter(c => owned(c.id)).sort((a, b) => (a.kind === 'item') - (b.kind === 'item')).map(c => c.id);
  for (const id of ids) { const n = Math.min(owned(id), BATTLE_RULES.copiesMax, BATTLE_RULES.deckMax - size); if (n > 0) { deck[id] = n; size += n; } }
  return deck;
}

function openDeckEditor(onClose) {
  deckList();
  ui.screen = { kind: 'deck', sel: 0, topRow: 0, onClose, cards: CARDS.filter(c => owned(c.id)) };
}

function updateDeckEditor() {
  const s = ui.screen, n = s.cards.length;
  if (pressed('left'))  s.sel = Math.max(0, s.sel - 1);
  if (pressed('right')) s.sel = Math.min(n - 1, s.sel + 1);
  if (pressed('up') && s.sel - GRID.cols >= 0) s.sel -= GRID.cols;
  if (pressed('down'))  s.sel = Math.min(n - 1, s.sel + GRID.cols);
  const row = Math.floor(s.sel / GRID.cols);
  if (row < s.topRow) s.topRow = row;
  if (row >= s.topRow + GRID.rows) s.topRow = row - GRID.rows + 1;

  const id = s.cards[s.sel].id, inDeck = state.deck[id] || 0, size = deckList().length;
  if (pressed('action') && inDeck < Math.min(owned(id), BATTLE_RULES.copiesMax) && size < BATTLE_RULES.deckMax) { state.deck[id] = inDeck + 1; state.deckEdited = true; }
  if (pressed('remove') && inDeck > 0) { if (inDeck === 1) delete state.deck[id]; else state.deck[id] = inDeck - 1; state.deckEdited = true; }
  if (pressed('auto')) { state.deck = autoDeck(); state.deckEdited = false; }      // back to "everything I own", and it keeps itself up to date again
  if (pressed('cancel')) { saveGame(); ui.screen = null; if (s.onClose) s.onClose(); }
}

function drawDeckEditor() {
  const s = ui.screen, list = deckList(), problem = deckProblem(list);
  ctx.fillStyle = '#12303a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  setFont(38); ctx.fillStyle = COLOR.sand; ctx.fillText('Your deck', 28, 54);
  setFont(24); ctx.fillStyle = problem ? COLOR.coral : COLOR.glass;
  ctx.fillText(list.length + ' cards.   ' + (problem || 'Ready to play.'), 200, 52);

  for (let i = s.topRow * GRID.cols; i < Math.min(s.cards.length, (s.topRow + GRID.rows) * GRID.cols); i++) {
    const card = s.cards[i], n = state.deck[card.id] || 0;
    const x = GRID.x + (i % GRID.cols) * (GRID.cw + GRID.gap);
    const y = GRID.y + (Math.floor(i / GRID.cols) - s.topRow) * (GRID.ch + GRID.gap);
    ctx.globalAlpha = n ? 1 : 0.35;                       // faded = owned, but not in the deck
    drawCard(card, x, y, GRID.cw, GRID.ch, false);
    ctx.globalAlpha = 1;
    roundRect(x + GRID.cw - 34, y + GRID.ch - 24, 32, 22, 6); ctx.fillStyle = COLOR.ink; ctx.fill();
    setFont(16); ctx.textAlign = 'center'; ctx.fillStyle = n ? COLOR.sand : COLOR.dim;
    ctx.fillText(n + '/' + Math.min(owned(card.id), BATTLE_RULES.copiesMax), x + GRID.cw - 18, y + GRID.ch - 8); ctx.textAlign = 'left';
    if (i === s.sel) { roundRect(x - 4, y - 4, GRID.cw + 8, GRID.ch + 8, 8); ctx.strokeStyle = COLOR.glass; ctx.lineWidth = 3; ctx.stroke(); }
  }
  const card = s.cards[s.sel], dx = 650, dw = 282, dh = Math.round(dw * 1.4);
  drawCard(card, dx, GRID.y, dw, dh, true);
  drawMoveNotes(card, dx, GRID.y + dh + 30, dw);
  setFont(18); ctx.fillStyle = COLOR.dim;
  ctx.fillText('E add a copy      X take one out      F everything I own      Esc done', 28, canvas.height - 16);
  if (!state.deckEdited) { ctx.fillStyle = COLOR.dim; ctx.textAlign = 'right'; ctx.fillText('Tracking your whole shoebox until you change it.', canvas.width - 28, 52); ctx.textAlign = 'left'; }
}

// Under a big card: is each of its effects actually working in the island game?
function drawMoveNotes(card, x, y, w) {
  setFont(18);
  const notes = [];
  if (card.kind === 'item') { const it = ITEMS[card.id] || {}; if (it.todo) notes.push(['Not playable on the island yet.', COLOR.coral]); else if (it.approx) notes.push(['Simplified: ' + it.approx, COLOR.dim]); }
  else for (const m of cardMoves(card)) {
    if (m.fx.todo) notes.push([m.name + ': effect not wired yet.', COLOR.coral]);
    else if (m.fx.approx) notes.push([m.name + ': ' + m.fx.approx + '.', COLOR.dim]);
    else if (m.text && !m.ops.length && !m.fx.tag) notes.push([m.name + ': effect not wired yet.', COLOR.coral]);
  }
  for (const [text, color] of notes) { ctx.fillStyle = color; for (const line of wrapText(text, w)) { ctx.fillText(line, x, y); y += 22; } }
}

/* ---------------- starting a match ---------------- */

function startBattle(opponentId, onDone) {
  const opp = OPPONENTS[opponentId];
  bs = { opp, opponentId, G: null, menu: null, picker: null, wait: null, lines: [], fx: [], preview: null, result: null, shake: {}, onDone };

  const human = {
    chooseAction: (G, P, actions) => new Promise(resolve => openCommandMenu(G, P, actions, resolve)),
    ask: (G, P, req) => new Promise(resolve => openQuestion(G, P, req, resolve)),
  };
  bs.G = newBattle(
    [{ name: 'You', deck: deckList(), controller: human, isHuman: true }, { name: opp.name, deck: opp.deck, controller: makeAI(opp.style) }],
    { rules: { pointsToWin: opp.points || BATTLE_RULES.pointsToWin }, io: { show: showBattleEvent } });
  ui.screen = { kind: 'battle' };

  runBattle(bs.G).then(G => {
    bs.result = G.draw ? 'draw' : G.winner.isHuman ? 'win' : 'loss';
  }).catch(err => {                       // a bug in a card effect shouldn't trap you at the table
    console.error(err);
    bs.result = 'broken';
  });
}

// The engine announces everything that happens through here. We show the line,
// add a little motion, and make the engine WAIT so the match can be followed.
function showBattleEvent(G, e) {
  bs.lines.push(e.text); if (bs.lines.length > 40) bs.lines.shift();
  if (e.mon) bs.preview = e.mon.card;
  if (e.cardId) bs.preview = CARD_BY_ID[e.cardId];
  if (e.mon && e.kind === 'damage' && e.amount) { bs.fx.push({ uid: e.mon.uid, text: '-' + e.amount, color: COLOR.coral, t: 0 }); bs.shake[e.mon.uid] = 0.3; }
  if (e.mon && e.kind === 'heal')   bs.fx.push({ uid: e.mon.uid, text: '+' + e.amount, color: COLOR.glass, t: 0 });
  if (e.mon && e.kind === 'status') bs.fx.push({ uid: e.mon.uid, text: e.text.split(' is now ')[1].replace('.', ''), color: COLOR.sand, t: 0 });
  const seconds = BATTLE_RULES.messageSeconds * (e.kind === 'turn' || e.kind === 'ko' || e.kind === 'win' ? 1.4 : 1);
  return new Promise(resolve => { bs.wait = { left: seconds, resolve }; });
}

/* ---------------- menus ---------------- */
// A menu here is { title, items, i, back }.  An item is
// { label, run, cardId, mon, move, energy, dim }.  `run` either opens another menu or answers the engine.

function openMenu(title, items, back) { bs.menu = { title, items, i: 0, back }; bs.picker = null; syncPreview(); }

function openCommandMenu(G, P, actions, resolve) {
  const answer = a => { bs.menu = null; resolve(a); };
  const of = type => actions.filter(a => a.type === type);
  const top = () => {
    const items = [];
    if (of('attack').length) items.push({ label: 'Attack', run: () => openMenu('Attack with ' + P.active.card.name, of('attack').map(a => ({ label: a.label, move: a.move, mon: P.active, run: () => answer(a) })), top) });
    else items.push({ label: 'Attack', dim: true, note: !G.t.canAttack ? P.active.card.name + " can't attack this turn." : 'Not enough energy for any attack.' });
    if (of('energy').length) items.push({ label: 'Attach energy', run: () => answer(of('energy')[0]) });
    const plays = of('playBasic').concat(of('evolve'), of('item'));
    if (plays.length) items.push({ label: 'Play a card   (' + P.hand.length + ' in hand)', run: () => openMenu('Play which card?', plays.map(a => ({ label: a.label, cardId: a.cardId, run: () => answer(a) })), top) });
    else items.push({ label: 'Look at your hand   (' + P.hand.length + ')', run: () => openMenu('Your hand. Nothing playable right now.', P.hand.map(id => ({ label: CARD_BY_ID[id].name, cardId: id, dim: true })), top) });
    if (of('ability').length) items.push({ label: 'Use an ability', run: () => openMenu('Which ability?', of('ability').map(a => ({ label: a.label, mon: a.mon, move: a.move, run: () => answer(a) })), top) });
    if (of('retreat').length) items.push({ label: of('retreat')[0].label, run: () => answer(of('retreat')[0]) });
    items.push({ label: 'Look at the table', run: () => openPicker(zone(P).concat(zone(other(G, P))), 'Arrows to look around. Esc to go back.', null, top) });
    items.push({ label: 'End turn', run: () => answer(of('endTurn')[0]) });
    items.push({ label: 'Give up', run: () => openMenu('Give up the match?', [{ label: 'Keep playing', run: top }, { label: 'Give up', run: () => { G.winner = other(G, P); G.t.over = true; answer(of('endTurn')[0]); } }], top) });
    openMenu('Your turn', items, null);
  };
  top();
}

function openQuestion(G, P, req, resolve) {
  if (req.kind === 'mon') return openPicker(req.options, req.prompt, mon => { bs.picker = null; resolve(mon); }, null);
  openMenu(req.prompt, req.options.map(o => ({ label: o.label, cardId: o.cardId, energy: o.energy, run: () => { bs.menu = null; resolve(o.value); } })), null);
}

// Pointing at a Bakemon on the table. With no `done`, it's just for looking.
function openPicker(mons, prompt, done, back) { bs.picker = { mons, i: 0, prompt, done, back }; bs.menu = null; syncPreview(); }

function syncPreview() {
  if (bs.picker) { bs.preview = bs.picker.mons[bs.picker.i].card; bs.previewMove = null; return; }
  const item = bs.menu && bs.menu.items[bs.menu.i];
  if (!item) return;
  if (item.cardId) bs.preview = CARD_BY_ID[item.cardId];
  if (item.mon) bs.preview = item.mon.card;
  bs.previewMove = item.move || null;
}

function updateBattle(dt) {
  for (const f of bs.fx) f.t += dt;
  bs.fx = bs.fx.filter(f => f.t < 1.1);
  for (const uid in bs.shake) if ((bs.shake[uid] -= dt) <= 0) delete bs.shake[uid];

  if (bs.result) {                                   // the match is over: one press to leave the table
    if (bs.wait) { const w = bs.wait; bs.wait = null; w.resolve(); }
    if (pressed('action')) finishBattle();
    return;
  }
  if (bs.wait) {                                     // commentary is on screen; E hurries it along
    bs.wait.left -= dt;
    if (bs.wait.left <= 0 || pressed('action')) { const w = bs.wait; bs.wait = null; w.resolve(); }
    return;
  }
  if (bs.picker) {
    const p = bs.picker;
    if (pressed('left') || pressed('up'))    p.i = (p.i + p.mons.length - 1) % p.mons.length;
    if (pressed('right') || pressed('down')) p.i = (p.i + 1) % p.mons.length;
    if (pressed('action') && p.done) return p.done(p.mons[p.i]);
    if (pressed('cancel') && p.back) return p.back();
    return syncPreview();
  }
  if (bs.menu) {
    const m = bs.menu;
    if (pressed('up'))   m.i = (m.i + m.items.length - 1) % m.items.length;
    if (pressed('down')) m.i = (m.i + 1) % m.items.length;
    syncPreview();
    if (pressed('cancel') && m.back) return m.back();
    if (pressed('action') && m.items[m.i].run) return m.items[m.i].run();
  }
}

function finishBattle() {
  const { result, opp, opponentId, onDone } = bs;
  ui.screen = null; bs = null;
  if (onDone) onDone(result, opp, opponentId);
}

/* ---------------- drawing the table ---------------- */

const TABLE = { benchW: 78, benchH: 109, activeW: 120, activeH: 168, centre: 410 };

// Where a Bakemon sits. side 0 = you (bottom), 1 = them (top). slot -1 = active.
function monRect(side, slot) {
  if (slot < 0) return { x: TABLE.centre - TABLE.activeW / 2, y: side ? 162 : 350, w: TABLE.activeW, h: TABLE.activeH };
  const total = 3 * TABLE.benchW + 2 * 18;
  return { x: TABLE.centre - total / 2 + slot * (TABLE.benchW + 18), y: side ? 44 : 530, w: TABLE.benchW, h: TABLE.benchH };
}

function drawEnergyPips(list, x, y, size) {
  if (list.length > 8) {                       // a big pile: show the first seven and a count
    setFont(size + 3); ctx.fillStyle = COLOR.text; ctx.fillText('+' + (list.length - 7), x + 7 * (size + 3) + 2, y + size - 1);
    list = list.slice(0, 7);
  }
  list.forEach((e, i) => {
    ctx.beginPath(); ctx.arc(x + i * (size + 3) + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = ENERGY_COLORS[e] || '#fff'; ctx.fill(); ctx.strokeStyle = COLOR.ink; ctx.lineWidth = 1.5; ctx.stroke();
  });
}

function drawMon(mon, r, highlighted) {
  const shake = bs.shake[mon.uid] ? Math.sin(bs.shake[mon.uid] * 60) * 4 : 0;
  const x = r.x + shake, y = r.y;
  drawCard(mon.card, x, y, r.w, r.h, true);
  // HP bar along the bottom of the card
  const frac = Math.max(0, mon.hp / mon.maxHp);
  ctx.fillStyle = 'rgba(15,34,39,0.88)'; ctx.fillRect(x, y + r.h - 22, r.w, 22);
  ctx.fillStyle = frac > 0.5 ? '#6ab860' : frac > 0.25 ? '#e8c93a' : COLOR.coral; ctx.fillRect(x + 4, y + r.h - 8, (r.w - 8) * frac, 4);
  setFont(14); ctx.fillStyle = COLOR.text; ctx.fillText(mon.hp + ' / ' + mon.maxHp, x + 5, y + r.h - 10);
  drawEnergyPips(mon.energy, x + 4, y - 7, r.w > 100 ? 13 : 10);
  // statuses and equipment, to the right of the card
  let ty = y + 14; setFont(14);
  for (const s of Object.keys(mon.status)) { ctx.fillStyle = COLOR.coral; ctx.fillText(s, x + r.w + 6, ty); ty += 16; }
  if (mon.effects.some(e => e.kind === 'shield')) { ctx.fillStyle = COLOR.glass; ctx.fillText('guarded', x + r.w + 6, ty); ty += 16; }
  if (mon.equip) { ctx.fillStyle = COLOR.sand; ctx.fillText(CARD_BY_ID[mon.equip].name, x + r.w + 6, ty); }
  if (highlighted) { roundRect(x - 5, y - 5, r.w + 10, r.h + 10, 10); ctx.strokeStyle = COLOR.glass; ctx.lineWidth = 4; ctx.stroke(); }
}

function drawSide(P, side) {
  // name, score and card counts, to the left of the active Bakemon
  const x = 24, y = side ? 176 : 372;
  setFont(26); ctx.fillStyle = COLOR.sand; ctx.fillText(P.name, x, y);
  for (let i = 0; i < bs.G.rules.pointsToWin; i++) {
    ctx.beginPath(); ctx.arc(x + 10 + i * 26, y + 26, 9, 0, Math.PI * 2);
    ctx.fillStyle = i < P.points ? COLOR.coral : 'rgba(255,255,255,0.1)'; ctx.fill(); ctx.strokeStyle = COLOR.edge; ctx.lineWidth = 2; ctx.stroke();
  }
  setFont(18); ctx.fillStyle = COLOR.dim;
  ctx.fillText('hand ' + P.hand.length, x, y + 66); ctx.fillText('deck ' + P.deck.length, x, y + 88); ctx.fillText('discard ' + P.discard.length, x, y + 110);

  const picked = bs.picker && bs.picker.mons[bs.picker.i];
  for (let slot = 0; slot < P.bench.length; slot++) {
    const r = monRect(side, slot);
    if (P.bench[slot]) drawMon(P.bench[slot], r, P.bench[slot] === picked);
    else { roundRect(r.x, r.y, r.w, r.h, 6); ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); }
  }
  if (P.active) drawMon(P.active, monRect(side, -1), P.active === picked);
}

function rectOfUid(uid) {
  for (const P of bs.G.players) { const side = P.isHuman ? 0 : 1;
    if (P.active && P.active.uid === uid) return monRect(side, -1);
    const slot = P.bench.findIndex(m => m && m.uid === uid); if (slot >= 0) return monRect(side, slot); }
  return null;
}

function drawBattle() {
  const G = bs.G;
  ctx.fillStyle = '#12303a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#173a45'; ctx.fillRect(0, 340, 650, 2);                       // the line down the middle of the table
  const you = G.players.find(P => P.isHuman), them = other(G, you);
  drawSide(them, 1); drawSide(you, 0);

  for (const f of bs.fx) { const r = rectOfUid(f.uid); if (!r) continue;
    ctx.globalAlpha = Math.max(0, 1 - f.t / 1.1); setFont(34); ctx.textAlign = 'center';
    ctx.fillStyle = COLOR.ink; ctx.fillText(f.text, r.x + r.w / 2 + 2, r.y + r.h / 2 - f.t * 40 + 2);
    ctx.fillStyle = f.color;   ctx.fillText(f.text, r.x + r.w / 2, r.y + r.h / 2 - f.t * 40);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1; }

  // commentary: the latest line bright, the one before it dim
  panel(16, 648, 626, 50);
  setFont(16); ctx.fillStyle = COLOR.dim;  ctx.fillText(bs.lines[bs.lines.length - 2] || '', 30, 667);
  setFont(20); ctx.fillStyle = COLOR.text; ctx.fillText(bs.lines[bs.lines.length - 1] || '', 30, 689);

  // right-hand column: the card you're looking at, what its move does, then the menu
  const px = 662, pw = 282;
  if (bs.preview) drawCard(bs.preview, px + 31, 10, 220, 308, true);
  let ty = 340;
  if (bs.previewMove) {
    const m = bs.previewMove;
    drawEnergyPips(Object.entries(m.cost.types).flatMap(([t, n]) => new Array(n).fill(t)), px, ty - 12, 13);
    setFont(18); ctx.fillStyle = COLOR.sand;
    ctx.fillText((m.cost.any ? '+' + m.cost.any + ' any    ' : '') + (m.damage ? m.damage + ' damage' : ''), px + (m.cost.total - m.cost.any) * 16 + 6, ty);
    ty += 22; setFont(16); ctx.fillStyle = COLOR.text;
    for (const line of wrapText(m.text, pw).slice(0, 4)) { ctx.fillText(line, px, ty); ty += 19; }
    if (m.fx.todo || (m.text && !m.ops.length && !m.fx.tag)) { ctx.fillStyle = COLOR.coral; ctx.fillText('Effect not wired yet: damage only.', px, ty); }
    else if (m.fx.approx) { ctx.fillStyle = COLOR.dim; for (const line of wrapText('Simplified: ' + m.fx.approx, pw)) { ctx.fillText(line, px, ty); ty += 19; } }
  }

  if (bs.result) {
    const words = { win: 'You win!', loss: 'You lose.', draw: 'A draw.', broken: 'The match fell apart.' }[bs.result];
    panel(px, 470, pw, 120); setFont(36); ctx.fillStyle = COLOR.sand; ctx.fillText(words, px + 24, 525);
    setFont(18); ctx.fillStyle = COLOR.dim; ctx.fillText(bs.result === 'broken' ? 'A card effect hit a bug. See the console (F12).' : 'E to leave the table', px + 24, 562);
  } else if (bs.picker) {
    panel(px, 470, pw, 90); setFont(20); ctx.fillStyle = COLOR.text;
    wrapText(bs.picker.prompt, pw - 40).forEach((line, i) => ctx.fillText(line, px + 20, 504 + i * 24));
  } else if (bs.menu) {
    const m = bs.menu, rowH = 27, visible = 7, first = Math.max(0, Math.min(m.i - 3, m.items.length - visible));
    const titleLines = wrapText(m.title, pw - 36);
    const top = 696 - (visible * rowH + titleLines.length * 22 + 26);
    panel(px, top, pw, 696 - top);
    setFont(18); ctx.fillStyle = COLOR.sand; titleLines.forEach((line, i) => ctx.fillText(line, px + 18, top + 26 + i * 22));
    let y = top + 26 + titleLines.length * 22 + 8; setFont(20);
    m.items.slice(first, first + visible).forEach((item, k) => {
      const i = first + k;
      if (i === m.i) { roundRect(px + 8, y - 20, pw - 16, rowH - 2, 5); ctx.fillStyle = 'rgba(143,211,193,0.16)'; ctx.fill(); }
      let tx = px + 18;
      if (item.energy) { drawEnergyPips([item.energy], tx, y - 14, 14); tx += 22; }
      ctx.fillStyle = item.dim ? '#6f8f8f' : (i === m.i ? COLOR.glass : COLOR.text);
      let label = item.label; while (ctx.measureText(label).width > pw - 40 - (tx - px - 18) && label.length > 4) label = label.slice(0, -2);
      ctx.fillText(label === item.label ? label : label + '…', tx, y);
      y += rowH;
    });
    const note = m.items[m.i].note;
    if (note) { setFont(15); ctx.fillStyle = COLOR.coral; ctx.fillText(note, px + 18, 690); }
    else if (m.items.length > visible) { setFont(15); ctx.fillStyle = COLOR.dim; ctx.fillText((m.i + 1) + ' of ' + m.items.length, px + pw - 70, 690); }
  } else {
    setFont(18); ctx.fillStyle = COLOR.dim; ctx.fillText('E to hurry the commentary along', px, 680);
  }
}
