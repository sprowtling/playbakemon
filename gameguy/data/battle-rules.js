/* ============================================================
   BATTLE RULES — the knobs for the card game itself.
   ============================================================
   The rules page on the playmat site describes a tabletop game
   that PEOPLE referee. A computer opponent needs every gap filled
   in. Where the rules page was silent I picked the most ordinary
   answer and put it here as a knob, marked ASSUMED. If I guessed
   wrong, change the knob, not the engine.
   ============================================================ */

const BATTLE_RULES = {
  handSize: 5,             // cards drawn at the start
  benchSize: 3,            // same as the playmat
  pointsToWin: 4,          // an opponent in data/opponents.js can ask for fewer
  copiesMax: 3,            // copies of one card in a deck

  // The real game uses 32-card decks. A kid with a shoebox can't build one
  // for a long time, so island matches accept anything in this range.
  deckMin: 10,
  deckMax: 32,

  weaknessBonus: 10,       // extra damage per matching energy symbol in the attack's cost

  energyPerTurn: 1,
  retreatsPerTurn: 1,          // ASSUMED
  firstPlayerCanAttack: true,  // ASSUMED: the player who goes first may attack on turn one
  evolveClearsStatus: true,    // ASSUMED
  noBakemonLeftLoses: true,    // ASSUMED: if your active is KO'd and your bench is empty, you lose
  // The rules page says the discard pile is reshuffled once your deck AND hand are
  // empty. With `false`, an empty deck is enough (kinder with small island decks).
  reshuffleNeedsEmptyHand: false,
  turnLimit: 120,              // a safety net. If a match somehow runs this long it's called a draw.

  // How long each line of the match commentary stays up, in seconds. E skips ahead.
  messageSeconds: 0.85,

  burnDamage: 10,
  poisonDamage: 20,
  frozenDamage: 10,
  enragedBonus: 20,
};

// The ten energy types and their colours, copied from the playmat.
// There is no "normal" ENERGY: a cost of "2normal" means "any two energy".
const ENERGY_COLORS = {
  fighting: '#965d48', grass: '#97c267', fire: '#e0602d', water: '#63a6e6', dark: '#3c697a',
  psychic: '#a56dad', steel: '#aaa7ab', electric: '#e8d331', dragon: '#ad9142', fairy: '#eb90f0',
};

// Spellings in the card database that mean the same thing.
const ENERGY_ALIASES = { lightning: 'electric' };
