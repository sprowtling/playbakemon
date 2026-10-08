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

   DICE, WEATHER AND OTHER LATER ADDITIONS
     { roll: 6, min: 4, then: [ops], otherwise: [ops] }   roll a D3/D6/D20. then/otherwise run on  >= min  / below it
     { roll: 3, times: { damage: 10 }, replaceBase: true }   ...or the number rolled multiplies damage / heal
     { roll: 6, table: { 1: [ops], 2: [ops] } }       a different result for each number
     { flipUntilTails: true, perHeads: { damage: 30 } }
     { flinch: true }                                 the target cannot attack through its next turn
     { weather: 'frost' }                             one weather at a time (see WEATHER below). It lasts until the
                                                      Bakemon that made it leaves play, or a newer weather replaces it.
     { ifWeather: 'hailstorm', then: [ops] }
     { shieldRoll: { sides: 6, mult: 10 } }           blocks (roll x mult) damage, rolled when the hit lands
     { shield: 10, grows: true, lasts: 'nextTurn' }   +10 for every turn in a row the same move is used (Curl)
     { streakBonus: 20, sameTarget: true }            +20 per consecutive use against the same target (Trample)
     { thorns: 10 }   { barbed: true }                hurt whoever hits this Bakemon: flat / D3 x 10, once
     { splashBench: 10 }                              next attack also hits every benched Bakemon
     { noBase: true }                                 the move's printed damage is NOT dealt now
     { delayHit: 80 }  { stones: 20 }  { sporeBloom: { damage: 60, heal: 60 } }     happen on a later turn
     { flashFreeze: true }     { amplify: { heads: [types], tails: [types], amount: 20 } }
     { retreatSelf: true | { ofType: 'ground' } }     step back to the bench (and who may replace it)
     { copyAnyAttack: 6 }     roll, then copy any attack in play that costs that much energy or less
     { dragBenchSlot: true }  { swapEnemyEnergy: true }  { disableMove: true }  { reveal: 3 }
     { lurk: true }  { stealEquip: true }  { delusion: true }  { drawUntilBasic: true }  { cling: true }
     { lockTurn: true }                               nothing else (no items, energy, attacks, abilities) this turn
     { hydraulic: true }  { swapPartner: { names: [...] } }  { convertStatus: { from, to } }  { purify: true }
   A move can also carry   needsTargetStatus: 'asleep'   (it can only be used on such a target).

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

// Weather. One at a time; see the vocabulary above. The rules live in js/battle.js.
const WEATHER = {
  hailstorm:  { label: 'Hailstorm',  text: 'Clears and prevents elemental effects.' },
  hydrosurge: { label: 'Hydrosurge', text: 'Water attacks do +20 damage.' },
  starfall:   { label: 'Starfall',   text: 'Damage to fairy-types is reduced by a D6.' },
  frost:      { label: 'Frost',      text: 'Bakemon put in the active slot may freeze.' },
};

// "Mushroom-based" Bakemon, for Mushmutt's Co-opt and Iveldyr's Spore Bloom. ASSUMED list.
const MUSHROOMS = ['Musherus', 'Shimejirus', 'Mushmutt', 'Iveldyr'];

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
  '011': { 'Chain Lightning': { ability: 'activated', oncePerTurn: true, ops: [{ convertEnergy: 'electric', on: 'own_any' }] },
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
  '022': { 'Quake':           { ops: [{ pre: true, retarget: 'enemy_bench' }] },
           'Hydrosurge':      { approx: '"discard Draquaduct at any time" is not offered', ops: [{ weather: 'hydrosurge' }] } },
  '023': { 'Twinship':        { ability: 'passive', tag: 'twinshipBonus' },
           'Prance':          { ops: [{ shield: 'all', lasts: 'nextHit', who: 'own_any', names: ['Jeremo♀'] }] } },
  '024': { 'Twinship':        { ability: 'activated', oncePerTurn: false, ops: [{ swapPartner: { names: ['Jeremo♂'] } }] },
           'Graze':           { ops: [{ heal: 30, who: 'own_any', names: ['Jeremo♀', 'Jeremo♂'] }] } },
  '025': { 'Singe':           { ops: [{ flip: 1, heads: [{ status: 'burned' }] }] } },
  '026': { 'Dunk':            { ops: [{ shield: 'all', lasts: 'nextHit' }] } },
  '027': { 'Waste Disposal':  { ability: 'activated', oncePerTurn: false, ops: [{ moveEnergy: 1, from: 'self', to: 'own_other' }] } },
  '028': { 'Ink Blot':        { ops: [{ targetMustFlip: true }] } },
  '029': { 'Salt Spray':      { ops: [{ flipPerOwnEnergy: true, perHeads: { discardEnemyEnergy: 1 } }] } },
  '031': { 'Drain Punch':     { ops: [{ stealEnergy: 1 }] },
           'Bloom':           { ops: [{ targetMisses: true }] } },
  '032': { 'Preen':           { ability: 'activated', oncePerTurn: true, ops: [{ heal: 10, who: 'any' }] } },
  '033': { 'Swoop':           { ops: [{ moveEnergy: 1, from: 'self', to: 'own_bench' }] },
           'Glare':           { ops: [{ flip: 1, heads: [{ shield: 20, lasts: 'nextTurn' }] }] } },
  '034': { 'Manifest Egg':    { ops: [{ addEnergy: 'choose', to: 'own_bench' }] },
           'Hypnotic Dance':  { ops: [{ flip: 3, perHeads: { shield: 20 } }] } },
  '035': { 'Shed Skin':       { ability: 'activated', oncePerTurn: true, ops: [{ convertEnergy: 'choose', on: 'own_any' }] },
           'Swift':           { ops: [{ pre: true, retarget: 'enemy_any', unavoidable: true }] } },
  '036': { 'Poison Sting':    { ops: [{ flip: 1, heads: [{ status: 'poisoned' }, { cantRetreat: true }] }] },
           'Lurk':            { ops: [{ lurk: true }] } },
  '037': { 'Infiltrate':      { ops: [{ status: 'confused' }] },
           'Surgeflood':      { ops: [{ discardAllEnergy: 'electric', from: 'self' }] } },
  '038': { 'Networking':      { ability: 'activated', oncePerTurn: true, ops: [{ addEnergy: 'choose', to: 'own_other', names: ['Musherus', 'Shimejirus'] }] },
           'Sporesprinkle':   { ops: [{ damageBench: 10, pick: 'all' }] } },
  '039': { 'Nutrient Absorption': { ability: 'passive', tag: 'healsOnEnemyPoison' },
           'Poison Spore':    { ops: [{ status: 'poisoned' }] } },
  '040': { 'Ghostfall':       { ability: 'activated', oncePerTurn: false, ops: [{ convertStatus: { from: 'frozen', to: 'haunted' } }] },
           'Ominous Wind':    { ops: [{ shield: 10, lasts: 'nextTurn' }] } },
  '041': { 'Hailstorm':       { ops: [{ weather: 'hailstorm' }] },
           'Cursed Wind':     { ops: [{ ifWeather: 'hailstorm', then: [{ thorns: 10 }] }] } },
  '042': { 'Till':            { ops: [{ buffSelf: 30, lasts: 'myNextTurn' }] },
           'Plow':            { ops: [{ discardEnergy: 1, from: 'self' }] } },
  '043': { 'Static Nuzzle':   { ops: [{ targetMustFlip: true }] },
           'Generator':       { ops: [{ debuffTarget: 20, turns: 3 }] } },
  '044': { 'Arclight':        { ops: [{ aura: { costIncludes: 'electric', damage: 20 } }] },
           'Stormdance':      { ops: [{ flip: 2, atLeast: { n: 2, ops: [{ opponentDiscards: 1 }] } }] } },
  '045': { 'Heat Lightning':  { ability: 'passive', tag: 'heatLightning' },
           'Plasmablast':     { ops: [{ discardZoneEnergy: 2, side: 'own', types: ['fire', 'electric'] }, { discardZoneEnergy: 3, side: 'enemy', types: ['water'] }] } },
  '046': { 'Taunt':           { ops: [{ status: 'taunted', tauntDamage: 50 }] },
           'Polished Scales': { ops: [{ reflect: { minus: 20 } }] } },
  '047': { 'Outrage':         { ops: [{ selfDamageIfHit: 40 }] },
           'Venom Strike':    { ops: [{ flip: 3, perHeads: { damage: 30 }, replaceBase: true, atLeast: { n: 2, ops: [{ status: 'poisoned' }] } }] } },
  '048': { 'Curl':            { ops: [{ shield: 10, grows: true, lasts: 'nextTurn' }] },
           'Grassy Terrain':  { ops: [{ heal: 30, who: 'any', ofType: 'grass' }] } },
  '049': { 'Trapjaw':         { ops: [{ cantRetreat: true }] },
           'Ivyconstrictor':  { ops: [{ pre: true, retarget: 'enemy_bench' }, { noEnergy: true }] } },
  '050': { 'Energized Evolution': { ability: 'passive', tag: 'evolveNeedsMatchingEnergy' },
           'Black Tongue':    { ops: [{ noBase: true }, { delayHit: 80 }] } },
  '051': { 'Lightning Rod':   { ability: 'activated', oncePerTurn: false, ops: [{ moveEnergy: 1, from: 'own_other', to: 'self', type: 'electric' }] },
           'High Voltage':    { ops: [{ moveEnergy: 1, from: 'self', to: 'target', type: 'electric' }] } },
  '052': { 'Cling':           { ability: 'activated', oncePerTurn: true, ops: [{ cling: true }] } },
  '053': { 'Magnetize':       { ability: 'activated', oncePerTurn: true, ops: [{ dragToActive: { withEnergy: 'steel' } }] },
           'Trample':         { ops: [{ streakBonus: 20, sameTarget: true }] } },
  '055': { 'Toxidermic':      { ability: 'whenHit', onlyBelowHp: 30, ops: [{ status: 'poisoned', on: 'attacker' }] },
           'Acid Spray':      { ops: [{ status: 'poisoned' }, { discardEnergy: 3, from: 'self', type: 'dark' }] } },
  '056': { 'Hungry Ghost':    { ability: 'passive', tag: 'hungerShrink' },
           'Soul Eater':      { ops: [{ damagePerEnergy: 30, type: 'psychic', where: 'self', replaceBase: true }] } },
  '057': { 'Plate Armor':     { ability: 'passive', tag: 'plateArmor' } },
  '054': { 'Voices on the Wind': { ops: [{ status: 'confused' }] },
           'Detect Change':   { ability: 'passive', tag: 'peekDraw' } },
  '058': { 'Zero to Hero':    { ability: 'activated', oncePerTurn: true, ops: [{ addEnergy: 'fighting', to: 'own_other' }] },
           'Grapple':         { ops: [{ discardEnergy: 3, from: 'self', type: 'fighting' }] } },
  '061': { 'Confusion':       { ops: [{ status: 'confused' }] } },
  '062': { 'Aqua Ring':       { ability: 'passive', tag: 'aquaRing' },
           'Last Dive':       { ops: [{ chooseDamage: { max: 100, step: 10, recoil: true } }] } },
  '063': { 'Liquidation':     { ops: [{ liquidation: { count: 3, types: ['fire', 'fighting', 'dragon'], otherwise: 20 } }] },
           'Psyonic':         { ops: [{ pre: true, flip: 1, flipper: 'opponent', tails: [{ forceSwitch: true }] }] } },
  '064': { 'Rascal':          { ops: [{ stealEquip: true }] } },
  '065': { 'Sharpen Claws':   { ops: [{ buffSelf: 10, lasts: 'forever' }] },
           'Scavenge':        { ops: [{ draw: 1 }] } },
  '066': { 'Life Cycle':      { ability: 'passive', tag: 'grassEvolvesSameTurn' },
           'Molt':            { ops: [{ heal: 10, who: 'self' }] } },
  '067': { 'Fluttershine':    { ability: 'passive', tag: 'fluttershine' },
           'Rainbow Sting':   { ops: [{ status: 'poisoned', doubling: 10 }] } },
  // ---- the newer cards ----
  '059': { 'Ice Spear':       { ops: [{ flip: 1, heads: [{ status: 'frozen' }] }] } },
  '060': { 'Frostbite':       { ability: 'passive', tag: 'frostbite' },
           'Frostpincer':     { ops: [{ flip: 1, heads: [{ status: 'frozen' }], tails: [{ status: 'poisoned' }] }] } },
  '068': { 'Lightning Rod':   { ability: 'passive', tag: 'redirectElectric' },
           'Voltage Surge':   { ops: [{ moveEnergy: 1, from: 'self', to: 'target', type: 'electric' }, { moveEnergy: 1, from: 'self', to: 'own_bench', type: 'electric' }] } },
  '069': { 'Hydraulic Press': { ability: 'activated', oncePerTurn: false, ops: [{ hydraulic: true }] } },
  '070': { 'Co-opt':          { ability: 'activated', oncePerTurn: true, ops: [{ moveEnergy: 1, from: 'any_other', to: 'self', names: MUSHROOMS }] },
           'Head Tilt':       { ops: [{ copyAnyAttack: 6 }] } },
  '071': { 'Phase Through':   { ops: [{ optional: 'Return Alfay to the bench?', ops: [{ retreatSelf: true }] }] },
           'Steel Cage':      { ops: [{ roll: 6, min: 4, then: [{ cantRetreat: true }] }] } },
  '072': { 'Starfall':        { ability: 'enterPlay', ops: [{ weather: 'starfall' }] } },
  '073': { 'Pitter-Patter':   { ops: [{ flip: 1, tails: [{ status: 'quaked' }] }] },
           'Steady Claws':    { ops: [{ shield: 10, lasts: 'nextTurn' }] } },
  '074': { 'Pounce':          { ops: [{ pre: true, flip: 1, tails: [{ retarget: 'enemy_bench' }] }] },
           'Raging Fang':     { ops: [{ flip: 1, heads: [{ flinch: true }] }] } },
  '075': { 'Talon Pluck':     { ops: [{ stealEnergy: 1 }, { healByDealt: true }] },
           'Frill Fluster':   { ops: [{ discardEnergy: 1, from: 'self' }, { buffSelf: 20, lasts: 'myNextTurn' }] } },
  '076': { 'Immovable':       { ops: [{ shieldRoll: { sides: 6, mult: 10 } }] } },
  '077': { 'Rock Garden':     { ops: [{ addEnergy: 'ground', to: 'target' }] },
           'Calming Focus':   { ops: [{ splashBench: 10 }] } },
  '078': { 'Levitate Stone':  { ops: [{ stones: 20 }] },
           'Beam Me Up':      { ops: [{ retreatSelf: { ofType: 'ground' } }] } },
  '079': { 'Ice Eggs':        { ability: 'passive', tag: 'iceEggs' },
           'Sssss':           { ops: [{ roll: 3, min: 3, then: [{ status: 'frozen' }] }] } },
  '080': { 'Brumate':         { ability: 'activated', oncePerTurn: true, ops: [{ heal: 50, who: 'self', damagedOnly: true }, { lockTurn: true }] },
           'Frostglass':      { ops: [{ retaliate: { status: 'frozen' } }] } },
  '081': { 'Flash Freeze':    { ops: [{ flashFreeze: true }] },
           'Scareglare':      { ops: [{ ifWeather: 'hailstorm', then: [{ status: 'frozen' }] }] } },
  '082': { 'Reorganise':      { ops: [{ swapEnemyEnergy: true }] },
           'Tail Lasso':      { ops: [{ noEnergy: true, on: 'enemy_any' }] } },
  '083': { 'Xìqǔ':            { ops: [{ status: 'asleep' }] },
           'Chǒu':            { needsTargetStatus: 'asleep' } },
  '084': { 'Wǔtái':           { ops: [{ dragBenchSlot: true }] },
           'Dǎoyǎn':          { ops: [{ disableMove: true }] } },
  '085': { 'Quake Tackle':    { ops: [{ status: 'quaked' }] },
           'Denticle':        { ops: [{ roll: 3, times: { damage: 10 }, replaceBase: true }] } },
  '086': { 'Chum Slam':       { ops: [{ status: 'quaked' }] },
           'Apex Uppercut':   { ops: [{ roll: 3, min: 3, then: [{ flinch: true }] }] } },
  '087': { 'Detect':          { ops: [{ reveal: 3 }, { discardEnergy: 1, from: 'self', type: 'dragon' }] },
           'Dragon Pulse':    { ops: [{ flipUntilTails: true, perHeads: { damage: 30 }, replaceBase: true }] } },
  '088': { 'Barbed Coil':     { ops: [{ barbed: true }] },
           'Metal Chomp':     { ops: [{ roll: 6, min: 5, then: [{ status: 'taunted' }] }] } },
  '089': { 'Ground Dasher':   { ability: 'passive', tag: 'groundAbsorb' },
           'Steel Cable':     { ops: [{ discardEnergy: 2, from: 'self', type: 'steel' }] } },
  '090': { 'Dark Pulse':      { ability: 'passive', tag: 'darkPulse' },
           'Tail Slap':       { ops: [{ roll: 6, times: { damage: 10 }, replaceBase: true }] } },
  '091': { 'Delusion':        { ops: [{ delusion: true }] } },
  '092': { 'Abyssal Flame':   { ops: [{ cantRetreat: true }, { discardZoneEnergy: 4, side: 'enemy', types: ['grass', 'ice'] }] },
           'Hellfire':        { ability: 'passive', tag: 'hellfire' } },
  '093': { 'Ion Charge':      { ability: 'passive', tag: 'ionCharge' },
           'Glaciabolt':      { ops: [{ weather: 'frost' }] } },
  '094': { 'Spore Bloom':     { ops: [{ sporeBloom: { damage: 60, heal: 60 } }] } },
  '095': { 'Master of All Elements': { ability: 'passive', tag: 'fiveTypesToEvolve' },
           'Celestial Bodies': { ability: 'activated', oncePerTurn: true,
                                 ops: [{ amplify: { heads: ['fire', 'electric', 'ground', 'fighting'], tails: ['ice', 'water', 'dark', 'steel'], amount: 20 } }] } },
  '096': { 'Purify':          { ability: 'activated', oncePerTurn: true, ops: [{ purify: true }] } },
  '099': { 'Secret Frequency': { ability: 'activated', oncePerTurn: true, ops: [{ bothDraw: 1 }] } },
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
  '104': { equip: 'blocksAttack' },
  '105': { equip: 'burnsAttackers' },
  '106': { ops: [{ heal: 50, who: 'own_any' }] },
  '107': { ops: [{ newHand: 3 }] },
  '108': { equip: 'extraEnergy' },
  '109': { equip: 'blocksWeakness' },
  '110': { equip: 'sleepHeals40', approx: 'heals whenever asleep, whoever caused it' },
  '111': { equip: 'humidifier' },
  '112': { equip: 'notepad' },
  '113': { ops: [{ moveAllEnergy: true }], approx: 'moves ALL the energy, not "as much as you like"' },
  '114': { ops: [{ reshuffleDiscard: true }] },
  '115': { ops: [{ evolveFreelyThisTurn: true }] },
  '116': { ops: [{ transmute: true }] },
  '117': { ops: [{ removeEnemyEquip: true }] },
  '118': { ops: [{ digForEvolution: { penaltyOver: 6, discard: 5 } }] },
  '119': { ops: [{ cure: 'all', who: 'any', activeOnly: true, withStatus: 'any' }] },
  '120': { ops: [{ drawUntilBasic: true }] },
};
