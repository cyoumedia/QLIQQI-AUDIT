"use client";

import Image from "next/image";
import { devFeaturesEnabled } from "@/lib/audit/config";
import { brand } from "@/lib/brand";
import type { AuditReport } from "@/lib/audit/types";

function downloadJsonFile(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch (e) {
    return dateStr;
  }
};

export function ReportFooter({ report }: { report: AuditReport }) {
  const dateStr = formatDate(report.generatedAt);
  const domain = report.meta.domain;

  return (
    <div className="w-full">
      <footer className="mt-16 bg-[#0A1C30] text-white rounded-2xl p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl">
        {/* Left Column: Logo & Tagline */}
        <div className="flex flex-col items-start gap-3">
          <div className="flex items-center h-10">
            <Image
              src={brand.logoSrc}
              alt={brand.name}
              height={36}
              width={Math.round(36 * brand.logoAspectRatio)}
              className="h-9 w-auto brightness-0 invert"
            />
          </div>
          <p className="text-slate-350 text-[11px] md:text-xs font-light max-w-sm leading-relaxed">
            GEO, AEO, and AI Visibility engineering for hospitality & local businesses.
          </p>
        </div>

        {/* Right Column: Meta details */}
        <div className="flex flex-col items-start md:items-end text-slate-350 text-[11px] md:text-xs font-mono gap-1.5">
          <div>Report generated for {domain}</div>
          <div>Audit date: {dateStr}</div>
          <a
            href="https://cyoumedia.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white underline transition-colors"
          >
            cyoumedia.com
          </a>
        </div>
      </footer>

      {/* JSON Download links (hidden in print) */}
      <div className="no-print mt-4 flex justify-center gap-4 text-[10px] text-slate-500">
        <button
          type="button"
          onClick={() => {
            const auditExport = { ...report };
            delete auditExport.devCrawl;
            delete auditExport.devProviderScores;
            downloadJsonFile(auditExport, `cyoumedia-audit-${report.meta.domain}.json`);
          }}
          className="hover:underline cursor-pointer"
        >
          Download JSON export
        </button>
        {devFeaturesEnabled() && report.devCrawl && (
          <button
            type="button"
            onClick={() =>
              downloadJsonFile(
                report.devCrawl,
                `cyoumedia-crawl-${report.meta.domain}.json`,
              )
            }
            className="hover:underline cursor-pointer"
          >
            Download crawl data (dev)
          </button>
        )}
      </div>
    </div>
  );
}
