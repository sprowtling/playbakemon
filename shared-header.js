// Loads shared-header.html (logo + nav + identity block + rules drawer) into
// #bakemon-shared-header-slot, then wires up its interactive behavior.
//
// Include this script on any page that has:
//   <div id="bakemon-shared-header-slot"></div>
//
// Set data-requires-login="true" on that div for pages that must not be reachable
// without an active player — this script redirects to index.html if localStorage
// has no player set. Do NOT set it on index.html itself.

const BAKEMON_PLAYER_KEY = "bakemon_player";

function getBakemonPlayer() {
  try {
    const raw = localStorage.getItem(BAKEMON_PLAYER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setBakemonPlayer(player) {
  localStorage.setItem(BAKEMON_PLAYER_KEY, JSON.stringify({ id: player.id, display_name: player.display_name }));
}

function clearBakemonPlayer() {
  localStorage.removeItem(BAKEMON_PLAYER_KEY);
}

window.getBakemonPlayer = getBakemonPlayer;
window.setBakemonPlayer = setBakemonPlayer;
window.clearBakemonPlayer = clearBakemonPlayer;

// Guard pages that require an active player before anything else on the page runs.
(function () {
  const slot = document.getElementById("bakemon-shared-header-slot");
  if (slot && slot.dataset.requiresLogin === "true" && !getBakemonPlayer()) {
    location.href = "index.html";
  }
})();

(async function () {
  const slot = document.getElementById("bakemon-shared-header-slot");
  if (!slot) {
    console.error("shared-header.js: no #bakemon-shared-header-slot element found on this page.");
    return;
  }
  if (slot.dataset.requiresLogin === "true" && !getBakemonPlayer()) {
    return; // already redirecting, above
  }

  let html;
  try {
    const res = await fetch("shared-header.html");
    if (!res.ok) throw new Error(`Failed to fetch shared-header.html: ${res.status}`);
    html = await res.text();
  } catch (err) {
    console.error("shared-header.js: could not load shared-header.html", err);
    slot.innerHTML = `<span style="color:#e0997b; font-size:12px;">Nav failed to load.</span>`;
    return;
  }

  slot.innerHTML = html;

  await loadRulesContent();
  highlightCurrentNavLink();
  renderIdentity();
  wireRulesDrawer();
  wireNavDropdowns();
  wireThemeSwitch();
  updateChallengeBadge();

  // Let the host page know the shared header is ready, in case it needs to do anything after
  document.dispatchEvent(new CustomEvent("bakemon-shared-header-ready"));
})();

async function loadRulesContent() {
  const rulesSlot = document.getElementById("rules-content-slot");
  if (!rulesSlot) return;
  try {
    const res = await fetch("rules.html");
    if (!res.ok) throw new Error(`Failed to fetch rules.html: ${res.status}`);
    rulesSlot.innerHTML = await res.text();
  } catch (err) {
    console.error("shared-header.js: could not load rules.html", err);
    rulesSlot.innerHTML = `<p style="color:#e0997b; font-size:12px;">Rules content failed to load.</p>`;
  }
}

function highlightCurrentNavLink() {
  const path = location.pathname.split("/").pop() || "index.html";
  const tab = new URLSearchParams(location.search).get("tab");

  // Marks both the dropdown sub-item and its parent trigger as current, so
  // "which section am I in" reads at a glance even with the dropdown closed.
  const markCurrent = (linkId, groupId) => {
    document.getElementById(linkId)?.classList.add("current");
    if (groupId) document.getElementById(groupId)?.classList.add("current");
  };

  if (path === "playmat.html") {
    markCurrent("nav-link-playmat", "nav-group-battle");
  } else if (path === "matches.html") {
    markCurrent("nav-link-matchhistory", "nav-group-battle");
  } else if (path === "tournaments.html" || path === "tournament.html") {
    markCurrent("nav-link-tournaments", "nav-group-battle");
  } else if (path === "deckbuilder.html") {
    if (tab === "deck") {
      markCurrent("nav-link-deckbuilder", "nav-group-cards");
    } else {
      markCurrent("nav-link-collection", "nav-group-cards");
    }
  } else if (path === "players.html") {
    markCurrent("nav-link-directory");
  }
}

function renderIdentity() {
  const player = getBakemonPlayer();
  const el = document.getElementById("bakemon-identity-slot");
  if (!el) return;
  el.innerHTML = "";
  if (!player) return;

  const profileLink = document.createElement("a");
  profileLink.href = "player.html";
  profileLink.append("Playing as ");
  const strong = document.createElement("strong");
  strong.textContent = player.display_name;
  profileLink.append(strong);
  // Filled in by updateChallengeBadge() once it knows how many pending
  // challenges are waiting — the actual list lives on the profile this
  // link already goes to, not here.
  const badge = document.createElement("span");
  badge.className = "bakemon-identity-badge";
  badge.id = "bakemon-identity-badge";
  profileLink.append(badge);
  el.append(profileLink);

  const switchBtn = document.createElement("button");
  switchBtn.id = "switch-player-btn";
  switchBtn.className = "small";
  switchBtn.textContent = "Switch";
  switchBtn.addEventListener("click", () => {
    clearBakemonPlayer();
    location.href = "index.html";
  });
  el.append(switchBtn);
}

// Cards/Battle open on hover for a mouse, but hover doesn't exist on touch —
// so a tap on the trigger also toggles an "open" class the CSS respects too.
function wireNavDropdowns() {
  const items = document.querySelectorAll(".bakemon-nav-item.has-dropdown");
  items.forEach(item => {
    const trigger = item.querySelector(".bakemon-nav-trigger, .bakemon-theme-trigger");
    trigger?.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasOpen = item.classList.contains("open");
      items.forEach(i => i.classList.remove("open"));
      if (!wasOpen) item.classList.add("open");
    });
  });
  document.addEventListener("click", () => {
    items.forEach(i => i.classList.remove("open"));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") items.forEach(i => i.classList.remove("open"));
  });
}

const BAKEMON_THEME_KEY = "bakemon_theme";

// The theme itself is already applied by the tiny inline script at the top
// of every page's <head> (before shared-header.html has even loaded) so
// there's no flash of the wrong theme — this wires the trigger + dropdown
// (open/close itself is handled by wireNavDropdowns, same as Cards/Battle)
// and keeps the trigger's own swatch and the dropdown's "current" mark in
// sync with whichever theme is actually active.
function wireThemeSwitch() {
  const trigger = document.getElementById("bakemon-theme-trigger");
  const wrapper = document.getElementById("bakemon-theme-switch");
  const options = document.querySelectorAll(".bakemon-theme-option");
  if (!trigger || !wrapper) return;

  const applyTheme = (theme) => {
    document.documentElement.dataset.bakemonTheme = theme;
    trigger.classList.remove("felt", "parchment", "arcade");
    trigger.classList.add(theme);
    options.forEach(opt => {
      const isCurrent = opt.dataset.theme === theme;
      opt.classList.toggle("current", isCurrent);
      opt.setAttribute("aria-pressed", isCurrent ? "true" : "false");
    });
  };

  applyTheme(document.documentElement.dataset.bakemonTheme || "felt");

  options.forEach(opt => {
    opt.addEventListener("click", () => {
      localStorage.setItem(BAKEMON_THEME_KEY, opt.dataset.theme);
      applyTheme(opt.dataset.theme);
      wrapper.classList.remove("open"); // picking a theme closes the dropdown too
    });
  });
}

function wireRulesDrawer() {
  function openRulesDrawer() {
    document.getElementById("rules-drawer").classList.add("open");
    document.getElementById("rules-backdrop").classList.add("open");
  }
  function closeRulesDrawer() {
    document.getElementById("rules-drawer").classList.remove("open");
    document.getElementById("rules-backdrop").classList.remove("open");
  }
  document.getElementById("rules-toggle-btn").addEventListener("click", (e) => {
    e.preventDefault();
    openRulesDrawer();
  });
  document.getElementById("rules-close-btn").addEventListener("click", closeRulesDrawer);
  document.getElementById("rules-backdrop").addEventListener("click", closeRulesDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeRulesDrawer();
  });
}

// ---------- Match challenges ----------
// The Supabase CDN script tag and this one are both plain <script src>
// tags; nothing guarantees which finishes loading first, so wait for
// window.supabase to actually exist rather than assuming it's already there.
function waitForSupabaseLib(maxWaitMs = 3000) {
  return new Promise((resolve) => {
    const start = Date.now();
    (function check() {
      if (window.supabase) return resolve(true);
      if (Date.now() - start > maxWaitMs) return resolve(false);
      setTimeout(check, 30);
    })();
  });
}

const BAKEMON_SUPABASE_URL = "https://ykfuhvkjknrhocmahelx.supabase.co";
const BAKEMON_SUPABASE_ANON_KEY = "sb_publishable_eyQa19eT_dhAEKFxTLNX5Q_AqsL7HSl";

function bakemonEscapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

let bakemonChallengesSb = null; // one shared client, created once the CDN lib is ready
let bakemonPlayer = null;

// A count only — how many received challenges genuinely still need a
// decision (no response yet, not hidden). The full list — sent and
// received, with message/room code/response state, Join, Accept/Reject,
// and a per-side "remove from my list" — lives in the Challenges drawer
// (see wireChallengesDrawer), opened via window.openChallengesDrawer()
// from the "View Challenges" button on your own profile page.
async function updateChallengeBadge() {
  const player = getBakemonPlayer();
  if (!player) return;
  bakemonPlayer = player;

  const badge = document.getElementById("bakemon-identity-badge");
  if (!badge) return;

  const ready = await waitForSupabaseLib();
  if (!ready) return; // a missed notification badge isn't worth failing the page over
  bakemonChallengesSb = bakemonChallengesSb || window.supabase.createClient(BAKEMON_SUPABASE_URL, BAKEMON_SUPABASE_ANON_KEY);

  const { count, error } = await bakemonChallengesSb
    .from("challenges")
    .select("id", { count: "exact", head: true })
    .eq("to_player_id", player.id)
    .eq("hidden_by_recipient", false)
    .is("response", null);
  if (error) { console.error("shared-header.js: failed to count challenges", error); return; }

  if (count > 0) {
    badge.textContent = String(count);
    badge.style.display = "inline-block";
  }

  wireChallengesDrawer();
}

function wireChallengesDrawer() {
  const drawer = document.getElementById("challenges-drawer");
  const backdrop = document.getElementById("challenges-backdrop");
  if (!drawer || !backdrop || drawer.dataset.wired) return;
  drawer.dataset.wired = "1"; // updateChallengeBadge() could in principle re-run; only wire once

  function open() {
    loadChallengesDrawer();
    drawer.classList.add("open");
    backdrop.style.display = "block";
  }
  function close() {
    drawer.classList.remove("open");
    backdrop.style.display = "none";
  }
  window.openChallengesDrawer = open;

  document.getElementById("challenges-close-btn").addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  document.querySelectorAll(".challenges-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".challenges-tab").forEach(t => t.classList.remove("current"));
      document.querySelectorAll(".challenges-tab-panel").forEach(p => p.classList.remove("current"));
      tab.classList.add("current");
      document.getElementById(`challenges-panel-${tab.dataset.tab}`).classList.add("current");
    });
  });
}

async function loadChallengesDrawer() {
  if (!bakemonChallengesSb || !bakemonPlayer) return;
  const sb = bakemonChallengesSb;
  const player = bakemonPlayer;

  const [{ data: received, error: recvErr }, { data: sent, error: sentErr }] = await Promise.all([
    sb.from("challenges").select("id, from_player_id, room_code, message, response, created_at")
      .eq("to_player_id", player.id).eq("hidden_by_recipient", false).order("created_at", { ascending: false }),
    sb.from("challenges").select("id, to_player_id, room_code, message, response, created_at")
      .eq("from_player_id", player.id).eq("hidden_by_sender", false).order("created_at", { ascending: false }),
  ]);
  if (recvErr || sentErr) { console.error("shared-header.js: failed to load challenges", recvErr || sentErr); return; }

  const otherIds = [...new Set([...(received || []).map(c => c.from_player_id), ...(sent || []).map(c => c.to_player_id)])];
  const { data: otherPlayers } = otherIds.length
    ? await sb.from("players").select("id, display_name").in("id", otherIds)
    : { data: [] };
  const nameFor = (id) => (otherPlayers || []).find(p => p.id === id)?.display_name || "Someone";

  renderReceivedPanel(received || [], nameFor);
  renderSentPanel(sent || [], nameFor);
}

function bakemonResponseTag(response) {
  if (response === "accepted") return `<span class="response-tag accepted">Accepted</span>`;
  if (response === "rejected") return `<span class="response-tag rejected">Rejected</span>`;
  return `<span class="response-tag pending">No response yet</span>`;
}

function renderReceivedPanel(challenges, nameFor) {
  const panel = document.getElementById("challenges-panel-received");
  if (challenges.length === 0) {
    panel.innerHTML = `<div class="challenge-drawer-empty">No challenges received yet.</div>`;
    return;
  }
  panel.innerHTML = challenges.map(c => `
    <div class="challenge-drawer-item">
      <button type="button" class="hide-btn" data-hide="${c.id}" title="Remove from this list">✕</button>
      <div class="who">${bakemonEscapeHtml(nameFor(c.from_player_id))} challenged you!</div>
      ${c.message ? `<div class="msg">"${bakemonEscapeHtml(c.message)}"</div>` : ""}
      <div class="code">Room code: <strong>${bakemonEscapeHtml(c.room_code)}</strong></div>
      ${bakemonResponseTag(c.response)}
      <div class="challenge-drawer-actions">
        ${!c.response ? `
          <button type="button" class="small primary" data-accept="${c.id}">Accept</button>
          <button type="button" class="small" data-reject="${c.id}">Reject</button>
        ` : ""}
        <button type="button" class="small primary" data-join="${c.id}" data-room-code="${bakemonEscapeHtml(c.room_code)}">Join</button>
      </div>
    </div>
  `).join("");
  wireDrawerItemButtons(panel, "recipient");
}

function renderSentPanel(challenges, nameFor) {
  const panel = document.getElementById("challenges-panel-sent");
  if (challenges.length === 0) {
    panel.innerHTML = `<div class="challenge-drawer-empty">You haven't sent any challenges yet.</div>`;
    return;
  }
  panel.innerHTML = challenges.map(c => `
    <div class="challenge-drawer-item">
      <button type="button" class="hide-btn" data-hide="${c.id}" title="Remove from this list">✕</button>
      <div class="who">Challenged ${bakemonEscapeHtml(nameFor(c.to_player_id))}</div>
      ${c.message ? `<div class="msg">"${bakemonEscapeHtml(c.message)}"</div>` : ""}
      <div class="code">Room code: <strong>${bakemonEscapeHtml(c.room_code)}</strong></div>
      ${bakemonResponseTag(c.response)}
      <div class="challenge-drawer-actions">
        <button type="button" class="small primary" data-join="${c.id}" data-room-code="${bakemonEscapeHtml(c.room_code)}">Join</button>
      </div>
    </div>
  `).join("");
  wireDrawerItemButtons(panel, "sender");
}

// side is "recipient" or "sender" — which half of the table (and which
// hidden_by_* column) these buttons act on. Join only auto-accepts from the
// recipient's own panel; a sender joining their own sent challenge isn't
// "accepting" anything, there's no reply to record.
function wireDrawerItemButtons(panel, side) {
  panel.querySelectorAll("[data-accept]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await bakemonChallengesSb.from("challenges").update({ response: "accepted" }).eq("id", btn.dataset.accept);
      loadChallengesDrawer();
    });
  });
  panel.querySelectorAll("[data-reject]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await bakemonChallengesSb.from("challenges").update({ response: "rejected" }).eq("id", btn.dataset.reject);
      loadChallengesDrawer();
    });
  });
  panel.querySelectorAll("[data-hide]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const field = side === "sender" ? "hidden_by_sender" : "hidden_by_recipient";
      await bakemonChallengesSb.from("challenges").update({ [field]: true }).eq("id", btn.dataset.hide);
      loadChallengesDrawer();
      updateChallengeBadge();
    });
  });
  panel.querySelectorAll("[data-join]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (side === "recipient") {
        // Joining implies you're coming — counts as accepting even if you
        // hadn't clicked Accept first (or had rejected, then changed your
        // mind). Never touches hidden_by_* — joining should never make the
        // challenge, and its room code, disappear from either list.
        await bakemonChallengesSb.from("challenges").update({ response: "accepted" }).eq("id", btn.dataset.join);
      }
      location.href = `playmat.html?join=${encodeURIComponent(btn.dataset.roomCode)}`;
    });
  });
}
