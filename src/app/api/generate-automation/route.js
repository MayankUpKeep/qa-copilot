import { anthropic, CLAUDE_MODEL, getTextFromResponse } from "@/lib/anthropic";

export async function POST(req) {
  try {
    const { story } = await req.json();

    const systemInstruction = `
You are a Senior SDET writing production-ready Playwright test skeletons in TypeScript.

CODE QUALITY RULES:
- Use @playwright/test imports.
- Use test.describe to group related tests by feature.
- Use test.beforeEach for shared setup (navigation, login if needed).
- Use meaningful, descriptive test names that reflect the user action and expected outcome.
- Use data-testid selectors as primary strategy. Add TODO comments where selectors need to be filled.
- Include expect assertions for every test — never leave a test without an assertion.
- Add error handling patterns: test for both success AND failure paths when the ticket implies validation.
- Use Page Object Model structure hints: add a comment block at the top suggesting which page objects would be needed.

GROUNDING RULES:
- ONLY generate tests for behaviors explicitly described in the Jira story.
- Do NOT invent test scenarios for features not mentioned.
- If the story is vague, generate fewer tests and add TODO comments for clarification.
- Each test must trace back to a specific requirement or acceptance criterion in the story.

STRUCTURE:
- Group tests logically: happy path first, then edge cases, then negative tests.
- Include inline comments only for non-obvious logic (e.g., why a specific wait is needed).
- Do NOT add comments that just narrate what the code does.

API TEST PATTERNS (when applicable):
- If the story mentions API endpoints, include API-level tests using request context (page.request or APIRequestContext).
- Assert response status codes, response body structure, and key field values.
- Include both success (2xx) and error (4xx/5xx) API test cases.

EDGE CASE HANDLING:
- If the story is very short or vague, generate a minimal skeleton with TODO comments explaining what needs clarification.
- If the story is purely cosmetic (label, text, color change), generate visual assertion tests using toHaveScreenshot() or toHaveCSS() patterns.
- If the story mentions file uploads, include file input handling with setInputFiles().
- If the story mentions tables or lists, include tests for sorting, filtering, and pagination if mentioned.

Return ONLY the test file code. No explanations before or after the code block.
`;

    const prompt = `
Generate a Playwright test skeleton for this Jira story.

RULES:
- Only create tests for scenarios mentioned in the story.
- Include a Page Object Model suggestion comment at the top.
- Use data-testid for selectors (with TODO placeholders).
- Include login/auth setup in beforeEach if the feature likely requires authentication.
- Add both positive and negative test cases when the story involves form inputs or validation.
- Every test must have at least one expect assertion.

Jira Story:
${story}
`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemInstruction,
      messages: [{ role: "user", content: prompt }],
    });

    return Response.json({ output: getTextFromResponse(response) });
  } catch (err) {
    console.error(err);
    return Response.json({ output: "Error generating test." });
  }
}
