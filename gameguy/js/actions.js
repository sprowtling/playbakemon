/* ============================================================
   ACTIONS — what happens when you press E on something.
   ============================================================
   Places (data/maps.js) and NPCs (data/npcs.js) are described with
   the same vocabulary: talk, to, job, shop, trade, action. This file
   is the one place that reads that vocabulary and makes it happen.

   The order of business for any E-press is in interact(), below.
   If you invent a new thing a place or person can do, this is where
   it gets wired in. Add it to the validator in js/world.js too.
   ============================================================ */

function interact(target) {
  const def = target.def;
  const who = target.npc ? target.npc.id : null;

  // Turn to face whoever's talking to you (unless there's a counter in the way).
  if (target.npc && !target.acrossCounter) {
    target.npc.facing = { up: 'down', down: 'up', left: 'right', right: 'left' }[player.facing];
  }

  // 1. Are you carrying something for this person?
  if (who) for (const [jobId, job] of Object.entries(JOBS)) {
    if (job.type === 'delivery' && job.deliverTo === who && state.items[job.item]) return finishDelivery(jobId, def.name);
  }

  // 2. Is it a door?
  if (def.to) {
    if (!check(def.openIf)) return say(def.name, def.closedLine || "It's locked.");
    return goThrough(def.to);
  }

  // 3. They say their piece, then offer whatever they offer.
  const talk = pickTalk(def, who);
  if (talk) say(def.name, talk.lines, () => { finishTalk(talk); offerOptions(target); });
  else offerOptions(target);
}

/* ---------------- talk ---------------- */

function pickTalk(def, who) {
  if (def.talk) {
    const owner = who || (currentName + '/' + def.name);
    for (let i = 0; i < def.talk.length; i++) {
      const entry = def.talk[i], key = 'talk:' + owner + ':' + i;
      if (entry.once && state.done[key]) continue;
      if (check(entry.if)) return Object.assign({ key }, entry);
    }
    return null;
  }
  if (def.lines || def.line) return { lines: def.lines || def.line };
  return null;
}

function finishTalk(entry) {
  if (entry.once && entry.key) state.done[entry.key] = true;
  for (const f of entry.set || []) setFlag(f);
  receive(entry.give);
}

function receive(gift) {
  if (!gift) return;
  if (gift.money) { state.money += gift.money; toast('+' + moneyText(gift.money)); }
  if (gift.card && CARD_BY_ID[gift.card]) { addCard(gift.card); toast('You got ' + CARD_BY_ID[gift.card].name + '!'); }
  if (gift.item && GOODS[gift.item]) { addGood(gift.item); toast('You got: ' + GOODS[gift.item].name); }
}

/* ---------------- the options menu ---------------- */

function offerOptions(target) {
  const def = target.def;
  const again = () => offerOptions(target);
  const options = [];

  for (const jobId of [].concat(def.job || [])) options.push(jobOption(jobId, def.name, again));
  if (def.shop)  options.push({ label: 'Buy cards', run: () => openShop(def.shop, def.name) });
  if (def.trade) options.push({ label: 'Trade', run: () => openTrade(target) });
  if (def.battle) options.push(battleOption(def, again));

  if (!options.length) { if (def.action) runAction(def.action, def); return; }
  options.push({ label: 'Never mind' });
  choose('', options);
}

/* ---------------- jobs ---------------- */

function jobOption(jobId, giver, again) {
  const job = JOBS[jobId];
  if (job.type === 'delivery' && state.items[job.item])
    return { label: job.name, dim: true, hint: 'You have it. Go!', run: again };
  if ((state.jobsToday[jobId] || 0) >= (job.perDay || 1))
    return { label: job.name, dim: true, hint: 'Done for today.', run: () => say(giver, "\"That's all for today.\"", again) };
  if (!check(job.availableIf))
    return { label: job.name, dim: true, hint: 'Not right now.', run: () => say(giver, job.unavailable || "\"Not right now.\"", again) };

  const length = job.minutes ? (job.minutes >= 60 ? (job.minutes / 60) + (job.minutes === 60 ? ' hour' : ' hours') : job.minutes + ' minutes') + ',  ' : '';
  return { label: job.name, hint: length + moneyText(job.pay), run: () => startJob(jobId, giver) };
}

function startJob(jobId, giver) {
  const job = JOBS[jobId];
  say(giver, job.offer, () => choose('', [
    { label: "I'll do it", run: () => {
        if (job.type === 'delivery') {
          state.items[job.item] = true;
          say(giver, job.done);
        } else {
          // 'shift', and 'minigame' until minigames exist: time passes on a dark screen.
          let tooLate = false;
          fadeThrough(() => { tooLate = advanceMinutes(job.minutes); payFor(jobId); refreshPeople(); },
            { text: job.workText, sub: clockText() + '  →  ' + clockAfter(job.minutes),
              then: () => say(giver, job.done, () => { toast('+' + moneyText(job.pay)); fireEvent('job_done', () => { if (tooLate) collapse(); }); }) });
        }
      } },
    { label: 'Not now' },
  ]));
}

function clockAfter(minutes) { const keep = state.minutes; state.minutes += minutes; const t = clockText(); state.minutes = keep; return t; }

function payFor(jobId) {
  state.money += JOBS[jobId].pay;
  state.jobsToday[jobId] = (state.jobsToday[jobId] || 0) + 1;
  saveGame();
}

function finishDelivery(jobId, receiver) {
  const job = JOBS[jobId];
  delete state.items[job.item];
  payFor(jobId);
  say(receiver, job.received, () => { toast('+' + moneyText(job.pay)); fireEvent('job_done'); });
}

/* ---------------- card matches ---------------- */

function battleOption(def, again) {
  const id = def.battle, opp = OPPONENTS[id];
  if (!check(opp.playIf))
    return { label: 'Play cards', dim: true, hint: "They don't want to play you. Yet.", run: () => say(opp.name, opp.notYetLine || '"Come back when you\'ve got a real deck."', again) };
  const problem = deckProblem(deckList());
  if (problem)
    return { label: 'Play cards', dim: true, hint: 'Your deck isn\'t ready.', run: () => say('', [def.notReadyLine || "You don't have a deck you could play with.", problem + ' (You build your deck at the desk in your room, or from the Esc menu.)']) };
  return { label: 'Play cards', hint: 'First to ' + (opp.points || BATTLE_RULES.pointsToWin) + ' knock-outs.  Takes about ' + (opp.minutes || 30) + ' minutes.',
           run: () => say(opp.name, opp.intro || '"Let\'s play."', () => fadeThrough(() => startBattle(id, afterBattle), { dur: 0.3 })) };
}

function afterBattle(result, opp, id) {
  if (!state.battles) state.battles = {};                    // (older saves don't have this yet)
  const record = state.battles[id] || (state.battles[id] = { wins: 0, losses: 0 });
  const tooLate = advanceMinutes(opp.minutes || 30);
  refreshPeople();
  if (result === 'broken') { saveGame(); return toast('The match was abandoned.'); }
  if (result === 'win') {
    record.wins += 1; setFlag('beat_' + id);
    if (!state.done['reward:' + id]) { state.done['reward:' + id] = true; receive(opp.reward); }
  } else if (result === 'loss') record.losses += 1;
  saveGame();
  const line = result === 'win' ? opp.ifYouWin : result === 'loss' ? opp.ifYouLose : 'Nobody wins. You both stare at the table for a while.';
  say(result === 'draw' ? '' : opp.name, line || '"Good game."', () =>
    fireEvent(result === 'win' ? 'battle_won' : 'battle_lost', () => { if (tooLate) collapse(); }));
}

/* ---------------- shop ---------------- */

function openShop(shopId, keeper) {
  const shop = SHOPS[shopId];
  const shelf = state.shops[shopId] || (state.shops[shopId] = {});
  const again = () => openShop(shopId, keeper);

  const options = shop.products.map(p => {
    const key = productKey(p), good = p.item && GOODS[p.item];
    const name = p.pack ? PACKS[p.pack].name : good.name;
    const label = name + '     ' + moneyText(p.price);
    const limited = p.startStock !== undefined;                 // no startStock = never runs out
    if (limited && shelf[key] === undefined) shelf[key] = p.startStock;
    const left = limited ? shelf[key] + ' left.  ' : '';

    if (good && good.tool && have(p.item))
      return { label, dim: true, hint: 'You already have one.', run: again };
    if (limited && shelf[key] <= 0)
      return { label, dim: true, hint: 'Sold out.', run: () => say(keeper, shop.soldOutLine || '"Sold out."', again) };
    if (state.money < p.price)
      return { label, dim: true, hint: left + 'You have ' + state.money + '.',
               run: () => say('', "You count it again. Still " + (p.price - state.money) + " short.", again) };
    return { label, hint: left + (good ? good.desc : ''), run: () => {
      state.money -= p.price;
      if (limited) shelf[key] -= 1;
      if (p.pack) return buyPack(p.pack);
      addGood(p.item); saveGame(); toast('Bought: ' + good.name); again();
    } };
  });
  if (shop.buys) options.push({ label: 'Sell things', run: () => openSelling(shopId, keeper) });
  options.push({ label: 'Just looking' });
  choose(shop.name, options);
}

function openSelling(shopId, keeper) {
  const again = () => openSelling(shopId, keeper);
  const sellable = Object.keys(state.inventory || {}).filter(id => GOODS[id] && GOODS[id].sell > 0 && have(id));
  if (!sellable.length) return say(keeper, '"Nothing I can use in there. Come back with your pockets full."', () => openShop(shopId, keeper));
  const options = sellable.map(id => ({
    label: GOODS[id].name + '  x' + have(id) + '     ' + moneyText(GOODS[id].sell) + ' each',
    hint: 'Sells one.',
    run: () => { removeGood(id); state.money += GOODS[id].sell; saveGame(); toast('+' + moneyText(GOODS[id].sell)); again(); },
  }));
  const total = sellable.reduce((n, id) => n + have(id) * GOODS[id].sell, 0);
  options.push({ label: 'Sell all of it     ' + moneyText(total), run: () => {
    for (const id of sellable) removeGood(id, have(id));
    state.money += total; saveGame(); toast('+' + moneyText(total)); openShop(shopId, keeper);
  } });
  options.push({ label: 'Back', run: () => openShop(shopId, keeper) });
  choose('Sell what?', options, () => openShop(shopId, keeper));
}

function buyPack(packId) {
  const ids = rollPack(packId);
  // The cards go into the collection NOW, before the reveal. If the page is
  // refreshed mid-opening, nothing is lost. The reveal is only a show.
  const wasNew = ids.map(id => { const isNew = owned(id) === 0; addCard(id); return isNew; });
  saveGame();
  openPackScreen(packId, ids, wasNew, () => fireEvent('pack_opened'));
}

/* ---------------- trading ---------------- */
// SHORTCUT: for "any water type" style wants, the game picks which of your
// cards to hand over (the one you have most copies of). You don't get to
// choose. Fine while collections are small; it'll want a picker later.

// Which offers is this person making TODAY? Their fixed `offers`, plus `show`
// of their rotating `pool`. Each comes with a `key` used to remember it's been done.
function currentOffers(id, trade) {
  const out = (trade.offers || []).map((offer, i) => ({ offer, key: 'trade:' + id + ':' + i }));
  if (trade.pool && trade.pool.length) {
    const period = trade.refresh === 'day' ? 'day' + state.day : 'week' + weekNow();
    for (const i of seededPick(trade.pool.length, trade.show || 1, id + ':' + period))
      out.push({ offer: trade.pool[i], key: 'trade:' + id + ':pool' + i + ':' + period });     // the period is in the key, so
  }                                                                                            // next time round it's fresh again
  return out;
}

function openTrade(target) {
  const def = target.def, id = target.npc ? target.npc.id : def.name;
  const again = () => openTrade(target);

  const options = currentOffers(id, def.trade).map(({ offer, key }) => {
    const giveId = resolveGive(offer.give, key);
    const theirs = CARD_BY_ID[giveId];
    state.seen[giveId] = true;                            // they showed it to you. It counts as seen.
    if (offer.once !== false && state.done[key]) return { label: theirs.name + '   (already traded)', dim: true, run: again };

    const mine = CARDS.filter(c => owned(c.id) > 0 && c.id !== giveId && cardMatches(c, offer.want))
                      .sort((a, b) => owned(b.id) - owned(a.id))[0];
    const label = theirs.name + '   for   ' + (mine ? 'your ' + mine.name : describeWant(offer.want));
    if (!mine) return { label, dim: true, hint: "You don't have that.", run: again };

    const doTrade = () => {
      removeCard(mine.id); addCard(giveId); state.done[key] = true; saveGame();
      say(def.name, def.trade.doneLine || '"Deal."', () => { toast('You got ' + theirs.name + '!'); fireEvent('trade_done'); });
    };
    const last = owned(mine.id) === 1;
    return { label, hint: last ? "That's your only one." : 'You have ' + owned(mine.id) + ' of those.',
             run: last ? () => choose('Trade away your only ' + mine.name + '?', [{ label: 'Trade it', run: doTrade }, { label: 'Keep it', run: again }]) : doTrade };
  });
  options.push({ label: 'Never mind' });
  choose(def.name + ' will trade', options);
}

/* ---------------- actions ---------------- */

function runAction(action, def) {
  if (action === 'collection') return openCollection();
  if (action === 'deck') return openDeckEditor();
  if (action === 'desk') return choose(def.name, [
    { label: 'Look through the shoebox', run: () => openCollection() },
    { label: 'Build your deck', hint: deckList().length + ' cards in it.  ' + (deckProblem(deckList()) || 'Ready to play.'), run: () => openDeckEditor() },
    { label: 'Never mind' },
  ]);
  if (action === 'save') return toast(saveGame() ? 'Saved.' : "Couldn't save in this browser.");

  if (action === 'sleep') {
    const early = hourNow() < 18;
    return choose(early ? "It's still light out. Go to bed anyway?" : 'Go to sleep?', [
      { label: 'Sleep until morning', run: () => goToSleep(false) },
      { label: 'Not yet' },
    ]);
  }

  if (action === 'playmat' || action === 'battle') {
    // The real, multiplayer playmat on the web. (Island matches use `battle:` instead.)
    return say(def.name, "There's a bigger game out there, past the island.", () => choose('', [
      { label: 'Open the playmat in a new tab', run: () => window.open(PLAYMAT_URL, '_blank') },
      { label: 'Not now' },
    ]));
  }
  console.warn('Unknown action:', action);
}

function goToSleep(collapsed) {
  const tomorrow = DAY_NAMES[state.day % 7];
  let notes = [];
  fadeThrough(() => {
    notes = startNewDay();
    if (collapsed) { loadMap(START.map, START.col, START.row, 'down'); notes.unshift("You wake up in your own bed. Somebody must have carried you home."); }
    else refreshPeople();
    saveGame();
  }, { dur: 0.6, text: tomorrow, sub: 'day ' + (state.day + 1),
       then: () => { const go = () => fireEvent('daystart'); if (notes.length) say('', notes, go); else go(); } });
}

function collapse() {
  say('', "Your eyes won't stay open. It's far too late to be out.", () => goToSleep(true));
}

/* ---------------- using tools (F) ---------------- */

function weightedPick(table) {
  let roll = Math.random() * table.reduce((n, f) => n + f.weight, 0);
  for (const f of table) if ((roll -= f.weight) < 0) return f;
  return table[table.length - 1];
}

function doActivity(found) {
  const act = found.act;
  if (act.bait && !have(act.bait)) return say('', act.noBait || "You're out of " + GOODS[act.bait].name.toLowerCase() + '.');

  let tooLate = false, result = null;
  fadeThrough(() => {
    if (act.bait) removeGood(act.bait);
    if (act.oncePerSpot) { if (!state.dug) state.dug = { day: state.day, spots: {} }; state.dug.spots[currentName + ':' + found.col + ',' + found.row] = act.marks || 'dug_hole'; }
    tooLate = advanceMinutes(act.minutes || 10);
    // STUB: a dice roll. A timing minigame would go here and hand back a `result` the same shape.
    result = weightedPick((act.findsIn && act.findsIn[currentName]) || act.finds);
  }, { dur: 0.25, text: act.text, sub: clockText() + '  →  ' + clockAfter(act.minutes || 10),
       then: () => say('', result.line || '...', () => {
         if (result.item)  { addGood(result.item); toast('+ ' + GOODS[result.item].name); }
         if (result.money) { const n = result.money[0] + Math.floor(Math.random() * (result.money[1] - result.money[0] + 1)); state.money += n; toast('+' + moneyText(n)); }
         if (result.card)  { const pool = CARDS.filter(c => rarityOf(c) === result.card); const c = pool[Math.floor(Math.random() * pool.length)]; if (c) { addCard(c.id); toast('You got ' + c.name + '!'); } }
         saveGame();
         if (tooLate) collapse();
       }) });
}

/* ---------------- moving between maps ---------------- */

function arrive(previousTitle) {
  if (current.title && current.title !== previousTitle) banner(current.title);
  saveGame();
  fireEvent('enter:' + currentName);
}

function goThrough(to) {
  const before = current.title;
  fadeThrough(() => loadMap(to.map, to.col, to.row, to.facing), { then: () => arrive(before) });
}

// Walking off the side of one map onto the next.
function crossEdge(side, nbName) {
  const before = current.title, nb = MAPS[nbName];
  // Keep your position ALONG the edge; flip your position ACROSS it.
  let x = player.x, y = player.y;
  if (side === 'east')  x -= WORLD_W;
  if (side === 'west')  x += nb.tiles[0].length * TILE;
  if (side === 'south') y -= WORLD_H;
  if (side === 'north') y += nb.tiles.length * TILE;
  fadeThrough(() => { loadMap(nbName); player.x = x; player.y = y; updateCamera(); }, { dur: 0.12, then: () => arrive(before) });
}

/* ---------------- story events ---------------- */

function fireEvent(trigger, then) {
  const ev = EVENTS.find(e => e.on === trigger && !(e.once && state.done['event:' + e.id]) && check(e.if));
  if (!ev) { if (then) then(); return; }
  if (ev.once) state.done['event:' + ev.id] = true;
  say(ev.name, ev.lines, () => {
    for (const f of ev.set || []) setFlag(f);
    receive(ev.give);
    if (then) then();
  });
}
