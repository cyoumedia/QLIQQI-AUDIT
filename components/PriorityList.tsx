"use client";

import type { AuditReport } from "@/lib/audit/types";
import { ReportDetails } from "./ReportDetails";

const impactStyles = {
  high: "text-[var(--fault)] border-[rgba(220,38,38,0.4)]",
  medium: "text-[var(--caution)] border-[rgba(217,119,6,0.4)]",
  low: "text-[var(--good)] border-[rgba(16,185,129,0.35)]",
};

export function PriorityList({ report }: { report: AuditReport }) {
  return (
    <ReportDetails
      className="mt-10 rounded-xl border border-[var(--line)] bg-white p-5"
      summaryClassName="cursor-pointer font-display text-sm font-semibold tracking-wide text-qliqqi-navy uppercase"
      summary={
        <>
          <span className="mr-3 font-mono text-sm font-normal text-[var(--faint)]">
            [ ! ]
          </span>
          Recommended Service — Ranked
        </>
      }
    >
      <div className="priority mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <ol className="m-0 list-none p-0">
          {report.rankedRecommendations.map((item, i) => (
            <li
              key={item.rank}
              className="flex gap-4 border-b border-[var(--line)] px-5 py-3.5 last:border-b-0"
            >
              <span className="min-w-[26px] pt-0.5 font-mono text-sm font-bold text-qliqqi-teal">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1">
                <div className="font-semibold text-[var(--ink)]">
                  {item.title}
                </div>
                <div className="mt-0.5 text-sm text-[var(--muted)]">
                  {item.description}
                </div>
              </div>
              <span
                className={`self-center whitespace-nowrap rounded-full border px-2.5 py-0.5 font-display text-[11px] font-semibold tracking-wide uppercase ${impactStyles[item.impact]}`}
              >
                {item.impact} impact
              </span>
            </li>
          ))}
        </ol>
      </div>
    </ReportDetails>
  );
}
