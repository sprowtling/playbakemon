// Loads shared-header.html (nav links + rules drawer) into #bakemon-shared-header-slot,
// then wires up its interactive behavior. Include this script on any page that has:
//   <div id="bakemon-shared-header-slot"></div>
// Set data-page="playmat" or data-page="deckbuilder" on that div to highlight the current nav link.

(async function () {
  const slot = document.getElementById("bakemon-shared-header-slot");
  if (!slot) {
    console.error("shared-header.js: no #bakemon-shared-header-slot element found on this page.");
    return;
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

  // Highlight the current page's nav link
  const currentPage = slot.dataset.page;
  if (currentPage === "playmat") {
    document.getElementById("nav-link-playmat")?.classList.add("current");
  } else if (currentPage === "deckbuilder") {
    document.getElementById("nav-link-deckbuilder")?.classList.add("current");
  }

  // Wire up the rules drawer
  function openRulesDrawer() {
    document.getElementById("rules-drawer").classList.add("open");
    document.getElementById("rules-backdrop").classList.add("open");
  }
  function closeRulesDrawer() {
    document.getElementById("rules-drawer").classList.remove("open");
    document.getElementById("rules-backdrop").classList.remove("open");
  }
  document.getElementById("rules-toggle-btn").addEventListener("click", openRulesDrawer);
  document.getElementById("rules-close-btn").addEventListener("click", closeRulesDrawer);
  document.getElementById("rules-backdrop").addEventListener("click", closeRulesDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeRulesDrawer();
  });

  // Let the host page know the shared header is ready, in case it needs to do anything after
  document.dispatchEvent(new CustomEvent("bakemon-shared-header-ready"));
})();
