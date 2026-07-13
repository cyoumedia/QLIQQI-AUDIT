import type { AuditProgressEvent, AuditReport } from "./types";

export interface AuditStreamCallbacks {
  onEvent: (event: AuditProgressEvent) => void;
  onReport: (report: AuditReport) => void;
  onError: (message: string) => void;
}

export async function streamAudit(
  url: string,
  signal: AbortSignal,
  callbacks: AuditStreamCallbacks,
): Promise<void> {
  const res = await fetch("/api/audit/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal,
  });

  if (!res.ok || !res.body) {
    callbacks.onError(`Audit request failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      try {
        const event = JSON.parse(line.slice(5).trim()) as AuditProgressEvent;
        callbacks.onEvent(event);
        if (event.type === "complete") callbacks.onReport(event.report);
        if (event.type === "error") callbacks.onError(event.message);
        if (event.type === "warning") callbacks.onEvent(event);
      } catch {
        // skip malformed chunk
      }
    }
  }
}
