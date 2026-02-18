import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { input } = await req.json();

    const systemInstruction = `
You are a senior QA + backend debugging specialist.
Your job is to interpret logs and errors for a tester.
Explain failures clearly and help the tester communicate with developers.
Do NOT be vague.
`;

    const prompt = `
Analyze the following error/log output.

Output EXACTLY in this format:

Failure Summary:
(What failed in simple words)

Where The Problem Likely Exists:
(Frontend / Backend / Database / Authentication / Network / Configuration)

Technical Explanation:
(Explain what the error actually means)

Probable Root Cause:
(Why this is happening)

How QA Can Verify:
(What tester should try)

What To Tell Developer:
(Short message tester can send in Jira or Slack)

Error:
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
    return Response.json({ output: "Error analyzing logs." });
  }
}
