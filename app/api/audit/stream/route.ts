import { runAudit } from "@/lib/audit/orchestrator";
import type { AuditProgressEvent } from "@/lib/audit/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function encodeEvent(event: AuditProgressEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const url = typeof body.url === "string" ? body.url : "";

  if (!url) {
    return new Response(JSON.stringify({ error: "URL required" }), { status: 400 });
  }

  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: AuditProgressEvent) => {
        controller.enqueue(encoder.encode(encodeEvent(event)));
      };

      try {
        await runAudit(url, clientIp, emit, req.signal);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          emit({
            type: "error",
            message: e instanceof Error ? e.message : "Audit failed",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
