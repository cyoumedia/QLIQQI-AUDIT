import Anthropic from "@anthropic-ai/sdk";
import { aiAuditSchema, buildAIPrompt, type ProviderRunResult } from "./schema";

export async function runClaudeAudit(
  crawlSummary: object,
  signal?: AbortSignal,
): Promise<ProviderRunResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { provider: "claude", success: false, error: "Missing ANTHROPIC_API_KEY" };

  try {
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create(
      {
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        temperature: 0,
        messages: [{ role: "user", content: buildAIPrompt(crawlSummary) }],
      },
      { signal },
    );

    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = aiAuditSchema.parse(JSON.parse(jsonMatch[0]));
    return { provider: "claude", success: true, data: parsed };
  } catch (e) {
    return {
      provider: "claude",
      success: false,
      error: e instanceof Error ? e.message : "Claude failed",
    };
  }
}
