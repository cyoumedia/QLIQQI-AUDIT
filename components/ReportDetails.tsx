"use client";

import { useEffect, useState } from "react";
import { useReportExpand } from "./ReportExpandContext";

interface ReportDetailsProps {
  className?: string;
  summaryClassName?: string;
  summary: React.ReactNode;
  children: React.ReactNode;
}

export function ReportDetails({
  className,
  summaryClassName = "cursor-pointer",
  summary,
  children,
}: ReportDetailsProps) {
  const { allExpanded } = useReportExpand();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(allExpanded);
  }, [allExpanded]);

  return (
    <details
      className={className}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className={summaryClassName}>{summary}</summary>
      {children}
    </details>
  );
}
