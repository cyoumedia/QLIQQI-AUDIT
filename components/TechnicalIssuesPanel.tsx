"use client";

import { useEffect, useState } from "react";
import type { AuditReport, TechnicalIssue } from "@/lib/audit/types";
import { ReportDetails } from "./ReportDetails";
import { useReportExpand } from "./ReportExpandContext";

const CATEGORY_LABELS: Record<TechnicalIssue["category"], string> = {
  redirect: "Redirects",
  canonical: "Canonicals",
  hreflang: "Hreflang",
  "structured-data": "Structured data",
};

const PREVIEW_LIMIT = 15;

interface PageIssueGroup {
  url: string;
  severity: TechnicalIssue["severity"];
  messages: string[];
}

function groupIssuesByUrl(issues: TechnicalIssue[]): PageIssueGroup[] {
  const byUrl = new Map<string, TechnicalIssue[]>();
  for (const issue of issues) {
    const list = byUrl.get(issue.url) ?? [];
    list.push(issue);
    byUrl.set(issue.url, list);
  }

  return [...byUrl.entries()].map(([url, items]) => ({
    url,
    severity: items.some((i) => i.severity === "error") ? "error" : "warning",
    messages: items.map((i) => i.message),
  }));
}

function IssueGroup({
  title,
  issues,
  allExpanded,
}: {
  title: string;
  issues: TechnicalIssue[];
  allExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const groups = groupIssuesByUrl(issues);

  useEffect(() => {
    setExpanded(allExpanded);
  }, [allExpanded]);

  if (groups.length === 0) return null;

  const visible = expanded ? groups : groups.slice(0, PREVIEW_LIMIT);
  const hiddenCount = groups.length - PREVIEW_LIMIT;

  return (
    <div className="mt-4">
      <h4 className="font-display text-xs font-semibold tracking-wide text-qliqqi-navy uppercase">
        {title} ({issues.length} issue{issues.length === 1 ? "" : "s"} across{" "}
        {groups.length} page{groups.length === 1 ? "" : "s"})
      </h4>
      <ul className="mt-2 space-y-2">
        {visible.map((group) => (
          <li
            key={group.url}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <div className="flex items-start gap-2">
              <span
                className={
                  group.severity === "error"
                    ? "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-red-100 text-red-800"
                    : "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-900"
                }
              >
                {group.severity}
              </span>
              <div className="min-w-0">
                <div className="font-mono text-xs text-qliqqi-teal break-all">
                  {group.url}
                </div>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-[var(--muted)]">
                  {group.messages.map((message, i) => (
                    <li
                      key={i}
                      className="break-words [overflow-wrap:anywhere]"
                    >
                      {message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-xs font-medium text-qliqqi-teal hover:text-qliqqi-bright hover:underline"
        >
          {expanded
            ? "Show fewer"
            : `Show ${hiddenCount} more page${hiddenCount === 1 ? "" : "s"} in this category`}
        </button>
      )}
    </div>
  );
}

function countPagesAffected(issues: TechnicalIssue[]): number {
  return new Set(issues.map((issue) => issue.url)).size;
}

export function TechnicalIssuesPanel({ report }: { report: AuditReport }) {
  const { allExpanded } = useReportExpand();
  const issues = report.technicalIssues;
  if (!issues || issues.counts.total === 0) return null;

  const allIssues = [
    ...issues.redirectChains,
    ...issues.canonicalErrors,
    ...issues.hreflangErrors,
    ...issues.schemaErrors,
  ];
  const pagesAffected = countPagesAffected(allIssues);

  return (
    <ReportDetails
      className="mt-8 rounded-xl border border-[var(--line)] bg-white p-5"
      summaryClassName="cursor-pointer font-display text-sm font-semibold tracking-wide text-qliqqi-navy uppercase"
      summary={
        <>
          Technical SEO issues ({issues.counts.total}
          {pagesAffected < issues.counts.total
            ? ` across ${pagesAffected} pages`
            : ""}
          )
        </>
      }
    >
      <p className="mt-2 text-sm text-[var(--muted)]">
        Validation findings from the crawl, grouped by page. Multiple checks on
        the same URL appear as one entry.
      </p>
      <IssueGroup
        title={CATEGORY_LABELS.redirect}
        issues={issues.redirectChains}
        allExpanded={allExpanded}
      />
      <IssueGroup
        title={CATEGORY_LABELS.canonical}
        issues={issues.canonicalErrors}
        allExpanded={allExpanded}
      />
      <IssueGroup
        title={CATEGORY_LABELS.hreflang}
        issues={issues.hreflangErrors}
        allExpanded={allExpanded}
      />
      <IssueGroup
        title={CATEGORY_LABELS["structured-data"]}
        issues={issues.schemaErrors}
        allExpanded={allExpanded}
      />
    </ReportDetails>
  );
}
