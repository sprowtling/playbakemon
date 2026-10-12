when your cron job wakes you every 24 hours, please check the feedback table in the bakemon supabase. if there are new bug fix items there, please look into fixing them, if possible. if the feedback is not bug related, and is instead suggestion related or soemthing else, please notify me inside the terminal.

once you've addressed any new feedback, change its status from "new" to either "pending" or "complete".

if there is no feedback when you wake, enjoy your time hwoever you'd like to! see /clodtime/claude.md for more.

---

# update log

## 2026-10-09
- **Leapod's Hide now lasts through the opponent's next turn** (feedback 13c131ea). The engine had it as "block the next hit, whenever that comes", so Leapod could sit guarded forever. Now it blocks all damage during the opponent's next turn, then wears off, which is what the printed card says. `gameguy/data/moves.js`, plus a test in `gameguy/tools/test-moves.js`. The card text stored in Supabase and `cards.js` still reads "Avoid next incoming damage." and needs the printed wording.
- Torshock's HP (feedback 9116372a): left for the owner, who is restoring the HP values that were reverted in Supabase.

## 2026-10-11
Eight reports from one long practice match against Nyx. Checked each against the printed cards.
- **Musherus's Networking now reaches Mushmutt** (feedback 5daf6fee). Its list of mushroom-based Bakemon was missing Mushmutt and Iveldyr. Now it uses the same list as Co-opt. `gameguy/data/moves.js`.
- **Shimejirus heals only the HP the poisoned Bakemon actually lost** (b7974397). Poison for 80 on a Bakemon with 70 left heals 70, not 80. `gameguy/js/battle.js`.
- **A Bakemon that steps in can attack** (a6cdd820). When the active Bakemon failed its sleep, paralysis or freeze flip, or flinched, attacking was switched off for the whole turn. Swapping in a new one with Dinner Bell or a retreat left the new one unable to attack. Now the block belongs to the Bakemon that can't attack. `gameguy/js/battle.js`.
- **Ice Spear and Frostpincer cost ice, not water** (e73053dd). The printed cards say ice. Fixed in `gameguy/data/cards.js`. The Supabase `cards` table needs the same change before practice mode picks it up.
- Not changed, because the engine follows the printed card: Grupix's Life Cycle and Gossiary's Fluttershine only work while that Bakemon is **active**, and in both reports it was on the bench (de02bc30, 56dab600). The discard pile reshuffles only once your deck *and* hand are empty, per the rules page (9a0b40b1). Coin flips are a plain 50/50 with nothing rigged (d527077b).
- Tests for all four fixes in `gameguy/tools/test-moves.js` (77 pass). The 200-match simulator runs with 0 crashes.
- Follow-up after talking with the owner: on cards, "active" usually means *in play*, not *in the active slot*. **Grupix's Life Cycle and Gossiary's Fluttershine now work from the bench** (de02bc30, 56dab600). Two Gossiary in play still add +20, not +40. I checked every other ability that mentions "active": Sparkeet, Biropod and Murkitty already worked anywhere in your zone. `gameguy/js/battle.js`.
- **Practice mode reshuffles the discard pile as soon as the deck runs out** (9a0b40b1). In person you can discard any time to get there, but practice mode has no button for that. `practice.html`.
- Tests for both bench abilities (79 pass).

## 2026-10-12
Eight more reports from Cameron, plus a request to check every ice- and ground-type card against its printed version. I compared 20 printed cards with the card data.
- **Ground and ice costs** (f5b9c675, f8264258, 1506847f). These cards were printed with ground or ice symbols, but the data still says fighting or water: Vasflor's Vine Slap, Raizado's Take Root and Solar Powered, Kotora's Ominous Wind, Yukitora's Hailstorm and Cursed Wind, and Mymot's Till and Plow. That's why Vine Slap missed Gloomgoyle's ground weakness. Fixed in `gameguy/data/cards.js`. Supabase needs the same change before practice mode picks it up.
- **Mushmutt is weak to water**, not ice (printed card). `cards.js`, and Supabase needs it too.
- **Raizado's Solar Powered heals 20 on heads**, not 10 (113e6a59). `gameguy/data/moves.js`.
- **Take Root doesn't stack** (4af4d3aa). Using it again refreshes the 30 instead of adding another 30. New `noStack` option on shields. `moves.js`, `battle.js`.
- **Whave** (347430c0): Torrent is 40 and Drown discards two water energy, per the printed card. Drown is now wired in `moves.js`. Torrent's damage and Drown's text come from Supabase, which still has 50 and no text.
- **Mymot**: Plow discards *two ground* energy, not one of any kind. Weak to ice, not fire.
- **Cryodyr's frost freezes on a D3 under three**, not under two (printed card). `battle.js`.
- Not a bug: Poison Spore did 20 because Nyx had Lemurk on the bench, and Lemurk's Dark Pulse adds 10 to every dark attack (69e46260). The run of heads is logged, and it's still a fair coin (d5756d09).
- 5 new tests, plus one frost test updated to the printed rule. 84 pass. The simulator runs with 0 crashes.

Later the same day, from a different session:
- **Boowhomp and Whompwhomp (097, 098) are wired**, the last two cards of Set A. Fluff It Up haunts. Mister Fister does 30 less but confuses if Fluff It Up was Boowhomp's attack on its previous turn (the card text says "Fluff Up"; read as Fluff It Up). Lucky Whomps rolls a D6 after the hit: haunt, target heals 20, confuse, Whompwhomp heals 20, 20 to one of your own Bakemon (you choose; the bot picks its sturdiest), or Whompwhomp falls asleep. New ops `addDamage`, `ifUsedLastTurn`, `hurtOwn`. `gameguy/data/moves.js`, `gameguy/js/battle.js`, `gameguy/js/battle-ai.js`.
- Added both cards to `gameguy/data/cards.js` by inserting just their two lines (not a full re-export, so the hand fixes above stay).
- **Arc can play the practice bots through the MCP** (`bkmn_mcp/practice.js`, new tools `practice_list_bots`, `practice_start`, `practice_look`, `practice_choose`, `practice_undo`, `practice_give_up`). Same engine and bots as practice.html; results go to `practice_matches`.
- Tests: 9 new (Fluff It Up, Mister Fister, each Lucky Whomps roll). 92 pass. 1000 simulated matches with all 120 cards: 0 crashes, no cards lost.
