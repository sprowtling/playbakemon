#!/usr/bin/env node
// Bakemon MCP server — lets a Claude sit at the same battle_tables/chat
// tables playmat.html uses, as a genuine second seat, not a browser-clicking
// stand-in. Every tool here maps to a tested function in game.js; nothing
// here invents new game rules beyond what's already tested there.

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema
} = require("@modelcontextprotocol/sdk/types.js");

const game = require("./game.js");

const sb = game.client();

// Session state: which player/table this server instance is currently
// sitting at. One MCP server process = one seat at one table, matching
// how a person only sits at one table at a time in the real UI.
let session = { player: null, tableId: null, seat: null, oppSeat: null };

const server = new Server(
  { name: "bakemon", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  {
    name: "login",
    description: "Log in as an existing Bakemon player by display name and PIN — the same 4-digit PIN they use to log in via index.html. Must be called before anything else. The player must already have an account and a PIN set.",
    inputSchema: {
      type: "object",
      properties: {
        display_name: { type: "string", description: "The player's display name, e.g. 'Bryan' or 'Arc'." },
        pin: { type: "string", description: "Their 4-digit PIN." }
      },
      required: ["display_name", "pin"]
    }
  },
  {
    name: "list_my_decks",
    description: "List the decks belonging to the logged-in player, so you know what deck names are available to bring to a table. Call login first.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "join_table",
    description: "Sit down at a battle table by room code, bringing a deck. Creates the table if it doesn't exist yet, or seats you into the open second seat. Call login first.",
    inputSchema: {
      type: "object",
      properties: {
        room_code: { type: "string", description: "The room code to create or join." },
        deck_name: { type: "string", description: "The name of one of your decks to bring, e.g. 'pillar resistance'. Only needed the first time you sit down at this table." }
      },
      required: ["room_code"]
    }
  },
  {
    name: "see_board",
    description: "Get a full snapshot of the current board: your hand, active, bench, item slot, deck/discard counts, score, the opponent's visible state (face-down if setup isn't locked yet), and recent chat. Call this whenever you need to check the state of the game.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "draw_card",
    description: "Draw the top card of your deck into your hand.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "play_card",
    description: "Play a card from your hand into your active slot, an empty bench slot, or the item slot. Supports evolution (an evolution card placed onto an occupied slot whose current Bakemon matches its evolves_from carries damage/energy/status forward and stacks the chain) and equipping (an equip-type item card into the item slot, only if it's empty). Swapping two already-in-play cards isn't supported yet by this tool.",
    inputSchema: {
      type: "object",
      properties: {
        card_name: { type: "string", description: "The exact name of the card in your hand to play." },
        destination: { type: "string", enum: ["active", "bench", "item_slot"], description: "Where to play it." },
        bench_index: { type: "number", description: "Which bench slot (0, 1, or 2) — only used when destination is 'bench'." }
      },
      required: ["card_name", "destination"]
    }
  },
  {
    name: "add_energy",
    description: "Attach an energy of a given type to your active Bakemon or a bench Bakemon.",
    inputSchema: {
      type: "object",
      properties: {
        zone: { type: "string", enum: ["active", "bench"] },
        bench_index: { type: "number", description: "Only used when zone is 'bench'." },
        energy_type: { type: "string", description: "e.g. fire, water, grass, electric, psychic, dark, steel, fighting, dragon, fairy." }
      },
      required: ["zone", "energy_type"]
    }
  },
  {
    name: "send_chat",
    description: "Post a message to the table chat — use this to narrate attacks, abilities, and other actions the game doesn't enforce automatically (this game is trust-based for combat, same as a real tabletop match). Announce what you're doing so your opponent can follow along.",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"]
    }
  },
  {
    name: "move_card",
    description: "Move a Bakemon that's already in play. active↔bench or bench↔bench: swaps the two if the destination is occupied (or evolves, if the moving card's evolves_from matches the destination card). Any in-play Bakemon → discard sends its whole evolution chain to discard. An equipped item (from item_slot) can go to hand or discard (unequip). A played Bakemon can never return to hand.",
    inputSchema: {
      type: "object",
      properties: {
        from_zone: { type: "string", enum: ["active", "bench", "item_slot"] },
        from_index: { type: "number", description: "Bench slot (0-2) when from_zone is 'bench'; ignored otherwise." },
        to_zone: { type: "string", enum: ["active", "bench", "discard", "hand"] },
        to_index: { type: "number", description: "Bench slot (0-2) when to_zone is 'bench'; ignored otherwise." }
      },
      required: ["from_zone", "to_zone"]
    }
  },
  {
    name: "remove_energy",
    description: "Remove one attached energy from your active or a bench Bakemon, by its position in that card's energy list (see see_board for the list).",
    inputSchema: {
      type: "object",
      properties: {
        zone: { type: "string", enum: ["active", "bench"] },
        bench_index: { type: "number" },
        energy_index: { type: "number", description: "0-based position in the card's energy array." }
      },
      required: ["zone", "energy_index"]
    }
  },
  {
    name: "adjust_damage",
    description: "Change damage on your active or a bench Bakemon. Positive = took damage, negative = healed. Damage is applied in the amount given (typically multiples of 10). HP can't go below 0 remaining or above max.",
    inputSchema: {
      type: "object",
      properties: {
        zone: { type: "string", enum: ["active", "bench"] },
        bench_index: { type: "number" },
        amount: { type: "number", description: "e.g. 30 for 30 damage taken, -20 to heal 20." }
      },
      required: ["zone", "amount"]
    }
  },
  {
    name: "set_status",
    description: "Add or remove a status condition on your active or a bench Bakemon. Valid statuses: poisoned, burned, sleeping, paralyzed, frozen, quaked, haunted, taunted, confused, enraged.",
    inputSchema: {
      type: "object",
      properties: {
        zone: { type: "string", enum: ["active", "bench"] },
        bench_index: { type: "number" },
        status: { type: "string" },
        action: { type: "string", enum: ["add", "remove"] }
      },
      required: ["zone", "status", "action"]
    }
  },
  {
    name: "shuffle_hand_into_deck",
    description: "Shuffle your entire hand back into your deck (e.g. a mulligan when you have no basic Bakemon during setup).",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "reshuffle_discard_into_deck",
    description: "Shuffle your discard pile back into your deck (allowed when your deck and hand are both empty, per the rules).",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "set_score",
    description: "Set your point total (0-4). You earn a point each time you KO an opponent's Bakemon; 4 points wins a standard match.",
    inputSchema: {
      type: "object",
      properties: { score: { type: "number" } },
      required: ["score"]
    }
  },
  {
    name: "start_match",
    description: "Reveal both fields and begin the match. Call once both players have placed their active (and optional bench) Bakemon during setup. Either player can trigger this; it applies to the whole table.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "coin_flip",
    description: "Flip a coin (Heads/Tails). Posts the result to chat automatically so both players see it. For any card effect that calls for a flip. For deciding who goes first, use decide_first instead.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "roll_dice",
    description: "Roll a die and post the result to chat automatically, matching the /d3, /d6, /d20 chat commands in the browser.",
    inputSchema: {
      type: "object",
      properties: { sides: { type: "number", enum: [3, 6, 20], description: "Number of sides on the die: 3, 6, or 20." } },
      required: ["sides"]
    }
  },
  {
    name: "decide_first",
    description: "Randomly pick which of the two players at the table goes first, and post it to chat automatically — matching the /start chat command in the browser.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "end_turn",
    description: "Announce that your turn is over and post it to chat automatically — matching the /turn chat command in the browser. Renders as a divider line in the browser's chat so both players can see where one turn ended and the next began, instead of it getting lost among coin flips and dice rolls. Call this whenever you're done with your turn.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "end_match",
    description: "End the match and record the result. outcome: 'me' (you won), 'opponent' (they won), or 'none' (no decision — doesn't count toward anyone's record). Logs to match history and closes the table for both players. This is final.",
    inputSchema: {
      type: "object",
      properties: { outcome: { type: "string", enum: ["me", "opponent", "none"] } },
      required: ["outcome"]
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await handleTool(name, args || {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});

async function handleTool(name, args) {
  switch (name) {
    case "login": {
      session.player = await game.findPlayer(sb, args.display_name, args.pin);
      return { logged_in_as: session.player.display_name };
    }

    case "list_my_decks": {
      requireLogin();
      const { data: decks, error } = await sb.from("decks").select("id, deck_name").eq("player_id", session.player.id).order("created_at");
      if (error) throw new Error(`Couldn't load decks: ${error.message}`);
      return { decks: (decks || []).map(d => d.deck_name.trim()) };
    }

    case "join_table": {
      requireLogin();
      let deckId = null;
      if (args.deck_name) {
        const { data: decks } = await sb.from("decks").select("id, deck_name").eq("player_id", session.player.id);
        const match = (decks || []).find(d => d.deck_name.trim().toLowerCase() === args.deck_name.trim().toLowerCase());
        if (!match) throw new Error(`No deck named "${args.deck_name}" found for ${session.player.display_name}. Their decks: ${(decks || []).map(d => d.deck_name).join(", ")}`);
        deckId = match.id;
      }
      const joined = await game.joinTable(sb, session.player, args.room_code, deckId);
      session.tableId = joined.tableId;
      session.seat = joined.seat;
      session.oppSeat = joined.oppSeat;
      return { room_code: args.room_code, seat: joined.seat };
    }

    case "see_board": {
      requireTable();
      return await game.seeBoard(sb, session.tableId, session.seat, session.oppSeat);
    }

    case "draw_card": {
      requireTable();
      return await game.drawCard(sb, session.tableId, session.seat);
    }

    case "play_card": {
      requireTable();
      const board = await game.seeBoard(sb, session.tableId, session.seat, session.oppSeat);
      const inHand = board.my_hand.find(c => c.name.toLowerCase() === args.card_name.trim().toLowerCase());
      if (!inHand) throw new Error(`"${args.card_name}" isn't in your hand. Your hand: ${board.my_hand.map(c => c.name).join(", ")}`);
      return await game.playCardFromHand(sb, session.tableId, session.seat, inHand.card_id, args.destination, args.bench_index || 0);
    }

    case "add_energy": {
      requireTable();
      return await game.addEnergy(sb, session.tableId, session.seat, args.zone, args.bench_index || 0, args.energy_type);
    }

    case "send_chat": {
      requireTable();
      return await game.sendChat(sb, session.tableId, session.player, args.message);
    }

    case "move_card": {
      requireTable();
      return await game.moveInPlayCard(sb, session.tableId, session.seat, args.from_zone, args.from_index || 0, args.to_zone, args.to_index || 0);
    }

    case "remove_energy": {
      requireTable();
      return await game.removeEnergy(sb, session.tableId, session.seat, args.zone, args.bench_index || 0, args.energy_index);
    }

    case "adjust_damage": {
      requireTable();
      return await game.adjustDamage(sb, session.tableId, session.seat, args.zone, args.bench_index || 0, args.amount);
    }

    case "set_status": {
      requireTable();
      return await game.setStatus(sb, session.tableId, session.seat, args.zone, args.bench_index || 0, args.status, args.action === "add");
    }

    case "shuffle_hand_into_deck": {
      requireTable();
      return await game.shuffleHandIntoDeck(sb, session.tableId, session.seat);
    }

    case "reshuffle_discard_into_deck": {
      requireTable();
      return await game.reshuffleDiscardIntoDeck(sb, session.tableId, session.seat);
    }

    case "set_score": {
      requireTable();
      return await game.setScore(sb, session.tableId, session.seat, args.score);
    }

    case "start_match": {
      requireTable();
      return await game.startMatch(sb, session.tableId);
    }

    case "coin_flip": {
      requireTable();
      const result = game.coinFlip();
      // Same message format as the /flip chat command in playmat.html, so it
      // looks identical whether a human or a Claude flipped it.
      await game.sendChat(sb, session.tableId, session.player, `🪙 flipped a coin: ${result}`);
      return { result };
    }

    case "roll_dice": {
      requireTable();
      if (![3, 6, 20].includes(args.sides)) throw new Error("sides must be 3, 6, or 20.");
      const result = game.rollDice(args.sides);
      // Same message format as /d3, /d6, /d20 in playmat.html.
      await game.sendChat(sb, session.tableId, session.player, `🎲 rolled a d${args.sides}: ${result}`);
      return { sides: args.sides, result };
    }

    case "decide_first": {
      requireTable();
      const winner = await game.decideFirstPlayer(sb, session.tableId, session.oppSeat, session.player);
      // Same message format as /start in playmat.html.
      await game.sendChat(sb, session.tableId, session.player, `🎯 ${winner} goes first!`);
      return { goes_first: winner };
    }

    case "end_turn": {
      requireTable();
      const message = await game.endTurn(sb, session.tableId, session.oppSeat, session.player);
      // Same message format (and "⏭️" prefix, for the browser's divider styling) as /turn in playmat.html.
      await game.sendChat(sb, session.tableId, session.player, message);
      return { announced: message };
    }

    case "end_match": {
      requireTable();
      const result = await game.endMatch(sb, session.tableId, session.seat, session.oppSeat, session.player, args.outcome);
      if (result.ok) {
        // Table is gone — clear the session so further calls fail clearly
        // rather than acting on a deleted table.
        session.tableId = null; session.seat = null; session.oppSeat = null;
      }
      return result;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function requireLogin() {
  if (!session.player) throw new Error("Not logged in yet — call login first.");
}
function requireTable() {
  requireLogin();
  if (!session.tableId) throw new Error("Not sitting at a table yet — call join_table first.");
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
