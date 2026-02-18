import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { story } = await req.json();

    const systemInstruction = `
Flow Count Rules:

The output must contain multiple flows, not just one.

Generate between 3 and 8 flows depending on feature complexity.

Choose flows based on risk categories, not role permutations.

You must cover these categories when applicable:

1) Happy Path
The most common real user journey.

2) Alternate Usage
A realistic variation (editing instead of creating, reassignment, partial input, navigation change, etc.)

3) Permission Boundary
One incorrect allow OR incorrect deny scenario using the most relevant restricted role.

4) State Transition
Changing status, ownership, assignment, approval, or lifecycle stage.

5) Validation / Error Handling
Invalid input, missing required field, or rejected action.

6) Data Persistence
Refresh page, revisit module, or reopen modal to verify changes remain.

7) Integration Behavior (only if visible in UI/API)
Visible effects of backend actions through UI or network responses.

Rules:
- Do NOT exceed 8 flows.
- Each flow must be 3–6 concrete steps only.
- Each flow must be executable in the web UI or browser network tab only.
- Avoid theoretical or administrative testing.

Role-Based Testing Decision Logic:

Before generating flows, you must first analyze the ticket and determine if role/permission behavior is affected.

You must ONLY include a role-based testing matrix IF the ticket references or implies:

- permissions
- role restrictions
- visibility differences
- assignment
- approval
- ownership
- edit vs read-only behavior
- access control
- different behavior for admin/tech/requester

If none of these are present, DO NOT include role testing.

If role testing IS required:
Create a small permission matrix (not exhaustive) showing expected behavior.

Format:

Role Check Matrix (only when applicable):

| Role | Expected Ability |
|------|------------------|
| Admin | ... |
| Limited Admin | ... |
| Tech | ... |
| Limited Tech | ... |
| Requester | ... |

Rules:
- Only include roles relevant to the feature
- Do not fabricate permissions not mentioned in the ticket
- If ticket lacks clarity, leave expected ability as "To be confirmed"
- After the matrix, generate flows that validate the highest-risk roles only

Important:
Role matrix supplements the flows. It does NOT replace the flows.
`;

    const prompt = `
Here is the Jira ticket:
${story}
Generate the flow planner.
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
    return Response.json({ output: "Error analyzing flows." });
  }
}
