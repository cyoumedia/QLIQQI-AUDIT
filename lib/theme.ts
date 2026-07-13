export const colors = {
  navy: "#07111F",
  teal: "#113255",
  brightTeal: "#1D538C",
  white: "#FFFFFF",
  good: "#10B981",
  caution: "#D97706",
  fault: "#DC2626",
  unknown: "#64748B",
  line: "#E2E8F0",
  muted: "#64748B",
} as const;

export function scoreColor(score: number): string {
  if (score >= 80) return colors.good;
  if (score >= 50) return colors.caution;
  return colors.fault;
}

export function providerLabel(id: string): string {
  const map: Record<string, string> = {
    claude: "Claude",
    grok: "Grok",
    openai: "ChatGPT",
  };
  return map[id] ?? id;
}
