import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";


export async function POST(req) {
  try {
    const { story, images = [] } = await req.json();

    let imageSection = "";
    if (images && images.length > 0) {
      imageSection = `\n\nThe following images are attached to the ticket and may be relevant for test planning.\nFor each image, consider if it impacts the test plan:\n${images.map((img, i) => `Image ${i+1}: [${img.name || "image"}] (type: ${img.type})`).join("\n")}`;
    }

    const systemInstruction = `
You are a senior QA engineer creating executable, ticket-focused test plans.

OBJECTIVE:
- Generate PRACTICAL, executable test plans (not documentation).
- Every test plan element MUST trace back to explicit ticket content or images.
- NO invented scenarios, assumptions, or features not mentioned.

IMAGES ARE PRIMARY REFERENCE:
- Analyze attached images to understand exact feature behavior, UI state, and requirements.
- Images clarify ambiguous ticket descriptions.
- Use images to validate test scenarios match intended design.

TESTING CONSTRAINTS:
- Testing is done in a non-production environment only.
- No database access, backend logs, or server consoles.
- Only UI testing and API validation via browser network tab are allowed.

COVERAGE RULES:
- Convert backend validations into UI observable behavior.
- Replace DB verification with UI state validation.
- Replace log verification with API response verification.
- Include functional testing and UI validation ALWAYS.
- Include API testing ONLY if ticket mentions APIs/services/endpoints/tokens.
- Include permission checks ONLY if ticket mentions role-based behavior.
- EXCLUDE: security, infrastructure, load, deployment, performance testing, monitoring, analytics, data warehouse, migrations, audit systems (unless explicitly in ticket).
- Avoid QA jargon ("test strategy", "test methodology", "stakeholder alignment", etc).

RACE CONDITION & CONCURRENCY AWARENESS:
- If the ticket involves any of the following, you MUST include race condition scenarios:
  * Concurrent user actions (multiple users editing the same record)
  * Rapid repeated submissions (double-click, multiple form submits)
  * Status/state transitions that could be triggered simultaneously
  * Bulk operations or batch processing
  * Real-time updates, notifications, or live data
  * Queues, background jobs, or async workflows visible in UI
- For each race condition scenario, describe: the conflicting actions, the timing, and the observable expected behavior.
- If the ticket does NOT involve any concurrency-sensitive behavior, do NOT force race condition scenarios.

QUALITY STANDARDS:
- Each test plan element must reference ticket content (quote or paraphrase).
- All sections must be focused and concise.
- Output must be directly pasteable into Jira fields.

EDGE CASE HANDLING:
- If the ticket content is very short (under 50 words) or vague, produce a minimal test plan and add at the top: "⚠ Ticket lacks detail — test plan is limited. Request clarification from the team before testing."
- If the ticket is purely cosmetic (label, color, text change), limit to 3-5 scenarios max and skip sections that don't apply (e.g., skip Race Conditions, skip TP Technical Requirements).
- If no images are attached and the ticket references UI behavior, note: "No images provided — scenarios based on text description only. Visual verification recommended."
`;

const formattingRule = `
FORMATTING RULES:
- Use bullet points for all sections.
- One short, actionable line per bullet.
- No paragraphs, introductions, or summaries.
- No filler or generic statements.
- Output must be directly pasteable into Jira fields.
- Each item should reference ticket content where applicable.
`;

const prompt = `
Analyze the Jira ticket and attached images ONLY. Produce a focused, executable test plan.

TICKET CONTENT:
${story}
${imageSection}

CRITICAL REQUIREMENTS:
1. Analyze ticket content and images carefully.
2. Identify ONLY features, behaviors, and requirements EXPLICITLY mentioned.
3. Do NOT invent, assume, or speculate beyond ticket scope.
4. Each test plan section must reference ticket content (quote or paraphrase the source).
5. Use images to validate test understanding and accuracy.
6. Output ONLY the test plan sections (no explanations, summaries, or ticket repetition).

SECTION DEFINITIONS:

TP Feature Dependencies & Risks:
- List cross-team impacts, affected features, workflow changes, compatibility issues, and behavior differences as EXPLICITLY mentioned in ticket or shown in images.
- Do NOT assume risks. Only document identified or evident risks.

TP Test Execution Dependencies & Risks:
- List required roles, permissions, data setup, external services, testability concerns, or blockers EXPLICITLY mentioned or implied by images.
- Avoid speculating about missing prerequisites.

TP Technical Requirements for Testing:
- List specific environments, feature flags, configuration changes, integrations, or test data sources mentioned in ticket or visible in images.
- Only include if ticket explicitly references these.

TP Assumptions:
- List ONLY assumptions that are directly implied by the ticket or images.
- Examples: "Assume feature is available in Staging", "Assume admin role has access".
- Do NOT add invented assumptions.

TP Out of Scope:
- List ONLY items explicitly excluded in the ticket (e.g., "Performance testing out of scope").
- Do NOT assume items are out of scope unless ticket explicitly states it.

TP Testing Scope:
- Map EXACTLY to features/requirements mentioned in ticket.
- Use bullet points for each feature or requirement that will be tested.
- Reference specific ticket points.

TP Testing Approach:
- List testing method (exploratory, manual, automation) based on ticket requirements.
- Specify who performs testing and any relevant QA workflow considerations mentioned.

Test Scenarios:
- Generate as many scenarios as needed to cover ALL explicit ticket requirements.
- NEVER use fixed count.
- Each scenario must trace back to a specific ticket requirement or image detail.
- Focus on high-risk, critical paths, and requirement coverage.
- Write deterministically, avoid "verify it works".
- Expected results must be observable (UI state, API response, etc).
- If the ticket involves concurrency-sensitive behavior, include race condition scenarios.

SCENARIO CLASSIFICATION TABLE:
After listing all test scenarios, you MUST produce a summary table classifying each scenario.

Rules for classification:
- Manual: Scenarios requiring visual verification, subjective judgment, exploratory paths, or complex multi-step UI workflows.
- Automatable: Scenarios with deterministic inputs/outputs, repeatable steps, API validations, or data-driven checks that are good candidates for Playwright/Cypress/API automation.
- Mark scenarios that involve race conditions or timing as "Manual" unless they can be reliably scripted.

Output EXACTLY in this structure:

TP Feature Dependencies & Risks:

TP Test Execution Dependencies & Risks:

TP Technical Requirements for Testing:

TP Assumptions:

TP Out of Scope:

TP Testing Scope:

TP Testing Approach:

Test Scenarios:

| # | Scenario | Expected Result | Type |
|---|----------|-----------------|------|
| 1 | [specific user action/condition] | [observable outcome] | Manual / Automatable |
| 2 | ... | ... | ... |

Race Condition Scenarios (if applicable):

| # | Conflicting Actions | Timing | Expected Behavior | Type |
|---|---------------------|--------|-------------------|------|
| 1 | [action A vs action B] | [simultaneous / rapid succession] | [which should win, error shown, etc.] | Manual / Automatable |
`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 3000,
      system: systemInstruction + formattingRule,
      messages: [{ role: "user", content: prompt }],
    });

    return Response.json({ output: getTextFromResponse(response) });

  } catch (err) {
    console.error(err);
    return Response.json({ output: "Error generating test plan." });
  }
}
