import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";
import { getAppContext, formatAppContextForPrompt } from "@/lib/app-mapper";

export async function POST(req) {
  try {
    const { story, prContext } = await req.json();

    const appContext = getAppContext({});
    const appMapBlock = formatAppContextForPrompt(appContext);

    const storyWithPr = prContext
      ? story + "\n\n--- PR / Code Changes ---\n\n" + prContext
      : story;

    const systemInstruction = `
You are a Senior QA Engineer performing TECHNICAL test analysis on actual code changes.

MINDSET: You are reading the PR diff, the files changed, the endpoints modified, and the ticket requirements. You think in terms of: API contracts, data flow, state management, error handling, input validation, boundary conditions, race conditions, and regression risk.

CONTEXT: The story is in "Code Review" or "Ready for Testing." A PR exists with actual code changes. Your job is to create a strictly technical test plan based on WHAT WAS ACTUALLY CHANGED in the code.

PURPOSE:
- Analyze the PR to determine exactly what was modified at a technical level.
- Map each code change to testable behavior (API responses, UI state changes, data persistence).
- Identify technical risks: unhandled errors, missing validations, broken contracts, state inconsistencies.
- Cross-reference PR changes against the application map to find regression risks.
- Flag gaps between ticket requirements and what the PR actually implements.

RULES:
- Be STRICTLY technical. Reference specific endpoints, routes, modules, file areas changed.
- Every test scenario must trace to a specific code change or technical behavior.
- Classify tests by type: API validation, UI state verification, data integrity, error handling, boundary testing.
- For regression: identify which routes and endpoints share code/data with the changed areas.
- Do NOT use vague language like "verify it works" — specify the exact input, action, and expected technical outcome.
- If the PR changes something the ticket didn't mention, flag it explicitly.

TESTING CONSTRAINTS:
- Non-production environment only.
- UI testing and API validation via browser network tab.
- No direct database or server console access.

${appMapBlock ? `APPLICATION MAP:
- Cross-reference PR file changes against these routes and endpoints.
- Identify which endpoints are affected by the modified code.
- Only reference routes/endpoints that exist in the map.` : ""}
`;

    const prompt = `
Perform technical test analysis on this PR and create a strictly technical test plan.

TICKET + PR:
${storyWithPr}

Output EXACTLY in this structure:

Technical Change Summary:
(3-4 sentences: what the PR modifies at a technical level — which modules, endpoints, data flows, or components are affected. No user-facing language.)

Ticket vs PR Coverage:
| Requirement | Covered in PR? | Technical Evidence |
|-------------|---------------|-------------------|
| [requirement from ticket] | Yes / Partial / Not visible | [specific files, endpoints, or logic that address this] |

Technical Test Scenarios:
| # | Test | Expected Technical Outcome | Test Type | Source |
|---|------|---------------------------|-----------|--------|
| 1 | [specific technical test: call endpoint X with payload Y] | [HTTP 200, response contains Z / UI state updates to show A] | API / UI State / Data / Error Handling / Boundary | Ticket / PR / Both |
| 2 | ... | ... | ... | ... |

Error & Boundary Conditions:
| # | Condition | Input / Trigger | Expected Behavior |
|---|-----------|----------------|-------------------|
| 1 | [invalid input, missing field, timeout, etc.] | [specific trigger] | [error message, status code, UI feedback] |

Regression Impact:
| Route / Endpoint / Module | Risk Level | Reason |
|---------------------------|-----------|--------|
| [specific area from app map] | High / Medium / Low | [which code change affects this, shared dependencies] |

Regression Retest:
1. [Technical test step targeting regression area] → [Expected result]
2. ...

Technical Gaps / Risks:
- [Missing error handling, uncovered edge cases, ticket requirements not in PR]
- (Write "None identified — PR is technically sound" if clean)
${appMapBlock}
`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: systemInstruction,
      messages: [{ role: "user", content: prompt }],
    });

    return Response.json({ output: getTextFromResponse(response) });
  } catch (err) {
    console.error(err);
    return Response.json({ output: "Error generating Phase 2 plan." });
  }
}
