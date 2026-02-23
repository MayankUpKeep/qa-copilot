const token = process.env.GITHUB_TOKEN;

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github.v3+json",
};

export function parsePrUrl(url) {
  const match = url.match(
    /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/
  );
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: parseInt(match[3]) };
}

export async function fetchPullRequest(owner, repo, number) {
  const base = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`;

  const [prRes, filesRes, commentsRes] = await Promise.all([
    fetch(base, { headers }),
    fetch(`${base}/files?per_page=100`, { headers }),
    fetch(`${base}/comments?per_page=50`, { headers }),
  ]);

  if (!prRes.ok) {
    const text = await prRes.text();
    throw new Error(`GitHub API ${prRes.status}: ${text}`);
  }

  const pr = await prRes.json();
  const files = filesRes.ok ? await filesRes.json() : [];
  const comments = commentsRes.ok ? await commentsRes.json() : [];

  return {
    title: pr.title,
    body: pr.body || "",
    state: pr.state,
    merged: pr.merged,
    baseBranch: pr.base?.ref,
    headBranch: pr.head?.ref,
    author: pr.user?.login,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
    files: files.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: (f.patch || "").substring(0, 2000),
    })),
    reviewComments: comments.map((c) => ({
      author: c.user?.login,
      body: c.body,
      path: c.path,
      line: c.line,
    })),
  };
}
