import { fetchTicket, getDevInfo } from "@/lib/jira";
import { parsePrUrl, fetchPullRequest } from "@/lib/github";

export async function POST(req) {
  try {
    const { ticketId } = await req.json();

    if (!ticketId || !ticketId.trim()) {
      return Response.json({ error: "Ticket ID is required" }, { status: 400 });
    }

    const ticket = await fetchTicket(ticketId.trim().toUpperCase());

    const prUrls = new Set();

    let linkedPRs = [];
    try {
      const devInfo = await getDevInfo(ticket.id);
      linkedPRs = devInfo.pullRequests || [];
      for (const pr of linkedPRs) {
        if (pr.url) prUrls.add(pr.url);
      }
    } catch {
      // Dev info API may not be available
    }

    const ghPrPattern = /https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/g;
    const textToScan = [
      ticket.description || "",
      ...ticket.comments.map((c) => c.body),
    ].join("\n");

    for (const match of textToScan.matchAll(ghPrPattern)) {
      prUrls.add(match[0]);
    }

    const prDetails = [];
    for (const url of prUrls) {
      try {
        const parsed = parsePrUrl(url);
        if (parsed) {
          const pr = await fetchPullRequest(parsed.owner, parsed.repo, parsed.number);
          prDetails.push({ url, ...pr });
        }
      } catch {
        prDetails.push({ url, error: "Could not fetch PR details" });
      }
    }

    const imageAttachments = [];
    const imageTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
    for (const att of ticket.attachments || []) {
      if (imageTypes.includes(att.mimeType) && att.url) {
        try {
          const imgRes = await fetch(att.url, {
            headers: {
              Authorization:
                "Basic " +
                Buffer.from(
                  `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`
                ).toString("base64"),
            },
          });
          if (imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer());
            imageAttachments.push({
              name: att.filename,
              mimeType: att.mimeType,
              dataUrl: `data:${att.mimeType};base64,${buf.toString("base64")}`,
            });
          }
        } catch {
          // Skip images that fail to download
        }
        if (imageAttachments.length >= 6) break;
      }
    }

    const ticketText = formatTicketText(ticket);
    const prText = formatPrText(prDetails);
    const formattedText = [ticketText, prText].filter(Boolean).join("\n\n");

    return Response.json({
      ticket,
      linkedPRs,
      prDetails,
      ticketText,
      prText,
      formattedText,
      imageAttachments,
    });
  } catch (err) {
    console.error("Jira fetch error:", err);
    return Response.json(
      { error: err.message || "Failed to fetch Jira ticket" },
      { status: 500 }
    );
  }
}

function formatTicketText(ticket) {
  let text = `[${ticket.key}] ${ticket.summary}\n`;
  text += `Status: ${ticket.status || "Unknown"} | Priority: ${ticket.priority || "Unknown"}`;
  if (ticket.assignee) text += ` | Assignee: ${ticket.assignee}`;
  if (ticket.labels?.length) text += ` | Labels: ${ticket.labels.join(", ")}`;
  text += "\n\n";

  if (ticket.description) {
    text += `Description:\n${ticket.description}\n\n`;
  }

  if (ticket.comments?.length) {
    text += `Recent Comments:\n`;
    for (const c of ticket.comments) {
      text += `— ${c.author} (${new Date(c.created).toLocaleDateString()}):\n${c.body}\n\n`;
    }
  }

  if (ticket.linkedIssues?.length) {
    text += `Linked Issues:\n`;
    for (const link of ticket.linkedIssues) {
      text += `- ${link.type}: ${link.key} — ${link.summary} (${link.status})\n`;
    }
    text += "\n";
  }

  if (ticket.attachments?.length) {
    text += `Attachments:\n`;
    for (const a of ticket.attachments) {
      text += `- ${a.filename} (${a.mimeType})\n`;
    }
  }

  return text.trim();
}

function formatPrText(prDetails) {
  if (!prDetails?.length) return "";

  let text = "";
  for (const pr of prDetails) {
    if (pr.error) {
      text += `PR: ${pr.url} — ${pr.error}\n\n`;
      continue;
    }
    const repoMatch = (pr.url || "").match(/github\.com\/[^/]+\/([^/]+)/);
    const repoName = repoMatch ? repoMatch[1] : "unknown";
    text += `PR: ${pr.title}\n`;
    text += `Repository: ${repoName}\n`;
    text += `Author: ${pr.author} | State: ${pr.state}${pr.merged ? " (merged)" : ""}\n`;
    text += `Branch: ${pr.headBranch} → ${pr.baseBranch}\n`;
    text += `Changes: +${pr.additions} -${pr.deletions} across ${pr.changedFiles} files\n`;
    if (pr.body) text += `\nPR Description:\n${pr.body}\n`;
    if (pr.files?.length) {
      text += `\nFiles Changed:\n`;
      for (const f of pr.files) {
        text += `- ${f.filename} (${f.status}, +${f.additions} -${f.deletions})\n`;
      }
    }
    if (pr.files?.length) {
      text += `\nCode Changes:\n`;
      for (const f of pr.files) {
        if (f.patch) {
          text += `--- ${f.filename} ---\n${f.patch}\n\n`;
        }
      }
    }
    text += "\n";
  }

  return text.trim();
}
