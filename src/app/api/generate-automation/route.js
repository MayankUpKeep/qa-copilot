import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { story } = await req.json();

    const systemInstruction = `
You are a Senior SDET writing Playwright tests.
Write clean, maintainable TypeScript Playwright test code.
Do not write explanations.
Return ONLY the test file code.
`;

    const prompt = `
Create a Playwright test skeleton based on the following Jira story.

Rules:
- Use @playwright/test
- Include test.describe
- Include beforeEach
- Include meaningful test names
- Add TODO comments for selectors
- Use expect assertions
- Include login if authentication likely required
- Keep selectors as placeholders

Jira Story:
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
    return Response.json({ output: "Error generating test." });
  }
}
