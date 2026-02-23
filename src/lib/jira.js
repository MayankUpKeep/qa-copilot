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

function flattenADF(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.type === "text") return node.text || "";
  if (!node.content) return "";
  return node.content.map(flattenADF).join("\n").trim();
}
