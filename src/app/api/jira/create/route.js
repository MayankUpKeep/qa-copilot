import { getProjectFields, createIssue, linkIssues } from "@/lib/jira";

export async function POST(req) {
  try {
    const { parentTicketId, projectKey, issueType, summary, sections } = await req.json();

    if (!projectKey || !summary || !sections) {
      return Response.json({ error: "projectKey, summary, and sections are required" }, { status: 400 });
    }

    const tpFields = await getProjectFields();

    const fieldMap = {};
    for (const field of tpFields) {
      fieldMap[field.name.toLowerCase()] = { id: field.id, type: field.type };
    }

    const customFields = {};
    let descriptionText = sections._description || "";
    const matched = [];
    const unmatched = [];

    const sectionKeys = Object.keys(sections).filter(k => k !== "_description");
    console.log("[Jira Create] Sections received:", sectionKeys);
    console.log("[Jira Create] TP fields available:", tpFields.map(f => f.name));

    for (const [sectionName, content] of Object.entries(sections)) {
      if (sectionName === "_description") continue;

      const field = fieldMap[sectionName.toLowerCase()];
      if (field) {
        customFields[field.id] = textToRichField(content);
        matched.push(sectionName);
        console.log(`[Jira Create] MATCHED: "${sectionName}" → ${field.id}`);
      } else {
        descriptionText += `\n\n**${sectionName}:**\n${content}`;
        unmatched.push(sectionName);
        console.log(`[Jira Create] UNMATCHED: "${sectionName}"`);
      }
    }

    const isSubtask = issueType === "Sub-task" || issueType === "Subtask";

    const result = await createIssue({
      projectKey,
      issueType,
      summary,
      description: descriptionText.trim() || null,
      customFields,
      parentKey: isSubtask ? parentTicketId : null,
    });

    let linkStatus = null;
    if (!isSubtask && parentTicketId) {
      const linkTypesToTry = ["Test Plan", "A related issue", "Relates"];
      for (const lt of linkTypesToTry) {
        try {
          await linkIssues(parentTicketId, result.key, lt);
          linkStatus = `Linked via "${lt}"`;
          break;
        } catch (linkErr) {
          linkStatus = `Link failed: ${linkErr.message}`;
        }
      }
    }

    const domain = process.env.JIRA_DOMAIN;
    const ticketUrl = `https://${domain}/browse/${result.key}`;

    return Response.json({
      success: true,
      key: result.key,
      id: result.id,
      url: ticketUrl,
      linkStatus,
      fieldsMatched: matched.length,
      fieldsUnmatched: unmatched,
    });
  } catch (err) {
    console.error("Jira create error:", err);
    return Response.json(
      { error: err.message || "Failed to create Jira ticket" },
      { status: 500 }
    );
  }
}

function textToRichField(text) {
  if (!text) return undefined;
  const lines = text.split("\n");
  const content = [];
  let currentList = null;
  let tableLines = [];

  function flushList() {
    if (currentList) { content.push(currentList); currentList = null; }
  }

  function flushTable() {
    if (tableLines.length === 0) return;
    const table = buildADFTable(tableLines);
    if (table) content.push(table);
    tableLines = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const isTableLine = trimmed.startsWith("|") && trimmed.endsWith("|");
    const isSeparator = isTableLine && /^\|[\s\-:|]+\|$/.test(trimmed);

    if (isTableLine) {
      flushList();
      if (!isSeparator) {
        tableLines.push(trimmed);
      }
      continue;
    }

    flushTable();

    const bulletMatch = line.match(/^\s*-\s+(.*)/);
    const numberedMatch = line.match(/^\s*\d+\.\s+(.*)/);

    if (bulletMatch) {
      if (!currentList || currentList.type !== "bulletList") {
        flushList();
        currentList = { type: "bulletList", content: [] };
      }
      currentList.content.push({
        type: "listItem",
        content: [{ type: "paragraph", content: parseInline(bulletMatch[1]) }],
      });
    } else if (numberedMatch) {
      if (!currentList || currentList.type !== "orderedList") {
        flushList();
        currentList = { type: "orderedList", content: [] };
      }
      currentList.content.push({
        type: "listItem",
        content: [{ type: "paragraph", content: parseInline(numberedMatch[1]) }],
      });
    } else {
      flushList();
      if (trimmed === "") continue;
      content.push({ type: "paragraph", content: parseInline(line) });
    }
  }

  flushList();
  flushTable();

  if (content.length === 0) {
    content.push({ type: "paragraph", content: [{ type: "text", text: " " }] });
  }

  return { type: "doc", version: 1, content };
}

function buildADFTable(rows) {
  if (rows.length === 0) return null;

  const parseCells = (row) =>
    row.split("|").slice(1, -1).map((c) => c.trim());

  const headerCells = parseCells(rows[0]);
  const tableRows = [];

  // Header row
  tableRows.push({
    type: "tableRow",
    content: headerCells.map((cell) => ({
      type: "tableHeader",
      content: [{ type: "paragraph", content: parseInline(cell || " ") }],
    })),
  });

  // Data rows
  for (let i = 1; i < rows.length; i++) {
    const cells = parseCells(rows[i]);
    const numCols = headerCells.length;
    tableRows.push({
      type: "tableRow",
      content: Array.from({ length: numCols }, (_, j) => ({
        type: "tableCell",
        content: [{ type: "paragraph", content: parseInline((cells[j] || "").trim() || " ") }],
      })),
    });
  }

  return { type: "table", content: tableRows };
}

function parseInline(text) {
  const parts = [];
  const boldRegex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "text", text: match[1], marks: [{ type: "strong" }] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", text: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", text: text || " " }];
}
