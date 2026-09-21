/* ============================================================
   SHOPS, PACKS and RARITY
   ============================================================ */

/* ---- Rarity -------------------------------------------------
   A card's rarity comes straight from the database (the `rarity`
   column, 1-5), by way of data/cards.js. rarityOf() in js/state.js
   is what reads it — this file no longer decides rarity itself.

   Any card still missing a rarity in the database — a card you're
   mid-way through designing — falls back to RARITY_FALLBACK below,
   so packs and trades never choke on an incomplete card. Once you
   fill in its rarity on the playmat and re-export, it uses that.
   ------------------------------------------------------------- */
const RARITY_FALLBACK = 'ultra rare';

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
      { count: 3, odds: { 'ultra rare': 0.02, 'double rare': 0.08 , rare: 0.1, uncommon: 0.3, common: 0.5 } },
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

   A product is EITHER  { pack: 'booster', ... }  (cards, data above)
                 OR     { item: 'shovel', ... }   (goods, data/goods.js)
   Leave out startStock / restockTo and it never runs out.

   buys: true         this shop will buy anything in data/goods.js that has
                      a `sell` price above 0.
   ------------------------------------------------------------- */
const SHOPS = {
  tidepool: {
    name: 'Tidepool Games',
    restockDay: 'Thu',
    products: [
      { pack: 'booster', price: 800, startStock: 1, restockTo: 4, otherKidsBuy: 1 },
    ],
    soldOutLine: "\"All gone. Boat's in Thursday. Same as always.\"",
  },

  // PLACEHOLDER shop: name, prices, stock.
  island_finds: {
    name: 'Island Finds',
    products: [
      { item: 'shovel', price: 1200 },
      { item: 'rod',    price: 2000 },
      { item: 'worm',   price: 5 },          // for the impatient. Digging them up is free.
    ],
    buys: true,
    soldOutLine: "\"Fresh out. Try me next week.\"",
  },
};
