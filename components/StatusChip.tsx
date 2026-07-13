import type { VerificationChip } from "@/lib/audit/scorer";

const styles: Record<VerificationChip, string> = {
  verified: "text-[var(--good)] border-[rgba(16,185,129,0.35)]",
  inferred: "text-blue-500 border-blue-200",
  estimated: "text-[var(--caution)] border-[rgba(217,119,6,0.35)]",
  unverified: "text-[var(--unknown)] border-[rgba(100,116,139,0.45)]",
};

const labels: Record<VerificationChip, string> = {
  verified: "Verified",
  inferred: "Inferred from rendered structure",
  estimated: "Estimated",
  unverified: "Unverified",
};

export function StatusChip({ chip }: { chip: VerificationChip }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 font-display text-[10.5px] font-semibold tracking-wider uppercase ${styles[chip]}`}
    >
      {labels[chip]}
    </span>
  );
}
