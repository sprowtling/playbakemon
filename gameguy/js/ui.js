/* ============================================================
   UI — everything drawn on top of the world, in SCREEN pixels.
   ============================================================
   There are only four kinds of thing on screen besides the world:

     dialogue   a box of text you press E through      → say()
     menu       a short list to pick from              → choose()
     screen     something that takes over the whole view
                (collection, pack opening, title)
     fade       a dip to black, optionally with words  → fadeThrough()

   Each is a plain object sitting in `ui`, or null when not in use.
   main.js looks at which ones exist to decide who gets the keys.

   say() and choose() take a function to run AFTERWARDS. Chaining
   those is how every conversation in the game is built:
       say('Oyo', 'Want work?', () => choose('', [...]))
   ============================================================ */

const COLOR = {
  ink:   '#0f2227',
  panel: 'rgba(19, 46, 53, 0.96)',
  edge:  '#3b6b74',
  sand:  '#e8d5a3',
  text:  '#f2ead3',
  dim:   '#9db8b5',
  glass: '#8fd3c1',
  coral: '#ef8354',
};

const ui = { dialogue: null, menu: null, screen: null, fade: null, toast: null, banner: null };

const setFont = size => { ctx.font = size + 'px ' + UI_FONT; };

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(x, y, w, h) {
  roundRect(x, y, w, h, 10);
  ctx.fillStyle = COLOR.panel; ctx.fill();
  ctx.strokeStyle = COLOR.edge; ctx.lineWidth = 2; ctx.stroke();
}

// Breaks text into lines no wider than maxW, using whatever font is set.
function wrapText(text, maxW) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(' ')) {
    const test = line ? line + ' ' + word : word;
    if (line && ctx.measureText(test).width > maxW) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/* ---------------- dialogue ---------------- */

function say(name, lines, then) {
  ui.dialogue = { name: name || '', pages: [].concat(lines).map(l => fmt(l)), i: 0, shown: 0, then };
}

function updateDialogue(dt) {
  const d = ui.dialogue, page = d.pages[d.i];
  d.shown += dt * 75;                                   // letters per second. Try 30.
  if (!pressed('action')) return;
  if (d.shown < page.length) { d.shown = page.length; return; }   // first press: finish the line
  d.i += 1; d.shown = 0;
  if (d.i >= d.pages.length) { ui.dialogue = null; if (d.then) d.then(); }
}

function drawDialogue() {
  const d = ui.dialogue;
  const w = canvas.width - 64, h = 150, x = 32, y = canvas.height - h - 28;
  panel(x, y, w, h);
  let ty = y + 44;
  if (d.name) { setFont(24); ctx.fillStyle = COLOR.sand; ctx.fillText(d.name, x + 26, y + 38); ty = y + 74; }
  setFont(26); ctx.fillStyle = COLOR.text;
  // Wrap the FULL line so words don't jump around as letters appear, then
  // print only as many letters as have been "typed" so far.
  let lettersLeft = Math.floor(d.shown);
  for (const line of wrapText(d.pages[d.i], w - 52)) {
    ctx.fillText(line.slice(0, Math.max(0, lettersLeft)), x + 26, ty);
    lettersLeft -= line.length + 1;
    ty += 32;
  }
  if (d.shown >= d.pages[d.i].length) { setFont(18); ctx.fillStyle = COLOR.dim; ctx.fillText('E', x + w - 34, y + h - 16); }
}

/* ---------------- menus ---------------- */
// options: [{ label, hint, disabled, run }]
//   hint      shown underneath while that option is highlighted
//   dim       greyed out, but can still be picked (to hear WHY it's unavailable)
//   disabled  greyed out and can't be picked at all
//   run       what happens when it's picked. Leave out for "just close the menu".

function choose(title, options, onCancel) {
  const firstOk = options.findIndex(o => !o.disabled);
  ui.menu = { title: title ? fmt(title) : '', options, i: Math.max(0, firstOk), onCancel };
}

function updateMenu() {
  const m = ui.menu;
  if (pressed('up'))   m.i = (m.i + m.options.length - 1) % m.options.length;
  if (pressed('down')) m.i = (m.i + 1) % m.options.length;
  if (pressed('cancel')) { ui.menu = null; if (m.onCancel) m.onCancel(); return; }
  if (pressed('action')) {
    const opt = m.options[m.i];
    if (opt.disabled) return;
    ui.menu = null;
    if (opt.run) opt.run();
  }
}

function drawMenu() {
  const m = ui.menu;
  const rowH = 36, w = 560;
  const hint = m.options[m.i].hint;
  const h = 28 + (m.title ? 40 : 0) + m.options.length * rowH + (hint ? 44 : 8);
  const x = (canvas.width - w) / 2, y = canvas.height - h - 28;
  panel(x, y, w, h);
  let ty = y + 40;
  if (m.title) { setFont(24); ctx.fillStyle = COLOR.sand; ctx.fillText(m.title, x + 26, ty); ty += 40; }
  setFont(24);
  m.options.forEach((opt, i) => {
    if (i === m.i) { roundRect(x + 14, ty - 26, w - 28, rowH - 2, 6); ctx.fillStyle = 'rgba(143,211,193,0.16)'; ctx.fill(); }
    ctx.fillStyle = (opt.disabled || opt.dim) ? (i === m.i ? '#8aa7a7' : '#5f7f7f') : (i === m.i ? COLOR.glass : COLOR.text);
    ctx.fillText((i === m.i ? '›  ' : '    ') + fmt(opt.label), x + 26, ty);
    ty += rowH;
  });
  if (hint) { setFont(20); ctx.fillStyle = COLOR.dim; ctx.fillText(fmt(hint), x + 26, ty + 8); }
}

/* ---------------- fade ---------------- */
// Dips to black, runs `mid` while nothing can be seen, comes back.
// With `text`, it lingers on black to show it (a day title, a work montage).

function fadeThrough(mid, opts) {
  opts = opts || {};
  ui.fade = { phase: 'out', t: 0, dur: opts.dur || 0.2, mid, then: opts.then,
              text: opts.text ? fmt(opts.text) : '', sub: opts.sub ? fmt(opts.sub) : '', hold: opts.text ? 2.2 : 0 };
}

function updateFade(dt) {
  const f = ui.fade;
  f.t += dt;
  if (f.phase === 'out' && f.t >= f.dur) { if (f.mid) f.mid(); f.phase = f.hold ? 'hold' : 'in'; f.t = 0; }
  else if (f.phase === 'hold' && (f.t >= f.hold || (f.t > 0.4 && pressed('action')))) { f.phase = 'in'; f.t = 0; }
  else if (f.phase === 'in' && f.t >= f.dur) { ui.fade = null; if (f.then) f.then(); }
}

function drawFade() {
  const f = ui.fade;
  const a = f.phase === 'out' ? f.t / f.dur : f.phase === 'in' ? 1 - f.t / f.dur : 1;
  ctx.fillStyle = 'rgba(8,16,20,' + Math.max(0, Math.min(1, a)) + ')';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (f.phase !== 'hold' || !f.text) return;
  const textA = Math.min(1, f.t / 0.4);
  ctx.textAlign = 'center';
  setFont(44); ctx.fillStyle = 'rgba(232,213,163,' + textA + ')';
  const lines = wrapText(f.text, canvas.width - 240);
  lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, canvas.height / 2 - (lines.length - 1) * 26 + i * 52));
  if (f.sub) { setFont(24); ctx.fillStyle = 'rgba(157,184,181,' + textA + ')'; ctx.fillText(f.sub, canvas.width / 2, canvas.height / 2 + lines.length * 30 + 20); }
  ctx.textAlign = 'left';
}

/* ---------------- HUD, toast, banner ---------------- */

function toast(text)  { ui.toast  = { text: fmt(text), t: 0 }; }
function banner(text) { ui.banner = { text, t: 0 }; }

function drawHud(dt) {
  // Day and clock, top left.
  setFont(24);
  const dayLine = dayName() + ', day ' + state.day;
  const w = Math.max(ctx.measureText(dayLine).width, 120) + 40;
  panel(20, 20, w, 78);
  ctx.fillStyle = COLOR.sand; ctx.fillText(dayLine, 40, 52);
  setFont(22); ctx.fillStyle = hourNow() >= SLEEPY_HOUR ? COLOR.coral : COLOR.text;
  ctx.fillText(clockText() + (hourNow() >= SLEEPY_HOUR ? '   getting late' : ''), 40, 82);

  // Money, top right.
  setFont(24);
  const money = moneyText(state.money);
  const mw = ctx.measureText(money).width + 40;
  panel(canvas.width - mw - 20, 20, mw, 46);
  ctx.fillStyle = COLOR.sand; ctx.fillText(money, canvas.width - mw, 52);

  // What you're carrying, if anything.
  const carrying = Object.values(JOBS).filter(j => j.item && state.items[j.item]).map(j => j.itemName);
  if (carrying.length) {
    setFont(20);
    const text = 'Carrying ' + carrying.join(', ');
    const cw = ctx.measureText(text).width + 36;
    panel(20, 106, cw, 38);
    ctx.fillStyle = COLOR.text; ctx.fillText(text, 38, 132);
  }

  if (ui.banner) {
    const b = ui.banner; b.t += dt;
    const a = Math.min(1, b.t / 0.3, (2.4 - b.t) / 0.5);
    if (b.t >= 2.4) ui.banner = null;
    else {
      ctx.textAlign = 'center'; setFont(40);
      ctx.fillStyle = 'rgba(8,16,20,' + 0.55 * a + ')'; ctx.fillText(b.text, canvas.width / 2 + 2, 152);
      ctx.fillStyle = 'rgba(242,234,211,' + a + ')';    ctx.fillText(b.text, canvas.width / 2, 150);
      ctx.textAlign = 'left';
    }
  }

  if (ui.toast) {
    const t = ui.toast; t.t += dt;
    if (t.t >= 2.6) ui.toast = null;
    else {
      setFont(22);
      const tw = ctx.measureText(t.text).width + 40;
      const slide = Math.min(1, t.t / 0.2) * Math.min(1, (2.6 - t.t) / 0.3);
      ctx.globalAlpha = slide;
      panel((canvas.width - tw) / 2, 64 + slide * 12, tw, 42);
      ctx.fillStyle = COLOR.glass; ctx.fillText(t.text, (canvas.width - tw) / 2 + 20, 92 + slide * 12);
      ctx.globalAlpha = 1;
    }
  }

  if (DEBUG) { setFont(16); ctx.fillStyle = 'rgba(242,234,211,0.5)'; ctx.fillText('debug   1 +hour   2 +money   3 free pack   4 tomorrow   0 boxes', 22, canvas.height - 10); }
}

/* ---------------- drawing a card ---------------- */
// Real card images are big, so they're fetched one at a time, only when a
// card is shown LARGE. Until one arrives (or if you're offline) a stand-in
// is drawn from the card's data. The small grid always uses stand-ins.
// SHORTCUT: if you ever make small thumbnail images, load them in the grid.

const cardImages = {};
function cardImage(card) {
  if (!card.image) return null;
  let entry = cardImages[card.id];
  if (!entry) {
    entry = cardImages[card.id] = { img: new Image(), ok: false };
    entry.img.onload = () => { entry.ok = true; };
    entry.img.src = CARD_IMAGE_BASE + card.image;
  }
  return entry.ok ? entry.img : null;
}

function cardColors(card) {
  const types = card.kind === 'item' ? ['item'] : (card.types && card.types.length ? card.types : ['normal']);
  return types.map(t => TYPE_COLORS[t] || TYPE_COLORS.normal);
}

function drawCard(card, x, y, w, h, large) {
  const r = w * 0.06;
  const img = large ? cardImage(card) : null;
  ctx.save();
  roundRect(x, y, w, h, r); ctx.clip();
  if (img) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, x, y, w, h);
  } else {
    const cols = cardColors(card);
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, cols[0]); g.addColorStop(1, cols[cols.length - 1]);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    // art window
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x + w * 0.08, y + h * 0.17, w * 0.84, h * 0.4);
    ctx.fillStyle = 'rgba(15,34,39,0.22)'; ctx.textAlign = 'center';
    setFont(h * 0.26); ctx.fillText(card.id, x + w / 2, y + h * 0.47);
    // name, fitted to the width
    let size = h * 0.105; setFont(size);
    while (ctx.measureText(card.name).width > w * 0.86 && size > 8) { size -= 1; setFont(size); }
    ctx.fillStyle = COLOR.ink; ctx.fillText(card.name, x + w / 2, y + h * 0.125);
    if (large) {
      setFont(h * 0.05);
      const sub = card.kind === 'item' ? 'item, ' + card.itemKind : card.stage + '   HP ' + card.hp + '   ' + card.types.join(' / ');
      ctx.fillText(sub, x + w / 2, y + h * 0.64);
      ctx.textAlign = 'left'; setFont(h * 0.043);
      wrapText(card.flavor || card.effect || '', w * 0.84).slice(0, 5).forEach((line, i) => ctx.fillText(line, x + w * 0.08, y + h * 0.73 + i * h * 0.052));
    }
    ctx.textAlign = 'left';
  }
  ctx.restore();
  roundRect(x, y, w, h, r); ctx.strokeStyle = 'rgba(15,34,39,0.6)'; ctx.lineWidth = 2; ctx.stroke();
}

// A card you don't own. If you've SEEN it somewhere you at least know its name.
function drawCardMissing(card, x, y, w, h) {
  roundRect(x, y, w, h, w * 0.06);
  ctx.fillStyle = 'rgba(15,34,39,0.55)'; ctx.fill();
  ctx.setLineDash([5, 5]); ctx.strokeStyle = COLOR.edge; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
  ctx.textAlign = 'center'; ctx.fillStyle = '#5f8f92';
  setFont(h * 0.2); ctx.fillText(card.id, x + w / 2, y + h * 0.5);
  if (state.seen[card.id]) { let s = h * 0.1; setFont(s); while (ctx.measureText(card.name).width > w * 0.9 && s > 8) { s -= 1; setFont(s); } ctx.fillText(card.name, x + w / 2, y + h * 0.7); }
  ctx.textAlign = 'left';
}

/* ---------------- the collection ---------------- */
// The emotional payoff surface. Deserves more love than it has.

function openCollection(onClose) {
  ui.screen = { kind: 'collection', sel: 0, topRow: 0, onClose };
}

const GRID = { cols: 7, rows: 5, cw: 76, ch: 106, gap: 10, x: 28, y: 84 };

function updateCollection() {
  const s = ui.screen, n = CARDS.length;
  if (pressed('left'))  s.sel = Math.max(0, s.sel - 1);
  if (pressed('right')) s.sel = Math.min(n - 1, s.sel + 1);
  if (pressed('up')   && s.sel - GRID.cols >= 0) s.sel -= GRID.cols;
  if (pressed('down'))  s.sel = Math.min(n - 1, s.sel + GRID.cols);
  const row = Math.floor(s.sel / GRID.cols);
  if (row < s.topRow) s.topRow = row;
  if (row >= s.topRow + GRID.rows) s.topRow = row - GRID.rows + 1;
  if (pressed('cancel') || pressed('collection')) { ui.screen = null; if (s.onClose) s.onClose(); }
}

function drawCollection() {
  const s = ui.screen;
  ctx.fillStyle = '#12303a'; ctx.fillRect(0, 0, canvas.width, canvas.height);

  setFont(38); ctx.fillStyle = COLOR.sand; ctx.fillText('Collection', 28, 54);
  setFont(24); ctx.fillStyle = COLOR.dim;
  ctx.fillText(uniqueOwned() + ' of ' + CARDS.length + ' found      ' + totalOwned() + ' cards in the shoebox', 210, 52);

  for (let i = s.topRow * GRID.cols; i < Math.min(CARDS.length, (s.topRow + GRID.rows) * GRID.cols); i++) {
    const card = CARDS[i];
    const x = GRID.x + (i % GRID.cols) * (GRID.cw + GRID.gap);
    const y = GRID.y + (Math.floor(i / GRID.cols) - s.topRow) * (GRID.ch + GRID.gap);
    if (owned(card.id)) {
      drawCard(card, x, y, GRID.cw, GRID.ch, false);
      if (owned(card.id) > 1) {
        ctx.beginPath(); ctx.arc(x + GRID.cw - 8, y + GRID.ch - 8, 13, 0, Math.PI * 2); ctx.fillStyle = COLOR.ink; ctx.fill();
        setFont(17); ctx.fillStyle = COLOR.sand; ctx.textAlign = 'center'; ctx.fillText('×' + owned(card.id), x + GRID.cw - 8, y + GRID.ch - 2); ctx.textAlign = 'left';
      }
    } else drawCardMissing(card, x, y, GRID.cw, GRID.ch);
    if (i === s.sel) { roundRect(x - 4, y - 4, GRID.cw + 8, GRID.ch + 8, 8); ctx.strokeStyle = COLOR.glass; ctx.lineWidth = 3; ctx.stroke(); }
  }
  // a simple scroll marker
  const totalRows = Math.ceil(CARDS.length / GRID.cols), trackH = GRID.rows * (GRID.ch + GRID.gap) - GRID.gap;
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(628, GRID.y, 4, trackH);
  ctx.fillStyle = COLOR.edge; ctx.fillRect(628, GRID.y + trackH * s.topRow / totalRows, 4, trackH * GRID.rows / totalRows);

  // detail, right-hand side
  const card = CARDS[s.sel], dx = 650, dw = 282, dh = Math.round(dw * 1.4);
  if (owned(card.id)) {
    drawCard(card, dx, GRID.y, dw, dh, true);
    let ty = GRID.y + dh + 40;
    setFont(28); ctx.fillStyle = COLOR.text; ctx.fillText(card.name, dx, ty);
    setFont(20); ctx.fillStyle = COLOR.dim;  ctx.fillText('No. ' + card.id + '     ' + rarityOf(card) + '     you have ' + owned(card.id), dx, ty + 30);
    setFont(20); ctx.fillStyle = COLOR.text;
    wrapText(card.flavor || card.effect || '', dw).slice(0, 4).forEach((line, i) => ctx.fillText(line, dx, ty + 64 + i * 25));
  } else {
    drawCardMissing(card, dx, GRID.y, dw, dh);
    setFont(24); ctx.fillStyle = COLOR.dim;
    ctx.fillText(state.seen[card.id] ? "You've seen this one. Not yours yet." : "Never seen it. Not even once.", dx, GRID.y + dh + 40);
  }
  setFont(18); ctx.fillStyle = COLOR.dim; ctx.fillText('arrows to look around      Esc to close', 28, canvas.height - 16);
}

/* ---------------- opening a pack ---------------- */

function openPackScreen(packId, cardIds, wasNew, onClose) {
  for (const id of cardIds) cardImage(CARD_BY_ID[id]);       // start fetching the pictures now
  ui.screen = { kind: 'pack', pack: PACKS[packId], cards: cardIds.map(id => CARD_BY_ID[id]), wasNew, i: -1, t: 0, onClose };
}

function updatePack(dt) {
  const s = ui.screen;
  s.t += dt;
  if (!pressed('action') || s.t < 0.25) return;      // a beat between cards, so mashing E doesn't skip them all
  s.i += 1; s.t = 0;
  if (s.i > s.cards.length) { ui.screen = null; if (s.onClose) s.onClose(); }
}

function drawPack(time) {
  const s = ui.screen, cx = canvas.width / 2;
  ctx.fillStyle = '#0e2830'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';

  if (s.i < 0) {                                       // the sealed pack
    const w = 250, h = 350, wob = Math.sin(time * 3) * 0.025;
    ctx.save(); ctx.translate(cx, canvas.height / 2 - 20); ctx.rotate(wob);
    roundRect(-w / 2, -h / 2, w, h, 12); ctx.fillStyle = s.pack.color || COLOR.glass; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-w / 2, -h / 2 + 26, w, 8); ctx.fillRect(-w / 2, h / 2 - 34, w, 8);
    ctx.fillStyle = COLOR.text; setFont(34);
    wrapText(s.pack.name, w - 40).forEach((line, i) => ctx.fillText(line, 0, -10 + i * 38));
    ctx.restore();
    setFont(24); ctx.fillStyle = COLOR.dim; ctx.fillText('E to tear it open', cx, canvas.height - 60);

  } else if (s.i < s.cards.length) {                   // one card at a time
    const card = s.cards[s.i];
    const grow = 1 - Math.pow(1 - Math.min(1, s.t / 0.28), 3);        // ease out
    const w = 320 * (0.7 + 0.3 * grow), h = w * 1.4;
    ctx.globalAlpha = grow;
    drawCard(card, cx - w / 2, 300 - h / 2, w, h, true);
    ctx.globalAlpha = 1; ctx.textAlign = 'center';
    setFont(32); ctx.fillStyle = COLOR.text; ctx.fillText(card.name, cx, 580);
    setFont(22);
    if (s.wasNew[s.i]) { ctx.fillStyle = COLOR.coral; ctx.fillText('NEW!   ' + rarityOf(card), cx, 614); }
    else { ctx.fillStyle = COLOR.dim; ctx.fillText(rarityOf(card) + '     you have ' + owned(card.id) + ' now', cx, 614); }
    s.cards.forEach((c, i) => { ctx.beginPath(); ctx.arc(cx + (i - (s.cards.length - 1) / 2) * 22, 660, 5, 0, Math.PI * 2); ctx.fillStyle = i <= s.i ? COLOR.sand : COLOR.edge; ctx.fill(); });

  } else {                                             // all of them together
    const perRow = Math.min(5, s.cards.length), w = 150, h = 210, gap = 16;
    const rows = Math.ceil(s.cards.length / perRow);
    const y0 = canvas.height / 2 - (rows * (h + 40)) / 2;
    s.cards.forEach((card, i) => {
      const inRow = Math.min(perRow, s.cards.length - Math.floor(i / perRow) * perRow);
      const x = cx - (inRow * w + (inRow - 1) * gap) / 2 + (i % perRow) * (w + gap);
      const y = y0 + Math.floor(i / perRow) * (h + 40);
      drawCard(card, x, y, w, h, true);
      if (s.wasNew[i]) { ctx.textAlign = 'center'; setFont(20); ctx.fillStyle = COLOR.coral; ctx.fillText('NEW!', x + w / 2, y + h + 24); }
    });
    ctx.textAlign = 'center'; setFont(24); ctx.fillStyle = COLOR.dim; ctx.fillText('E to put them in the shoebox', cx, canvas.height - 40);
  }
  ctx.textAlign = 'left';
}

/* ---------------- title ---------------- */

function drawTitle(time) {
  ctx.fillStyle = '#12303a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  // slow bands of lighter water
  for (let i = 0; i < 9; i++) {
    const y = 90 + i * 70 + Math.sin(time * 0.6 + i) * 8;
    ctx.fillStyle = 'rgba(143,211,193,' + (0.03 + 0.02 * Math.sin(time * 0.4 + i * 2)) + ')';
    ctx.fillRect(0, y, canvas.width, 14);
  }
  ctx.textAlign = 'center';
  setFont(84); ctx.fillStyle = COLOR.sand; ctx.fillText('Bakemon Island', canvas.width / 2, 250);
  ctx.textAlign = 'left';
}
