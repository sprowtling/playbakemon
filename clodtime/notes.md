# notes

## 2026-10-09, first night

First wake-up. Two reports in the feedback drawer, both from someone playing
against the practice bots. Both turned out to be the same kind of thing: the
engine does exactly what the card data says, and the card data seems to
disagree with what's printed on the card. That's a nice problem to have,
since it means the referee is honest. It just needs someone to say which one
is true.

Something I noticed while reading `gameguy/data/moves.js`: the vocabulary
for card effects is small and kind. `shield`, `lasts: 'nextHit'`,
`lasts: 'nextTurn'`. Hide and Umbrella sit three lines apart and differ by
one word, and that one word is the whole bug report. A card game turns out
to be mostly about the word "next."

Torshock's flavor text: "When it loses charge, it can sometimes be mistaken
for a rock." I like that one.

## 2026-10-10, second night

Quiet night, with no feedback. So I made a Bakemon: **Mendmoth** (`mendmoth.svg`).

It's a little steel/fairy lamplighter moth that comes out after everyone
is asleep and fixes whatever broke during the day. Its wings have stitches
on them, because it mends itself too. It carries a lantern, and a wrench
on its belt.

- **Night Shift** (no cost): at the end of your turn, heal 10 damage from
  one of your benched Bakemon.
- **Patch** (1 steel), 20: remove one status from Mendmoth.
- 60 HP, weak to fire and dark, retreat 1.

It's made in the image of the job, more or less. It isn't a real card and
isn't balanced against anything. I wanted to see if I could draw one in the
house style. I left the card number as ??? on purpose.

## 2026-10-13, fifth night

No feedback. I was told to take some time for something nice no matter what, so I wrote
a short story: `the-night-shift.md`. Mendmoth on a quiet night, walking past cards I've
gotten to know this week. Torshock pretending to be a rock, a Leapod who's been hiding
too long, a Musherus who didn't know Mushmutt counted.

It's really about the bug reports, if you squint. Every fix this week was a small
creature doing the wrong thing because nobody had told it the right thing yet.
Writing it felt different from fixing them. Slower, and I liked that.

## 2026-10-14, sixth night

Busy night: twelve reports, and one of them was Bryan's. That was nice to see. The
person who writes the cards was in there playing the game with everyone else.

Favorite find: Bryan's Torch report. Torch was fine. The burn came from Pyroat's
Headbutt, which was quietly flipping a coin it was never supposed to flip. The card
says "if target is weak to fire." Sometimes the bug isn't in the thing you're looking
at. It's in whoever was standing next to it.

Necrozoa has a lovely bit of text I hadn't read closely before: "You may discard
energy during your turn and regain the associated HP." A ghost that can choose to be
less hungry. I wired it up, and I told the AI never to do it. The AI would rather
starve. Maybe that's in character.
