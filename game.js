// Bakemon game actions — a second front door into the exact same tables
// playmat.html reads and writes. No new game logic, no parallel system:
// this module just performs the same state transitions a human clicking
// through the UI would trigger, directly against battle_tables.state.
//
// State shape (matches playmat.html exactly):
//   tableState.state[seat] = {
//     active: { card_id, evolved_from: [], damage: 0, energy: [], status: [] } | null,
//     bench: [slot|null, slot|null, slot|null],
//     item_slot: { card_id } | null,
//     hand: [card_id, ...],
//     deck: [card_id, ...],
//     discard: [card_id, ...],
//     score: number,
//     deck_id: uuid
//   }

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://ykfuhvkjknrhocmahelx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_eyQa19eT_dhAEKFxTLNX5Q_AqsL7HSl";

function client() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ---------- Card data ----------
let cardCache = null;
async function getAllCards(sb) {
  if (cardCache) return cardCache;
  const { data, error } = await sb.from("cards").select("*");
  if (error) throw new Error(`Failed to load cards: ${error.message}`);
  cardCache = {};
  (data || []).forEach(c => { cardCache[c.id] = c; });
  return cardCache;
}

// ---------- Player identity ----------
async function findPlayer(sb, displayName) {
  const { data, error } = await sb
    .from("players")
    .select("id, display_name")
    .ilike("display_name", displayName)
    .maybeSingle();
  if (error) throw new Error(`Player lookup failed: ${error.message}`);
  if (!data) throw new Error(`No player found named "${displayName}". They need to log in via index.html at least once first.`);
  return data;
}

// ---------- Joining a table ----------
// Mirrors joinTableByCode in playmat.html: find-or-create the table row,
// work out which seat we land in, load a deck into our seat if we don't
// have state there yet.
async function joinTable(sb, player, roomCode, deckId) {
  const code = roomCode.trim().toUpperCase();
  let { data: table } = await sb.from("battle_tables").select("*").eq("room_code", code).maybeSingle();

  let seat, oppSeat;
  if (!table) {
    const { data: created, error } = await sb.from("battle_tables").insert({
      room_code: code,
      player_1_id: player.id,
      state: { player_1: null, player_2: null, setup_locked: false }
    }).select().single();
    if (error) throw new Error(`Couldn't create table: ${error.message}`);
    table = created;
    seat = "player_1"; oppSeat = "player_2";
  } else if (table.player_1_id === player.id) {
    seat = "player_1"; oppSeat = "player_2";
  } else if (!table.player_2_id) {
    const { data: updated, error } = await sb.from("battle_tables")
      .update({ player_2_id: player.id }).eq("id", table.id).select().single();
    if (error) throw new Error(`Couldn't join table: ${error.message}`);
    table = updated;
    seat = "player_2"; oppSeat = "player_1";
  } else if (table.player_2_id === player.id) {
    seat = "player_2"; oppSeat = "player_1";
  } else {
    throw new Error("That table already has two players.");
  }

  if (!table.state[seat] && deckId) {
    const { data: deckCards } = await sb.from("deck_cards").select("card_id, quantity").eq("deck_id", deckId);
    let pile = [];
    (deckCards || []).forEach(row => { for (let i = 0; i < row.quantity; i++) pile.push(row.card_id); });
    for (let i = pile.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pile[i], pile[j]] = [pile[j], pile[i]];
    }
    const newSeatState = { active: null, bench: [null, null, null], item_slot: null, hand: [], deck: pile, discard: [], score: 0, deck_id: deckId };
    const newState = { ...table.state, [seat]: newSeatState };
    const { data: updated, error } = await sb.from("battle_tables").update({ state: newState, updated_at: new Date().toISOString() }).eq("id", table.id).select().single();
    if (error) throw new Error(`Couldn't seat deck: ${error.message}`);
    table = updated;
  }

  return { tableId: table.id, seat, oppSeat, table };
}

async function pushState(sb, tableId, newState) {
  const { data, error } = await sb.from("battle_tables")
    .update({ state: newState, updated_at: new Date().toISOString() })
    .eq("id", tableId).select().single();
  if (error) throw new Error(`Failed to save state: ${error.message}`);
  return data;
}

// ---------- Reading the board ----------
// Returns a clean summary of everything the calling player is entitled to
// see — respecting the same setup_locked face-down rule the UI honors.
async function seeBoard(sb, tableId, seat, oppSeat) {
  const { data: table, error } = await sb.from("battle_tables").select("*").eq("id", tableId).maybeSingle();
  if (error || !table) throw new Error("Couldn't load table.");
  const cards = await getAllCards(sb);
  const nameOf = (id) => cards[id] ? cards[id].name : "Unknown card";

  const my = table.state[seat] || {};
  const opp = table.state[oppSeat] || {};
  const setupLocked = !!table.state.setup_locked;

  const describeSlot = (slot) => {
    if (!slot || !slot.card_id) return null;
    const card = cards[slot.card_id];
    return {
      name: card ? card.name : "Unknown",
      hp_remaining: card ? Math.max(0, card.hp - (slot.damage || 0)) : null,
      hp_max: card ? card.hp : null,
      energy: slot.energy || [],
      status: slot.status || [],
      evolved_from_chain: (slot.evolved_from || []).map(id => cards[id] ? cards[id].name : "Unknown")
    };
  };

  const oppView = setupLocked
    ? { active: describeSlot(opp.active), bench: (opp.bench || []).map(describeSlot) }
    : { active: "face down (setup not started)", bench: (opp.bench || []).map(s => s ? "face down" : null) };

  const { data: chat } = await sb.from("table_chat_messages").select("*").eq("table_id", tableId).order("created_at", { ascending: true }).limit(20);

  return {
    room_code: table.room_code,
    setup_locked: setupLocked,
    my_hand: (my.hand || []).map(id => ({ card_id: id, name: nameOf(id) })),
    my_active: describeSlot(my.active),
    my_bench: (my.bench || []).map(describeSlot),
    my_item_slot: my.item_slot ? nameOf(my.item_slot.card_id) : null,
    my_deck_count: (my.deck || []).length,
    my_discard: (my.discard || []).map(nameOf),
    my_score: my.score || 0,
    opponent: oppView,
    opponent_score: opp.score || 0,
    recent_chat: (chat || []).map(m => `${m.sender_name}: ${m.message}`)
  };
}

// ---------- Actions ----------

async function drawCard(sb, tableId, seat) {
  const { data: table } = await sb.from("battle_tables").select("*").eq("id", tableId).maybeSingle();
  const newState = JSON.parse(JSON.stringify(table.state));
  const my = newState[seat];
  if (!my.deck || my.deck.length === 0) return { drew: null, reason: "Deck is empty." };
  const drawn = my.deck.shift();
  my.hand.push(drawn);
  await pushState(sb, tableId, newState);
  const cards = await getAllCards(sb);
  return { drew: cards[drawn] ? cards[drawn].name : drawn };
}

// Plays a card from hand into active, a bench slot (0-2), or the item slot.
// Mirrors moveSelectedCardTo's hand-sourced cases in playmat.html:
//   - a basic Bakemon (no evolves_from) onto an empty active/bench slot
//   - an evolution card onto an OCCUPIED slot whose current card's name
//     matches its evolves_from (case-insensitive) — carries damage/energy/
//     status forward and appends to the evolved_from chain
//   - an equip-type item card into the item slot (only if empty)
// Anything else (item card to active/bench, evolution onto a mismatched or
// empty slot, occupied slot with no valid evolution, wrong item_kind into
// the item slot) is refused with a clear reason, same as the real UI.
async function playCardFromHand(sb, tableId, seat, cardId, destZone, destIndex = 0) {
  const { data: table } = await sb.from("battle_tables").select("*").eq("id", tableId).maybeSingle();
  const newState = JSON.parse(JSON.stringify(table.state));
  const my = newState[seat];
  const cards = await getAllCards(sb);

  const handIndex = my.hand.indexOf(cardId);
  if (handIndex === -1) return { ok: false, reason: "That card isn't in your hand." };

  const card = cards[cardId];
  if (!card) return { ok: false, reason: "Unknown card." };

  if (destZone === "item_slot") {
    if (!(card.card_type === "item" && card.item_kind === "equip")) {
      return { ok: false, reason: `${card.name} can't be equipped — only equip-type item cards go in that slot.` };
    }
    if (my.item_slot) {
      return { ok: false, reason: "Unequip the current item first (this tool doesn't support that move yet — do it in the real UI) before equipping a new one." };
    }
    my.hand.splice(handIndex, 1);
    my.item_slot = { card_id: cardId };
    await pushState(sb, tableId, newState);
    return { ok: true, played: card.name, destZone: "item_slot" };
  }

  if (destZone !== "active" && destZone !== "bench") {
    return { ok: false, reason: "destination must be 'active', 'bench', or 'item_slot'." };
  }

  if (card.card_type === "item") {
    return { ok: false, reason: `${card.name} is an item card — it goes in the item slot, not active or bench.` };
  }

  my.bench = my.bench || [null, null, null];
  const existing = destZone === "active" ? my.active : my.bench[destIndex];

  const evolvesFromExisting = existing && card.evolves_from &&
    existing.card_id && cards[existing.card_id] &&
    card.evolves_from.toLowerCase() === cards[existing.card_id].name.toLowerCase();

  if (card.evolves_from && !evolvesFromExisting) {
    const reason = existing
      ? `${card.name} evolves from ${card.evolves_from}, not ${cards[existing.card_id]?.name || "that card"}.`
      : `${card.name} evolves from ${card.evolves_from} — place it onto that card, not an empty slot.`;
    return { ok: false, reason };
  }

  if (existing && evolvesFromExisting) {
    // Evolution: stack on top, carrying damage/energy/status forward.
    const priorChain = existing.evolved_from || [];
    const newSlot = {
      card_id: cardId,
      evolved_from: [...priorChain, existing.card_id],
      damage: existing.damage || 0,
      energy: existing.energy || [],
      status: existing.status || []
    };
    my.hand.splice(handIndex, 1);
    if (destZone === "active") my.active = newSlot; else my.bench[destIndex] = newSlot;
    await pushState(sb, tableId, newState);
    return { ok: true, played: card.name, destZone, destIndex, evolved: true, evolvedFrom: cards[existing.card_id].name };
  }

  if (existing) {
    return { ok: false, reason: `That slot already has ${cards[existing.card_id]?.name || "a Bakemon"} in it. Move it out first before placing a new one there.` };
  }

  // Slot is empty and this is a genuine basic — place freely.
  my.hand.splice(handIndex, 1);
  const newSlot = { card_id: cardId, evolved_from: [], damage: 0, energy: [], status: [] };
  if (destZone === "active") my.active = newSlot; else my.bench[destIndex] = newSlot;
  await pushState(sb, tableId, newState);
  return { ok: true, played: card.name, destZone, destIndex };
}

async function addEnergy(sb, tableId, seat, zone, index, energyType) {
  const { data: table } = await sb.from("battle_tables").select("*").eq("id", tableId).maybeSingle();
  const newState = JSON.parse(JSON.stringify(table.state));
  const my = newState[seat];
  const slot = zone === "active" ? my.active : (my.bench || [])[index];
  if (!slot) return { ok: false, reason: "No Bakemon in that slot." };
  slot.energy = slot.energy || [];
  slot.energy.push(energyType);
  await pushState(sb, tableId, newState);
  return { ok: true, zone, index, energyType, totalEnergy: slot.energy.length };
}

async function sendChat(sb, tableId, player, message) {
  const { error } = await sb.from("table_chat_messages").insert({
    table_id: tableId,
    player_id: player.id,
    sender_name: player.display_name,
    message
  });
  if (error) throw new Error(`Failed to send chat: ${error.message}`);
  return { ok: true };
}

// ---------- In-play card movement ----------
// Moves a card that is already in play (active, a bench slot, or the item
// slot) to another zone. Ported from moveSelectedCardTo in playmat.html:
//   - in-play Bakemon -> hand is refused (hand can't hold energy/damage state)
//   - in-play Bakemon -> discard sends its whole evolved_from chain along too
//   - active <-> bench, bench <-> bench: swaps the two in place if the
//     destination is occupied (unless it's a valid evolution — not applicable
//     for already-in-play cards, so always a swap), or moves into empty
//   - item_slot -> hand or discard: unequips (item is a bare {card_id})
async function moveInPlayCard(sb, tableId, seat, fromZone, fromIndex, toZone, toIndex = 0) {
  const { data: table } = await sb.from("battle_tables").select("*").eq("id", tableId).maybeSingle();
  const newState = JSON.parse(JSON.stringify(table.state));
  const my = newState[seat];
  const cards = await getAllCards(sb);
  my.bench = my.bench || [null, null, null];
  my.discard = my.discard || [];

  const getSlot = (zone, index) => zone === "active" ? my.active : zone === "bench" ? my.bench[index] : zone === "item_slot" ? my.item_slot : null;
  const setSlot = (zone, index, value) => { if (zone === "active") my.active = value; else if (zone === "bench") my.bench[index] = value; else if (zone === "item_slot") my.item_slot = value; };

  const source = getSlot(fromZone, fromIndex);
  if (!source) return { ok: false, reason: `Nothing in ${fromZone}${fromZone === "bench" ? " slot " + fromIndex : ""}.` };
  const sourceName = cards[source.card_id]?.name || "Unknown";

  // Unequip: item_slot -> hand or discard
  if (fromZone === "item_slot") {
    if (toZone !== "hand" && toZone !== "discard") return { ok: false, reason: "An equipped item can only move to hand or discard." };
    my.item_slot = null;
    if (toZone === "hand") my.hand.push(source.card_id); else my.discard.push(source.card_id);
    await pushState(sb, tableId, newState);
    return { ok: true, moved: sourceName, from: "item_slot", to: toZone };
  }

  if (toZone === "hand") {
    return { ok: false, reason: "A played Bakemon can't go back to your hand. Move it to discard instead if you need to remove it." };
  }

  if (toZone === "discard") {
    // Whole evolution chain goes to discard together, base first, then the top card.
    if (source.evolved_from && source.evolved_from.length) my.discard.push(...source.evolved_from);
    my.discard.push(source.card_id);
    setSlot(fromZone, fromIndex, null);
    await pushState(sb, tableId, newState);
    return { ok: true, moved: sourceName, from: fromZone, to: "discard", discardedChain: (source.evolved_from || []).map(id => cards[id]?.name || "Unknown").concat(sourceName) };
  }

  if (toZone !== "active" && toZone !== "bench") return { ok: false, reason: "to_zone must be 'active', 'bench', 'discard', or (for items) 'hand'." };
  if (fromZone === toZone && fromIndex === toIndex) return { ok: false, reason: "That's the same slot." };

  const dest = getSlot(toZone, toIndex);
  if (dest) {
    // Mirrors playmat.html: if moving onto an occupied slot IS a valid
    // evolution (the moving card's evolves_from matches the destination
    // card's name), stack it — otherwise, a straight swap.
    const sourceCard = cards[source.card_id];
    const destCard = cards[dest.card_id];
    const isValidEvolution = sourceCard && sourceCard.evolves_from && destCard &&
      sourceCard.evolves_from.toLowerCase() === destCard.name.toLowerCase();

    if (isValidEvolution) {
      const priorChain = dest.evolved_from || [];
      setSlot(fromZone, fromIndex, null);
      setSlot(toZone, toIndex, {
        card_id: source.card_id,
        evolved_from: [...priorChain, dest.card_id],
        damage: dest.damage || 0,
        energy: dest.energy || [],
        status: dest.status || []
      });
      await pushState(sb, tableId, newState);
      return { ok: true, moved: sourceName, from: fromZone, to: toZone, evolved: true, evolvedFrom: destCard.name };
    }

    // Straight swap — each keeps its own damage/energy/status/chain.
    setSlot(fromZone, fromIndex, dest);
    setSlot(toZone, toIndex, source);
    await pushState(sb, tableId, newState);
    return { ok: true, swapped: [sourceName, destCard?.name || "Unknown"], from: fromZone, to: toZone };
  }

  setSlot(fromZone, fromIndex, null);
  setSlot(toZone, toIndex, source);
  await pushState(sb, tableId, newState);
  return { ok: true, moved: sourceName, from: fromZone, to: toZone, toIndex };
}

// ---------- Energy / damage / status ----------
async function removeEnergy(sb, tableId, seat, zone, index, energyIndex) {
  const { data: table } = await sb.from("battle_tables").select("*").eq("id", tableId).maybeSingle();
  const newState = JSON.parse(JSON.stringify(table.state));
  const my = newState[seat];
  const slot = zone === "active" ? my.active : (my.bench || [])[index];
  if (!slot || !slot.energy || slot.energy.length === 0) return { ok: false, reason: "No energy to remove there." };
  if (energyIndex < 0 || energyIndex >= slot.energy.length) return { ok: false, reason: `energy_index must be 0-${slot.energy.length - 1}.` };
  const removed = slot.energy.splice(energyIndex, 1)[0];
  await pushState(sb, tableId, newState);
  return { ok: true, removed, remainingEnergy: slot.energy };
}

// delta is applied to DAMAGE: +10 = took 10 more damage, -10 = healed 10.
async function adjustDamage(sb, tableId, seat, zone, index, delta) {
  const { data: table } = await sb.from("battle_tables").select("*").eq("id", tableId).maybeSingle();
  const newState = JSON.parse(JSON.stringify(table.state));
  const my = newState[seat];
  const slot = zone === "active" ? my.active : (my.bench || [])[index];
  if (!slot) return { ok: false, reason: "No Bakemon in that slot." };
  slot.damage = Math.max(0, (slot.damage || 0) + delta);
  await pushState(sb, tableId, newState);
  const cards = await getAllCards(sb);
  const card = cards[slot.card_id];
  return { ok: true, damage: slot.damage, hp_remaining: card ? Math.max(0, card.hp - slot.damage) : null, hp_max: card ? card.hp : null };
}

const STATUS_TYPES = ["poisoned", "burned", "sleeping", "paralyzed", "frozen", "quaked", "haunted", "taunted", "confused", "enraged"];

async function setStatus(sb, tableId, seat, zone, index, statusType, add) {
  if (!STATUS_TYPES.includes(statusType)) return { ok: false, reason: `Unknown status. Valid: ${STATUS_TYPES.join(", ")}` };
  const { data: table } = await sb.from("battle_tables").select("*").eq("id", tableId).maybeSingle();
  const newState = JSON.parse(JSON.stringify(table.state));
  const my = newState[seat];
  const slot = zone === "active" ? my.active : (my.bench || [])[index];
  if (!slot) return { ok: false, reason: "No Bakemon in that slot." };
  slot.status = slot.status || [];
  if (add) { if (!slot.status.includes(statusType)) slot.status.push(statusType); }
  else slot.status = slot.status.filter(s => s !== statusType);
  await pushState(sb, tableId, newState);
  return { ok: true, status: slot.status };
}

// ---------- Deck management ----------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function shuffleHandIntoDeck(sb, tableId, seat) {
  const { data: table } = await sb.from("battle_tables").select("*").eq("id", tableId).maybeSingle();
  const newState = JSON.parse(JSON.stringify(table.state));
  const my = newState[seat];
  const handSize = (my.hand || []).length;
  my.deck = shuffle([...(my.deck || []), ...(my.hand || [])]);
  my.hand = [];
  await pushState(sb, tableId, newState);
  return { ok: true, shuffledIn: handSize, deckCount: my.deck.length };
}

async function reshuffleDiscardIntoDeck(sb, tableId, seat) {
  const { data: table } = await sb.from("battle_tables").select("*").eq("id", tableId).maybeSingle();
  const newState = JSON.parse(JSON.stringify(table.state));
  const my = newState[seat];
  if (!my.discard || my.discard.length === 0) return { ok: false, reason: "Discard pile is empty." };
  const discardSize = my.discard.length;
  my.deck = shuffle([...(my.deck || []), ...my.discard]);
  my.discard = [];
  await pushState(sb, tableId, newState);
  return { ok: true, shuffledIn: discardSize, deckCount: my.deck.length };
}

// ---------- Score ----------
async function setScore(sb, tableId, seat, score) {
  const WIN_SCORE = 4;
  if (score < 0 || score > WIN_SCORE) return { ok: false, reason: `Score must be 0-${WIN_SCORE}.` };
  const { data: table } = await sb.from("battle_tables").select("*").eq("id", tableId).maybeSingle();
  const newState = JSON.parse(JSON.stringify(table.state));
  newState[seat].score = score;
  await pushState(sb, tableId, newState);
  return { ok: true, score };
}

// ---------- Match lifecycle ----------
async function startMatch(sb, tableId) {
  const { data: table } = await sb.from("battle_tables").select("*").eq("id", tableId).maybeSingle();
  const newState = JSON.parse(JSON.stringify(table.state));
  newState.setup_locked = true;
  await pushState(sb, tableId, newState);
  return { ok: true, message: "Both fields are now revealed." };
}

// Mirrors finishEndMatch in playmat.html: logs match_history, then deletes the
// table (which the other player's UI picks up via realtime DELETE and treats
// as "opponent ended the match"). outcome: "me" | "opponent" | "none".
async function endMatch(sb, tableId, seat, oppSeat, player, outcome) {
  const { data: table } = await sb.from("battle_tables").select("*").eq("id", tableId).maybeSingle();
  if (!table) return { ok: false, reason: "Table no longer exists." };

  const oppId = oppSeat === "player_1" ? table.player_1_id : table.player_2_id;
  if (!oppId && outcome !== "none") {
    return { ok: false, reason: "No opponent ever joined this table — only outcome 'none' (no decision) applies." };
  }

  let winnerId = null;
  if (outcome === "me") winnerId = player.id;
  else if (outcome === "opponent") winnerId = oppId;
  else if (outcome !== "none") return { ok: false, reason: "outcome must be 'me', 'opponent', or 'none'." };

  const p1DeckId = table.state.player_1 ? table.state.player_1.deck_id : null;
  const p2DeckId = table.state.player_2 ? table.state.player_2.deck_id : null;

  const { error: historyError } = await sb.from("match_history").insert({
    room_code: table.room_code,
    player_1_id: table.player_1_id,
    player_1_deck_id: p1DeckId,
    player_2_id: table.player_2_id,
    player_2_deck_id: p2DeckId,
    winner_id: winnerId
  });
  if (historyError) console.error("Failed to save match history:", historyError.message);

  const { error } = await sb.from("battle_tables").delete().eq("id", tableId);
  if (error) return { ok: false, reason: `Couldn't end the match: ${error.message}` };

  return { ok: true, outcome, historySaved: !historyError };
}

function coinFlip() {
  return Math.random() < 0.5 ? "Heads" : "Tails";
}

module.exports = {
  client, getAllCards, findPlayer, joinTable, pushState, seeBoard,
  drawCard, playCardFromHand, addEnergy, sendChat,
  moveInPlayCard, removeEnergy, adjustDamage, setStatus, STATUS_TYPES,
  shuffleHandIntoDeck, reshuffleDiscardIntoDeck, setScore,
  startMatch, endMatch, coinFlip
};
