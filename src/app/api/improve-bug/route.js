import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { title, description } = await req.json();

    const systemInstruction = `
You are a Senior QA Engineer rewriting poorly written Jira bug reports.

Your job:
Turn vague bug reports into clear, reproducible QA bug reports.

Rules:
- Do not invent new functionality
- Only clarify and structure
- Infer steps logically if needed
- Keep concise
`;

    const prompt = `
Rewrite this Jira bug into a structured QA bug:

Original Title:
${title}

Original Description:
${description}

Output format:

Title:
Module:
Environment:
Preconditions:
Steps to Reproduce:
Expected Result:
Actual Result:
Impact:
Severity:
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
    return Response.json({ output: "Error improving bug." });
  }
}
