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
