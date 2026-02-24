import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";
import { getAppContext, formatAppContextForPrompt } from "@/lib/app-mapper";

export async function POST(req) {
  try {
    const { input } = await req.json();

    const appContext = getAppContext({});
    const appMapBlock = formatAppContextForPrompt(appContext);

    const systemInstruction = `You are a Senior QA Engineer creating a focused retest plan after a developer fix or PR merge.

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
${appMapBlock ? "\nREGRESSION GROUNDING:\n- Use the application map below to identify real routes and endpoints adjacent to the fix.\n- Only reference actual routes/endpoints from the map when suggesting regression spots." : ""}`;

    const prompt = `Developer notes:
${input}

Produce the retest plan in this structure:

Fix Understanding:
(What changed, in simple QA terms. 2-3 sentences max.)

Primary Retest (verify the fix):
1. [Step to reproduce the original issue] → [Expected: issue should now be resolved]
2. [Variation of the same scenario] → [Expected result]

Negative Tests (what could now fail):
- [Scenario where the fix might introduce a new problem]
- ...

Suggested Test Data:
| Data Type | Value / Description | Purpose |
|-----------|-------------------|---------|
| [Role/Account/State/Input] | [Specific value] | [Why this data exercises the fix] |
${appMapBlock ? `
Regression Spots:
| Route / Endpoint / Module | Risk Level | Reason |
|---------------------------|-----------|--------|

Regression Retest Checklist:
1. [test step] → [expected result]
` : `
Regression Spots (directly adjacent only):
- [Feature/behavior that shares code or data with the fix]
`}
${appMapBlock}`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 3000,
      system: systemInstruction,
      messages: [{ role: "user", content: prompt }],
    });

    return Response.json({ output: getTextFromResponse(response) });
  } catch (err) {
    console.error(err);
    return Response.json({ output: "Error analyzing fix." });
  }
}
