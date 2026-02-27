(() => {
  const QA_COPILOT_URL = "http://localhost:3000";

  function getTicketId() {
    const url = window.location.href;

    // /browse/NEX-327
    let m = url.match(/\/browse\/([A-Z]+-\d+)/);
    if (m) return m[1];

    // /issues/NEX-327
    m = url.match(/\/issues\/([A-Z]+-\d+)/);
    if (m) return m[1];

    // ?selectedIssue=NEX-327
    const params = new URLSearchParams(window.location.search);
    const selected = params.get("selectedIssue");
    if (selected && /^[A-Z]+-\d+$/.test(selected)) return selected;

    // DOM: look for ticket key in any link
    const keyLink = document.querySelector('a[data-testid*="issue-key"], a[href*="/browse/"][data-testid]');
    if (keyLink) {
      const km = (keyLink.textContent || keyLink.href).match(/([A-Z]+-\d+)/);
      if (km) return km[1];
    }

    return null;
  }

  function openModule(path) {
    const ticketId = getTicketId();
    if (!ticketId) {
      alert("Could not detect ticket ID. Make sure a Jira ticket is open.");
      return;
    }
    window.open(QA_COPILOT_URL + path + "?ticketId=" + encodeURIComponent(ticketId), "_blank");
  }

  function injectPanel() {
    if (document.getElementById("qa-copilot-panel")) return;

    const panel = document.createElement("div");
    panel.id = "qa-copilot-panel";
    panel.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;";

    const toggle = document.createElement("button");
    toggle.style.cssText = "width:48px;height:48px;border-radius:14px;border:none;background:linear-gradient(135deg,#2563eb,#4f46e5);color:white;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 4px 12px rgba(37,99,235,0.35);display:flex;align-items:center;justify-content:center;";
    toggle.textContent = "SF";
    toggle.title = "QA Copilot — click to open";

    const menu = document.createElement("div");
    menu.style.cssText = "position:absolute;bottom:58px;right:0;background:white;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.15);border:1px solid #e5e7eb;padding:6px;min-width:210px;display:none;";

    // Header
    const hdr = document.createElement("div");
    hdr.style.cssText = "padding:8px 12px 4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;";
    hdr.textContent = "QA Copilot";
    menu.appendChild(hdr);

    // Ticket label
    const ticketEl = document.createElement("div");
    ticketEl.style.cssText = "padding:2px 12px 8px;font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #f3f4f6;margin-bottom:4px;";
    ticketEl.textContent = "...";
    menu.appendChild(ticketEl);

    // Module buttons
    const modules = [
      { label: "Generate Test Plan", path: "/", color: "#2563eb" },
      { label: "Generate Bug Report", path: "/bug", color: "#dc2626" },
    ];

    modules.forEach(function (mod) {
      const btn = document.createElement("button");
      btn.style.cssText = "display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:none;background:transparent;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;color:#374151;text-align:left;";
      btn.onmouseover = function () { btn.style.background = "#f3f4f6"; };
      btn.onmouseout = function () { btn.style.background = "transparent"; };

      const dot = document.createElement("span");
      dot.style.cssText = "width:8px;height:8px;border-radius:50%;background:" + mod.color + ";flex-shrink:0;";

      const lbl = document.createElement("span");
      lbl.textContent = mod.label;

      btn.appendChild(dot);
      btn.appendChild(lbl);
      btn.onclick = function () {
        openModule(mod.path);
        menu.style.display = "none";
      };
      menu.appendChild(btn);
    });

    let menuOpen = false;

    toggle.onclick = function (e) {
      e.stopPropagation();
      menuOpen = !menuOpen;
      menu.style.display = menuOpen ? "block" : "none";
      if (menuOpen) {
        const tid = getTicketId();
        ticketEl.textContent = tid || "No ticket detected";
      }
    };

    document.addEventListener("click", function () {
      menuOpen = false;
      menu.style.display = "none";
    });

    panel.appendChild(menu);
    panel.appendChild(toggle);
    document.body.appendChild(panel);

    console.log("[QA Copilot] Panel injected successfully");
  }

  // Inject immediately and also retry after delays (Jira SPA can be slow)
  injectPanel();
  setTimeout(injectPanel, 2000);
  setTimeout(injectPanel, 5000);
})();
