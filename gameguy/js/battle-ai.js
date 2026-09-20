/* ============================================================
   BATTLE AI — how everyone who isn't you plays cards.
   ============================================================
   It is not clever. It follows a short list of habits, in order:
   evolve, fill the bench, use helpful items, attach energy where
   it's needed, use free abilities, then make the biggest attack
   it can afford.

   `style` comes from the opponent's entry in data/opponents.js:
     mistakes   0 to 1. How often it picks an attack at random
                instead of the best one. Kids make more mistakes.
   ============================================================ */

function makeAI(style) {
  style = Object.assign({ mistakes: 0.15 }, style || {});
  const rand = list => list[Math.floor(Math.random() * list.length)];

  // What energy does this Bakemon still need for its most expensive attack?
  function neededType(mon) {
    const attacks = cardMoves(mon.card).filter(m => !m.isAbility).sort((a, b) => b.cost.total - a.cost.total);
    for (const move of attacks) {
      for (const [type, n] of Object.entries(move.cost.types)) if (mon.energy.filter(e => e === type).length < n) return type;
      if (mon.energy.length < move.cost.total) return Object.keys(move.cost.types)[0] || mon.card.types[0] || 'grass';
    }
    return null;
  }

  // The most damage this Bakemon could ever do, fully powered. Zero means "pure support".
  const potential = mon => Math.max(0, ...cardMoves(mon.card).filter(m => !m.isAbility).map(m =>
    m.damage + m.ops.reduce((n, op) => n + ((op.perHeads && op.perHeads.damage) || op.damagePerEnergy || (op.chooseDamage && op.chooseDamage.max) || 0), 0)));
  // A support Bakemon stuck in the active slot, with a fighter waiting on the bench, should get out of the way.
  const wantsOut = P => P.active && potential(P.active) === 0 && bench(P).some(m => potential(m) > 0) && !retreatBlocked(P.active);

  function estimate(G, P, move) {
    const enemy = other(G, P).active;
    let dmg = move.damage;
    for (const op of move.ops) {
      if (op.perHeads && op.perHeads.damage) dmg = (op.replaceBase ? 0 : dmg) + op.perHeads.damage * (op.flip || 1) / 2;
      if (op.damagePerEnergy) dmg = op.damagePerEnergy * zone(P).reduce((n, m) => n + m.energy.filter(e => e === op.type).length, 0);
      if (op.chooseDamage) dmg = Math.min(op.chooseDamage.max, enemy.hp);
      if (op.bonusIfTargetStatus && enemy.status[op.bonusIfTargetStatus]) dmg += op.damage;
    }
    for (const w of enemy.card.weak) dmg += (move.cost.types[w] || 0) * G.rules.weaknessBonus;
    let score = dmg + (move.ops.length ? 12 : 0);           // effects are worth a little something
    if (dmg >= enemy.hp) score += 1000;                     // a knock-out beats everything
    if (move.ops.some(op => op.selfDamage && op.selfDamage >= P.active.hp)) score -= 500;   // don't knock yourself out
    return score;
  }

  return {
    async chooseAction(G, P, actions) {
      const of = type => actions.filter(a => a.type === type);
      const enemy = other(G, P);

      if (of('evolve').length)    return of('evolve')[0];
      if (of('playBasic').length) return of('playBasic')[0];

      for (const a of of('item')) {
        const item = ITEMS[a.cardId], op = (item.ops || [])[0] || {};
        const hurt = zone(P).some(m => m.maxHp - m.hp >= (op.heal || 0) * 0.8);
        if (item.equip)                                   return a;
        if (op.draw || op.removeEnemyEquip)               return a;
        if (op.heal && hurt)                              return a;
        if (op.cure && zone(P).some(m => Object.keys(m.status).length)) return a;
        if (op.newHand && P.hand.length <= 1)             return a;
        if (op.digForEvolution && P.hand.length <= 3)     return a;
        if (op.freeRetreat && P.active.hp <= 20)          return a;
      }

      // Only attach energy if somebody can use it. (Found by watching a match: the AI had
      // piled two dozen energy onto one Bakemon that needed three.)
      if (of('energy').length && (wantsOut(P) || zone(P).some(neededType))) return of('energy')[0];

      for (const a of of('ability')) {
        const op = a.move.ops[0] || {};
        if (op.moveEnergy || op.convertEnergy) continue;                   // too easy to fiddle forever
        if (op.heal && !zone(P).concat(zone(enemy)).some(m => m.hp < m.maxHp)) continue;
        if (op.status && enemy.active && enemy.active.status[op.status]) continue;
        return a;
      }

      const attacks = of('attack');
      const stuck = !attacks.length && P.active && neededType(P.active);
      if (of('retreat').length && wantsOut(P)) return of('retreat')[0];
      if (of('retreat').length && ((P.active.hp <= 20 && Math.random() < 0.6) || (stuck && bench(P).some(m => cardMoves(m.card).some(mv => !mv.isAbility && canPay(m, mv.cost))))))
        return of('retreat')[0];

      if (attacks.length) {
        if (Math.random() < style.mistakes) return rand(attacks);
        return attacks.slice().sort((a, b) => estimate(G, P, b.move) - estimate(G, P, a.move))[0];
      }
      return of('endTurn')[0];
    },

    async ask(G, P, req) {
      const opts = req.options;
      const mine = m => zone(P).includes(m);
      switch (req.purpose) {
        // Both setup options are already filtered to basics by the engine (see runBattle),
        // but the AI shouldn't rely on that silently — pick defensively among what's basic.
        case 'setupActive': { const basics = opts.filter(o => CARD_BY_ID[o.cardId].kind === 'bakemon' && CARD_BY_ID[o.cardId].stage === 'basic'); return (basics.length ? basics : opts).sort((a, b) => CARD_BY_ID[b.cardId].hp - CARD_BY_ID[a.cardId].hp)[0].value; }
        case 'setupBench':  return opts[0].value;                                     // bench everyone
        case 'promote':     return opts.slice().sort((a, b) => ((potential(b) > 0) * 500 + b.energy.length * 30 + b.hp) - ((potential(a) > 0) * 500 + a.energy.length * 30 + a.hp))[0];
        case 'heal': case 'cure': case 'protect':
          return opts.filter(mine).sort((a, b) => (b.maxHp - b.hp) - (a.maxHp - a.hp))[0] || opts[0];
        case 'hurt':        return (opts.filter(m => !mine(m)).sort((a, b) => a.hp - b.hp)[0]) || opts[0];
        case 'energyTo': case 'equipTo': {
          const own = opts.filter(mine);
          if (req.purpose === 'energyTo' && wantsOut(P) && own.includes(P.active)) return P.active.energy.length < P.active.card.retreat ? P.active : (own.find(m => m !== P.active && potential(m) > 0 && neededType(m)) || own[0]);
          return (P.active && own.includes(P.active) && neededType(P.active)) ? P.active : own.find(neededType) || own[0] || opts[0];
        }
        case 'energyType': {
          const want = req.mon && neededType(req.mon);
          return (opts.find(o => o.value === want) || opts.find(o => req.mon && req.mon.card.types.includes(o.value)) || rand(opts)).value;
        }
        case 'energyFrom':  return opts.slice().sort((a, b) => b.energy.length - a.energy.length)[0];
        case 'optional':    return true;
        case 'whoseHand': case 'whoseDiscard': return P.index;
        case 'chooseDamage': {
          const safe = opts.filter(o => o.value < req.self.hp);                        // never dive to your own death
          const enough = safe.find(o => o.value >= req.target.hp);
          return (enough || safe[safe.length - 1] || opts[0]).value;
        }
      }
      const choice = rand(opts);
      return req.kind === 'option' ? choice.value : choice;
    },
  };
}
