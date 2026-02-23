import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";

export async function POST(req) {
  try {
    const { notes } = await req.json();

    const systemInstruction = `
You are a senior QA engineer formatting raw tester notes into a professional daily standup update.

CRITICAL GROUNDING RULES:
- ONLY include information that is present in the tester's notes.
- Do NOT invent tasks, tickets, blockers, or plans not mentioned.
- Do NOT rephrase notes into something that changes the meaning. Preserve the tester's intent.
- If the notes are vague or just a few words, produce a shorter standup and add: "(Note: Limited detail provided — tester should expand before posting)"

FORMATTING RULES:
- Each bullet should be a single, clear line — not a paragraph.
- Start each bullet with an action verb: Tested, Verified, Found, Reported, Blocked by, Retested, etc.
- Include ticket IDs (e.g., PROJ-123) if the tester mentioned them. Do NOT invent ticket IDs.
- Group related items together. Don't scatter.
- Blockers should clearly state: what is blocked, why, and who can unblock (if mentioned).
- If the tester doesn't mention blockers, write "None" — do NOT invent blockers.

CATEGORIZATION LOGIC:
- Yesterday: Tasks the tester describes as completed or worked on previously.
- Today: Tasks the tester describes as planned or upcoming.
- If notes don't clearly separate yesterday/today, make your best judgment based on tense and context, and flag: "(auto-categorized from notes)"
`;

    const prompt = `
Convert these raw tester notes into a professional standup update.

RULES:
- Only use information from the notes. Do not add tasks or tickets not mentioned.
- If notes are very brief, keep standup brief and flag it.
- Use action verbs for each bullet point.

Output EXACTLY in this format:

Yesterday:
- [Action verb] [what was done, with ticket ID if available]
- ...

Today:
- [Action verb] [what is planned, with ticket ID if available]
- ...

Blockers:
- [What is blocked + why + who can help] OR "None"

---
Tester Notes:
${notes}
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
    return Response.json({ output: "Error generating standup." });
  }
}
