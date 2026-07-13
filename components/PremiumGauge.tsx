"use client";

import { useEffect, useState } from "react";

import { scoreColor } from "@/lib/theme";

interface PremiumGaugeProps {
  score: number;
  color?: string; // Optional, defaults to scoreColor(score)
  trackColor?: string;
  size?: number;
}

const R = 45;
const C = 2 * Math.PI * R;

export function PremiumGauge({
  score,
  color,
  trackColor = "#EAE6E1",
  size = 130,
}: PremiumGaugeProps) {
  const [offset, setOffset] = useState(C);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Compute offset based on score (0 to 100)
        setOffset(C * (1 - score / 100));
      });
    });
    return () => cancelAnimationFrame(id);
  }, [score]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="-rotate-90"
      >
        {/* Track circle */}
        <circle
          className="fill-none"
          cx="50"
          cy="50"
          r={R}
          stroke={trackColor}
          strokeWidth="6.5"
        />
        {/* Progress circle */}
        <circle
          className="fill-none transition-all duration-[1250ms] ease-out"
          cx="50"
          cy="50"
          r={R}
          stroke={color || scoreColor(score)}
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
        />
      </svg>
      {/* Score Text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-serif text-[38px] font-bold text-[#07111F] tracking-tight leading-none">
          {score}
        </span>
      </div>
    </div>
  );
}
