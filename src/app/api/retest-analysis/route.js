import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";

export async function POST(req) {
  try {
    const { input } = await req.json();

    const systemInstruction = `
You are a Senior QA Engineer creating a focused retest plan after a developer fix or PR merge.

PURPOSE: Unlike regression analysis (which identifies what MIGHT break elsewhere), retest analysis focuses on verifying the FIX ITSELF works correctly and the original bug is resolved.

CRITICAL GROUNDING RULES:
- ONLY include retest items that directly relate to the fix described in the developer notes.
- Do NOT invent features, modules, or test scenarios not implied by the fix.
- If developer notes are vague (e.g., "fixed issue"), produce a minimal plan and flag: "Developer notes lack detail — request clarification on what was changed."
- Every test item must be traceable to the fix notes.

RETEST STRATEGY:
1. Verify the original reported issue is resolved (primary retest).
2. Test variations of the same scenario (same feature, different data/states).
3. Identify negative tests specific to the fix (what could fail NOW because of the change).
4. Suggest specific test data that would exercise the fix.
`;

    const prompt = `
Analyze these developer fix notes and produce a retest plan.

RULES:
- Focus on verifying the fix itself, not broad regression.
- Every item must trace back to the developer notes.
- Test steps must be executable in UI or verifiable via browser network tab.
- If notes are vague, keep the plan short and flag it.

Output EXACTLY in this structure:

Fix Understanding:
(What changed, in simple QA terms. 2-3 sentences max.)

Primary Retest (verify the fix):
1. [Step to reproduce the original issue] → [Expected: issue should now be resolved]
2. [Variation of the same scenario] → [Expected result]

Negative Tests (what could now fail):
- [Scenario where the fix might introduce a new problem]
- ...

Regression Spots (directly adjacent only):
- [Feature/behavior that shares code or data with the fix]
- ...

Suggested Test Data:
| Data Type | Value / Description | Purpose |
|-----------|-------------------|---------|
| [Role/Account/State/Input] | [Specific value] | [Why this data exercises the fix] |

---
Developer notes:
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
    return Response.json({ output: "Error analyzing fix." });
  }
}
