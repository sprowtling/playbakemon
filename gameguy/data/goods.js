/* ============================================================
   GOODS and ACTIVITIES — things to carry, and things to do.
   ============================================================

   GOODS are everything that can sit in the backpack.
     name, desc
     sprite     a name from SPRITES (data/tiles.js). Item pictures live in art/items.png.
     tool       true → you only ever need one; shops won't sell you a second
     sell       what Island Finds pays for one. Leave out for "can't be sold".

   (Bakemon CARDS are not goods. They live in the shoebox. And the loaf from
   Mrs. Oyo's delivery job is its own small thing in data/jobs.js.)

   ACTIVITIES are what tools DO. Press F to use whichever tool fits where
   you're standing.
     name       shown in the little "F  Dig" prompt
     tool       the goods id you need to own
     on         which map LETTERS it works on (from the legend in data/tiles.js)
     where      'standing' → the tile under your feet.  'facing' → the tile ahead of you
     bait       (optional) a goods id used up by each attempt
     noBait     what the game says when you're out
     minutes    how much of the day one attempt takes. THIS is the real price:
                an afternoon spent digging is an afternoon not spent at the bakery.
     oncePerSpot  true → each tile only works once a day (and shows a `marks` sprite after)
     text       shown on the dark screen while time passes
     finds      the loot table. Each entry has a `weight`: an entry with weight 4
                comes up twice as often as one with weight 2. An entry gives ONE of
                  item: 'oyster'        money: [1, 3]  (a random amount in that range)
                  card: 'common'        a random Bakemon card of that rarity
                  nothing: true
                and a `line` to say.
     findsIn    (optional) a different loot table for particular maps:
                  findsIn: { island_nw: [ ...pond fish... ] }
                SHORTCUT: it goes by MAP, not by which water. Fishing off the north
                coast of The Woods also gets pond fish. To fix that properly, give the
                pond its own letter in the outdoor legend and its own activity.

   STUB: every attempt is a dice roll. Fishing wants to be a little timing
   game one day. When it is, it replaces the dice in doActivity() in
   js/actions.js, and everything in this file stays as it is.

   ALL NAMES, PRICES AND ODDS ARE PLACEHOLDERS.
   ============================================================ */

const GOODS = {
  shovel:     { name: 'Shovel',        sprite: 'shovel', tool: true, desc: 'For digging in sand. Press F on a beach.' },
  rod:        { name: 'Fishing pole',  sprite: 'rod',    tool: true, desc: 'Face the water and press F. Needs worms.' },
  worm:       { name: 'Worm',          sprite: 'worm',       sell: 0, desc: 'Bait. Fish like them more than you do.' },
  oyster:     { name: 'Oyster',        sprite: 'oyster',     sell: 1, desc: 'Closed tight. Island Finds buys these.' },
  shell:      { name: 'Pretty shell',  sprite: 'shell',      sell: 1, desc: 'You can hear the sea in it. You can also just hear the sea.' },
  pearl:      { name: 'Pearl',         sprite: 'pearl',      sell: 8, desc: 'A real one. Probably.' },
  old_coin:   { name: 'Old coin',      sprite: 'old_coin',   sell: 4, desc: "Nobody's face you recognise." },
  bottle:     { name: 'Bottle',        sprite: 'bottle',     sell: 1, desc: 'No message. You checked twice.' },
  boot:       { name: 'Boot',          sprite: 'boot',       sell: 0, desc: 'Just the one.' },
  fish_small: { name: 'Small fish',    sprite: 'fish_small', sell: 2, desc: 'Dinner-sized, if dinner is small.' },
  fish_big:   { name: 'Big fish',      sprite: 'fish_big',   sell: 5, desc: "It was THIS big. Here it is, so they'll have to believe you." },
};

const ACTIVITIES = {

  dig: {
    name: 'Dig',
    tool: 'shovel',
    on: ['s'], where: 'standing',
    minutes: 10,
    oncePerSpot: true, marks: 'dug_hole',
    text: 'Dig diggy dig!',
    finds: [
      { weight: 6, nothing: true,      line: 'Sand. Then wetter sand.' },
      { weight: 3, item: 'worm',       line: 'A worm! It is not pleased.' },
      { weight: 3, item: 'shell',      line: 'A shell, whole, with no chips.' },
      { weight: 3, item: 'oyster',     line: 'An oyster, shut like a fist.' },
      { weight: 2, money: [5, 10],      line: "Loose change! Somebody's pocket had a hole in it." },
      { weight: 1, item: 'bottle',     line: 'A bottle. Empty.' },
      { weight: 0.6, item: 'old_coin', line: "A coin, green with age. It isn't island money." },
      { weight: 0.4, card: 'common',   line: 'A Bakemon card?! Soggy and bent, but still counts.' },
    ],
  },

  fish_ocean: {
    name: 'Fish',
    tool: 'rod',
    on: ['~'], where: 'facing',
    bait: 'oyster', noBait: "No bait. Grandpa used to say that oysters made the cod bite.",
    minutes: 20,
    text: 'The bobber floats. You wait. You start daydreaming about Bakemon.',
    finds: [
      { weight: 5, nothing: true,       line: 'Something took the worm and left.' },
      { weight: 5, item: 'fish_small',  line: 'A fish! A small one. A fish, though.' },
      { weight: 2, item: 'fish_big',    line: 'The pole bends double. You land it anyway.' },
      { weight: 1, item: 'boot',        line: 'A boot. Of course.' },
      { weight: 0.3, item: 'pearl',     line: "An oyster on the hook, and inside it... that's a pearl." },
    ],
  },
  
  fish_pond: {
    name: 'Fish', 
    tool: 'rod', 
    on: ['P'], where: 'facing',
    bait: 'worm', noBait: "You're out of bait. If the pond eels eat a worm, is it cannibalism?", 
    minutes: 20, 
    text: 'The bobber floats. You wait. You kind of wish you were a fish. ',
    finds: [
      { weight: 3, nothing: true,      line: 'The pond keeps its secrets.' },
      { weight: 7, item: 'fish_small', line: 'Pond fish bite easy.' },
      { weight: 1, item: 'fish_big',   line: "The pond's grandfather, by the look of it." },
    ],
  }

};
