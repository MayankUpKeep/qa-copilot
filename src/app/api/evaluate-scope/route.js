import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";

export async function POST(req) {
  try {
    const { story, planA, planB } = await req.json();

    const systemInstruction = `
You are a Senior QA Engineer writing the DEFINITIVE TESTING SCOPE for a Jira ticket.

You have two inputs:
1. Plan A (User Perspective) — written from an end-user's point of view. Covers user journeys, UX flows, edge cases users would hit, and areas of the app affected from a user standpoint.
2. Plan B (Technical Perspective) — written from a code/PR analysis standpoint. Covers API behavior, data flow, error handling, boundary conditions, regression from actual code changes.

YOUR OUTPUT: A single, unified TESTING SCOPE — the definitive list of what must be tested for this ticket. This should be directly pasteable into Jira.

MERGE RULES:
- Combine user-facing tests from Plan A with technical tests from Plan B into one coherent scope.
- Do NOT duplicate — if both plans describe the same behavior (user language vs technical language), merge into ONE scope item using clear, testable language.
- Keep the user perspective for functional tests (what the user does and sees).
- Keep the technical perspective for API, regression, and boundary tests.
- Every scope item must be a concrete, executable test — not a vague description.

FOCUS: This is a TESTING SCOPE, not a test plan. Be concise. Each item is one line describing what to test and what the pass criteria is. No lengthy explanations, no sections about assumptions or approach — just the scope.
`;

    const prompt = `
Create the definitive testing scope for this ticket by merging the user-perspective plan and the technical plan.

TICKET:
${story}

--- PLAN A (User Perspective) ---
${planA}

--- PLAN B (Technical Analysis) ---
${planB}

Output EXACTLY in this structure:

Scope Summary:
(2-3 sentences: what this ticket delivers and the total testing scope — functional + technical + regression.)

Testing Scope:
| # | What to Test | Pass Criteria | Priority | Type |
|---|-------------|---------------|----------|------|
| 1 | [specific, executable test] | [observable pass condition] | Critical / High / Medium / Low | Functional / Technical / Regression / Edge Case |
| 2 | ... | ... | ... | ... |

Regression Scope:
| # | Area | Test | Pass Criteria |
|---|------|------|---------------|
| 1 | [route / endpoint / module] | [what to verify] | [expected behavior] |
| 2 | ... | ... | ... |

Gaps (if any):
- [Requirements not covered by the PR — confirm with developer before testing]
- (Write "None" if fully aligned)

Test Execution Order:
1. [First — most critical functional test]
2. [Second — core regression check]
3. [Third — next priority]
4. ...
(Top 5-7 items in recommended execution order)
`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 3000,
      system: systemInstruction,
      messages: [{ role: "user", content: prompt }],
    });

    return Response.json({ output: getTextFromResponse(response) });
  } catch (err) {
    console.error(err);
    return Response.json({ output: "Error generating scope." });
  }
}
