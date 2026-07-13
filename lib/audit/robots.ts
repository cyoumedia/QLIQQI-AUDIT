import { safeFetch } from "./security";

const AI_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
  "CCBot",
  "anthropic-ai",
  "ChatGPT-User",
];

export interface RobotsParseResult {
  fetched: boolean;
  content: string;
  disallowedPaths: string[];
  aiBotRules: Record<string, "allow" | "disallow" | "unknown">;
  aiBotScore: number;
  allowsAiBots: boolean;
}

export function parseRobotsTxt(content: string): Omit<RobotsParseResult, "fetched"> {
  const lines = content.split("\n").map((l) => l.trim());
  const disallowedPaths: string[] = [];
  const aiBotRules: Record<string, "allow" | "disallow" | "unknown"> = {};

  for (const bot of AI_BOTS) aiBotRules[bot] = "unknown";

  let activeAgents: string[] = [];
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    const k = key.toLowerCase();

    if (k === "user-agent") {
      activeAgents = [value];
    } else if (k === "disallow" && value) {
      if (activeAgents.some((a) => a === "*" || AI_BOTS.includes(a))) {
        disallowedPaths.push(value);
      }
      for (const agent of activeAgents) {
        if (AI_BOTS.includes(agent)) aiBotRules[agent] = "disallow";
      }
    } else if (k === "allow" && value) {
      for (const agent of activeAgents) {
        if (AI_BOTS.includes(agent)) aiBotRules[agent] = "allow";
      }
    }
  }

  const known = Object.values(aiBotRules).filter((v) => v !== "unknown");
  const allowed = known.filter((v) => v === "allow").length;
  const disallowed = known.filter((v) => v === "disallow").length;
  const aiBotScore =
    known.length === 0
      ? 40
      : Math.round((allowed / Math.max(known.length, 1)) * 100 - disallowed * 5);

  return {
    content,
    disallowedPaths,
    aiBotRules,
    aiBotScore: Math.max(0, Math.min(100, aiBotScore)),
    allowsAiBots: allowed >= disallowed,
  };
}

export function isPathDisallowed(path: string, disallowedPaths: string[]): boolean {
  for (const rule of disallowedPaths) {
    if (rule === "/") return true;
    if (path.startsWith(rule)) return true;
  }
  return false;
}

export async function fetchRobotsTxt(
  origin: string,
  signal?: AbortSignal,
): Promise<RobotsParseResult> {
  try {
    const res = await safeFetch(`${origin}/robots.txt`, { signal });
    if (!res.ok) {
      return {
        fetched: false,
        content: "",
        disallowedPaths: [],
        aiBotRules: {},
        aiBotScore: 40,
        allowsAiBots: false,
      };
    }
    const content = await res.text();
    return { fetched: true, ...parseRobotsTxt(content) };
  } catch {
    return {
      fetched: false,
      content: "",
      disallowedPaths: [],
      aiBotRules: {},
      aiBotScore: 40,
      allowsAiBots: false,
    };
  }
}
