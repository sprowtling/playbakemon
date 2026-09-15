# Bakemon MCP Server

Lets a Claude sit at a real Bakemon battle table — same `battle_tables` and
`table_chat_messages` rows `playmat.html` uses — through tool calls instead
of clicking through the rendered page. Not a parallel game, a second door
into the same one.

## What it can do — full coverage of the browser UI

Every action a person can take on `playmat.html` is available as a tool,
so a Claude can play a complete match start to finish without a human
overseeing:

**Setup**
- `login` — log in as an existing player by display name
- `list_my_decks` — see what decks you have to choose from
- `join_table` — create/join a table by room code, with a named deck
- `start_match` — reveal both fields once setup is done (either player)

**Reading the game**
- `see_board` — full snapshot: hand, active, bench, item slot, deck/discard
  counts, score, opponent's visible state (face-down until setup locks),
  recent chat. Call this often — it's how you "look at the table."

**Playing cards**
- `draw_card`
- `play_card` — hand → active/bench (basic onto empty, or evolution onto a
  matching occupied slot — carries damage/energy/status, stacks the chain),
  or hand → item slot (equip-type items only)
- `move_card` — in-play movement: active↔bench swaps (or evolves if valid),
  any Bakemon → discard (whole chain goes), unequip an item to hand/discard

**Board state**
- `add_energy` / `remove_energy`
- `adjust_damage` (positive = damage taken, negative = healed)
- `set_status` (poisoned, burned, sleeping, paralyzed, frozen, quaked,
  haunted, taunted, confused, enraged)
- `set_score` (0–4; 4 wins)
- `shuffle_hand_into_deck` / `reshuffle_discard_into_deck`

**Table talk**
- `send_chat` — narrate attacks/abilities (combat is trust-based, same as
  the tabletop rules; announce what you're doing)
- `coin_flip` — posts the result to chat in the same format as the `/flip`
  command in the browser

**Ending**
- `end_match` — outcome `me` / `opponent` / `none`; logs match history and
  closes the table for both players

## What it deliberately does NOT do

Enforce combat rules. Attack legality, energy costs, weakness math, turn
order — none of that is validated here, exactly as it isn't in the browser.
Bakemon is trust-based: you read your card, announce what you're doing in
chat, and apply the results by hand (`adjust_damage`, `set_status`, etc.).
A Claude playing alone should read the card text via `see_board`, decide
its move, narrate it in chat, then apply the effects. That's the game.

## Playing against a human

The human plays in the browser as normal. Everything a Claude does through
these tools shows up live on their screen (the browser subscribes to table
changes in real time). The Claude doesn't get push updates — it just calls
`see_board` again when it's its turn, or when the human says they've moved.
That rhythm works fine.

## Running it

```
cd bakemon-mcp
npm install
```

Then point an MCP-capable client at `server.js` via stdio. In Claude Desktop's
config (`claude_desktop_config.json`), add:

```json
{
  "mcpServers": {
    "bakemon": {
      "command": "node",
      "args": ["/absolute/path/to/bakemon-mcp/server.js"]
    }
  }
}
```

Restart the client, and the tools above should appear as available.

## A note on state

One running server = one seat at one table, same as one person only sitting
at one table in the real UI. If you want two Claudes (or a Claude and a
human) at the same table, each side just calls `login`/`join_table`
independently — same room code, and the existing seat-finding logic in
`joinTable` (mirrored from `playmat.html`) sorts out who's `player_1` vs
`player_2`.
