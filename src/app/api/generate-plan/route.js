import { streamClaude } from "@/lib/anthropic";
import { getAppContext, formatAppContextForPrompt } from "@/lib/app-mapper";

export async function POST(req) {
  try {
    const { story, images = [], useAppMap = true, labels = [] } = await req.json();

    const appContext = useAppMap ? getAppContext({}) : null;
    const appMapBlock = appContext ? formatAppContextForPrompt(appContext) : "";

    let imageSection = "";
    if (images && images.length > 0) {
      imageSection = `\n\nAttached images:\n${images.map((img, i) => `Image ${i + 1}: [${img.name || "image"}] (${img.type})`).join("\n")}`;
    }

    const systemInstruction = `PURPOSE: Analyze the ticket to identify all positive and negative user flows, dependencies, risks, and technical requirements to produce a complete, Jira-pasteable test plan.

GROUNDING:
- Test scenarios for the ticket's feature MUST trace back to the ticket content or attached images.
- Do NOT invent features or requirements not present in the ticket.
- HOWEVER: If the application map reveals connected routes, endpoints, or modules that share data/state/APIs with the ticket's feature, you MUST include regression scenarios for those areas even if the ticket does not mention them. The goal is to cover gaps between what the ticket says and what the codebase shows is connected.
- If the ticket is ambiguous, generate minimal content and flag: "Ticket lacks detail — request clarification."
- Use the ticket's own terminology. Do not rename features or modules.

COVERAGE:
- Convert backend validations into UI observable behavior.
- Replace DB verification with UI state validation; replace log verification with API response verification.
- Include functional testing with UI validation ALWAYS.
- Include API testing ONLY if ticket mentions APIs/services/endpoints/tokens.
- Include permission checks ONLY if ticket mentions role-based behavior.
- EXCLUDE: security, infrastructure, load, deployment, performance, monitoring, analytics, data warehouse, migrations, audit systems (unless explicitly in ticket).

CONCURRENCY:
- If the ticket involves concurrent user actions, rapid repeated submissions, simultaneous state transitions, bulk operations, real-time updates, or async workflows — include race condition scenarios.
- For each: describe the conflicting actions, the timing, and the observable expected behavior.
- If no concurrency-sensitive behavior, skip this section entirely.

NEGATIVE TESTING:
- For every feature or flow in the ticket, identify the negative paths: invalid inputs, missing required fields, unauthorized access, boundary values, error states, and failure recovery.
- Negative scenarios must be grounded in the ticket — do not invent generic negative tests unrelated to the feature.

EDGE CASES:
- If the ticket is very short (under 50 words) or vague, produce a minimal plan and add: "⚠ Ticket lacks detail — test plan is limited. Request clarification."
- If purely cosmetic (label, color, text change), limit to 3-5 scenarios and skip inapplicable sections.
- If no images attached but ticket references UI behavior, note: "No images provided — visual verification recommended."

REGRESSION ANALYSIS:
- The application map below contains real routes, API calls, endpoints, and modules from THREE codebases: web-app (main frontend), core-service (main backend), and vendor-management (additional service with its own frontend + backend).
- Use TICKET LABELS to determine which codebases the ticket changes:
  * Labels with "vendor-management" / "vendor-portal" → changes are in vendor-management codebase.
  * Labels with "web-app" → changes are in web-app codebase.
  * Labels with "core-service" → changes are in core-service codebase.
  * If no labels, infer from ticket content.
- Scan the AFFECTED codebases first (based on labels), then check the OTHER codebases for cross-service regression.
- For each connected route/endpoint/module, assess the regression risk (shared state, shared API, shared UI component, data dependency).
- ONLY list routes/endpoints that actually appear in the application map. Do NOT invent paths.
- If the app map is not available, skip the regression section.

ROLE-BASED TESTING:
- Standard roles (web-app + core-service): Admin (1), Limited Admin (7), Technician (2), Limited Technician (5), View Only (3), Requester (4), Operator (8).
- Vendor portal roles (vendor-management ONLY): Vendor (6), Contractor (101), Provider Admin, Provider Tech.
- STEP 1 — Classify using TICKET LABELS (primary signal) + ticket content:
  A) VENDOR PORTAL ONLY: Labels include "vendor-management", "vendor-portal", "provider-network" — OR ticket text mentions "vendor portal", "provider", "contractor" — AND NO labels for web-app/core-service AND ticket does NOT describe core/web features.
  B) WEB-APP / CORE-SERVICE ONLY: Labels include "web-app", "core-service", or any non-vendor label — OR ticket is about work orders, assets, locations, PMs, parts, meters, purchase orders, people, settings, analytics — AND NO vendor labels present.
  C) CROSS-SYSTEM: Labels include BOTH vendor AND core/web labels — OR ticket describes changes spanning both systems.
- STEP 2 — Select roles:
  A) VENDOR PORTAL ONLY → Use ONLY: Vendor, Contractor, Provider Admin, Provider Tech. Do NOT include Admin, Limited Admin, or any standard role.
  B) WEB-APP / CORE-SERVICE ONLY → ALWAYS: Admin, Limited Admin. Add Technician, Limited Technician, View Only, Requester, or Operator ONLY if ticket mentions those roles or permission behavior. Do NOT include Vendor, Contractor, Provider Admin, or Provider Tech.
  C) CROSS-SYSTEM → Include BOTH standard roles (Admin, Limited Admin + contextual) AND vendor portal roles (Vendor, Contractor, Provider Admin, Provider Tech).
- Permission levels: Full, Partial (creator/assignee only), None.
- Limited Technician: affiliation-based filtering (only sees WOs assigned to them, created by them, or via team).
- Requester/Operator: only see their own requests.

SCENARIO WRITING RULES:
- The "Scenario" column describes WHAT is under test (the variable, interaction, or condition being validated) — NOT the action or step to perform. Think like a scientific experiment: name the variable.
  BAD: "Navigate to Provider Network page and perform search" (that is a step, not a scenario)
  GOOD: "Provider search results display as tile cards after query" (names the variable under test)
  GOOD: "Tile card click navigates to provider detail page" (variable = click-to-navigate behavior)
- The "Expected Result" column is the PROOF that acting on the variable produced the correct outcome. It must be observable and verifiable.
  BAD: "Page loads correctly" (vague, not proof)
  GOOD: "Search results render as tile cards with provider name, rating, and response time visible" (specific observable proof)
- Do NOT repeat the scenario in the expected result — they must be distinct.

ROLE ASSIGNMENT IN SCENARIOS:
- The Role column accepts: a specific role name, OR "Both" (meaning Admin + Limited Admin), OR "All" (meaning all selected roles).
- If a test scenario applies identically to Admin and Limited Admin with the same expected behavior, use "Both" — do NOT create duplicate rows.
- Only create separate rows per role when the expected behavior DIFFERS between roles (e.g., Admin sees all records, Limited Admin sees filtered records).

AUTOMATION CLASSIFICATION (two-pass):
- First, generate all test scenarios with the Type column set to "TBD".
- Then, review each scenario and classify it as:
  * "Automatable" — if it can be reliably automated with Playwright/JavaScript (standard UI interactions, form submissions, API calls, navigation, element visibility checks).
  * "Manual" — if it requires visual judgment, complex multi-step user flows with subjective validation, drag-and-drop, file uploads with visual verification, or cross-device testing.
- In the final output, replace "TBD" with the classification.
- COUNTING RULE (critical): After all scenario tables are complete, you MUST go back and count every single row across ALL tables — Positive Test Scenarios, Negative Test Scenarios, Race Condition Scenarios (if present), AND Regression Test Scenarios (if present). The "Total scenarios" number MUST equal the exact sum of rows across all these tables. Automatable + Manual MUST equal Total. Double-check by re-counting each table. If the math does not add up, re-count before outputting.

QUALITY:
- Output must be directly pasteable into Jira fields. Use bullets and tables, no paragraphs or filler.
- MANDATORY: If the application map is provided, you MUST include the "Regression Impact Areas" and "Regression Retest Checklist" sections. Never skip them.
- NEVER mention labels, classification steps, STEP 1/STEP 2, or internal reasoning in the output. Just list the roles and their access — do not explain why they were chosen.`;

    const labelsBlock = labels.length > 0 ? `\nTICKET LABELS: ${labels.join(", ")}\n` : "";

    const prompt = `TICKET:
${story}${imageSection}
${labelsBlock}
Output EXACTLY in this structure:

TP Feature Dependencies & Risks:
- Are DevOps, other teams, or other changes required as part of this feature change? How may that introduce risk to delivery, quality, timelines, or scope?
- Are other teams or features impacted by this change? How?
- Where can this feature/change be triggered, accessed, connected to, or interacted with?
- What are the parity & compatibility expectations between this change and how it works on other platforms?
- What are the parity & compatibility expectations between this change and what existed before? How were customers using it before and how will this require them to change their behavior?
- What sample scenarios might admins use this change for? And how would technicians use it? Where might this change create difficulty or usability issues (confusion, redundancy, unexpected behavior)?
- What don't we know or understand about this change, its workflows, triggers, use, interactions, and/or impacts?
- Any other dependencies or risks?

TP Test Execution Dependencies & Risks:
- What teams (outside project team), stakeholders, expertise, tools, and systems are required to fully test this change?
- What do we not understand about the change itself (these areas may be a great use of exploratory testing)?
- What areas of the scope do we have concerns about being able to properly test given the mechanisms, tools, and knowledge available within the team?

TP Technical Requirements for Testing:
- Roles to test (follow ROLE-BASED TESTING STEP 1 + STEP 2 strictly):
  * First classify ticket as (A) Vendor Portal Only, (B) Web-App/Core-Service Only, or (C) Cross-System
  * (A) Vendor Portal Only → Vendor, Contractor, Provider Admin, Provider Tech ONLY — no Admin or standard roles
  * (B) Web-App/Core-Service Only → Admin, Limited Admin always; add other standard roles only if ticket mentions them — no vendor roles
  * (C) Cross-System → both standard + vendor portal roles
  * For each included role, state the expected access level (Full / Partial / None) for the ticket's feature
- Access required or expected per role
- Platforms & OS impacted
- App versions to test (beta/legacy, version #, etc)
- Environments required for testing
- Application and/or environment configurations required for testing
- Applicable flags and settings
- Required backing data & data sources (starter account, specific data that exists or should not exist, etc)
- Points of data interactions (in/out)
- Connected/integrated systems, including 3rd party tools, micro services, connected feature sets or services
- Monitoring or other tools required for review & applicable data/indicators to review
- Test data sources
- Environment(s) to deploy changes to for testing

TP Assumptions:
- What is assumed to be true but not explicitly stated in the ticket?

TP Out of Scope:
- What does the ticket explicitly say will NOT be covered?

TP Testing Scope:
- What specific features and requirements from the ticket will be tested?
- One bullet per testable feature or requirement.

TP Testing Approach:
- Which tests will be covered by which of the three test methods (exploratory, manual test cases, automation)?
- Who on the team will be testing the various items (opportunity for coverage to be delegated around the team, including test automation)?
- Will product, the customer, or other internal teams be doing any UAT or validation?
- What prioritization, retesting, or efficiency strategies will be employed given pass/fail rates and anticipated defect resolution processes?
- Will any bugs be fixed as part of this change that can be tested under the same test scope?
- What are the test suspension and resumption criteria (e.g., max threshold of defects to stop testing, minimum health check before testing can begin)?
- How will roadblocks be handled?

Role Access Matrix (for this ticket's feature — only include roles selected in STEP 2):
| Role | Expected Access | Key Behavior |
|------|----------------|-------------|
(A) If Vendor Portal Only: list Vendor, Contractor, Provider Admin, Provider Tech rows ONLY.
(B) If Web-App/Core-Service Only: list Admin, Limited Admin rows + any contextual standard roles.
(C) If Cross-System: list both standard + vendor portal role rows.

Positive Test Scenarios:
| # | Role | Variable Under Test | Dependent Variables / Controls | Expected Proof | Type |
|---|------|--------------------|-----------------------------|----------------|------|
| 1 | Both | [what is being tested — the feature, behavior, or interaction] | [other fields, settings, or conditions that affect the outcome] | [specific observable proof that the variable behaved correctly] | Manual / Automatable |

Negative Test Scenarios:
| # | Role | Variable Under Test | Invalid Condition | Expected Proof (error behavior) | Type |
|---|------|--------------------|--------------------|-------------------------------|------|
| 1 | Both | [what is being tested negatively] | [invalid input, missing field, boundary, unauthorized] | [specific error message, validation state, or blocked action observed] | Manual / Automatable |

Race Condition Scenarios (only if ticket involves concurrency):
| # | Conflicting Actions | Timing | Expected Behavior | Type |
|---|---------------------|--------|-------------------|------|

Automation Assessment:
(Count EVERY numbered row from ALL scenario tables above. Automatable + Manual MUST equal Total.)
- Positive scenarios: [count from Positive table]
- Negative scenarios: [count from Negative table]
- Race condition scenarios: [count from Race Condition table, or 0 if skipped]
- Regression scenarios: [count from Regression Test Scenarios table, or 0 if no app map]
- **Total scenarios: [sum of above]**
- Automatable: [count] — [brief list of what can be automated and why (e.g., "standard form validation, API response checks, element visibility")]
- Manual: [count] — [brief list of what stays manual and why (e.g., "visual layout comparison, drag-and-drop reordering, cross-browser rendering")]
- Recommended automation priority: [which scenarios to automate first and why]
${appMapBlock ? `
Regression Impact Areas:
Use the ticket labels to identify which codebases are changed. Go ELEMENT-LEVEL: do not just list routes — list the specific UI elements (fields, filters, dropdowns, list columns, cards, modals, form inputs) and API parameters that reference or consume the same data the ticket's feature modifies. For example, if "provider search" changes, list every field, filter, and list view in the app that displays or filters by provider data.
| Element / Field / Filter | Location (route or endpoint) | Service | Risk Level | Why It Could Break |
|--------------------------|-------------------------------|---------|-----------|-------------------|
| [specific UI element: e.g. "Provider name column in /vendors/list"] | [route or endpoint path] | [web-app / core-service / vendor-management] | High / Medium / Low | [shares same data source, same API field, same component, same filter logic] |

Regression Test Scenarios:
For each High and Medium risk regression element, create a test scenario following the SCENARIO WRITING RULES:
| # | Element Under Test | Service | Variable Under Test | Expected Proof (unchanged behavior) | Type |
|---|-------------------|---------|--------------------|------------------------------------|------|
| 1 | [specific element from impact areas] | [web-app/core-service/vendor-management] | [what aspect of this element is being verified] | [specific proof that this element still works correctly] | Manual / Automatable |

Regression Retest Checklist:
For each High and Medium risk element above, write a concrete verification step:
1. [Go to specific screen, locate specific element] → [expected unchanged behavior with proof]
2. ...
` : ""}
${appMapBlock}`;

    return streamClaude({
      system: systemInstruction,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 8192,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ output: "Error generating test plan." });
  }
}
