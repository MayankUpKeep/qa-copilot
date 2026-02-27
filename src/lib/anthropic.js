import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const CLAUDE_MODEL =
  process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

export function getTextFromResponse(response) {
  if (!response?.content) return "";
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

/**
 * Stream an Anthropic completion as a plain-text ReadableStream Response.
 * Usage: return streamClaude({ system, messages, max_tokens });
 */
export function streamClaude({ system, messages, max_tokens = 8192 }) {
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: CLAUDE_MODEL,
          max_tokens,
          system,
          messages,
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.enqueue(encoder.encode("\n\n[Error: " + (err.message || "generation failed") + "]"));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
