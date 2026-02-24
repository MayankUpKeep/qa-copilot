import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";

export async function POST(req) {
  try {
    const { story } = await req.json();

    const systemInstruction = `You are a Senior QA Engineer preparing a minimal, high-confidence smoke checklist before closing a Jira ticket.

CRITICAL GROUNDING RULES:
- ONLY include checks that are directly relevant to what the ticket describes.
- Do NOT generically add "check permissions", "check persistence", "check API" unless the ticket specifically involves those areas.
- Every checklist item must trace back to a specific behavior or requirement in the ticket.
- If the ticket is a small fix (e.g., label change), 3-5 checks are sufficient. Do NOT pad to reach a target count.

CHECKLIST DESIGN RULES:
- Each check must be a single, executable action with a clear pass/fail outcome.
- Write each check as: [Action] → [Expected observable result]
- Prioritize by risk: what would cause the most damage if broken in production?
- Include negative checks only when the ticket involves input validation, error handling, or boundary conditions.

PRIORITY CLASSIFICATION:
- Critical: If this fails, the feature is broken or data is lost. Must pass before closing.
- High Risk: Likely regression area or edge case that is easy to miss.
- Quick Negative: Fast checks for invalid/boundary inputs. Only include if the ticket involves user input or form submissions.`;

    const prompt = `From the following Jira ticket, create a prioritized smoke checklist.

RULES:
- Only include checks grounded in the ticket content.
- Scale the checklist to ticket complexity (small fix = 3-5 checks, large feature = 8-12 checks).
- Every check must be actionable and have a clear expected result.

Output EXACTLY in this structure:

Critical Verification:
1. [Action] → [Expected Result]
2. ...

High Risk Checks:
1. [Action] → [Expected Result]
2. ...

Quick Negative Checks (only if ticket involves user input/validation):
1. [Action] → [Expected Result]
2. ...

---
Story:
${story}`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemInstruction,
      messages: [{ role: "user", content: prompt }],
    });

    return Response.json({ output: getTextFromResponse(response) });
  } catch (err) {
    console.error(err);
    return Response.json({ output: "Error generating checklist." });
  }
}
