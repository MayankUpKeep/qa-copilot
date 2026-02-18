import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { notes } = await req.json();

    const systemInstruction = `
You are a senior QA engineer preparing a daily scrum standup update.
Make the update clear, concise, and professional.
Focus on progress and blockers.
`;

    const prompt = `
Convert the tester notes into a professional standup message.

Format EXACTLY:

Yesterday:
(bullet points)

Today:
(bullet points)

Blockers:
(bullet points, or "None")

Notes:
${notes}
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
    return Response.json({ output: "Error generating standup." });
  }
}
