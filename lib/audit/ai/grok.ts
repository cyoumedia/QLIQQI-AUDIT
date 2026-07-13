import { aiAuditSchema, buildAIPrompt, type ProviderRunResult } from "./schema";

export async function runGrokAudit(
  crawlSummary: object,
  signal?: AbortSignal,
): Promise<ProviderRunResult> {
  const key = process.env.XAI_API_KEY;
  if (!key) return { provider: "grok", success: false, error: "Missing XAI_API_KEY" };

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "grok-4.3",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: "Return only valid JSON for the audit schema requested.",
          },
          { role: "user", content: buildAIPrompt(crawlSummary) },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      let detail = errBody;
      try {
        const parsed = JSON.parse(errBody) as { error?: string };
        if (parsed.error) detail = parsed.error;
      } catch {
        // keep raw body
      }
      throw new Error(`Grok API ${res.status}: ${detail}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in Grok response");
    const parsed = aiAuditSchema.parse(JSON.parse(jsonMatch[0]));
    return { provider: "grok", success: true, data: parsed };
  } catch (e) {
    return {
      provider: "grok",
      success: false,
      error: e instanceof Error ? e.message : "Grok failed",
    };
  }
}
