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

## 2026-10-14
Twelve reports (eleven from Cameron, one from Bryan). Each checked against the printed card.
- **Pyroat's Headbutt burns only a target weak to fire**, as printed (372416a7). It used to burn on a coin flip. That flip was the mystery burn in Bryan's Torch report; Torch itself works correctly. New `ifTargetWeakTo` op. `moves.js`, `battle.js`.
- **Floppy Disk moves as much energy as you like**, not all of it (a036bee5). You pick from, to, how many and which kinds. New `moveSomeEnergy` op. `moves.js`, `battle.js`, `battle-ai.js`.
- **Hercuzoa's Zero to Hero can target any Bakemon in play, itself included** (259d6d14). `moves.js`.
- **Mugini needs two energy of its target type to evolve**, not one (06765462). `battle.js`.
- **Necrozoa's Hungry Ghost** (bb4fd51d, a661d6db): it now counts *every* energy, not just psychic. The energy Mugini already had counts the moment it evolves. You can discard energy on your turn to get the HP back. The AI never discards that way. `moves.js`, `battle.js`, `battle-ai.js`.
- **Murkitty's Shed Skin** (3620a360) is printed as a free ability, but the data gave it a 2-dragon cost, so it was an attack. Fixed in `cards.js`; Supabase needs the same change.
- `cards.js` text now matches the printed Mugini, Necrozoa and Hercuzoa.
- Not changed: Moira (96504f3a) already searches only for benched Bakemon, and a new test confirms it. I couldn't reproduce the report. Flairees (97ffb53f) is Bryan's design call. Iveldyr's timing (7254fef4) needs Bryan to say what "after three turns" means. Iveldyr's healing (01d3d3d9) healed exactly the damage its mushrooms had. The Nyx/Venom Strike idea (c67f0495) went to Bryan.
- 7 new tests, plus the Hungry Ghost test updated to the printed rule. 90 pass. The simulator runs with 0 crashes.
- Follow-up from Bryan's answers:
  - **Iveldyr's Spore Bloom lands after four turns**, at the start of Iveldyr's side's turn. It used to land on the opponent's turn after three.
  - **The caster now chooses which mushroom Bakemon get the 60 HP of healing**, 10 at a time. Only mushrooms can be picked. The AI heals as much as each one needs.
  - **Moira can't be played unless something on your bench actually has an evolution.** Bryan's bench was only a Growlbud, which has none (96504f3a).
  - `battle.js`, `battle-ai.js`, `cards.js`. 2 new tests, plus the Spore Bloom timing test updated. 92 pass. The simulator runs with 0 crashes.

## 2026-10-14 (afternoon)
- **Flairees has Bryan's new Leap.** While Flairees is in play, every fire-type Bakemon in play, on both sides, does 10 more damage. When an opponent damages Flairees, they roll a D3, and a 1 burns the attacker. Like Lemurk's Dark Pulse, the +10 counts as an elemental effect, so Hailstorm stops it. `moves.js`, `battle.js`, `cards.js`, plus a test (93 pass).

## 2026-10-15
Four reports.
- **Shython's Brumate must be the first thing you do on your turn** (761bc855). The card says you may not draw, use items, attach energy, or use attacks/abilities that turn. Brumate is now offered only before any energy, item, ability or attack, and using it puts the turn's draw back on top of the deck. Cameron could attach energy and play items first and then still use it. The AI decides on Brumate before anything else. New `firstThing` op. `moves.js`, `battle.js`, `battle-ai.js`.
  - The other Shython report (24203947): Brumate isn't offered at full HP, since there's nothing to heal. Working as intended.
- **Hellfire can't burn without damage** (591ff0b4, Bryan's ruling). An attack that Hide fully blocks no longer burns. `battle.js`.
- **Silooper's Reorganise swaps one orb each between two enemy Bakemon that both have energy** (87300bf7). Before, it could just move an orb onto a Bakemon with no energy. The player picks which orb when there's a choice. `battle.js`.
- 3 new tests, 96 pass, and the simulator runs with 0 crashes.
