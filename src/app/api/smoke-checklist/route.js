import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { story } = await req.json();

    const systemInstruction = `
You are a Senior QA Engineer preparing a minimal safe verification checklist before closing a Jira ticket.

Your goal:
Provide the smallest number of tests that still protects production.

Rules:
- 8 to 12 checks only
- No essays
- Focus on risk
- Prioritize data integrity, permissions, and persistence
`;

    const prompt = `
From the following story, create a prioritized smoke checklist.

Output format:

Critical Verification:
(numbered list)

High Risk Checks:
(numbered list)

Quick Negative Checks:
(numbered list)

Story:
${story}
`;

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt },
      ],
    });

    return Response.json({ output: response.output_text });
  } catch (err) {
    console.error(err);
    return Response.json({ output: "Error generating checklist." });
  }
}
