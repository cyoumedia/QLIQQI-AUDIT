"use client";

import { useEffect, useRef, useState } from "react";
import { useReportExpandOptional } from "./ReportExpandContext";

interface ClampableTextProps {
  text: string;
  className?: string;
  lines?: number;
}

export function ClampableText({ text, className = "", lines = 2 }: ClampableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  const expandCtx = useReportExpandOptional();

  useEffect(() => {
    if (expandCtx) setExpanded(expandCtx.allExpanded);
  }, [expandCtx?.allExpanded]);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;

    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();

    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded, lines]);

  const clampStyle =
    !expanded
      ? ({
          display: "-webkit-box",
          WebkitLineClamp: lines,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        } as const)
      : undefined;

  return (
    <div className="w-full">
      <p
        ref={ref}
        className={`break-words [overflow-wrap:anywhere] ${className}`}
        style={clampStyle}
      >
        {text}
      </p>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[11px] font-medium text-qliqqi-teal hover:text-qliqqi-bright hover:underline"
        >
          {expanded ? "Show less" : "Show more…"}
        </button>
      )}
    </div>
  );
}
