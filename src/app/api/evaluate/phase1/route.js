import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";
import { getAppContext, formatAppContextForPrompt } from "@/lib/app-mapper";

export async function POST(req) {
  try {
    const { story, labels = [] } = await req.json();

    const appContext = getAppContext({});
    const appMapBlock = formatAppContextForPrompt(appContext);

    const systemInstruction = `PURPOSE: Analyze the ticket from the END-USER's perspective to identify all positive and negative user flows, dependencies, and risks. The story is in "Ready" state — no code exists yet.

GROUNDING:
- Think as the user: what you see, click, type, and experience. No APIs, endpoints, or code.
- Test scenarios for the ticket's feature must trace to the ticket. Do NOT invent features.
- HOWEVER: If the application map reveals connected screens or user flows that share navigation, data, or forms with the ticket's feature, you MUST include regression scenarios for those areas even if the ticket does not mention them. Do not miss scope.
- Use plain language. No developer terminology.
- If the ticket is vague, keep the plan minimal and flag: "Ticket lacks detail — request clarification."

COVERAGE:
- Focus on user journeys, UX flows, and edge cases users would actually hit.
- Include accessibility concerns only if the ticket mentions them.
- Include permission/role checks only if the ticket references role-based behavior.
- Do NOT include backend, API, or database tests — this is purely user-perspective.

CONCURRENCY:
- If the ticket involves concurrent user actions or rapid clicks, include race condition scenarios.
- For each: describe the conflicting user actions, the timing, and the expected user experience.
- If no concurrency, skip this section entirely.

NEGATIVE TESTING:
- For every user flow, identify what happens when the user does something wrong: bad input, missing fields, navigating away mid-action, unauthorized attempts, slow connection, unexpected sequences.
- Negative scenarios must be grounded in the ticket.

REGRESSION ANALYSIS:
- The application map below contains real routes, API calls, endpoints, and modules from THREE codebases: web-app (main frontend), core-service (main backend), and vendor-management (additional service with its own frontend + backend).
- Use TICKET LABELS to determine which codebases the ticket changes:
  * Labels with "vendor-management" / "vendor-portal" → changes are in vendor-management codebase.
  * Labels with "web-app" → changes are in web-app codebase.
  * Labels with "core-service" → changes are in core-service codebase.
  * If no labels, infer from ticket content.
- Scan the AFFECTED codebases first (based on labels), then check the OTHER codebases for cross-service regression from the user's perspective.
- For each connected route/screen, assess the regression risk from the user's perspective.
- ONLY list routes that actually appear in the application map. Do NOT invent paths.
- If the app map is not available, skip the regression section.

ROLE-BASED TESTING:
- Standard roles (web-app + core-service): Admin, Limited Admin, Technician, Limited Technician, View Only, Requester, Operator.
- Vendor portal roles (vendor-management ONLY): Vendor, Contractor, Provider Admin, Provider Tech.
- STEP 1 — Classify using TICKET LABELS (primary signal) + ticket content:
  A) VENDOR PORTAL ONLY: Labels include "vendor-management", "vendor-portal", "provider-network" — OR ticket text mentions "vendor portal", "provider", "contractor" — AND NO labels for web-app/core-service AND ticket does NOT describe core/web features.
  B) WEB-APP / CORE-SERVICE ONLY: Labels include "web-app", "core-service", or any non-vendor label — OR ticket is about work orders, assets, locations, PMs, parts, meters, purchase orders, people, settings, analytics — AND NO vendor labels present.
  C) CROSS-SYSTEM: Labels include BOTH vendor AND core/web labels — OR ticket describes changes spanning both systems.
- STEP 2 — Select roles:
  A) VENDOR PORTAL ONLY → Use ONLY: Vendor, Contractor, Provider Admin, Provider Tech. Do NOT include Admin, Limited Admin, or any standard role.
  B) WEB-APP / CORE-SERVICE ONLY → ALWAYS: Admin, Limited Admin. Add Technician, Limited Technician, View Only, Requester, or Operator ONLY if ticket mentions those roles or permission behavior. Do NOT include Vendor, Contractor, Provider Admin, or Provider Tech.
  C) CROSS-SYSTEM → Include BOTH standard roles (Admin, Limited Admin + contextual) AND vendor portal roles.
- Permission levels: Full, Partial (creator/assignee only), None.
- Limited Technician: affiliation-based (only sees WOs assigned/created/team). Requester/Operator: own requests only.

SCENARIO WRITING RULES:
- The "Scenario" / "Variable Under Test" column describes WHAT is being tested — the feature, behavior, or interaction — NOT the step to perform.
  BAD: "Navigate to Provider Network page" (that is a step)
  GOOD: "Provider search results display as tile cards" (names the variable under test)
- The "Expected Proof" column is the observable evidence that the variable behaved correctly. It must be specific.
  BAD: "Page loads correctly" (vague)
  GOOD: "Tile cards show provider name, rating, and response time" (specific observable proof)
- Do NOT repeat the scenario in the expected proof — they must be distinct.

ROLE ASSIGNMENT IN SCENARIOS:
- The Role column accepts: a specific role name, OR "Both" (meaning Admin + Limited Admin), OR "All" (meaning all selected roles).
- If a test applies identically to Admin and Limited Admin, use "Both" — do NOT create duplicate rows.
- Only create separate rows when expected behavior DIFFERS between roles.

AUTOMATION CLASSIFICATION (two-pass):
- First generate all scenarios with Type as "TBD", then classify each as "Automatable" (standard UI interactions testable with Playwright) or "Manual" (visual judgment, complex subjective validation, drag-and-drop, cross-device).
- After all scenario tables, add an Automation Assessment summary.

QUALITY:
- Output must be directly pasteable into Jira. Use bullets and tables, no paragraphs or filler.
- MANDATORY: If the application map is provided, you MUST include the "Regression Impact Areas" and "Regression Retest Checklist" sections. Never skip them.
- NEVER mention labels, classification steps, STEP 1/STEP 2, or internal reasoning in the output. Just list the roles and their access — do not explain why they were chosen.`;

    const labelsBlock = labels.length > 0 ? `\nTICKET LABELS: ${labels.join(", ")}\n` : "";

    const prompt = `TICKET:
${story}
${labelsBlock}
Produce the test plan in this structure:

TP Feature Dependencies & Risks:
- Are other teams or features impacted by this change? How?
- Where can this feature/change be triggered, accessed, connected to, or interacted with?
- What are the parity & compatibility expectations between this change and what existed before? How were customers using it and how will this require them to change their behavior?
- What sample scenarios might admins use this for? And how would technicians use it? Where might this create confusion, redundancy, or unexpected behavior?
- What don't we know or understand about this change, its workflows, triggers, use, interactions, and/or impacts?

TP Test Execution Dependencies & Risks:
- What teams, stakeholders, expertise, tools, and systems are required to fully test this change?
- What do we not understand about the change itself (great use of exploratory testing)?
- What areas do we have concerns about being able to properly test given the tools and knowledge available?

TP Technical Requirements for Testing:
- Roles to test (follow ROLE-BASED TESTING STEP 1 + STEP 2 strictly):
  * First classify ticket as (A) Vendor Portal Only, (B) Web-App/Core-Service Only, or (C) Cross-System
  * (A) Vendor Portal Only → Vendor, Contractor, Provider Admin, Provider Tech ONLY — no Admin or standard roles
  * (B) Web-App/Core-Service Only → Admin, Limited Admin always; add other standard roles only if ticket mentions them — no vendor roles
  * (C) Cross-System → both standard + vendor portal roles
  * For each included role, state the expected user experience (what they see/do vs. what is restricted)
- Access required or expected per role
- Platforms & OS impacted
- App versions to test (beta/legacy, version #)
- Environments required for testing
- Applicable flags and settings
- Required backing data & data sources (starter account, specific data that exists or should not exist)
- Test data sources

TP Assumptions:
- What is assumed but not stated in the ticket?

TP Out of Scope:
- What does the ticket explicitly say will NOT be covered?

TP Testing Scope:
- What user-facing features from the ticket will be tested?
- One bullet per testable feature.

TP Testing Approach:
- Which tests will be covered by exploratory, manual test cases, or automation?
- Who on the team will be testing the various items?
- Will product, customer, or internal teams do any UAT or validation?
- What prioritization or retesting strategies will be used?
- How will roadblocks be handled?

Role Access Matrix (for this ticket's feature — only include roles selected in STEP 2):
| Role | Expected Access | What User Sees / Can Do |
|------|----------------|------------------------|
(A) If Vendor Portal Only: list Vendor, Contractor, Provider Admin, Provider Tech rows ONLY.
(B) If Web-App/Core-Service Only: list Admin, Limited Admin rows + any contextual standard roles.
(C) If Cross-System: list both standard + vendor portal role rows.

Positive Test Scenarios:
| # | Role | Variable Under Test | Dependent Variables / Controls | Expected Proof | Priority | Type |
|---|------|--------------------|-----------------------------|----------------|----------|------|
| 1 | Both | [what is being tested — the feature, behavior, or interaction from the user's perspective] | [other fields, settings, or conditions that affect the outcome] | [specific observable proof the user would see] | Critical/High/Medium/Low | Manual / Automatable |

Negative Test Scenarios:
| # | Role | Variable Under Test | Invalid Condition | Expected Proof (error behavior) | Priority | Type |
|---|------|--------------------|--------------------|-------------------------------|----------|------|
| 1 | Both | [what is being tested negatively from the user's perspective] | [bad input, missing field, navigate away, unauthorized] | [specific error message or blocked action the user sees] | High/Medium/Low | Manual / Automatable |

Race Condition Scenarios (only if ticket involves concurrency):
| # | Conflicting Actions | Timing | Expected Behavior | Type |
|---|---------------------|--------|-------------------|------|

Automation Assessment:
- Total scenarios: [count]
- Automatable: [count] — [what can be automated and why]
- Manual: [count] — [what stays manual and why]
- Recommended automation priority: [which scenarios to automate first]

Confusing or Unclear Areas:
- Are there parts of the ticket where user behavior is ambiguous or undefined? If none, state "Ticket is clear."
${appMapBlock ? `
Regression Impact Areas:
Go ELEMENT-LEVEL from the user's perspective: list the specific UI elements (fields, filters, dropdowns, list columns, cards, modals, form inputs) that display or consume the same data the ticket's feature modifies.
| Element / Field / Filter | Location (screen or route) | Service | Risk Level | Why It Could Break |
|--------------------------|---------------------------|---------|-----------|-------------------|
| [specific UI element the user interacts with] | [route from app map] | [web-app / core-service / vendor-management] | High / Medium / Low | [shares same data, same component, same filter logic] |

Regression Test Scenarios:
For each High and Medium risk element, create a user-facing test scenario following SCENARIO WRITING RULES:
| # | Element Under Test | Service | Variable Under Test | Expected Proof (unchanged behavior) | Type |
|---|-------------------|---------|--------------------|------------------------------------|------|
| 1 | [specific element from impact areas] | [service] | [what aspect is being verified from user perspective] | [specific proof the user sees unchanged behavior] | Manual / Automatable |

Regression Retest Checklist:
For each High and Medium risk element above, write a user-facing verification step:
1. [Go to specific screen, locate specific element] → [expected unchanged behavior with proof]
2. ...
` : ""}
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
    return Response.json({ output: "Error generating Phase 1 plan." });
  }
}
