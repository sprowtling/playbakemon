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

  if (path === "playmat.html") {
    document.getElementById("nav-link-playmat")?.classList.add("current");
  } else if (path === "deckbuilder.html") {
    if (tab === "deck") {
      document.getElementById("nav-link-deckbuilder")?.classList.add("current");
    } else {
      document.getElementById("nav-link-collection")?.classList.add("current");
    }
  }
}

function renderIdentity() {
  const player = getBakemonPlayer();
  const el = document.getElementById("bakemon-identity-slot");
  if (!el) return;
  el.innerHTML = "";
  if (!player) return;

  const nameSpan = document.createElement("span");
  nameSpan.append("Playing as ");
  const strong = document.createElement("strong");
  strong.textContent = player.display_name;
  nameSpan.append(strong);
  el.append(nameSpan);

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
