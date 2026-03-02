import { streamClaude } from "@/lib/anthropic";
import { getAppContext, formatAppContextForPrompt } from "@/lib/app-mapper";

export async function POST(req) {
  try {
    const { story, prContext, labels = [] } = await req.json();

    const appContext = getAppContext({});
    const appMapBlock = formatAppContextForPrompt(appContext);

    const storyWithPr = prContext
      ? story + "\n\n--- PR / Code Changes ---\n\n" + prContext
      : story;

    const systemInstruction = `PURPOSE: Analyze the ticket and PR/code changes to identify all positive and negative technical flows, dependencies, risks, and regression impact to produce a complete technical test plan.

GROUNDING:
- Be strictly technical. Reference specific endpoints, routes, files changed.
- Test scenarios for the ticket's feature must trace to a specific code change or ticket requirement.
- HOWEVER: If the application map reveals connected endpoints, modules, or routes that share APIs, data models, or state with the PR's changes, you MUST include regression scenarios for those areas even if the ticket/PR does not mention them. Do not miss scope.
- No vague language like "verify it works" — specify exact input, action, expected outcome.
- Testing is UI + browser network tab only. No DB or server console access.
- If the PR changes something the ticket didn't mention, flag it.
- STRICT GROUNDING FOR NON-SCENARIO SECTIONS (Dependencies, Risks, Assumptions, Out of Scope): Every bullet MUST be directly traceable to something stated or implied in the ticket or PR. Do NOT generate generic risks or assumptions that could apply to any ticket. If nothing applies, write "None identified based on ticket/PR content." Fewer accurate bullets are always better than many speculative ones.

COVERAGE:
- Map every ticket requirement to PR evidence (files changed, endpoints modified).
- Include error & boundary condition tests for any new or modified input handling.
- Include permission/auth tests only if the PR modifies auth-related code.
- If PR includes database schema changes, test the downstream UI/API impact.

CONCURRENCY:
- If the PR involves concurrent operations or state transitions, include race condition scenarios.
- For each: describe the conflicting actions, the timing, and the expected technical behavior.
- If no concurrency, skip this section entirely.

NEGATIVE TESTING:
- For every modified endpoint or flow, identify negative paths: invalid payloads, missing required fields, unauthorized requests, boundary values, error responses, and failure recovery.
- Negative scenarios must trace to actual PR changes.

REGRESSION ANALYSIS:
- The application map below contains real routes, API calls, endpoints, and modules from THREE codebases: web-app (main frontend), core-service (main backend), and vendor-management (additional service with its own frontend + backend).
- Use TICKET LABELS to determine which codebases the ticket/PR changes:
  * Labels with "vendor-management" / "vendor-portal" → changes are in vendor-management codebase.
  * Labels with "web-app" → changes are in web-app codebase.
  * Labels with "core-service" → changes are in core-service codebase.
  * If no labels, infer from PR files changed and ticket content.
- MULTI-LABEL = MULTI-CODEBASE: When the ticket has MULTIPLE labels (e.g., "web-app", "core-service", "vendor-management"), this means changes span multiple codebases — possibly in separate branches/PRs. You MUST analyze ALL labeled codebases for regression, not just one. Cross-service regression is especially critical here (e.g., a core-service API change may break web-app pages that call it).
- PR FILE EVIDENCE: When PR/code changes are included, use the "Repository:" and "Files Changed:" sections per PR to confirm which specific modules, routes, and services are touched in each branch. This supplements the labels and reveals the exact scope of changes per codebase.
- Scan the AFFECTED codebases first (based on labels + PR evidence), then check the OTHER codebases for cross-service regression.
- For each connected route/endpoint/module, assess the regression risk (shared state, shared API contracts, shared DB tables, shared UI components).
- ONLY list routes/endpoints that actually appear in the application map. Do NOT invent paths.
- If the app map is not available, skip the regression section.

ROLE-BASED TESTING:
- Standard roles (web-app + core-service): Admin (1), Limited Admin (7), Technician (2), Limited Technician (5), View Only (3), Requester (4), Operator (8).
- Vendor portal roles (vendor-management ONLY): Vendor (6), Contractor (101), Provider Admin, Provider Tech.
- STEP 1 — Classify using TICKET LABELS (primary signal) + PR files + ticket content:
  A) VENDOR PORTAL ONLY: Labels include "vendor-management", "vendor-portal", "provider-network" — OR PR only modifies vendor-management/ files — AND NO labels for web-app/core-service AND ticket does NOT describe core/web features.
  B) WEB-APP / CORE-SERVICE ONLY: Labels include "web-app", "core-service", or any non-vendor label — OR PR only modifies web-app/core-service files — AND NO vendor labels present.
  C) CROSS-SYSTEM: Labels include BOTH vendor AND core/web labels — OR PR modifies files in BOTH vendor-management AND web-app/core-service. (Common when a ticket has multiple labels like "web-app, core-service" indicating changes across branches.)
- STEP 2 — Select roles:
  A) VENDOR PORTAL ONLY → Use ONLY: Vendor, Contractor, Provider Admin, Provider Tech. Do NOT include Admin, Limited Admin, or any standard role.
  B) WEB-APP / CORE-SERVICE ONLY → ALWAYS: Admin, Limited Admin. Add Technician, Limited Technician, View Only, Requester, or Operator ONLY if ticket/PR mentions those roles or modifies auth code. Do NOT include Vendor, Contractor, Provider Admin, or Provider Tech.
  C) CROSS-SYSTEM → Include BOTH standard roles (Admin, Limited Admin + contextual) AND vendor portal roles.
- Permission levels: Full, Partial (creator/assignee only), None.
- Limited Technician: affiliation-based filtering only. Requester/Operator: own requests only.

SCENARIO WRITING RULES:
- The "Variable Under Test" column describes WHAT is being tested — the specific endpoint behavior, data contract, component interaction — NOT the step.
  BAD: "Send POST request to /api/providers" (that is a step)
  GOOD: "Provider creation API validates required fields" (names the variable under test)
- The "Expected Proof" column is the technical evidence: HTTP status code, response payload shape, UI state change, network tab response.
- Do NOT repeat the scenario in the expected proof — they must be distinct.

ROLE ASSIGNMENT IN SCENARIOS:
- The Role column accepts: a specific role name, OR "Both" (meaning Admin + Limited Admin), OR "All".
- If a test applies identically to Admin and Limited Admin, use "Both" — do NOT create duplicate rows.
- Only create separate rows when expected technical behavior DIFFERS between roles (different status codes, different response payloads, different access levels).

AUTOMATION CLASSIFICATION (two-pass):
- First generate all scenarios with Type as "TBD", then classify each as:
  * "Automatable" — standard UI interactions, element checks testable with Playwright. Automation runs ONLY against the web-app UI, so a scenario is automatable only if the change produces an observable difference in the UI that Playwright can assert on.
  * "Manual" — visual judgment, complex subjective validation, drag-and-drop, cross-device, OR backend-only changes (core-service / vendor-management API, database, business logic) that do not alter what the UI renders or returns to the browser. If the backend change does not produce a visible UI difference, it cannot be verified through UI automation.
- COUNTING RULE (critical): After all scenario tables are complete, you MUST go back and count every single row across ALL tables — Positive Test Scenarios, Negative Test Scenarios, Race Condition Scenarios (if present), AND Regression Test Scenarios (if present). The "Total scenarios" number MUST equal the exact sum of rows across all these tables. Automatable + Manual MUST equal Total. Double-check by re-counting each table. If the math does not add up, re-count before outputting.

QUALITY:
- Each scenario must reference the PR change or ticket requirement it validates.
- Output must be directly pasteable into Jira. Use bullets and tables, no filler.
- MANDATORY: If the application map is provided, you MUST include the "Regression Impact Areas" and "Regression Retest Checklist" sections. Never skip them.
- NEVER mention labels, classification steps, STEP 1/STEP 2, or internal reasoning in the output. Just list the roles and their access — do not explain why they were chosen.`;

    const labelsBlock = labels.length > 0 ? `\nTICKET LABELS: ${labels.join(", ")}\n` : "";

    const prompt = `TICKET + PR:
${storyWithPr}
${labelsBlock}
Produce the test plan in this structure:

TP Feature Dependencies & Risks:
(ONLY list items directly evidenced by the ticket or PR. Do NOT speculate or generate generic risks. If nothing applies, write "None identified based on ticket/PR content.")
- Are DevOps, other teams, or other changes required as part of this feature change?
- Are other teams or features impacted by this PR? How?
- Where can this feature/change be triggered, accessed, connected to, or interacted with?
- What are the parity & compatibility expectations between this change and existing behavior?
- What don't we know or understand about this change?

TP Test Execution Dependencies & Risks:
(ONLY list items directly evidenced by the ticket or PR. If nothing applies, write "None identified based on ticket/PR content.")
- What teams, stakeholders, expertise, tools, and systems are required to fully test this change?
- What do we not understand about the change itself (areas for exploratory testing)?
- What areas do we have concerns about being able to properly test given available mechanisms, tools, and knowledge?

TP Technical Requirements for Testing:
- Roles to test (follow ROLE-BASED TESTING STEP 1 + STEP 2 strictly):
  * First classify ticket/PR as (A) Vendor Portal Only, (B) Web-App/Core-Service Only, or (C) Cross-System
  * (A) Vendor Portal Only → Vendor, Contractor, Provider Admin, Provider Tech ONLY — no Admin or standard roles
  * (B) Web-App/Core-Service Only → Admin, Limited Admin always; add other standard roles only if ticket/PR mentions them — no vendor roles
  * (C) Cross-System → both standard + vendor portal roles
  * For each included role, state the expected permission level (Full / Partial / None) for the affected endpoints
- Access required or expected per role
- Platforms & OS impacted
- App versions to test (beta/legacy, version #)
- Environments required for testing
- Application and/or environment configurations required
- Applicable flags and settings
- Required backing data & data sources
- Points of data interactions (in/out)
- Connected/integrated systems, including 3rd party tools, micro services
- Monitoring or other tools required for review & applicable data/indicators
- Test data sources
- Environment(s) to deploy changes to for testing

TP Assumptions:
(ONLY list assumptions directly implied by the ticket or PR but not explicitly stated. Do NOT generate generic assumptions. If nothing is assumed, write "None identified.")
- What is assumed to be true but not explicitly stated in the ticket or PR?

TP Out of Scope:
- What does the ticket explicitly exclude?
- If the application map is available: list nearby routes, endpoints, or modules that are related to the changed area but are NOT touched by this ticket's or PR's changes (based on labels, PR files, and ticket content). These are areas testers should NOT spend time on. Reference specific routes/endpoints from the app map.
- If no app map is available, only list items the ticket explicitly excludes. If nothing, write "Not specified in ticket."

TP Testing Scope:
- What features from the ticket and changes from the PR will be tested?
- One bullet per testable area.

TP Testing Approach:
- Which tests will be covered by exploratory, manual test cases, or automation?
- Who on the team will be testing the various items?
- Will product, customer, or internal teams do any UAT or validation?
- What prioritization, retesting, or efficiency strategies will be employed?
- What are the test suspension and resumption criteria?
- How will roadblocks be handled?

Ticket vs PR Coverage:
| Requirement | Covered in PR? | Evidence |
|-------------|---------------|----------|
| [from ticket] | Yes / Partial / Not visible | [files or endpoints] |

Role Access Matrix (for this ticket's affected endpoints — only include roles selected in STEP 2):
| Role | Permission Level | Expected Technical Behavior |
|------|-----------------|---------------------------|
(A) If Vendor Portal Only: list Vendor, Contractor, Provider Admin, Provider Tech rows ONLY.
(B) If Web-App/Core-Service Only: list Admin, Limited Admin rows + any contextual standard roles.
(C) If Cross-System: list both standard + vendor portal role rows.

Positive Test Scenarios:
| # | Role | Variable Under Test | Dependent Variables / Controls | Expected Proof | Test Type | Source | Type |
|---|------|--------------------|-----------------------------|----------------|-----------|--------|------|
| 1 | Both | [what is being tested — endpoint behavior, data contract, component interaction] | [related fields, settings, auth state] | [specific technical proof: HTTP status, response payload, UI state] | API/UI/Data | Ticket/PR/Both | Manual / Automatable |

Negative Test Scenarios:
| # | Role | Variable Under Test | Invalid Condition | Expected Proof (error behavior) | Test Type | Source | Type |
|---|------|--------------------|--------------------|-------------------------------|-----------|--------|------|
| 1 | Both | [what is being tested negatively] | [invalid payload, missing field, boundary] | [specific error code, validation message, blocked action] | API/UI/Error/Boundary | Ticket/PR/Both | Manual / Automatable |

Race Condition Scenarios (only if PR involves concurrency):
| # | Conflicting Actions | Timing | Expected Behavior | Type |
|---|---------------------|--------|-------------------|------|

Automation Assessment:
(Count EVERY numbered row from ALL scenario tables above. Automatable + Manual MUST equal Total.)
- Positive scenarios: [count from Positive table]
- Negative scenarios: [count from Negative table]
- Race condition scenarios: [count from Race Condition table, or 0 if skipped]
- Regression scenarios: [count from Regression Test Scenarios table, or 0 if no app map]
- **Total scenarios: [sum of above]**
- Automatable: [count] — [what can be automated and why]
- Manual: [count] — [what stays manual and why]
- Recommended automation priority: [which scenarios to automate first]
${appMapBlock ? `
Regression Impact Areas:
Go ELEMENT-LEVEL: list the specific API fields, UI components, filters, data columns, and parameters that reference or consume the same data the PR modifies. Not just routes — specific elements.
| Element / Field / Parameter | Location (route or endpoint) | Service | Risk Level | Why It Could Break |
|-----------------------------|-------------------------------|---------|-----------|-------------------|
| [specific element: e.g. "provider_id field in GET /api/work-orders response"] | [endpoint or route] | [web-app / core-service / vendor-management] | High / Medium / Low | [shares same data source, same API field, same DB table, same tRPC procedure] |

Regression Test Scenarios:
For each High and Medium risk element, create a test scenario following SCENARIO WRITING RULES:
| # | Element Under Test | Service | Variable Under Test | Expected Proof (unchanged behavior) | Type |
|---|-------------------|---------|--------------------|------------------------------------|------|
| 1 | [specific element from impact areas] | [service] | [what aspect is being verified technically] | [specific proof: unchanged HTTP response, same UI state, correct data] | Manual / Automatable |

Regression Retest Checklist:
For each High and Medium risk element above, write a concrete verification step:
1. [Call endpoint / Navigate to route, check specific element] → [expected unchanged behavior with proof]
2. ...
` : ""}

Technical Gaps / Risks:
- Are there missing error handlers, uncovered edge cases, or untested code paths? If none, state "None identified."
${appMapBlock}`;

    return streamClaude({
      system: systemInstruction,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 8192,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ output: "Error generating Phase 2 plan." });
  }
}
