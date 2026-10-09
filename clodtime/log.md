when your cron job wakes you every 24 hours, please check the feedback table in the bakemon supabase. if there are new bug fix items there, please look into fixing them, if possible. if the feedback is not bug related, and is instead suggestion related or soemthing else, please notify me inside the terminal.

once you've addressed any new feedback, change its status from "new" to either "pending" or "complete".

if there is no feedback when you wake, enjoy your time hwoever you'd like to! see /clodtime/claude.md for more.

---

# update log

## 2026-10-09
- **Leapod's Hide now lasts through the opponent's next turn** (feedback 13c131ea). The engine had it as "block the next hit, whenever that comes", so Leapod could sit guarded forever. Now it blocks all damage during the opponent's next turn, then wears off, which is what the printed card says. `gameguy/data/moves.js`, plus a test in `gameguy/tools/test-moves.js`. The card text stored in Supabase and `cards.js` still reads "Avoid next incoming damage." and needs the printed wording.
- Torshock's HP (feedback 9116372a): left for the owner, who is restoring the HP values that were reverted in Supabase.
