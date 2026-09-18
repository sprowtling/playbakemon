/* ============================================================
   MOVES — what every card's TEXT actually does, as data.
   ============================================================
   data/cards.js knows a move's name, cost and damage. It only has
   the effect as an English sentence, and a computer can't referee
   from a sentence. This file translates each sentence into a short
   list of OPS (operations) the battle engine knows how to run.

       MOVES[card id][move name] = { ops: [ ... ] }

   A move with no text needs no entry: it just does its damage.
   A move with text and no entry still does its damage, and the
   red box lists it as "not wired yet".

   Entries marked  approx  are simplified. Entries marked  todo
   are not wired: I couldn't express them faithfully yet, and would
   rather say so than fake it. Both are listed in the README.

   THE VOCABULARY. (who = which Bakemon; see SELECTORS below.)
     { heal: 10, who: 'self' }
     { healPerEnergy: 20, type: 'grass' }            heals self, per energy of that type
     { status: 'burned' }                            on the target, unless  on: 'self' / 'attacker' / 'enemy_active'
     { flip: 1, heads: [ops], tails: [ops] }         coin flips that lead to other ops
     { flip: 6, perHeads: { damage: 10 } }           ...or that count heads.  perHeads can be damage / heal / shield
     { flip: 3, perHeads: {damage:30}, replaceBase: true, atLeast: { n: 2, ops: [...] } }
     { flipPerOwnEnergy: true, perHeads: {...} }
     { bonusIfTargetStatus: 'burned', damage: 50 }
     { damagePerEnergy: 20, type: 'electric', where: 'zone' | 'self', replaceBase: true }
     { shield: 30 | 'all', lasts: 'nextHit' | 'nextTurn', onlyFrom: 'water' }
     { discardEnergy: 1, from: 'self' | 'target', type: 'fire' }      type is optional
     { discardAllEnergy: 'electric', from: 'self' }
     { discardZoneEnergy: 2, side: 'own' | 'enemy', types: ['fire'] }
     { selfDamage: 50 }     { selfDamageIfHit: 40 }
     { retarget: 'enemy_bench' | 'enemy_any', unavoidable: true }     the move's damage goes somewhere else
     { damageBench: 10, pick: 'all' | 'choose' }
     { opponentDiscards: 1 }      { draw: 1 }      { bothDraw: 1 }
     { addEnergy: 'fire' | 'choose', to: who }
     { moveEnergy: 1, from: who, to: who, type: 'electric' }
     { stealEnergy: 1 }                               from the target to one of yours
     { convertEnergy: 'electric' | 'choose', on: who }
     { targetMisses: true }                           target's next attack misses
     { targetMustFlip: true }                         target's next attack needs a coin flip
     { cantRetreat: true }        { noEnergy: true }  on the target, through its next turn
     { buffSelf: 30, lasts: 'myNextTurn' | 'forever' }
     { debuffTarget: 20, turns: 3 }
     { reflect: { minus: 20 } }                       through the opponent's next turn
     { retaliate: { status: 'burned' } }              anyone who attacks this Bakemon next turn gets it
     { aura: { costIncludes: 'water', damage: 20 } }  while this Bakemon stays active, your matching attacks hit harder
     { optional: 'Question?', ops: [...] }            the player may decline
     { pre: true, ... }                               run BEFORE damage instead of after

   SELECTORS (the `who`, `to`, `from`, `on` values):
     'self'  'target'  'attacker'  'enemy_active'
     'own_bench'  'own_other'  'own_any'  'enemy_bench'  'enemy_any'  'any'
     plus optional filters on the same op:  names: [...]   ofType: 'grass'   withStatus: 'asleep'
   When a selector matches several Bakemon, whoever's turn it is chooses.

   ABILITIES (moves with no energy cost) say WHEN they work:
     ability: 'activated'   you choose to use it on your turn.  oncePerTurn: true|false
     ability: 'enterPlay'   when the card is put into play from your hand
     ability: 'whenHit'     when damaged by an attack
     ability: 'passive'     always on; the engine checks for it by  tag
   ============================================================ */

const MOVES = {
  '001': { 'Photosynthesize': { ops: [{ heal: 10, who: 'self' }] } },
  '002': { 'Seed Bullet':     { ops: [{ flip: 6, perHeads: { damage: 10 } }] } },
  '003': { 'Take Root':       { ops: [{ shield: 30, lasts: 'nextHit' }] },
           'Solar Powered':   { ops: [{ flip: 1, heads: [{ heal: 10, who: 'self' }] }] } },
  '004': { 'Hide':            { ops: [{ shield: 'all', lasts: 'nextHit' }] } },
  // "water-type damage" is read as: an attack whose cost includes water energy.
  // (The same way the rules page defines weakness.)
  '005': { 'Umbrella':        { ops: [{ shield: 'all', lasts: 'nextTurn', onlyFrom: 'water' }] } },
  '006': { 'Growth':          { ops: [{ flip: 3, perHeads: { heal: 10 } }] },
           'Acid Wash':       { ops: [{ discardEnergy: 1, from: 'target' }] } },
  '008': { 'Flare':           { ability: 'activated', oncePerTurn: true, ops: [{ addEnergy: 'fire', to: 'own_bench' }] },
           'Flame Wind':      { ops: [{ optional: 'Discard a fire energy to burn the target?', ops: [{ discardEnergy: 1, from: 'self', type: 'fire' }, { status: 'burned' }] }] } },
  '009': { 'Ignite':          { ops: [{ status: 'burned' }, { discardEnergy: 1, from: 'self', type: 'fire' }] },
           'Fan The Flames':  { ops: [{ bonusIfTargetStatus: 'burned', damage: 50 }] } },
  '010': { 'Perch':           { ops: [{ shield: 40, lasts: 'nextHit' }] },
           'Claw Game':       { ops: [{ opponentDiscards: 1 }, { discardEnergy: 1, from: 'self' }] } },
  '011': { 'Chain Lightning': { ability: 'activated', oncePerTurn: true, approx: 'assumed once per turn', ops: [{ convertEnergy: 'electric', on: 'own_any' }] },
           'Spark Gust':      { ops: [{ flip: 1, heads: [{ status: 'paralyzed' }] }] } },
  '012': { 'Parrot':          { ops: [{ copyLastAttack: true }] },
           'Lightning Storm': { ops: [{ damagePerEnergy: 20, type: 'electric', where: 'zone', replaceBase: true }] } },
  // Literal reading would also wipe the opponent's OPENING hand if Shadopillar is
  // placed during setup. That felt unintended, so it only triggers when played during a turn.
  '013': { 'Shuffle':         { ability: 'enterPlay', approx: 'not during setup', ops: [{ opponentShufflesHandAway: true }] },
           'Sleep Visions':   { ops: [{ status: 'asleep', on: 'self' }, { sleepHeal: 20 }] } },
  '014': { 'Nightmare':       { ops: [{ selfDamage: 50 }] } },
  '015': { 'Lullaby':         { ability: 'activated', oncePerTurn: true, ops: [{ status: 'asleep', on: 'enemy_active' }] } },
  '016': { 'Slither':         { ops: [{ status: 'asleep' }] } },
  '017': { 'Mischief':        { ops: [{ discardEnergy: 1, from: 'self' }, { discardEnergy: 1, from: 'target' }] } },
  '018': { 'Graze':           { ops: [{ healPerEnergy: 20, type: 'grass' }] },
           'Headbutt':        { ops: [{ flip: 1, heads: [{ status: 'burned' }] }] } },
  '019': { 'Leap':            { ability: 'activated', oncePerTurn: true, ops: [{ retaliate: { status: 'burned' } }] } },
  '020': { 'Contact Zap':     { ability: 'whenHit', ops: [{ flip: 1, heads: [{ status: 'paralyzed', on: 'attacker' }, { debuffTarget: 999, turns: 1, on: 'attacker' }] }] } },
  '021': { 'Soak':            { ability: 'activated', oncePerTurn: true, ops: [{ addEnergy: 'water', to: 'own_any' }] } },
  // Read as: the 30 damage goes to a benched Bakemon INSTEAD of the active one.
  '022': { 'Quake':           { approx: 'damage goes to the bench instead of the active', ops: [{ pre: true, retarget: 'enemy_bench' }] },
           'Hydrosurge':      { approx: '"discard Draquaduct at any time" is not offered', ops: [{ aura: { costIncludes: 'water', damage: 20 } }] } },
  '023': { 'Twinship':        { ability: 'passive', tag: 'twinshipBonus' },
           'Prance':          { ops: [{ shield: 'all', lasts: 'nextHit', who: 'own_any', names: ['Jeremo♀'] }] } },
  '024': { 'Twinship':        { todo: 'free swap with Jeremo♂ at any time' },
           'Graze':           { ops: [{ heal: 30, who: 'own_any', names: ['Jeremo♀', 'Jeremo♂'] }] } },
  '025': { 'Singe':           { ops: [{ flip: 1, heads: [{ status: 'burned' }] }] } },
  '026': { 'Dunk':            { ops: [{ shield: 'all', lasts: 'nextHit' }] } },
  '027': { 'Waste Disposal':  { ability: 'activated', oncePerTurn: false, ops: [{ moveEnergy: 1, from: 'self', to: 'own_other' }] } },
  '028': { 'Ink Blot':        { ops: [{ targetMustFlip: true }] } },
  '029': { 'Salt Spray':      { ops: [{ flipPerOwnEnergy: true, perHeads: { discardEnemyEnergy: 1 } }] } },
  '031': { 'Drain Punch':     { ops: [{ stealEnergy: 1 }] },
           'Bloom':           { ops: [{ targetMisses: true }] } },
  '032': { 'Preen':           { ability: 'activated', oncePerTurn: true, approx: 'assumed once per turn', ops: [{ heal: 10, who: 'any' }] } },
  '033': { 'Swoop':           { ops: [{ moveEnergy: 1, from: 'self', to: 'own_bench' }] },
           'Glare':           { ops: [{ flip: 1, heads: [{ shield: 20, lasts: 'nextTurn' }] }] } },
  '034': { 'Manifest Egg':    { ops: [{ addEnergy: 'choose', to: 'own_bench' }] },
           'Hypnotic Dance':  { ops: [{ flip: 3, perHeads: { shield: 20 } }] } },
  '035': { 'Shed Skin':       { ability: 'activated', oncePerTurn: true, approx: 'assumed once per turn', ops: [{ convertEnergy: 'choose', on: 'own_any' }] },
           'Swift':           { ops: [{ pre: true, retarget: 'enemy_any', unavoidable: true }] } },
  '036': { 'Poison Sting':    { ops: [{ flip: 1, heads: [{ status: 'poisoned' }, { cantRetreat: true }] }] },
           'Lurk':            { todo: 'store the damage just received, deal double next turn' } },
  '037': { 'Infiltrate':      { ops: [{ status: 'confused' }] },
           'Surgeflood':      { ops: [{ discardAllEnergy: 'electric', from: 'self' }] } },
  '038': { 'Networking':      { ability: 'activated', oncePerTurn: true, ops: [{ addEnergy: 'choose', to: 'own_other', names: ['Musherus', 'Shimejirus'] }] },
           'Sporesprinkle':   { ops: [{ damageBench: 10, pick: 'all' }] } },
  '039': { 'Nutrient Absorption': { ability: 'passive', tag: 'healsOnEnemyPoison' },
           'Poison Spore':    { ops: [{ status: 'poisoned' }] } },
  '040': { 'Powdered Snow':   { todo: 'no move in the set can freeze yet, so there is nothing to boost' },
           'Ominous Wind':    { ops: [{ shield: 10, lasts: 'nextTurn' }] } },
  '041': { 'Hailstorm':       { todo: 'a lasting weather effect that cancels elemental effects' },
           'Cursed Wind':     { todo: 'depends on Hailstorm. Does its 50 damage only.' } },
  '042': { 'Till':            { ops: [{ buffSelf: 30, lasts: 'myNextTurn' }] },
           'Plow':            { ops: [{ discardEnergy: 1, from: 'self' }] } },
  '043': { 'Static Nuzzle':   { ops: [{ targetMustFlip: true }] },
           'Generator':       { ops: [{ debuffTarget: 20, turns: 3 }] } },
  '044': { 'Arclight':        { ops: [{ aura: { costIncludes: 'electric', damage: 20 } }] },
           'Stormdance':      { ops: [{ flip: 2, atLeast: { n: 2, ops: [{ opponentDiscards: 1 }] } }] } },
  '045': { 'Heat Lightning':  { todo: 'fire and electric energy interchangeable everywhere' },
           'Plasmablast':     { ops: [{ discardZoneEnergy: 2, side: 'own', types: ['fire', 'electric'] }, { discardZoneEnergy: 3, side: 'enemy', types: ['water'] }] } },
  '046': { 'Taunt':           { approx: 'does not wear off after 50 damage', ops: [{ status: 'taunted' }] },
           'Polished Scales': { ops: [{ reflect: { minus: 20 } }] } },
  '047': { 'Outrage':         { ops: [{ selfDamageIfHit: 40 }] },
           'Venom Strike':    { ops: [{ flip: 3, perHeads: { damage: 30 }, replaceBase: true, atLeast: { n: 2, ops: [{ status: 'poisoned' }] } }] } },
  '048': { 'Curl':            { approx: 'always 10; does not build up with repeated use', ops: [{ shield: 10, lasts: 'nextTurn' }] },
           'Grassy Terrain':  { ops: [{ heal: 30, who: 'any', ofType: 'grass' }] } },
  '049': { 'Trapjaw':         { ops: [{ cantRetreat: true }] },
           'Ivyconstrictor':  { ops: [{ pre: true, retarget: 'enemy_bench' }, { noEnergy: true }] } },
  '050': { 'Energized Evolution': { ability: 'passive', tag: 'evolveNeedsMatchingEnergy' },
           'Black Tongue':    { todo: 'delayed hit on a declared target. Does its 80 damage immediately instead.' } },
  '051': { 'Lightning Rod':   { ability: 'activated', oncePerTurn: false, ops: [{ moveEnergy: 1, from: 'own_other', to: 'self', type: 'electric' }] },
           'High Voltage':    { ops: [{ moveEnergy: 1, from: 'self', to: 'target', type: 'electric' }] } },
  '052': { 'Cling':           { todo: 'skip attacking and energy to avoid all damage for a turn' } },
  '053': { 'Magnetize':       { ability: 'activated', oncePerTurn: true, ops: [{ dragToActive: { withEnergy: 'steel' } }] },
           'Trample':         { todo: 'grows by 20 with each consecutive use. Does its 50 only.' } },
  '054': { 'Voices on the Wind': { ops: [{ status: 'confused' }] } },
  '055': { 'Toxidermic':      { ability: 'whenHit', onlyBelowHp: 30, ops: [{ status: 'poisoned', on: 'attacker' }] },
           'Acid Spray':      { ops: [{ status: 'poisoned' }, { discardEnergy: 3, from: 'self', type: 'dark' }] } },
  '056': { 'Hungry Ghost':    { ability: 'passive', tag: 'hurtByEnergy', approx: 'takes 10 damage whenever energy is attached' },
           'Soul Eater':      { ops: [{ damagePerEnergy: 30, type: 'psychic', where: 'self', replaceBase: true }] } },
  '057': { 'Plate Armor':     { todo: 'builds defence for each turn it declines to attack' } },
  '058': { 'Zero to Hero':    { ability: 'activated', oncePerTurn: true, ops: [{ addEnergy: 'fighting', to: 'own_other' }] },
           'Grapple':         { ops: [{ discardEnergy: 3, from: 'self', type: 'fighting' }] } },
  '061': { 'Confusion':       { ops: [{ status: 'confused' }] } },
  '062': { 'Aqua Ring':       { ability: 'passive', tag: 'aquaRing' },
           'Last Dive':       { ops: [{ chooseDamage: { max: 100, step: 10, recoil: true } }] } },
  '063': { 'Liquidation':     { ops: [{ liquidation: { count: 3, types: ['fire', 'fighting', 'dragon'], otherwise: 20 } }] },
           'Psyonic':         { ops: [{ pre: true, flip: 1, flipper: 'opponent', tails: [{ forceSwitch: true }] }] } },
  '064': { 'Rascal':          { todo: 'steal the target\'s equipped item on a coin flip. Does its 10 damage only.' } },
  '065': { 'Sharpen Claws':   { ops: [{ buffSelf: 10, lasts: 'forever' }] },
           'Scavenge':        { ops: [{ draw: 1 }] } },
  '066': { 'Life Cycle':      { ability: 'passive', tag: 'grassEvolvesSameTurn' },
           'Molt':            { ops: [{ heal: 10, who: 'self' }] } },
  '067': { 'Fluttershine':    { ability: 'passive', tag: 'fluttershine' },
           'Rainbow Sting':   { ops: [{ status: 'poisoned', doubling: 10 }] } },
  '099': { 'Secret Frequency': { ability: 'activated', oncePerTurn: true, approx: 'the opponent\'s drawn card is not shown', ops: [{ bothDraw: 1 }] } },
};

/* ---- Items ---------------------------------------------------
   Consumables run their ops once and are discarded.
   Equippables sit on a Bakemon and are checked by  tag.
   ------------------------------------------------------------- */
const ITEMS = {
  '100': { ops: [{ cure: ['asleep'], who: 'any', withStatus: 'asleep' }] },
  '101': { ops: [{ heal: 20, who: 'own_any' }] },
  '102': { ops: [{ draw: 2 }] },
  '103': { ops: [{ freeRetreat: true }] },
  '104': { equip: 'attackersMustFlip', approx: 'every attack against the wearer needs a coin flip, not just the next one' },
  '105': { equip: 'burnsAttackers' },
  '106': { ops: [{ heal: 50, who: 'own_any' }] },
  '107': { ops: [{ newHand: 3 }] },
  '108': { equip: 'extraEnergy' },
  '109': { equip: 'blocksWeakness' },
  '110': { equip: 'sleepHeals40', approx: 'heals whenever asleep, whoever caused it' },
  '111': { todo: 'every attack gains +1 water energy' },
  '112': { todo: 'copy and later use an opponent\'s move' },
  '113': { ops: [{ moveAllEnergy: true }], approx: 'moves ALL the energy, not "as much as you like"' },
  '114': { ops: [{ reshuffleDiscard: true }] },
  '115': { ops: [{ evolveFreelyThisTurn: true }] },
  '116': { ops: [{ transmute: true }] },
  '117': { ops: [{ removeEnemyEquip: true }] },
  '118': { ops: [{ digForEvolution: { penaltyOver: 6, discard: 5 } }], approx: 'the five discards are chosen at random' },
  '119': { ops: [{ cure: 'all', who: 'any', activeOnly: true, withStatus: 'any' }] },
};
