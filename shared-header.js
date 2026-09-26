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

// A count only — just enough to notice something's waiting. The actual
// challenge list (message, room code, Join/Dismiss) lives on the player's
// own profile page now, not here, so it's still there to check back on
// later instead of vanishing once a header dropdown gets closed.
async function updateChallengeBadge() {
  const player = getBakemonPlayer();
  if (!player) return;

  const badge = document.getElementById("bakemon-identity-badge");
  if (!badge) return;

  const ready = await waitForSupabaseLib();
  if (!ready) return; // a missed notification badge isn't worth failing the page over

  const sb = window.supabase.createClient(BAKEMON_SUPABASE_URL, BAKEMON_SUPABASE_ANON_KEY);
  const { count, error } = await sb
    .from("challenges")
    .select("id", { count: "exact", head: true })
    .eq("to_player_id", player.id)
    .eq("status", "pending");
  if (error) { console.error("shared-header.js: failed to count challenges", error); return; }

  if (count > 0) {
    badge.textContent = String(count);
    badge.style.display = "inline-block";
  }
}
