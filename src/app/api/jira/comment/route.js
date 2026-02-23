import { postComment } from "@/lib/jira";

export async function POST(req) {
  try {
    const { ticketId, comment } = await req.json();

    if (!ticketId || !comment) {
      return Response.json(
        { error: "Ticket ID and comment are required" },
        { status: 400 }
      );
    }

    await postComment(ticketId.trim().toUpperCase(), comment);

    return Response.json({ success: true });
  } catch (err) {
    console.error("Jira comment error:", err);
    return Response.json(
      { error: err.message || "Failed to post comment" },
      { status: 500 }
    );
  }
}
