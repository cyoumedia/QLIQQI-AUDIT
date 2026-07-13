"use client";

import { useEffect, useState } from "react";
import { formatElapsed } from "@/lib/format-elapsed";
import type { AuditProgressEvent } from "@/lib/audit/types";

interface SystemDiagnosticsProps {
  percent: number;
  phase: string;
  message: string;
  stages: Record<"discovery" | "lighthouse" | "ai", "pending" | "active" | "complete">;
  logs: { icon: string; text: string }[];
  onCancel: () => void;
}

const STAGE_META = [
  { key: "discovery" as const, title: "Resource Discovery", sub: "DNS check & DOM tree fetch" },
  { key: "lighthouse" as const, title: "Lighthouse Audit", sub: "Lighthouse category scoring" },
  { key: "ai" as const, title: "AI Visibility Check", sub: "robots.txt & JSON-LD structures" },
];

export function SystemDiagnostics({
  percent,
  phase,
  message,
  stages,
  logs,
  onCancel,
}: SystemDiagnosticsProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const tick = () => setElapsedMs(Date.now() - startedAt);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-qliqqi-navy/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-[var(--line)] bg-white p-8 shadow-2xl">
        <div className="flex flex-col items-center">
          <div className="relative h-36 w-36">
            <svg viewBox="0 0 148 148" className="h-full w-full -rotate-90">
              <circle cx="74" cy="74" r="60" fill="none" stroke="var(--line)" strokeWidth="8" />
              <circle
                cx="74"
                cy="74"
                r="60"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 60}`}
                strokeDashoffset={`${2 * Math.PI * 60 * (1 - percent / 100)}`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-3xl font-bold text-qliqqi-navy">{percent}%</span>
              <span className="font-display text-xs font-semibold tracking-widest text-[var(--muted)]">
                {phase}
              </span>
            </div>
          </div>

          <h2 className="mt-6 font-display text-xl font-bold tracking-wide text-qliqqi-navy uppercase">
            System Diagnostics Underway
          </h2>
          <p className="mt-2 max-w-md text-center text-sm text-[var(--muted)]">
            {message}
            <span className="font-mono tabular-nums text-[var(--ink)]">
              {" "}
              · {formatElapsed(elapsedMs)}
            </span>
          </p>

          <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
            {STAGE_META.map((s) => {
              const status = stages[s.key];
              const active = status === "active";
              const complete = status === "complete";
              return (
                <div
                  key={s.key}
                  className={`rounded-xl border p-4 text-center transition ${
                    complete
                      ? "border-[var(--good)]/40 bg-emerald-50"
                      : active
                        ? "border-qliqqi-teal bg-slate-50/50"
                        : "border-[var(--line)] bg-[var(--panel-2)]"
                  }`}
                >
                  <div className="mb-2 text-lg">
                    {complete ? "✓" : active ? "◉" : "○"}
                  </div>
                  <div className="font-display text-xs font-semibold tracking-wide text-qliqqi-navy uppercase">
                    {s.title}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--muted)]">{s.sub}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 max-h-48 w-full overflow-y-auto rounded-xl border border-[var(--line)] bg-qliqqi-navy p-4 font-mono text-xs text-slate-200">
            {logs.map((log, i) => (
              <div key={i} className="mb-1.5 flex gap-2">
                <span className="text-qliqqi-teal">›</span>
                <span>
                  {log.icon} {log.text}
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="mt-6 rounded-lg border border-[var(--line)] px-4 py-2 text-sm text-[var(--muted)] hover:bg-slate-50"
          >
            Cancel audit
          </button>
        </div>
      </div>
    </div>
  );
}

export function parseProgressEvent(
  event: AuditProgressEvent,
  state: {
    percent: number;
    phase: string;
    message: string;
    stages: SystemDiagnosticsProps["stages"];
    logs: { icon: string; text: string }[];
  },
) {
  switch (event.type) {
    case "progress":
      return {
        ...state,
        percent: event.percent,
        phase: event.phase,
        message: event.message,
      };
    case "stage":
      return {
        ...state,
        stages: { ...state.stages, [event.stage]: event.status },
      };
    case "log":
      return {
        ...state,
        logs: [...state.logs, { icon: event.icon, text: event.text }],
      };
    default:
      return state;
  }
}
