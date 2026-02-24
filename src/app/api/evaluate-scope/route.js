import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";

export async function POST(req) {
  try {
    const { story, planA, planB } = await req.json();

    const systemInstruction = `
You are a Senior QA Engineer writing the DEFINITIVE TESTING SCOPE for a Jira ticket.

You have two inputs:
1. Plan A (User Perspective) — written from an end-user's point of view. Covers user journeys, UX flows, edge cases users would hit, and areas of the app affected from a user standpoint.
2. Plan B (Technical Perspective) — written from a code/PR analysis standpoint. Covers API behavior, data flow, error handling, boundary conditions, regression from actual code changes.

YOUR JOB:
1. First, produce an ALIGNMENT DIFF that categorizes every test item from both plans.
2. Then, produce the unified TESTING SCOPE.

ALIGNMENT RULES:
- Go through every test scenario / scope item in Plan A and Plan B.
- Categorize each as:
  [ALIGNED] — The item appears in BOTH plans (same feature/behavior described from user vs technical perspective). Merge into one description.
  [PLAN A ONLY] — The item appears ONLY in Plan A (user perspective). The PR does not appear to cover it. This is a POTENTIAL GAP — the user expects it but it may not be implemented.
  [PLAN B ONLY] — The item appears ONLY in Plan B (technical changes). The ticket/user story did not anticipate this change. This is an UNDOCUMENTED CHANGE — the PR does something the ticket didn't ask for.
- Be thorough: every significant test item from both plans must appear in exactly one category.
- Use your judgment to match items — Plan A says "user can search providers" and Plan B says "GET /api/providers/search endpoint returns results" are the SAME item (ALIGNED).

MERGE RULES:
- Combine user-facing tests from Plan A with technical tests from Plan B into one coherent scope.
- Do NOT duplicate — if both plans describe the same behavior, merge into ONE scope item.
- Keep the user perspective for functional tests (what the user does and sees).
- Keep the technical perspective for API, regression, and boundary tests.
- Every scope item must be a concrete, executable test — not a vague description.

QUALITY:
- Be concise. Each item is one line describing what to test and the pass criteria.
- Do NOT mention internal reasoning, alignment logic, or how you matched items.
- Output must be directly pasteable into Jira.
`;

    const prompt = `
Create the alignment diff and definitive testing scope for this ticket.

TICKET:
${story}

--- PLAN A (User Perspective) ---
${planA}

--- PLAN B (Technical Analysis) ---
${planB}

FORMATTING: Use bullet points and numbered lists. Do NOT use markdown tables. Output must be directly pasteable into Jira.

Output EXACTLY in this structure:

Scope Summary:
(2-3 sentences: what this ticket delivers and the total testing scope — functional + technical + regression.)

Alignment Diff:

Aligned (covered in both plans):
- [ALIGNED] [specific test area] — Plan A: [user-facing description] | Plan B: [technical description]
- [ALIGNED] ...

Plan A Only (potential gaps — user expects but PR may not cover):
- [PLAN A ONLY] [specific test area] — [what the user expects to test that has no matching PR evidence]
- [PLAN A ONLY] ...
(Write "None — all user expectations are covered by the PR." if empty)

Plan B Only (undocumented changes — PR does something ticket didn't mention):
- [PLAN B ONLY] [specific test area] — [what the PR changes that the ticket didn't ask for]
- [PLAN B ONLY] ...
(Write "None — all PR changes trace back to ticket requirements." if empty)

Testing Scope:
1. [Priority: Critical/High/Medium/Low] [Type: Functional/Technical/Regression/Edge Case] — [specific, executable test] → Pass: [observable pass condition]
2. ...

Regression Scope:
1. [Area: route / endpoint / module] — [what to verify] → Pass: [expected behavior]
2. ...

Test Execution Order:
1. [First — most critical functional test]
2. [Second — core regression check]
3. [Third — next priority]
4. ...
(Top 5-7 items in recommended execution order)
`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 6000,
      system: systemInstruction,
      messages: [{ role: "user", content: prompt }],
    });

    return Response.json({ output: getTextFromResponse(response) });
  } catch (err) {
    console.error(err);
    return Response.json({ output: "Error generating scope." });
  }
}
