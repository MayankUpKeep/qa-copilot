import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";

export async function POST(req) {
  try {
    const { title, description } = await req.json();

    const systemInstruction = `
You are a Senior QA Engineer rewriting poorly written Jira bug reports into clear, structured, reproducible tickets.

CRITICAL GROUNDING RULES:
- ONLY use information present in the original title and description.
- Do NOT invent new behaviors, modules, or features not mentioned.
- If the original bug is vague, keep the rewritten version equally scoped — do NOT expand beyond what was reported.
- If a field cannot be filled from the original, write "(not specified in original report)" — never fabricate.
- Infer logical steps ONLY when the sequence is obvious from context. Flag inferred steps with "(inferred)".

REWRITING GOALS:
- Make the bug reproducible by a developer who has never seen it.
- Separate observed behavior (Actual) from expected behavior (Expected) clearly.
- Ensure Steps to Reproduce are numbered, specific, and start from a clear entry point.
- Preserve the tester's intent — do not change what the bug is about.

SEVERITY CLASSIFICATION (apply strictly):
- Blocker: User cannot proceed at all OR core workflow is completely broken.
- Critical: Data loss, security exposure, or payment/billing failure.
- Major: Feature is unusable but a workaround exists.
- Minor: Cosmetic, typo, or minor usability issue.
- If severity cannot be determined from the description, write "To be confirmed by QA" with reasoning.
`;

    const prompt = `
Rewrite this poorly written Jira bug into a professional, structured QA bug report.

Original Title:
${title}

Original Description:
${description || "(no description provided)"}

RULES:
- Every field must trace back to the original title/description.
- Do NOT add scenarios, edge cases, or behaviors not in the original.
- If description is empty or too vague, write a minimal report and flag: "Original report lacks detail — tester should clarify."

Output EXACTLY in this structure:

Title:
[Module if known] - [User Action] - [Problem]

Module:
(Extract from original. If unclear: "Unknown Module")

Environment:
(Only if mentioned in original. Default: "Not specified")

Preconditions:
(Only if implied by original. Default: "None specified")

Steps to Reproduce:
1.
2.
3.

Expected Result:

Actual Result:

Impact:
(1-2 lines based on what the original report implies)

Severity:
(Blocker / Critical / Major / Minor / "To be confirmed by QA" — with 1-line justification)

Possible Root Cause:
(Only if original mentions error codes, logs, or technical details. Otherwise: "Not determinable from report")

Improvement Notes:
(What was unclear in the original and what you inferred or flagged)
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
    return Response.json({ output: "Error improving bug." });
  }
}
