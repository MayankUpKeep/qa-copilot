import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";

export async function POST(req) {
  try {
    const { input } = await req.json();

    const systemInstruction = `
You are a Senior QA Engineer performing regression impact analysis after a developer fix or code change.

CRITICAL GROUNDING RULES:
- ONLY analyze impact based on what the developer fix notes explicitly describe.
- Do NOT invent affected modules, features, or scenarios not implied by the fix.
- If the fix notes are vague (e.g., "fixed the bug"), produce a shorter analysis and flag: "Fix notes lack detail — request developer to clarify scope of changes."
- Every impacted area and risk scenario must be traceable to something in the fix notes.

ANALYSIS APPROACH:
- First understand WHAT changed (the fix itself).
- Then predict WHERE it could ripple (related modules, shared components, data flows).
- Then identify WHAT could break (regression risks).
- Finally produce a prioritized, actionable retest checklist.

RISK CLASSIFICATION:
- High Risk: Directly modified behavior + areas sharing the same data/API/component.
- Medium Risk: Adjacent features in the same module that weren't directly changed.
- Low Risk / Safe to Skip: Unrelated modules with no shared dependencies.
`;

    const prompt = `
Analyze these developer fix notes and produce a regression impact analysis.

RULES:
- Every item must be grounded in the fix notes below.
- If fix notes are too vague, say so and keep the analysis minimal rather than speculating.
- Retest checklist steps must be executable in UI or verifiable via browser network tab.

Output EXACTLY in this structure:

Fix Understanding:
(Explain in simple QA language what the developer changed and why. 2-3 sentences max.)

Impacted Areas:
| Area | Risk Level | Reason |
|------|-----------|--------|
| [module/feature] | High / Medium | [why this area is affected based on fix notes] |

High Risk Scenarios:
- [Specific scenario that could break, traced to the fix]
- ...

Retest Checklist:
1. [Executable test step] → [Expected result]
2. ...

Edge Cases:
- [Boundary condition relevant to the fix]
- ...

Safe to Skip:
- [What QA does NOT need to retest and why]

---
Developer fix notes:
${input}
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
    return Response.json({ output: "Error analyzing regression." });
  }
}
