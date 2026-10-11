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
