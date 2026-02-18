import OpenAI from "openai";

export const runtime = "nodejs"; // VERY IMPORTANT

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("image");
    const context = formData.get("context");


    if (!file) {
      return Response.json({ output: "No image received." }, { status: 400 });
    }

    // Convert image to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString("base64");

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
            You are a Senior Software QA Engineer, not a UI describer.

            You must generate a Jira bug report using tester reasoning, not visual guessing.

            IMPORTANT RULES:
            - Do NOT invent feature names from the screenshot
            - Prefer tester provided context over UI interpretation
            - If module is unclear, use "Unknown Module"
            - Focus on behavior, validation, and system response
            - Avoid describing colors, borders, or layout unless it affects usability
            - Write concise professional QA language

            Output STRICTLY in this format:

            Title:
            [Module] - [User Action] - [Problem]

            Module:

            Environment:
            Web (Staging assumed unless specified)

            Precondition:

            Steps to Reproduce:
            1.
            2.
            3.

            Test Data:

            Expected Result:

            Actual Result:

            Impact:

            Severity:
            (Choose: Blocker, Major, Minor)

            Notes for Developer:
            (optional technical suspicion)
            `,
        },
        {
          role: "user",
          content: [
            {
            type: "text",
            text: `Analyze this screenshot and write a bug report.

            Additional tester context:
            ${context || "No additional context provided"}
            `,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${file.type};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 900,
    });

    return Response.json({
      output: response.choices[0].message.content,
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { output: "Error analyzing screenshot." },
      { status: 500 }
    );
  }
}
