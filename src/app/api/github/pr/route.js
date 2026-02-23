import { parsePrUrl, fetchPullRequest } from "@/lib/github";

export async function POST(req) {
  try {
    const { prUrl } = await req.json();

    if (!prUrl || !prUrl.trim()) {
      return Response.json({ error: "PR URL is required" }, { status: 400 });
    }

    const parsed = parsePrUrl(prUrl.trim());
    if (!parsed) {
      return Response.json(
        { error: "Invalid GitHub PR URL. Expected format: https://github.com/owner/repo/pull/123" },
        { status: 400 }
      );
    }

    const pr = await fetchPullRequest(parsed.owner, parsed.repo, parsed.number);

    const formattedText = formatPrAsText(pr);

    return Response.json({ pr, formattedText });
  } catch (err) {
    console.error("GitHub PR fetch error:", err);
    return Response.json(
      { error: err.message || "Failed to fetch PR" },
      { status: 500 }
    );
  }
}

function formatPrAsText(pr) {
  let text = `PR: ${pr.title}\n`;
  text += `Author: ${pr.author} | State: ${pr.state}${pr.merged ? " (merged)" : ""}\n`;
  text += `Branch: ${pr.headBranch} → ${pr.baseBranch}\n`;
  text += `Changes: +${pr.additions} -${pr.deletions} across ${pr.changedFiles} files\n\n`;

  if (pr.body) {
    text += `Description:\n${pr.body}\n\n`;
  }

  if (pr.files?.length) {
    text += `Files Changed:\n`;
    for (const f of pr.files) {
      text += `- ${f.filename} (${f.status}, +${f.additions} -${f.deletions})\n`;
    }
    text += "\n";
  }

  if (pr.files?.length) {
    text += `Code Changes (truncated):\n`;
    for (const f of pr.files) {
      if (f.patch) {
        text += `--- ${f.filename} ---\n${f.patch}\n\n`;
      }
    }
  }

  if (pr.reviewComments?.length) {
    text += `Review Comments:\n`;
    for (const c of pr.reviewComments) {
      text += `- ${c.author} on ${c.path}:${c.line}: ${c.body}\n`;
    }
  }

  return text.trim();
}
