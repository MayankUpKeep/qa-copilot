const domain = process.env.JIRA_DOMAIN;
const email = process.env.JIRA_EMAIL;
const token = process.env.JIRA_API_TOKEN;

function getAuthHeader() {
  return "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
}

function getBaseUrl() {
  return `https://${domain}/rest/api/3`;
}

export async function fetchTicket(ticketId) {
  const res = await fetch(
    `${getBaseUrl()}/issue/${ticketId}?fields=summary,description,comment,attachment,issuelinks,status,priority,assignee,labels`,
    {
      headers: {
        Authorization: getAuthHeader(),
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API ${res.status}: ${text}`);
  }

  const data = await res.json();
  const fields = data.fields;

  const description = flattenADF(fields.description);
  const comments = (fields.comment?.comments || [])
    .slice(-5)
    .map((c) => ({
      author: c.author?.displayName || "Unknown",
      body: flattenADF(c.body),
      created: c.created,
    }));

  const attachments = (fields.attachment || []).map((a) => ({
    filename: a.filename,
    mimeType: a.mimeType,
    url: a.content,
  }));

  const linkedIssues = (fields.issuelinks || []).map((link) => {
    const related = link.inwardIssue || link.outwardIssue;
    return {
      type: link.type?.name || "Related",
      direction: link.inwardIssue ? "inward" : "outward",
      key: related?.key,
      summary: related?.fields?.summary,
      status: related?.fields?.status?.name,
    };
  });

  return {
    id: data.id,
    key: data.key,
    summary: fields.summary,
    description,
    status: fields.status?.name,
    priority: fields.priority?.name,
    assignee: fields.assignee?.displayName,
    labels: fields.labels || [],
    comments,
    attachments,
    linkedIssues,
  };
}

export async function postComment(ticketId, commentText) {
  const res = await fetch(`${getBaseUrl()}/issue/${ticketId}/comment`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      body: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: commentText }],
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API ${res.status}: ${text}`);
  }

  return await res.json();
}

export async function getDevInfo(ticketId) {
  const res = await fetch(
    `https://${domain}/rest/dev-status/latest/issue/detail?issueId=${ticketId}&applicationType=GitHub&dataType=pullrequest`,
    {
      headers: {
        Authorization: getAuthHeader(),
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) return { pullRequests: [] };

  const data = await res.json();
  const prs = [];

  for (const detail of data.detail || []) {
    for (const pr of detail.pullRequests || []) {
      prs.push({
        name: pr.name,
        url: pr.url,
        status: pr.status,
        source: pr.source?.branch,
        destination: pr.destination?.branch,
      });
    }
  }

  return { pullRequests: prs };
}

export async function getProjectFields() {
  const res = await fetch(`${getBaseUrl()}/field`, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API ${res.status}: ${text}`);
  }

  const fields = await res.json();
  return fields
    .filter((f) => f.name && f.name.startsWith("TP "))
    .map((f) => ({ id: f.id, name: f.name, custom: f.custom, type: f.schema?.type || "string" }));
}

export async function createIssue({ projectKey, issueType, summary, description, customFields, parentKey }) {
  const body = {
    fields: {
      project: { key: projectKey },
      issuetype: { name: issueType },
      summary,
      ...customFields,
    },
  };

  if (description) {
    body.fields.description = textToADF(description);
  }

  if (parentKey && (issueType === "Sub-task" || issueType === "Subtask")) {
    body.fields.parent = { key: parentKey };
  }

  const res = await fetch(`${getBaseUrl()}/issue`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API ${res.status}: ${text}`);
  }

  return await res.json();
}

export async function linkIssues(inwardKey, outwardKey, linkType = "Relates") {
  const res = await fetch(`${getBaseUrl()}/issueLink`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: { name: linkType },
      inwardIssue: { key: inwardKey },
      outwardIssue: { key: outwardKey },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API ${res.status}: ${text}`);
  }
}

function textToADF(text) {
  const lines = text.split("\n");
  const content = [];
  let currentList = null;

  for (const line of lines) {
    const bulletMatch = line.match(/^(\s*)-\s+(.*)/);
    const numberedMatch = line.match(/^(\s*)\d+\.\s+(.*)/);
    const tableMatch = line.startsWith("|");

    if (bulletMatch) {
      if (!currentList || currentList.type !== "bulletList") {
        if (currentList) content.push(currentList);
        currentList = { type: "bulletList", content: [] };
      }
      currentList.content.push({
        type: "listItem",
        content: [{ type: "paragraph", content: inlineTextToADF(bulletMatch[2]) }],
      });
    } else if (numberedMatch) {
      if (!currentList || currentList.type !== "orderedList") {
        if (currentList) content.push(currentList);
        currentList = { type: "orderedList", content: [] };
      }
      currentList.content.push({
        type: "listItem",
        content: [{ type: "paragraph", content: inlineTextToADF(numberedMatch[2]) }],
      });
    } else if (tableMatch) {
      if (currentList) { content.push(currentList); currentList = null; }
      // Tables are complex in ADF; pass as a code block for reliable rendering
      let tableBlock = line + "\n";
      // Caller should group table lines — single-line tables become code
      content.push({ type: "paragraph", content: inlineTextToADF(line) });
    } else {
      if (currentList) { content.push(currentList); currentList = null; }
      if (line.trim() === "") continue;

      const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
      if (headingMatch) {
        content.push({
          type: "heading",
          attrs: { level: headingMatch[1].length },
          content: inlineTextToADF(headingMatch[2]),
        });
      } else {
        content.push({ type: "paragraph", content: inlineTextToADF(line) });
      }
    }
  }

  if (currentList) content.push(currentList);

  return { type: "doc", version: 1, content: content.length > 0 ? content : [{ type: "paragraph", content: [{ type: "text", text: " " }] }] };
}

function inlineTextToADF(text) {
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

function flattenADF(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.type === "text") return node.text || "";
  if (!node.content) return "";
  return node.content.map(flattenADF).join("\n").trim();
}
