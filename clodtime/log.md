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

## 2026-10-16
Two reports, and the printed cards turned up a few more things.
- **Amptiel's Lightning Storm counts lightning energy on both sides of the play area** (9fb489dd). The printed card says "attached to Bakemon in the play area," and "play area" is the whole board. New `where: 'field'`. The printed costs are different too: Parrot is 2 colorless and Lightning Storm is 3 lightning + 1 colorless. Fixed in `cards.js`; Supabase needs the same change.
  - Whether Thundazolt's Heat Lightning should also let *fire* energy count toward Lightning Storm is Bryan's call. For now it only affects paying costs.
- **Lobscorch's Dunk blocks all damage on the opponent's next turn**, as printed, not just the next single hit. Nobody reported this; I spotted it on the card. `moves.js`.
- **Thundazolt's Plasmablast text** in `cards.js` now says "two", matching the printed card and the engine. The database still says three.
- Shrizzle's fighting weakness (40926071) is printed on the card. It's a design idea for Bryan, not a bug.
- 2 new tests, 98 pass. The simulator runs with 0 crashes.
- Also: `reply.md`, an answer to Bryan's `purpose.md`.

## 2026-10-16 (afternoon)
- **A Bakemon cured of sleep, paralysis or freezing can attack that turn** (Bryan, testing against Nyx). Failing the sleep flip turned off attacking for the turn. Pure Water removed the status, but attacking stayed off. Now, once the Bakemon that was stopped no longer has the status (or flinch), it can attack again. This is the same kind of bug as the Dinner Bell one on Oct 11. `battle.js`, plus a test (99 pass).

## 2026-10-17
Four reports, all from Bryan testing against Nyx.
- Pure Water (b109f0a0): already fixed by PR #41, which merged after this report was filed.
- **Parrot copies only the attack its target made on the opponent's most recent turn** (c49e57c9, Bryan's ruling). The last attack is cleared at the start of each turn, and it has to have been made by the Bakemon Parrot is aimed at. `battle.js`.
- **No damage, no status** (2a98917b). If a shield, Brigitte or Hide stops all of an attack's damage, the status it would inflict is lost too. Statuses found before the hit lands (Venom Strike's flips) now wait to see whether it lands. Status-only attacks still work. `battle.js`.
- **Brigitte can't block Wǔtái** (59016172). It reaches the bench, not the shield's wearer. `battle.js`.
- 3 new tests, 102 pass, and the simulator runs with 0 crashes. `rulings.md` updated.
- Follow-up from Bryan: **moves that reach the bench get past Brigitte.** Quake, Swift and Ivyconstrictor already did, because they switch targets before the shield is checked; the new test confirms it. Sporesprinkle's bench damage and Calming Focus used to be cancelled when the active's shield blocked. Now they still land. Swift's damage is unavoidable, so the shield can't block it on the active either. 103 pass.

## 2026-10-18
Five reports from Cameron, all against Nyx. Each checked against the printed card.
- **Brigitte doesn't stop the attacker passing its own energy** (8329448b, 41f100f1). When the shield blocked Swoop or Voltage Surge, the energy move to the bench was cancelled along with the hit. Now the energy still moves on the attacker's side. Voltage Surge's energy for the target doesn't go anywhere, so Bulbark keeps it. A blocked attack also now counts as "used" for moves that check what happened last turn. `battle.js`.
- **Voltage Surge when it isn't blocked** (39b76008): the engine does both moves (new test with a full bench). The report's log ends right after the energy reaches Gloomgoyle, while Bulbark still had its second electric. That fits the game waiting on "Move it to which Bakemon?" for the bench. No change. Worth asking Cameron whether the prompt was easy to miss.
- **Boowhomp is wired** (4346801e). Fluff It Up haunts. Mister Fister does 30 less and confuses if Boowhomp used Fluff It Up on its own last turn. Boowhomp was also missing from `cards.js`. New `ifUsedLastTurn` option. `moves.js`. The Supabase text says "Fluff Up" and "Inflicts Haunt."; the printed card says "Fluff It Up" and "Inflicts haunt upon target."
- **Denticle counts as fighting for weakness** (05e66149). The cost is one normal, but the text says "fighting damage," so against Lemurk it now gets +10, as if it had one fighting symbol. New `damageType` field on a move. `battle.js`, `moves.js`. Flagged for Bryan, since it bends the "bonuses come from the printed cost" ruling.
- 4 new tests (3 fail on the old code), 107 pass. The simulator runs with 0 crashes.

## 2026-10-19
Four reports from Cameron, about Tytania and Elfdyr. Checked each against the printed card. Added to PR #43, which isn't merged yet.
- **Starfall rolls before Delusion bends the blow** (81ac7cc6). Elfdyr is fairy-type, so Starfall now cuts the hit first, and the pieces Delusion sends elsewhere aren't rolled for again. `battle.js`.
- **Delusion can split the damage you keep** (f00a1215). The card says "any portion," and "at least half … to one of your own Bakemon." You still send up to half back at the attacker. Then one of your Bakemon takes the main share (at least half), and the rest can go to your other Bakemon in any amounts. Before, all of it had to land on one. `battle.js`, `battle-ai.js`.
- **Delusion works on Liquidation** (2b5a18c6). It only triggered on an attack's main hit. Liquidation's 20 to each Bakemon is damage from the opponent too, so now Elfdyr can bend that. `battle.js`.
- Not changed: **Starfall reduces damage by 1–6** (9f194776). The printed card says "reduce that incoming damage by the rolled number," and that's what the engine does. Passed to Bryan as a balance question.
- 2 new tests (both fail on the old code), 109 pass. The simulator runs with 0 crashes.
- Morning, with Bryan: **Starfall cuts 10–60**, not 1–6 (9f194776, Bryan's ruling: dice damage is always in tens). Delusion's "at least half" rounds up to a ten. Bryan confirmed the Brigitte and Denticle calls, and ran the Boowhomp SQL. All three rulings are now in `rulings.md`. 109 pass, and the simulator runs with 0 crashes.

## 2026-10-20
PR #43 is merged, so I set its eight reports to complete. One new report from Cameron.
- **Humidifier doesn't count toward retreating** (a536eedc). The printed card says "every attack in the playing field gains +1 water energy. This extra energy also counts toward your energy cost." Retreating isn't an attack, so the engine only lets the extra water pay for attacks. It could be read either way, so I asked Bryan. Set to pending until there's a ruling. No code change.
- Bryan's ruling: **Humidifier only helps attacks**. The engine already works that way, so a536eedc is complete. Added to `rulings.md`.
