import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";
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
- Scan the AFFECTED codebases first (based on labels), then check the OTHER codebases for cross-service regression.
- For each connected route/endpoint/module, assess the regression risk (shared state, shared API contracts, shared DB tables, shared UI components).
- ONLY list routes/endpoints that actually appear in the application map. Do NOT invent paths.
- If the app map is not available, skip the regression section.

ROLE-BASED TESTING:
- Standard roles (web-app + core-service): Admin (1), Limited Admin (7), Technician (2), Limited Technician (5), View Only (3), Requester (4), Operator (8).
- Vendor portal roles (vendor-management ONLY): Vendor (6), Contractor (101), Provider Admin, Provider Tech.
- STEP 1 — Classify using TICKET LABELS (primary signal) + PR files + ticket content:
  A) VENDOR PORTAL ONLY: Labels include "vendor-management", "vendor-portal", "provider-network" — OR PR only modifies vendor-management/ files — AND NO labels for web-app/core-service AND ticket does NOT describe core/web features.
  B) WEB-APP / CORE-SERVICE ONLY: Labels include "web-app", "core-service", or any non-vendor label — OR PR only modifies web-app/core-service files — AND NO vendor labels present.
  C) CROSS-SYSTEM: Labels include BOTH vendor AND core/web labels — OR PR modifies files in BOTH vendor-management AND web-app/core-service.
- STEP 2 — Select roles:
  A) VENDOR PORTAL ONLY → Use ONLY: Vendor, Contractor, Provider Admin, Provider Tech. Do NOT include Admin, Limited Admin, or any standard role.
  B) WEB-APP / CORE-SERVICE ONLY → ALWAYS: Admin, Limited Admin. Add Technician, Limited Technician, View Only, Requester, or Operator ONLY if ticket/PR mentions those roles or modifies auth code. Do NOT include Vendor, Contractor, Provider Admin, or Provider Tech.
  C) CROSS-SYSTEM → Include BOTH standard roles (Admin, Limited Admin + contextual) AND vendor portal roles.
- Permission levels: Full, Partial (creator/assignee only), None.
- Limited Technician: affiliation-based filtering only. Requester/Operator: own requests only.

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
- Are DevOps, other teams, or other changes required as part of this feature change? How may that introduce risk to delivery, quality, timelines, or scope?
- Are other teams or features impacted by this PR? How?
- Where can this feature/change be triggered, accessed, connected to, or interacted with?
- What are the parity & compatibility expectations between this change and existing behavior?
- What are the points of data interaction (in/out) affected by this PR?
- Connected/integrated systems, including 3rd party tools, micro services, connected feature sets or services impacted?

TP Test Execution Dependencies & Risks:
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
- What is assumed but not stated in the ticket or PR?

TP Out of Scope:
- What does the ticket explicitly exclude?

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
| # | Role | Scenario | Expected Technical Outcome | Test Type | Source | Type |
|---|------|----------|---------------------------|-----------|--------|------|
| 1 | Admin | [specific happy-path test] | [HTTP code, UI state, response] | API/UI/Data | Ticket/PR/Both | Manual/Automatable |
| 2 | Limited Admin | [same or similar test] | [HTTP code, UI state, response] | API/UI/Data | Ticket/PR/Both | Manual/Automatable |

Negative Test Scenarios:
| # | Role | Scenario | Invalid Input / Condition | Expected Error Behavior | Test Type | Source | Type |
|---|------|----------|--------------------------|------------------------|-----------|--------|------|
| 1 | Admin | [invalid payload, missing field, boundary value] | [what goes wrong] | [error code, validation message] | API/UI/Error/Boundary | Ticket/PR/Both | Manual/Automatable |

Race Condition Scenarios (only if PR involves concurrency):
| # | Conflicting Actions | Timing | Expected Behavior | Type |
|---|---------------------|--------|-------------------|------|
${appMapBlock ? `
Regression Impact Areas:
Use the ticket labels to identify which codebases are changed. Scan the application map for routes, endpoints, and modules that share data, state, API contracts, DB tables, or UI components with the PR's changes. List every match:
| Route / Endpoint / Module | Service (web-app / core-service / vendor-management) | Risk Level | Connection to PR Changes |
|---------------------------|------------------------------------------------------|-----------|-------------------------|
| [exact path from app map] | [which codebase] | High / Medium / Low | [shared API, shared module, shared DB table, shared state, UI dependency, tRPC procedure] |

Regression Test Scenarios:
For each High and Medium risk regression area, create concrete test scenarios:
| # | Route / Endpoint | Service | Scenario | Expected Technical Outcome | Type |
|---|-----------------|---------|----------|---------------------------|------|
| 1 | [path from impact areas] | [web-app/core-service/vendor-management] | [specific action to verify no regression] | [expected unchanged response/behavior] | Manual / Automatable |

Regression Retest Checklist:
For each High and Medium risk area above, write a concrete test step:
1. [Navigate to route / Call endpoint / Verify module behavior] → [expected behavior should be unchanged]
2. ...
` : ""}

Technical Gaps / Risks:
- Are there missing error handlers, uncovered edge cases, or untested code paths? If none, state "None identified."
${appMapBlock}`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      system: systemInstruction,
      messages: [{ role: "user", content: prompt }],
    });

    return Response.json({ output: getTextFromResponse(response) });
  } catch (err) {
    console.error(err);
    return Response.json({ output: "Error generating Phase 2 plan." });
  }
}
