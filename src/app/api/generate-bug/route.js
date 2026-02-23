import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";

export async function POST(req) {
  try {
    const { bug } = await req.json();

    const systemInstruction = `
You are a Senior QA Engineer converting raw tester observations into professional, Jira-ready bug reports.

CRITICAL GROUNDING RULES:
- ONLY describe behavior that is explicitly stated or directly implied by the tester's observation.
- Do NOT invent steps, modules, or behaviors not mentioned.
- If the observation is vague, write shorter sections and flag uncertainty with "(to be confirmed)".
- Do NOT assume environment, browser, or platform unless the tester mentions it. Default to "Web (to be confirmed)".
- Do NOT fabricate root causes. If no technical clue is given, write "No technical indicators available from the observation."

SEVERITY CLASSIFICATION (apply strictly):
- Blocker: User cannot proceed at all OR a core workflow is completely broken. Example: login fails for all users, checkout crashes.
- Critical: Data loss, security exposure, or payment/billing failure. Example: saved records disappear, unauthorized data visible.
- Major: Feature is unusable but a workaround exists. Example: filter doesn't work but manual scroll finds the item.
- Minor: Cosmetic, typo, or minor usability issue. Example: misaligned button, wrong label text.

TONE: Neutral, factual, concise. No opinions, no exaggeration, no "the system is broken" language.
`;

    const prompt = `
Convert this raw bug observation into a structured Jira bug report.

RULES:
- Each field must be grounded in the observation below.
- Steps to Reproduce must be numbered, specific, and executable.
- Expected vs Actual must describe observable behavior (UI state, message, response), not internal logic.
- If information is missing for a field, write "(not specified in observation)" — do NOT invent.

Output EXACTLY in this structure:

Title:
[Module if known] - [User Action] - [Problem]

Environment:
(Only state what the tester mentioned. Default: "Web (to be confirmed)")

Preconditions:
(State required setup. Write "None specified" if observation doesn't mention any.)

Steps to Reproduce:
1.
2.
3.

Expected Result:
(What should happen — based on standard behavior implied by the observation)

Actual Result:
(What the tester observed — use their words, do not rephrase loosely)

Impact:
(1-2 lines: who is affected and how. Only claim what the observation supports.)

Severity:
(Blocker / Critical / Major / Minor — with 1-line justification referencing the severity rules above)

Possible Root Cause:
(Only if the observation contains technical clues like error codes, console messages, or API responses. Otherwise: "No technical indicators available from the observation.")

Tester Notes:
(Reproduce any additional debugging context the tester provided. If none: "None provided.")

---
Bug observation:
${bug}
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
    return Response.json({ output: "Error generating bug report." });
  }
}
