"use client";

import type { AuditReport } from "@/lib/audit/types";
import { ClampableText } from "./ClampableText";
import { ReportDetails } from "./ReportDetails";

export function PerPageAppendix({ report }: { report: AuditReport }) {
  if (report.perPageFindings.length === 0) return null;

  const totalIssues = report.perPageFindings.reduce((sum, page) => sum + page.issues.length, 0);

  return (
    <ReportDetails
      className="mt-8 rounded-xl border border-[var(--line)] bg-white p-5"
      summaryClassName="cursor-pointer font-display text-sm font-semibold tracking-wide text-qliqqi-navy uppercase"
      summary={
        <>
          Per-page findings ({report.perPageFindings.length} page
          {report.perPageFindings.length === 1 ? "" : "s"} · {totalIssues} issue
          {totalIssues === 1 ? "" : "s"})
        </>
      }
    >
      <p className="mt-2 text-sm text-[var(--muted)]">
        All flagged issues grouped by URL, including technical SEO checks and on-page signals.
      </p>
      <ul className="mt-4 space-y-4">
        {report.perPageFindings.map((p) => (
          <li key={p.url} className="border-b border-[var(--line)] pb-3 last:border-0">
            <div className="font-mono text-xs text-qliqqi-teal break-all">{p.url}</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-[var(--muted)]">
              {p.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
            {p.finding && (
              <ClampableText text={p.finding} className="mt-2 text-xs text-[var(--muted)]" />
            )}
            {p.fix && (
              <div className="mt-1 text-xs text-[var(--ink)]">
                <b className="text-qliqqi-teal">Fix</b>
                <ClampableText text={p.fix} className="mt-1 text-xs text-[var(--ink)]" />
              </div>
            )}
          </li>
        ))}
      </ul>
    </ReportDetails>
  );
}
