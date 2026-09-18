/* ============================================================
   STORY — flags, conditions and events. The narrative spine.
   ============================================================

   FLAGS are things the game remembers being true: 'met_megan',
   'opened_first_pack'. A flag is just a name. It doesn't exist
   until something sets it, and you never have to declare it
   anywhere. Dialogue sets them with  set: ['name'].

   CONDITIONS are little sentences the game can check. They're
   used everywhere: `if`, `availableIf`, `openIf`, `presentIf`,
   `showIf`. A single condition is a string; a list of them means
   ALL must be true.

       'flag:met_megan'      that flag is set
       '!flag:met_megan'     a leading ! flips ANY condition
       'day:Thu'             today is Thursday
       'day:Tue,Sat'         today is Tuesday OR Saturday
       'time:morning'        morning | afternoon | evening | night
       'hour>=9'             numbers: hour, money, daynum, week,
       'money<5'               cards (different cards owned),
       'cards>=20'             total (all copies)
                             with  >=  <=  >  <  =
       'has:004'             you own card 004
       'dupe:004'            you own more than one
       'carrying:loaf'       you're holding that delivery item
       'jobdone:sweep_shop'  that job was done today
       'stock:tidepool'      that shop has anything left to sell

   If you type one the game doesn't understand, it says so in the
   red box at the top of the page rather than failing silently.

   EVENTS are moments that play by themselves when something
   happens (`on`) and their conditions (`if`) are true.

       on: 'newgame'         right after starting a new game
           'daystart'        each morning, after waking
           'enter:shop'      on walking into that map
           'pack_opened'     after closing the pack screen
           'trade_done'      after any trade
           'job_done'        after being paid for any job

       once   true → never plays again (this is the usual case)
       name   who is speaking. Leave '' for narration.
       lines  what's said
       set    flags to switch on afterwards
       give   { money: 1 } or { card: '004' }

   Only one event plays per trigger: the first one in the list that
   qualifies. Order the list from most specific to most general.

   EVERYTHING BELOW IS PLACEHOLDER WRITING.
   ============================================================ */

const EVENTS = [

  { id: 'intro', on: 'newgame', once: true, name: '',
    lines: [
      "Summer. The whole of it, stretched out ahead like the sea.",
      "Under your pillow: three Bakemon cards. In your pocket: one {moneyone}.",
      "A booster pack at Tidepool Games costs five. The boat brings new ones every Thursday.",
    ],
    set: ['intro_done'] },

  { id: 'first_thursday', on: 'daystart', if: 'day:Thu', once: true, name: '',
    lines: ["Thursday. You were awake before the gulls."] },

  { id: 'sailor_in', on: 'daystart', if: 'day:Tue,Sat', name: '',
    lines: ["From the window: a sail, down by the dock."] },

  { id: 'first_shop_visit', on: 'enter:shop', once: true, name: '',
    lines: ["It smells like cardboard and floor polish. It's the best smell on the island."] },

  { id: 'first_pack', on: 'pack_opened', once: true, name: '',
    lines: ["You put the wrapper in your pocket. You're keeping the wrapper."],
    set: ['opened_first_pack'] },

  { id: 'first_trade', on: 'trade_done', once: true, name: '',
    lines: ["A trade. A real one. You check the card twice on the way home to make sure it's still real."],
    set: ['made_first_trade'] },

  // STUB: a longer thread to hang things from. What happens when the list on
  // the desk is nearly finished? Who else is collecting? What's in the lighthouse?
];
