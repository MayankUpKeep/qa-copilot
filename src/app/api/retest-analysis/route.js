import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { input } = await req.json();

    const systemInstruction = `
You are a Senior QA Engineer performing impact analysis after a bug fix or code change.
Your job is to determine what needs to be retested and what regression areas are risky.
Be concise and practical.
`;

    const prompt = `
Analyze the following developer fix / PR description.

Produce a QA retest checklist.

Output EXACTLY in this format:

Fix Understanding:
(Explain what changed in simple QA terms)

Primary Areas to Retest:
(Bullet list)

High-Risk Scenarios:
(Edge cases and failure paths)

Regression Areas:
(Related features that might break)

Negative Tests:
(What could now fail)

Suggested Test Data:
(Accounts, roles, states useful to test)

Developer notes:
${input}
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
    return Response.json({ output: "Error analyzing fix." });
  }
}
