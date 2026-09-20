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
    pay: 50,
    availableIf: ['hour<10'],
    unavailable: "\"The dough was rising while you were still sleeping. Come earlier next time.\"",
    offer: "\"Two hours shaping rolls. Three {moneyname}, and whatever breaks.\"",
    workText: "Flour to the elbows. The rolls come out lopsided, then less lopsided.",
    done: "\"Not bad. Here. And take the broken one.\"",
  },

  lighthouse_delivery: {
    name: 'Take a loaf to the lighthouse',
    type: 'delivery',
    pay: 20,
    availableIf: ['hour<14'],
    unavailable: "\"He'll have eaten by now. Tomorrow.\"",
    item: 'loaf',
    itemName: 'a warm loaf',
    deliverTo: 'keeper',
    offer: "\"Nikau won't come down for his bread. Want to run it up to him?.\"",
    done: "She tucks a loaf, still warm, under your arm. \"Straight there. No detours.\"",
    received: "\"From Ruiha? Ahhh, stil warm.\" He counts out twenty {moneyname}.",
  },

  sweep_shop: {
    name: 'Sweep the shop',
    type: 'shift',
    minutes: 60,
    pay: 10,
    availableIf: ['hour>=16'],
    unavailable: "\"Floor's fine till closing. Come back after four.\"",
    offer: "\"Sweep up before I close and there's a few jenni in it.\"",
    workText: "Dice under the tables. A card sleeve. Somebody's gum.",
    done: "\"Spotless. Near enough.\"",
  },
  
  pick_weeds: {
    name: 'Weed the Garden',
    type: 'shift',
    minutes: '75',
    pay: 50,
    availableIf: ['day:Sat'],
    unavailable: "\"The garden's looking good. No need to be trampling on the flowers.\"",
    offer: "\"Save my old knuckles a bit of work and pull the weeds, would you?\"",
    workText: "Even your little fingers start to get sore from pulling out these tiny green buds. Oops, that one was a flower!",
    done: "\"I'll take this flower home for mom.\""
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
