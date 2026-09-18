/* ============================================================
   SHOPS, PACKS and RARITY
   ============================================================ */

/* ---- Rarity -------------------------------------------------
   The real card list has no rarity column, so the island decides.
   The rule of thumb: the further along an evolution line, the
   rarer. Anything listed in RARITY_OVERRIDES ignores the rule.

   SHORTCUT: this is a guess at what feels right, not a design
   decision you made. If rarity becomes a real column on the
   playmat site, delete all of this and read it from the card.
   ------------------------------------------------------------- */
const RARITY_BY_STAGE = {
  'basic':     'common',
  'stage one': 'uncommon',
  'stage two': 'rare',
};
const RARITY_BY_ITEM_KIND = {
  'consumable': 'common',
  'equip':      'uncommon',
};
const RARITY_OVERRIDES = {
  // '050': 'uncommon',   // example: make Mugini harder to find
};

/* ---- Packs --------------------------------------------------
   A pack is a list of SLOTS. Each slot says how many cards to
   pull and how rare they are. A slot with `odds` rolls a die:
   { rare: 0.25, uncommon: 0.75 } is a rare one time in four.

   `exclude` lists card ids that never appear in this pack (a
   card you want to be trade-only, or a story reward).
   ------------------------------------------------------------- */
const PACKS = {
  booster: {
    name: 'Bakemon Booster',
    color: '#2f8f83',           // the wrapper colour on the pack-opening screen
    slots: [
      { count: 3, odds: { rare: 0.25, uncommon: 0.75 } },
    ],
    exclude: [],
  },
  // PLACEHOLDER: a second product to prove the shop can sell more than one thing.
  // Not stocked anywhere yet. Add it to a shop's `products` to sell it.
  starter: {
    name: 'Starter Bundle',
    color: '#c9763e',
    slots: [ { count: 8, rarity: 'common' }, { count: 2, rarity: 'uncommon' } ],
    exclude: [],
  },
};

/* ---- Shops --------------------------------------------------
   restockDay         new stock arrives the morning of this day
   restockTo          ...and the shelf is filled back up to this many
   startStock         how many are on the shelf on day 1
   otherKidsBuy       every night, this many sell to kids who aren't you.
                      This is what makes Thursday matter: wait too long
                      and they're gone. Set it to 0 to switch that off.
   ------------------------------------------------------------- */
const SHOPS = {
  tidepool: {
    name: 'Tidepool Games',
    restockDay: 'Thu',
    products: [
      { pack: 'booster', price: 5, startStock: 1, restockTo: 6, otherKidsBuy: 1 },
    ],
    soldOutLine: "\"All gone. Boat's in Thursday. Same as always.\"",
  },
};
