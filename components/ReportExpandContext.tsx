"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface ReportExpandContextValue {
  allExpanded: boolean;
  toggleAllExpanded: () => void;
}

const ReportExpandContext = createContext<ReportExpandContextValue | null>(null);

export function ReportExpandProvider({ children }: { children: React.ReactNode }) {
  const [allExpanded, setAllExpanded] = useState(false);
  const toggleAllExpanded = useCallback(() => setAllExpanded((value) => !value), []);

  const value = useMemo(
    () => ({ allExpanded, toggleAllExpanded }),
    [allExpanded, toggleAllExpanded],
  );

  return <ReportExpandContext.Provider value={value}>{children}</ReportExpandContext.Provider>;
}

export function useReportExpand(): ReportExpandContextValue {
  const ctx = useContext(ReportExpandContext);
  if (!ctx) {
    throw new Error("useReportExpand must be used within ReportExpandProvider");
  }
  return ctx;
}

export function useReportExpandOptional(): ReportExpandContextValue | null {
  return useContext(ReportExpandContext);
}
