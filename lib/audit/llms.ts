import { safeFetch } from "./security";

export interface LlmsResult {
  present: boolean;
  content: string;
  scoreBoost: number;
}

export async function fetchLlmsTxt(
  origin: string,
  signal?: AbortSignal,
): Promise<LlmsResult> {
  try {
    const res = await safeFetch(`${origin}/llms.txt`, { signal });
    if (!res.ok) return { present: false, content: "", scoreBoost: 0 };
    const content = await res.text();
    const hasStructure = content.includes("#") || content.length > 50;
    return {
      present: true,
      content: content.slice(0, 2000),
      scoreBoost: hasStructure ? 15 : 8,
    };
  } catch {
    return { present: false, content: "", scoreBoost: 0 };
  }
}
