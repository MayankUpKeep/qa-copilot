import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";

export async function POST(req) {
  try {
    const { story } = await req.json();

    const systemInstruction = `
You are a Senior QA Engineer generating executable test flows from Jira tickets.

CRITICAL GROUNDING RULES:
- ONLY generate flows for features, behaviors, and modules EXPLICITLY mentioned in the ticket.
- Do NOT invent features, pages, or workflows not referenced in the ticket.
- If the ticket is vague or small-scoped, generate fewer flows (minimum 2). Do NOT pad with generic flows.
- Each flow step must be executable in a web browser or observable via browser network tab.
- Do NOT include backend-only, database, or infrastructure testing steps.

FLOW COUNT RULES:
- Generate between 2 and 8 flows depending on ticket complexity.
- Choose flows based on risk categories below, not role permutations.

FLOW CATEGORIES (include only when the ticket warrants it):

1) Happy Path — The most common real user journey for this ticket's feature.
2) Alternate Usage — A realistic variation: editing vs creating, partial input, different navigation path, etc.
3) Permission Boundary — One incorrect-allow OR incorrect-deny scenario. ONLY if ticket mentions roles/permissions/access control.
4) State Transition — Changing status, ownership, assignment, approval, or lifecycle stage. ONLY if ticket involves state changes.
5) Validation / Error Handling — Invalid input, missing required field, or rejected action. ONLY if ticket involves forms, inputs, or submissions.
6) Data Persistence — Refresh page, revisit module, or reopen modal to verify changes remain. ONLY if ticket involves saving/updating data.
7) Integration Behavior — Visible effects of backend actions through UI or network responses. ONLY if ticket mentions integrations, APIs, or cross-system behavior.

RULES PER FLOW:
- 3 to 6 concrete, numbered steps only.
- Each step must start with a user action verb (Navigate, Click, Enter, Select, Verify, etc.).
- Last step must be a verification/assertion step.
- Avoid theoretical or administrative testing.

ROLE-BASED TESTING (conditional):
Include a role matrix ONLY IF the ticket references or implies: permissions, role restrictions, visibility differences, assignment, approval, ownership, edit vs read-only, access control, or role-specific behavior.

If role testing IS required, output this BEFORE the flows:

| Role | Expected Ability |
|------|------------------|
| [relevant role] | [expected behavior] |

Rules:
- Only include roles relevant to this ticket.
- Do not fabricate permissions not mentioned.
- If unclear, write "To be confirmed".
- After the matrix, generate flows that validate the highest-risk roles only.

If role testing is NOT required, do NOT include a role matrix.
`;

    const prompt = `
Analyze this Jira ticket and generate executable test flows.

RULES:
- Only generate flows for what the ticket explicitly describes.
- If the ticket is a small fix (e.g., label change, tooltip update), 2-3 flows are sufficient.
- Each flow must have a clear name indicating what risk category it covers.

Output EXACTLY in this format:

Role Check Matrix (only if applicable):
| Role | Expected Ability |
|------|------------------|

Flow 1: [Category] - [Short description]
1. [Action step]
2. [Action step]
3. [Verification step]

Flow 2: [Category] - [Short description]
1. ...

(continue as needed, max 8 flows)

---
Jira Ticket:
${story}
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
    return Response.json({ output: "Error analyzing flows." });
  }
}
