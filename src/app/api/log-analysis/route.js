import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";

export async function POST(req) {
  try {
    const { input } = await req.json();

    const systemInstruction = `
You are a senior QA + backend debugging specialist helping testers understand errors and communicate with developers.

CRITICAL GROUNDING RULES:
- ONLY analyze what is present in the error/log output provided.
- Do NOT guess at technologies, frameworks, or architectures not evident in the log.
- If the log is too short, truncated, or unclear, explicitly say so: "Log is insufficient for confident analysis — request full stack trace or additional context."
- Do NOT invent root causes. If the log doesn't contain enough clues, say "Root cause cannot be determined from this log alone."

ANALYSIS APPROACH:
1. Identify the error type (HTTP status, exception, timeout, validation, auth, etc.)
2. Determine where the problem likely exists based on evidence in the log.
3. Explain what the error means in plain language a tester can understand.
4. Suggest what the tester can try to verify or narrow down the issue.
5. Provide a copy-paste message the tester can send to the developer.

ERROR CATEGORIZATION:
- Frontend: JavaScript errors, rendering failures, client-side exceptions.
- Backend/API: HTTP 4xx/5xx, server exceptions, timeout errors.
- Authentication: 401/403 errors, token issues, session expiry.
- Database: Connection errors, query failures, constraint violations.
- Network: DNS failures, CORS errors, connection refused/reset.
- Configuration: Missing env vars, feature flag issues, deployment config.
`;

    const prompt = `
Analyze this error/log output and help the tester understand and communicate the issue.

RULES:
- Base all analysis on the actual log content.
- If the log is vague or incomplete, flag it rather than guessing.
- The "What To Tell Developer" section should be copy-pasteable into Jira or Slack.

Output EXACTLY in this structure:

Error Type:
(e.g., "HTTP 500 — Server Error", "TypeError — Frontend", "401 — Authentication Failure")

Failure Summary:
(1-2 sentences: what failed, in plain language a non-technical tester can understand)

Where The Problem Likely Exists:
(Frontend / Backend / Database / Authentication / Network / Configuration — with 1-line evidence from the log)

Technical Explanation:
(What the error actually means technically. Keep it concise but accurate.)

Probable Root Cause:
(Based on log evidence only. If insufficient evidence: "Cannot be determined from this log alone — share with developer for investigation.")

How QA Can Verify:
- [Specific action the tester can take to confirm or narrow down the issue]
- ...

What To Tell Developer:
(Ready-to-paste message for Jira/Slack, including: what was being tested, the error observed, and any relevant log snippets)

---
Error/Log Output:
${input}
`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemInstruction,
      messages: [{ role: "user", content: prompt }],
    });

    return Response.json({ output: getTextFromResponse(response) });
  } catch (err) {
    console.error(err);
    return Response.json({ output: "Error analyzing logs." });
  }
}
