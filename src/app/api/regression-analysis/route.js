import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { input } = await req.json();

    const systemInstruction = `
You are a Senior QA Engineer performing impact analysis after a fix.

Your job:
- Understand what code behavior changed
- Predict affected modules
- Identify regression risk
- Provide a practical retest checklist

Do not write essays.
Be practical and actionable.
`;

    const prompt = `
Analyze the developer fix notes below and create a regression test strategy.

Output STRICTLY in this format:

Fix Understanding:
(Explain in simple QA language what changed)

Impacted Areas:
(Bullet points)

High Risk Scenarios:
(Bullet points)

Retest Checklist:
(Numbered steps QA should execute)

Edge Cases:
(Bullet points)

Safe To Skip:
(What QA likely does NOT need to retest)

Fix notes:
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
    return Response.json({ output: "Error analyzing regression." });
  }
}
