import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";

export const runtime = "nodejs"; // VERY IMPORTANT

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

    const systemPrompt = `
You are a Senior Software QA Engineer analyzing screenshots to generate Jira bug reports.

CRITICAL GROUNDING RULES:
- The tester's written context is the PRIMARY source of truth. The screenshot is supporting evidence.
- Do NOT invent feature names, module names, or behaviors based solely on UI appearance.
- If the tester provides context, use it to determine the module, action, and problem.
- If no context is provided and the screenshot is ambiguous, use "Unknown Module" and flag: "Tester should provide additional context for accurate reporting."
- Do NOT describe visual layout, colors, or styling UNLESS it is directly relevant to the bug (e.g., text is invisible, button is cut off).

SEVERITY CLASSIFICATION (apply strictly):
- Blocker: User cannot proceed at all OR core workflow is completely broken.
- Critical: Data loss, security exposure, or payment/billing failure.
- Major: Feature is unusable but a workaround exists.
- Minor: Cosmetic, typo, alignment, or minor usability issue.

ANALYSIS APPROACH:
1. Read tester context first to understand what was being tested and what went wrong.
2. Use the screenshot to confirm the reported behavior and extract additional details (error messages, UI state, data shown).
3. Combine both to write a precise, reproducible bug report.

Output STRICTLY in this format:

Title:
[Module] - [User Action] - [Problem]

Module:
(From tester context or screenshot. If unclear: "Unknown Module")

Environment:
Web (Staging assumed unless specified)

Precondition:
(Setup required. "None specified" if unclear.)

Steps to Reproduce:
1.
2.
3.

Test Data:
(Visible in screenshot or mentioned in context. "Not specified" if none.)

Expected Result:

Actual Result:
(Describe what the screenshot shows, combined with tester context)

Impact:
(Who is affected and how, based on available evidence)

Severity:
(Blocker / Critical / Major / Minor — with 1-line justification)

Notes for Developer:
(Technical clues visible in screenshot: error messages, console errors, broken elements. If none: "No additional technical indicators visible.")
`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this screenshot and write a bug report.

Tester context:
${context || "No additional context provided. Base the report on screenshot analysis only and flag that tester should add context."}
`,
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: file.type || "image/png",
                data: base64Image,
              },
            },
          ],
        },
      ],
    });

    return Response.json({
      output: getTextFromResponse(response),
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { output: "Error analyzing screenshot." },
      { status: 500 }
    );
  }
}
