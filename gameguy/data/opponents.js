/* ============================================================
   OPPONENTS — who you can play cards against, and with what.
   ============================================================
   Give an NPC (data/npcs.js) or a place (data/maps.js) the line
       battle: 'megan'
   and "Play cards" appears in their menu.

     name       shown across the table
     deck       a list of card ids. Must be a legal deck (the red box checks):
                10 to 32 cards, at least one basic, at most 3 of any card.
     points     knock-outs needed to win. The real game plays to 4; kids'
                decks are small, so island matches default to fewer.
     style      { mistakes: 0.3 }  how often they pick an attack at random
                instead of their best one. 0 is ruthless, 1 is a toddler.
     minutes    how much of the day a match takes
     intro / ifYouWin / ifYouLose     what they say
     reward     { money: 2 }  and/or  { card: '004' }   given the FIRST time you beat them
     playIf     conditions (data/story.js) for them to be willing at all

   After any match the story event 'battle_won' or 'battle_lost' fires, and
   the flag  beat_<id>  is set on a win, so dialogue can react to it.

   ALL DECKS AND LINES HERE ARE PLACEHOLDERS.
   ============================================================ */

const OPPONENTS = {

  megan: {
    name: 'Megan',
    deck: ['004', '004', '005', '030', '030', '061', '061', '032', '032', '101', '101', '102'],
    points: 3,
    style: { mistakes: 0.3 },
    minutes: 40,
    intro: "\"Best of one. No crying.\"",
    ifYouWin: "\"Okay. OKAY. Again tomorrow.\"",
    ifYouLose: "\"Ha! You nearly had me, though.\"",
    reward: { money: 1 },
  },

  kid1: {
    name: 'Dockside Kid',
    deck: ['017', '017', '018', '025', '025', '026', '007', '007', '008', '043', '101', '105'],
    points: 3,
    style: { mistakes: 0.35 },
    minutes: 40,
    intro: "\"Fire beats everything. Watch.\"",
    ifYouWin: "\"...Water's cheating.\"",
    ifYouLose: "\"Told you.\"",
  },

  shop_regular: {
    name: 'Shop Regular',
    deck: ['010', '010', '011', '012', '021', '021', '022', '027', '027', '028', '016', '102', '102', '106', '104', '119'],
    points: 3,
    style: { mistakes: 0.15 },
    minutes: 50,
    intro: "A regular looks up from sleeving a deck. \"You play? Sit.\"",
    ifYouWin: "\"Huh. Good game, kid.\"",
    ifYouLose: "\"You'll get there. Build around your energy.\"",
    reward: { money: 2 },
  },

  sailor: {
    name: 'Sailor',
    deck: ['035', '035', '036', '037', '046', '046', '047', '013', '013', '014', '016', '016', '102', '106', '103', '117'],
    points: 4,
    style: { mistakes: 0.05 },
    minutes: 60,
    playIf: 'cards>=15',
    intro: "\"I've played this in nine ports. Don't feel bad.\"",
    ifYouWin: "He's quiet for a while. \"...Where did you learn that?\"",
    ifYouLose: "\"Nine ports, kid.\"",
    reward: { card: '046' },
  },

};
