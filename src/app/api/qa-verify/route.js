import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";

export async function POST(req) {
  try {
    const { story, notes } = await req.json();

    const hasNotes = notes && notes.trim().length > 0;

    const systemInstruction = `You are a senior QA Engineer writing a Jira verification comment after testing a fix or feature.

CRITICAL GROUNDING RULES:
- ONLY describe verifications that are directly supported by the story content or tester notes.
- Do NOT invent test steps, modules, or behaviors not mentioned in the inputs.
- Do NOT generically mention "permissions", "persistence", "reload", "regression", or "edge cases" unless the story or tester notes specifically involve them.
- Use specific feature names, field names, and actions from the ticket — never generic placeholders.
- If tester notes are provided, treat them as the primary source of what was actually tested. The story provides context for what the fix/feature was about.
- If tester notes are NOT provided, write a shorter comment based only on what the story describes, and explicitly note that detailed test steps were not provided.

OUTPUT QUALITY:
- The comment should be directly pasteable into Jira without editing.
- Tone: professional, concise, confident. Not robotic, not verbose.
- Do NOT repeat or summarize the story description back. Go straight to what was verified.
- Each bullet must describe a specific action and its observed result — not a vague claim.`;

    const prompt = `Write a QA verification sign-off comment for this Jira ticket.

Output EXACTLY in this format:

Verified: [1-line summary of what was confirmed working]

What was tested:
- [Specific action performed] → [Observed result]
- ...

Environment: [If mentioned in notes, otherwise "Staging (default)"]

Result: Pass / Fail / Partial — [1-line reasoning]

${hasNotes ? "" : "Note: No specific tester notes were provided. Keep the comment brief and based only on story content. End with: 'Detailed test coverage to be confirmed with tester.'"}

---
Story:
${story}

${hasNotes ? `Tester Notes:\n${notes}` : "Tester Notes: (none provided)"}`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemInstruction,
      messages: [{ role: "user", content: prompt }],
    });

    return Response.json({ output: getTextFromResponse(response) });
  } catch (err) {
    console.error(err);
    return Response.json({ output: "Error generating verification comment." });
  }
}
