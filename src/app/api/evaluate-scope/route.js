import { streamClaude } from "@/lib/anthropic";
import { getAppContext, formatAppContextForPrompt } from "@/lib/app-mapper";

export async function POST(req) {
  try {
    const { story, planA, planB, labels = [] } = await req.json();

    const appContext = getAppContext({});
    const appMapBlock = appContext ? formatAppContextForPrompt(appContext) : "";

    const systemInstruction = `PURPOSE: You are a Senior QA Engineer producing the REFINED TEST PLAN by merging two independent test plans into one superior plan.

You have:
1. Plan A (User Perspective) — user journeys, UX flows, edge cases a real user would hit.
2. Plan B (Technical Perspective) — PR/code analysis: API behavior, data flow, error handling, boundary conditions, regression from actual changes.

YOUR GOAL: Merge the best of both into a single refined test plan that is more complete than either plan alone. Focus on TESTING SCOPE (what to test) and TESTING APPROACH (how to test it). The regression section must be THOROUGH — err on the side of including more regression cases rather than fewer.

MERGE RULES:
- If both plans test the same behavior, merge into ONE item keeping the best description.
- If Plan A has a user scenario that Plan B missed, include it.
- If Plan B has a technical scenario that Plan A missed, include it.
- The merged plan should cover MORE than either individual plan.
- Every item must be concrete and executable — not vague.

SCENARIO WRITING RULES:
- "Variable Under Test" describes WHAT is under test — the feature, behavior, or interaction being validated — NOT the action or step.
  BAD: "Navigate to Provider Network page and perform search" (that is a step)
  GOOD: "Provider search results display as tile cards after query" (names the variable)
- "Expected Proof" is the observable evidence that the variable behaved correctly. Must be specific and verifiable.
  BAD: "Page loads correctly" (vague)
  GOOD: "Search results render as tile cards with provider name, rating, and response time visible" (specific)
- Do NOT repeat the scenario in the expected proof — they must be distinct.

ROLE ASSIGNMENT:
- The Role column accepts: a specific role name, "Both" (Admin + Limited Admin), or "All" (all selected roles).
- Use "Both" if Admin and Limited Admin behave identically — no duplicate rows.
- Only create separate role rows when expected behavior DIFFERS between roles.

ROLE SELECTION (use TICKET LABELS as primary signal):
- Standard roles (web-app + core-service): Admin (1), Limited Admin (7), Technician (2), Limited Technician (5), View Only (3), Requester (4), Operator (8).
- Vendor portal roles (vendor-management): Vendor (6), Contractor (101), Provider Admin, Provider Tech.
- VENDOR PORTAL ONLY (labels: vendor-management/vendor-portal/provider-network) → Vendor, Contractor, Provider Admin, Provider Tech ONLY.
- WEB-APP / CORE-SERVICE ONLY → Admin, Limited Admin always; add others only if ticket mentions them.
- CROSS-SYSTEM (both vendor + core/web labels) → both standard + vendor roles.

REGRESSION — BE THOROUGH:
- This is the most important section. When two plans are merged, regression coverage must EXPAND, not shrink.
- Use the application map to find EVERY route, endpoint, and module that shares data, state, APIs, or components with the changed feature.
- Go ELEMENT-LEVEL: list specific UI elements (fields, filters, dropdowns, list columns, cards, modals, form inputs) and API parameters — not just routes.
- Include regression for ALL affected codebases (web-app, core-service, vendor-management).
- For each regression item, create a concrete test scenario with expected proof.
- When in doubt, INCLUDE the regression case. More coverage is better than missed regression.
- If no app map is available, still derive regression areas from what both plans mention.

AUTOMATION CLASSIFICATION:
- Classify each scenario as "Automatable" (Playwright/JS: standard UI interactions, API calls, element checks) or "Manual" (visual judgment, complex multi-step, drag-and-drop).
- COUNTING RULE (critical): After all scenario tables are complete, you MUST go back and count every single row across ALL tables — Positive Test Scenarios, Negative Test Scenarios, AND Regression Test Scenarios (if present). The "Total scenarios" number MUST equal the exact sum of rows across all these tables. Automatable + Manual MUST equal Total. Double-check by re-counting each table. If the math does not add up, re-count before outputting.

QUALITY:
- Output must be directly pasteable into Jira.
- MANDATORY: Include ALL regression sections if the application map is provided.
- NEVER mention labels, classification steps, or internal reasoning in the output.`;

    const labelsBlock = labels.length > 0 ? `\nTICKET LABELS: ${labels.join(", ")}\n` : "";

    const prompt = `Merge these two test plans into one refined test plan.

TICKET:
${story}
${labelsBlock}
--- PLAN A (User Perspective) ---
${planA}

--- PLAN B (Technical Analysis) ---
${planB}

Output EXACTLY in this structure:

Scope Summary:
(2-3 sentences: what this ticket delivers and the total testing scope after merging both plans.)

Testing Scope:
- What specific features and requirements will be tested (merged from both plans)?
- One bullet per testable feature or requirement — no duplicates.

Testing Approach:
- Which tests will be covered by exploratory testing, manual test cases, or automation?
- What prioritization and retesting strategy will be used?
- What are the test suspension criteria (e.g., max defect threshold to pause testing)?
- Who on the team should cover which areas?

Role Access Matrix:
| Role | Expected Access | Key Behavior |
|------|----------------|-------------|

Positive Test Scenarios (merged & refined — take the best from both plans):
| # | Role | Variable Under Test | Dependent Variables / Controls | Expected Proof | Type |
|---|------|--------------------|-----------------------------|----------------|------|
| 1 | Both | [what is being tested] | [conditions affecting outcome] | [specific observable proof] | Manual / Automatable |

Negative Test Scenarios (merged — include negatives from both plans):
| # | Role | Variable Under Test | Invalid Condition | Expected Proof (error behavior) | Type |
|---|------|--------------------|--------------------|-------------------------------|------|
| 1 | Both | [what is being tested negatively] | [invalid input/state/access] | [specific error/validation observed] | Manual / Automatable |

Automation Assessment:
(Count EVERY numbered row from ALL scenario tables above. Automatable + Manual MUST equal Total.)
- Positive scenarios: [count from Positive table]
- Negative scenarios: [count from Negative table]
- Regression scenarios: [count from Regression Test Scenarios table, or 0 if no app map]
- **Total scenarios: [sum of above]**
- Automatable: [count] — [what can be automated and why]
- Manual: [count] — [what stays manual and why]
- Recommended automation priority: [which to automate first]
${appMapBlock ? `
Regression Impact Areas (BE THOROUGH — list every element that could be affected):
Go element-level across all three codebases. List every UI element, filter, field, API parameter that references or consumes the same data the ticket modifies.
| Element / Field / Filter | Location (route or endpoint) | Service | Risk Level | Why It Could Break |
|--------------------------|-------------------------------|---------|-----------|-------------------|
| [specific element] | [path] | [web-app/core-service/vendor-management] | High/Medium/Low | [shared data, API, component, filter logic] |
(Include at least 8-12 regression elements. Be exhaustive.)

Regression Test Scenarios (create a test for EVERY High and Medium risk element):
| # | Element Under Test | Service | Variable Under Test | Expected Proof (unchanged behavior) | Type |
|---|-------------------|---------|--------------------|------------------------------------|------|
| 1 | [element from impact areas] | [service] | [what is being verified] | [proof it still works] | Manual / Automatable |
(Be thorough — one scenario per high/medium risk element minimum.)

Regression Retest Checklist (step-by-step verification):
1. [Go to specific screen, locate specific element] → [expected unchanged behavior]
2. ...
(Cover every high and medium risk element. Aim for 10+ items.)
` : `
Regression Areas (derive from both plans):
- List every area mentioned by either plan that could regress.
- For each: what to verify and expected unchanged behavior.
1. [Area] — [what to verify] → Pass: [expected behavior]
2. ...
(Be thorough — include everything both plans flagged.)
`}
Test Execution Order:
1. [Most critical functional test from merged plan]
2. [Core regression check]
3. [Next priority]
4. ...
(Top 8-10 items in recommended execution order — prioritize regression higher than usual.)
${appMapBlock}`;

    return streamClaude({
      system: systemInstruction,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 8192,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ output: "Error generating refined test plan." });
  }
}
