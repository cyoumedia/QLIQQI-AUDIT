"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AuditForm } from "@/components/AuditForm";
import { AIPanel } from "@/components/AIPanel";
import { HeroReport } from "@/components/HeroReport";
import { CrawlIntegrityPanel } from "@/components/CrawlIntegrityPanel";
import { LighthousePanel } from "@/components/LighthousePanel";
import { PerPageAppendix } from "@/components/PerPageAppendix";
import { PriorityList } from "@/components/PriorityList";
import { ReportFooter } from "@/components/ReportFooter";
import {
  parseProgressEvent,
  SystemDiagnostics,
} from "@/components/SystemDiagnostics";
import { TechnicalCards } from "@/components/TechnicalCards";
import { TechnicalIssuesPanel } from "@/components/TechnicalIssuesPanel";
import { ReportExpandProvider } from "@/components/ReportExpandContext";
import { VerificationNote } from "@/components/VerificationNote";
import { AICredibilityPanel } from "@/components/AICredibilityPanel";
import { streamAudit } from "@/lib/audit/sse-client";
import type { AuditReport } from "@/lib/audit/types";
import { sampleReport } from "@/lib/fixtures/sample-report";

type View = "form" | "running" | "report";

type StageStatus = "pending" | "active" | "complete";

const initialDiag = {
  percent: 0,
  phase: "VALIDATE",
  message: "Preparing audit…",
  stages: {
    discovery: "pending" as StageStatus,
    lighthouse: "pending" as StageStatus,
    ai: "pending" as StageStatus,
  },
  logs: [] as { icon: string; text: string }[],
};

export default function AdminPage() {
  const [view, setView] = useState<View>("form");
  const [url, setUrl] = useState("");
  const [report, setReport] = useState<AuditReport | null>(null);
  const [diag, setDiag] = useState(initialDiag);
  const [isLocalhost, setIsLocalhost] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const auditStartedRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.endsWith(".local")
      ) {
        setIsLocalhost(true);
      }
    }
  }, []);

  const startAudit = useCallback(async (auditUrl: string) => {
    auditStartedRef.current = Date.now();
    setView("running");
    setDiag(initialDiag);
    abortRef.current = new AbortController();

    try {
      await streamAudit(auditUrl, abortRef.current.signal, {
        onEvent: (event) => {
          if (event.type === "warning") {
            toast.warning(event.message);
            return;
          }
          setDiag((d) => parseProgressEvent(event, d));
        },
        onReport: (r) => {
          const auditDurationMs =
            auditStartedRef.current != null
              ? Date.now() - auditStartedRef.current
              : undefined;
          setReport({
            ...r,
            meta: {
              ...r.meta,
              ...(auditDurationMs != null ? { auditDurationMs } : {}),
            },
          });
          setView("report");
        },
        onError: (msg) => {
          toast.error(msg);
          if (msg.includes("Rate limit")) setView("form");
        },
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        toast.info("Audit cancelled");
        setView("form");
      } else {
        toast.error("Connection lost — retry audit");
        setView("form");
      }
    }
  }, []);

  const handleSubmit = () => {
    let u = url.trim();
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    setUrl(u);
    startAudit(u);
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setView("form");
  };

  const handleNewAudit = () => {
    setReport(null);
    setView("form");
    setUrl("");
  };

  const handleSample = () => {
    setReport(sampleReport);
    setView("report");
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/logout", { method: "POST" });
      if (res.ok) {
        window.location.href = "/login";
      } else {
        toast.error("Logout failed");
      }
    } catch (e) {
      toast.error("Error logging out");
    }
  };

  return (
    <main
      className={
        view === "report"
          ? "w-full min-h-screen bg-white text-slate-800"
          : view === "form"
            ? "w-full min-h-screen"
            : "wrap mx-auto max-w-[1400px] px-3 py-10 pb-16"
      }
    >
      {view === "form" && (
        <div className="no-print">
          <AuditForm
            url={url}
            onUrlChange={setUrl}
            onSubmit={handleSubmit}
            onSample={handleSample}
            onLogout={handleLogout}
          />
        </div>
      )}

      {view === "running" && (
        <SystemDiagnostics {...diag} onCancel={handleCancel} />
      )}

      {view === "report" && report && (
        <ReportExpandProvider>
          <HeroReport report={report} onNewAudit={handleNewAudit} onLogout={handleLogout} />

          <div className="mx-auto max-w-[1400px] px-3 pt-48 pb-16 space-y-12">
            <AIPanel report={report} />

            <TechnicalCards report={report} />

            <LighthousePanel report={report} />

            {isLocalhost && (
              <>
                <AICredibilityPanel report={report} />
                <PriorityList report={report} />
                <TechnicalIssuesPanel report={report} />
                <PerPageAppendix report={report} />
                <VerificationNote report={report} />
                <CrawlIntegrityPanel report={report} />
              </>
            )}

            <ReportFooter report={report} />
          </div>
        </ReportExpandProvider>
      )}
    </main>
  );
}
