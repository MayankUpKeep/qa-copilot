let buttonAdded = false;

function getTicketData() {
  const title =
    document.querySelector('[data-testid="issue.views.issue-base.foundation.summary.heading"]')
      ?.innerText || "";

  const description =
    document.querySelector('[data-testid="issue.views.field.rich-text.description"]')
      ?.innerText || "";

  return `${title}\n\n${description}`;
}

function createButton() {
  if (document.getElementById("qa-copilot-btn")) return;

  const titleElement = document.querySelector(
    '[data-testid="issue.views.issue-base.foundation.summary.heading"]'
  );

  if (!titleElement) return;

  const btn = document.createElement("button");
  btn.id = "qa-copilot-btn";
  btn.innerText = "Generate QA Plan";

  btn.style.marginLeft = "12px";
  btn.style.padding = "6px 12px";
  btn.style.background = "#0052CC";
  btn.style.color = "white";
  btn.style.border = "none";
  btn.style.borderRadius = "4px";
  btn.style.cursor = "pointer";
  btn.style.fontSize = "12px";
  btn.style.fontWeight = "600";


  btn.onclick = async () => {
    const content = getTicketData();

    try {
      const encoded = encodeURIComponent(content);
      window.open(`http://localhost:3000?jira=${encoded}`, "_blank");

    } catch (e) {
      alert("QA Copilot is not running. Start localhost:3000 first.");
    }
  };

  titleElement.parentElement.appendChild(btn);
}

function observePage() {
  const observer = new MutationObserver(() => {
    createButton();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // initial attempt
  createButton();
}

observePage();

let bugbuttonAdded = false;

function createImproveButton() {
  if (bugbuttonAdded) return;

  const title = document.querySelector('[data-testid="issue.views.issue-base.foundation.summary.heading"]');

  if (!title) return;

  // prevent duplicates
  if (document.getElementById("qa-improve-btn")) return;

  const btn = document.createElement("button");
  btn.id = "qa-improve-btn";
  btn.innerText = "Improve Bug Report";

  btn.style.marginTop = "10px";
  btn.style.padding = "8px 14px";
  btn.style.background = "#7c3aed";
  btn.style.color = "white";
  btn.style.border = "none";
  btn.style.borderRadius = "8px";
  btn.style.cursor = "pointer";
  btn.style.fontWeight = "600";

  btn.onclick = async () => {
  try {
    /* ---------- GET TITLE ---------- */
    const title =
      document.querySelector(
        '[data-testid="issue.views.issue-base.foundation.summary.heading"]'
      )?.innerText || "";

    /* ---------- GET DESCRIPTION (robust) ---------- */
    let description = "";

    // Jira renders description as multiple paragraphs/spans
    const descriptionContainer = document.querySelector(
      '[data-testid="issue.views.field.rich-text.description"]'
    );

    if (descriptionContainer) {
      description = descriptionContainer.innerText;
    }

    // fallback (very important)
    if (!description || description.trim().length < 5) {
      const paragraphs = document.querySelectorAll(
        '[data-testid="issue.views.field.rich-text.description"] p'
      );

      description = Array.from(paragraphs)
        .map(p => p.innerText)
        .join("\n");
    }

    // final fallback (Jira sometimes uses role=article)
    if (!description || description.trim().length < 5) {
      const alt = document.querySelector('[role="article"]');
      if (alt) description = alt.innerText;
    }

    if (!description || description.trim().length < 5) {
      alert("Jira description not loaded yet. Scroll the description once and click again.");
      return;
    }

    /* ---------- SEND TO QA COPILOT ---------- */
    const content = `${title}\n\n${description}`;
    const encoded = encodeURIComponent(content);

    window.open(`http://localhost:3000/bug?jira=${encoded}`, "_blank");

  } catch (e) {
    console.error(e);
    alert("QA Copilot is not running or Jira page not ready.");
  }
};


  title.parentElement.appendChild(btn);
  buttonAdded = true;
}

/* ---- MAGIC PART ---- */

const observer = new MutationObserver(() => {
  createImproveButton();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

/* also run once immediately */
setTimeout(createImproveButton, 2000);

