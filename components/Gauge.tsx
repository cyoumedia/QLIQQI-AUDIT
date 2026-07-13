"use client";

import { useEffect, useState } from "react";
import { scoreColor } from "@/lib/theme";

interface GaugeProps {
  score: number;
  size?: "lg" | "sm";
  label?: string;
}

const R = 60;
const C = 2 * Math.PI * R;
const SWEEP = 0.75;

export function Gauge({ score, size = "lg", label }: GaugeProps) {
  const [offset, setOffset] = useState(C * SWEEP);
  const visible = C * SWEEP;
  const color = scoreColor(score);
  const dim = size === "lg" ? 148 : 120;
  const fontSize = size === "lg" ? "text-[34px]" : "text-[27px]";

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setOffset(visible * (1 - score / 100));
      });
    });
    return () => cancelAnimationFrame(id);
  }, [score, visible]);

  return (
    <div className="relative" style={{ width: dim, height: dim }}>
      <svg
        viewBox="0 0 148 148"
        width={dim}
        height={dim}
        className="rotate-[135deg]"
      >
        <circle
          className="fill-none stroke-[var(--line)]"
          cx="74"
          cy="74"
          r={R}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${visible} ${C}`}
        />
        <circle
          className="gauge-fill fill-none transition-all duration-[1250ms] ease-out"
          cx="74"
          cy="74"
          r={R}
          strokeWidth="11"
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={`${visible} ${C}`}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-mono font-bold leading-none ${fontSize}`} style={{ color }}>
          {score}
        </span>
        <span className="font-mono text-[11px] text-[var(--faint)]">/ 100</span>
        {label && (
          <span className="mt-1 font-display text-[10px] font-semibold tracking-widest text-[var(--muted)] uppercase">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
