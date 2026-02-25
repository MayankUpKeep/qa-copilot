import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";

export async function POST(req) {
  try {
    const { story, planA, planB } = await req.json();

    const systemInstruction = `PURPOSE: Compare two test plans (Plan A = user perspective, Plan B = technical/PR perspective) and produce a focused ALIGNMENT DIFF that highlights exactly what matches and what doesn't.

RULES:
- Go through every test scenario and scope item in both plans.
- Categorize each into exactly one of three buckets:
  [ALIGNED] — Same feature/behavior appears in BOTH plans (even if described differently). User language and technical language describing the same thing = ALIGNED.
  [PLAN A ONLY] — Appears ONLY in Plan A. The user/ticket expects this but the PR does not appear to cover it. Flag as a POTENTIAL GAP.
  [PLAN B ONLY] — Appears ONLY in Plan B. The PR changes something the ticket did not ask for. Flag as an UNDOCUMENTED CHANGE.
- Be thorough: every significant item from both plans must appear in exactly one bucket.
- Use your judgment to match items across plans — different wording for the same behavior = ALIGNED.
- Be concise: one line per item.
- Do NOT merge or rewrite the plans. Do NOT produce a unified scope. ONLY produce the diff.
- NEVER mention internal reasoning or how you matched items.`;

    const prompt = `Compare these two test plans and produce the alignment diff.

TICKET:
${story}

--- PLAN A (User Perspective) ---
${planA}

--- PLAN B (Technical Analysis) ---
${planB}

Output EXACTLY in this structure:

Alignment Summary:
- Aligned: [count] items
- Plan A Only (gaps): [count] items
- Plan B Only (undocumented): [count] items

Aligned (covered in both plans):
- [ALIGNED] [test area] — Plan A: [user description] | Plan B: [technical description]
- [ALIGNED] ...

Plan A Only (potential gaps — user expects but PR may not cover):
- [PLAN A ONLY] [test area] — [what the user expects that has no matching PR evidence]
- [PLAN A ONLY] ...
(Write "None — all user expectations are covered by the PR." if empty)

Plan B Only (undocumented changes — PR does something ticket didn't mention):
- [PLAN B ONLY] [test area] — [what the PR changes that the ticket didn't ask for]
- [PLAN B ONLY] ...
(Write "None — all PR changes trace back to ticket requirements." if empty)

Recommended Actions:
- For each [PLAN A ONLY] item: suggest whether to confirm with developer, defer, or add to PR scope.
- For each [PLAN B ONLY] item: suggest whether to add test coverage, flag for review, or accept as intentional.`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system: systemInstruction,
      messages: [{ role: "user", content: prompt }],
    });

    return Response.json({ output: getTextFromResponse(response) });
  } catch (err) {
    console.error(err);
    return Response.json({ output: "Error generating diff." });
  }
}
