/* ============================================================
   JOBS — how a kid earns pocket money.
   ============================================================
   A job is offered by whoever lists its id under `job:` (an NPC
   in data/npcs.js, or a place in data/maps.js).

   Every job has:
     name          what the menu calls it
     type          'shift'     time passes, you get paid          ← works
                   'delivery'  carry something to another NPC     ← works
                   'minigame'  STUB. Behaves like a shift for now.
     pay           money earned
     availableIf   conditions (data/story.js). Leave out for "always".
     unavailable   what the menu says when it isn't available
     perDay        how many times a day it can be done (default 1)
     offer         what they say when you ask
     done          what they say when it's finished

   shift / minigame also have:
     minutes       how long it takes
     workText      shown on the dark screen while time passes

   delivery also has:
     item          an id for the thing you carry
     itemName      what the game calls it
     deliverTo     the NPC id who receives it
     received      what THEY say when you hand it over
     Undelivered items are thrown away overnight.

   SHORTCUT: a shift can run past bedtime. If it does, you simply
   collapse the moment it ends. Good enough until it isn't.
   ============================================================ */

const JOBS = {

  bakery_shift: {
    name: 'Help in the bakery',
    type: 'shift',
    minutes: 120,
    pay: 3,
    availableIf: ['hour<11'],
    unavailable: "\"Too late for today. The dough waits for nobody. Come before eleven.\"",
    offer: "\"Two hours shaping rolls. Three {moneyname}, and whatever breaks.\"",
    workText: "Flour to the elbows. The rolls come out lopsided, then less lopsided.",
    done: "\"Not bad. Here. And take the broken one.\"",
  },

  lighthouse_delivery: {
    name: 'Take a loaf to the lighthouse',
    type: 'delivery',
    pay: 2,
    availableIf: ['hour<14'],
    unavailable: "\"He'll have eaten by now. Tomorrow.\"",
    item: 'loaf',
    itemName: 'a warm loaf',
    deliverTo: 'keeper',
    offer: "\"The keeper won't come down for his bread. Take it up to him? Two {moneyname}.\"",
    done: "She tucks a loaf, still warm, under your arm. \"Straight there. No detours.\"",
    received: "\"From Oyo? Still warm. You ran.\" He counts out two {moneyname}.",
  },

  sweep_shop: {
    name: 'Sweep the shop',
    type: 'shift',
    minutes: 60,
    pay: 1,
    availableIf: ['hour>=16'],
    unavailable: "\"Floor's fine till closing. Come back after four.\"",
    offer: "\"Sweep up before I close and there's a {moneyone} in it. One. Singular.\"",
    workText: "Dice under the tables. A card sleeve. Somebody's gum.",
    done: "\"Spotless. Near enough.\"",
  },

  // STUB: meant to become a small game (stack crates? count cargo?).
  // For now it's a shift, so the money side of it already works.
  unload_boat: {
    name: 'Help unload the boat',
    type: 'minigame',
    minutes: 90,
    pay: 4,
    availableIf: ['hour<12'],
    unavailable: "\"Hold's empty, kid. You missed it.\"",
    offer: "\"Crates won't carry themselves. Four {moneyname} if you don't drop any.\"",
    workText: "The crates are heavier than they look. Everything smells like rope.",
    done: "\"Didn't drop a one. Here.\"",
  },

};
