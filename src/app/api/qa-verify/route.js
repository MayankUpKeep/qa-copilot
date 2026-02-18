import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { story, notes } = await req.json();

    const systemInstruction = `
You are a professional QA Engineer writing a Jira verification comment after testing a fix.

Tone:
- Professional
- Concise
- Confident
- Not robotic

Do NOT write long paragraphs.
Do NOT repeat the story.
Summarize what QA validated.
`;

    const prompt = `
Write a QA verification sign-off comment.

Include:
- what behavior was verified
- persistence/reload validation
- permission checks if relevant
- regression check

Story:
${story}

Tester Notes:
${notes || "General verification performed"}
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
    return Response.json({ output: "Error generating verification comment." });
  }
}
