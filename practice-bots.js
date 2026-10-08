/* ============================================================
   PRACTICE BOTS & BORROWABLE DECKS — practice.html reads this file.
   ============================================================
   Everything here is plain data. To add a bot or a deck, copy an
   entry, change it, save, and refresh practice.html.

   CARDS are listed by card number (the "001" on the card), with how
   many copies:  '001': 3  means three Poteplant. The name after //
   is only a reminder for you; the page ignores it.

   A deck should follow the deck rules on the rules page: 32 cards,
   at most 3 of a common/uncommon/rare card, 2 of a double rare, 1 of
   an ultra rare, and only one legendary card in the whole deck.
   Energy isn't a card here (the playmat doesn't use energy cards
   either), so a deck is just Bakemon and items.

   TEXT IN QUOTES: if a line has an apostrophe in it (isn't, I'll),
   wrap it in "double quotes", like the hello lines below. Inside
   'single quotes' the apostrophe ends the text early and the whole
   file stops working.

   If a deck breaks a rule or names a card that doesn't exist, the
   practice page still loads, but it lists the problem in yellow on
   the setup screen so you can fix it.

   BOT fields:
     id          a short unique word, no spaces
     name        shown at the table
     difficulty  any label you like: 'Easy', 'Medium', 'Hard'...
     mistakes    0 to 1. How often the bot picks a random attack instead of
                 its best one. 0 never misplays, 0.5 is very sloppy.
     blurb       one line on the setup screen
     hello / ifYouWin / ifYouLose   what the bot says
     cards       the deck
   ============================================================ */

const PRACTICE_BOTS = [

  {
    id: 'pip',
    name: 'Pip',
    difficulty: 'Easy',
    mistakes: 0.45,
    blurb: 'Garden variety Bakemon. Slow, sturdy, and easily distracted.',
    hello: "Oh, hi! I just learned how to play. Be nice?",
    ifYouWin: "Good game! Can we play again after I water my plants?",
    ifYouLose: "I WON??!",
    cards: {
      '001': 3,  // Poteplant
      '002': 3,  // Vasflor
      '003': 2,  // Raizado
      '048': 3,  // Envelawn
      '049': 2,  // Constricturf
      '066': 1,  // Grupix
      '067': 1,  // Gossiary
      '101': 3,  // Band-aid
      '106': 2,  // Nectar
      '102': 3,  // Bill
      '090': 2, // Lemurk
      '082': 1, // Silooper
      '031': 1, // Growlbud
      '109': 1, // Helmet
      '116': 1, // Elemental Drift
      '110': 2, // Sleeping Bag
      '016': 1, // Pentawunk 
       
    },
  },

  {
    id: 'cinder',
    name: 'Cinder',
    difficulty: 'Medium',
    mistakes: 0.2,
    blurb: 'All fire, all the time. Burninating the whole town.',
    hello: "Hope you brought water... for your sake. You know, in case you get thirsty.",
    ifYouWin: "Erm... uhh... I let you win!",
    ifYouLose: "Burned to a crisp. Better luck next time!",
    cards: {
      '017': 3,  // Kidding
      '018': 3,  // Pyroat
      '019': 2,  // Flairees
      '007': 3,  // Quetzalil
      '008': 2,  // Quexcell
      '009': 1,  // Quetzillian
      '025': 3,  // Shrizzle
      '026': 2,  // Lobscorch
      '043': 2,  // Sizzolt
      '044': 2,  // Crackazolt
      '105': 2,  // Torch
      '108': 2,  // Power Cable
      '102': 2,  // Bill
      '101': 2,  // Band-aid
      '103': 1,  // Dinner Bell
    },
  },

  {
    id: 'brine',
    name: 'Brine',
    difficulty: 'Medium',
    mistakes: 0.25,
    blurb: "Water and ice. Wait, ice is also water, isn't it?",
    hello: "Ready for the tide to come in?",
    ifYouWin: "Well played. The tide was with you today.",
    ifYouLose: "Washed away. Happens to everyone.",
    cards: {
      '004': 3,  // Leapod
      '005': 2,  // Leapol
      '061': 3,  // Porsite
      '062': 2,  // Cettoekko
      '063': 1,  // Bathygigas
      '059': 3,  // Iceopod
      '060': 2,  // Sleetle
      '030': 2,  // Whave
      '021': 2,  // Aquimp
      '022': 1,  // Draquaduct
      '025': 2,  // Shrizzle
      '111': 2,  // Humidifier
      '106': 2,  // Nectar
      '102': 3,  // Bill
      '103': 2,  // Dinner Bell
    },
  },

  {
    id: 'nyx',
    name: 'Nyx',
    difficulty: 'Hard',
    mistakes: 0,
    blurb: 'A powerful dark and psychic challenge.',
    hello: "glhf i guess.",
    ifYouWin: "...bkmn diff.",
    ifYouLose: "hahahaha ggz",
    cards: {
      '013': 3,  // Shadopillar
      '014': 3,  // Phantoplume
      '015': 2,  // Ravenoth
      '046': 3,  // Glumwyrm
      '047': 2,  // Gloomgoyle
      '027': 2,  // Biropod
      '028': 2,  // Blackbrish
      '029': 1,  // Orcuill
      '090': 2,  // Lemurk
      '092': 1,  // Pyrdyr (legendary: only one legendary per deck)
      '102': 3,  // Bill
      '106': 2,  // Nectar
      '108': 2,  // Power Cable
      '104': 2,  // Brigitte
      '117': 1,  // Power Wash
      '120': 1,  // Lyza
    },
  },

];


/* ---- Decks you can borrow ----------------------------------
   Same idea as the bots' decks, for players who want to try cards
   they don't own. Fields: id, name, blurb, cards.
   ------------------------------------------------------------- */

const BORROW_DECKS = [

  {
    id: 'spark',
    name: "Sparky's Pack",
    blurb: 'Electric attackers that power each other up.',
    cards: {
      '010': 3,  // Paravolt
      '011': 3,  // Sparkeet
      '012': 2,  // Amptiel
      '068': 3,  // Bulbark
      '069': 2,  // Current
      '020': 3,  // Torshock
      '050': 3,  // Mugini
      '051': 2,  // Deserzoa
      '108': 2,  // Power Cable
      '102': 3,  // Bill
      '101': 3,  // Band-aid
      '103': 2,  // Dinner Bell
      '120': 1,  // Lyza
    },
  },

];
