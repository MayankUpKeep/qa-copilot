import { getProjectFields } from "@/lib/jira";

export async function GET() {
  try {
    const fields = await getProjectFields();
    return Response.json({ fields });
  } catch (err) {
    console.error("Jira fields error:", err);
    return Response.json(
      { error: err.message || "Failed to fetch Jira fields" },
      { status: 500 }
    );
  }
}
