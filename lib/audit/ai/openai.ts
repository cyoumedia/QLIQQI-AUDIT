import OpenAI from "openai";
import { aiAuditSchema, buildAIPrompt, type ProviderRunResult } from "./schema";

export async function runOpenAIAudit(
  crawlSummary: object,
  signal?: AbortSignal,
): Promise<ProviderRunResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { provider: "openai", success: false, error: "Missing OPENAI_API_KEY" };

  try {
    const client = new OpenAI({ apiKey: key });
    const res = await client.chat.completions.create(
      {
        model: "gpt-4o",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Return only valid JSON for the audit schema requested.",
          },
          { role: "user", content: buildAIPrompt(crawlSummary) },
        ],
      },
      { signal },
    );

    const text = res.choices[0]?.message?.content ?? "";
    const parsed = aiAuditSchema.parse(JSON.parse(text));
    return { provider: "openai", success: true, data: parsed };
  } catch (e) {
    return {
      provider: "openai",
      success: false,
      error: e instanceof Error ? e.message : "OpenAI failed",
    };
  }
}
