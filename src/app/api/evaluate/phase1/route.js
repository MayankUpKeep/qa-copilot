import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";
import { getAppContext, formatAppContextForPrompt } from "@/lib/app-mapper";

export async function POST(req) {
  try {
    const { story } = await req.json();

    const appContext = getAppContext({});
    const appMapBlock = formatAppContextForPrompt(appContext);

    const systemInstruction = `
You are a Senior QA Engineer thinking from the USER'S PERSPECTIVE.

MINDSET: You are the end-user of this application. You care about what you see, what you click, what happens when you do things, and whether the experience makes sense. You do NOT care about code, APIs, endpoints, or technical implementation.

CONTEXT: The story is in "Ready" state — requirements are defined but no code exists yet. You are reading the ticket as a user would read a feature description and thinking: "How will I use this? What could go wrong for me?"

PURPOSE:
- Think through every user journey this ticket describes.
- Identify what a real user would do: happy paths, mistakes, edge cases, confusing flows.
- Predict where the user experience could break, frustrate, or confuse.
- Flag anything in the ticket that's unclear from a user's point of view.

RULES:
- Write EVERY scenario as a user action: "As a user, I navigate to...", "I click...", "I enter...", "I expect to see..."
- Do NOT mention APIs, endpoints, database, code files, or technical details.
- Do NOT use developer language. Use plain, user-facing language.
- Focus on what the user SEES and DOES, not what the system does internally.
- Think about: navigation, forms, buttons, messages, loading states, error states, permissions (from user's view), data display, edge cases in input.
- If the ticket is vague from a user perspective, call it out.
`;

    const prompt = `
Read this ticket as an end-user and create a test plan from the user's perspective.

TICKET:
${story}

Output EXACTLY in this structure:

What This Means for the User:
(2-3 sentences in plain language: what changes for the user, what they'll be able to do differently, and what they should notice.)

User Journeys to Test:
| # | User Action | What User Expects to See | Priority |
|---|------------|--------------------------|----------|
| 1 | [step-by-step user action in plain language] | [what the screen shows, what feedback the user gets] | Critical / High / Medium / Low |
| 2 | ... | ... | ... |

Edge Cases (things users actually do):
- [What if the user double-clicks the button?]
- [What if the user enters unexpected input?]
- [What if the user navigates away and comes back?]
- [What if the user has slow internet?]
- (Only include edge cases relevant to this ticket)

Confusing or Unclear Areas:
- [Parts of the ticket where user behavior is ambiguous]
- [Missing information about what the user sees or how the UI behaves]
- (Write "Ticket is clear from user perspective" if nothing is ambiguous)

Areas of the App This Likely Affects:
- [Other screens or features the user might notice changes in]
- [Related workflows that could behave differently]
${appMapBlock ? "\n(Reference real app routes below when identifying affected areas)\n" + appMapBlock : ""}
`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 3000,
      system: systemInstruction,
      messages: [{ role: "user", content: prompt }],
    });

    return Response.json({ output: getTextFromResponse(response) });
  } catch (err) {
    console.error(err);
    return Response.json({ output: "Error generating Phase 1 plan." });
  }
}
