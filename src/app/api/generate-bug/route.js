import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { bug } = await req.json();

    const systemInstruction = `
You are a Senior QA Engineer writing professional Jira bug reports.
Write clearly, concisely, and in a structured format.
Do not exaggerate severity.
Use observable behavior, not assumptions.
`;

const prompt = `
You are a professional Software QA Engineer writing a Jira bug report for developers.

Goal:
Convert rough tester observations into a clear, reproducible, engineering-quality bug ticket.

Strict Rules:
- Do NOT invent behavior not implied by the report
- Use neutral factual tone
- Avoid long paragraphs
- Do not repeat the user description verbatim
- Fill missing details with minimal realistic assumptions
- Focus on reproducibility
- Avoid generic statements like "system is broken"

Severity Rules:
Blocker → user cannot proceed OR core workflow impossible
Critical → data loss, security issue, or payment failure
Major → feature unusable but workaround exists
Minor → cosmetic or small usability issue

Output EXACTLY in this structure:

Title:

Environment:
(Infer Web / Mobile / API / Backend)

Preconditions:

Steps to Reproduce:
(Write numbered steps)

Expected Result:

Actual Result:

Impact:
(Explain user/business impact)

Severity Suggestion:
(Choose Blocker / Critical / Major / Minor + 1-line reasoning)

Possible Root Cause:
(Short technical hint for developer if logs or behavior suggest something)

Tester Notes:
(Helpful debugging observations only)

Bug observation:
${bug}
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
    return Response.json({ output: "Error generating bug report." });
  }
}
