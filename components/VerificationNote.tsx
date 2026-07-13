import type { AuditReport } from "@/lib/audit/types";

export function VerificationNote({ report }: { report: AuditReport }) {
  if (report.unverified.length === 0) return null;

  return (
    <div className="note mt-8 rounded-xl border border-[var(--line)] bg-slate-50 p-5 text-sm text-[var(--muted)]">
      <h3 className="m-0 font-display text-sm font-semibold tracking-widest text-[var(--unknown)] uppercase">
        What couldn&apos;t be directly verified
      </h3>
      <ul className="mt-3 space-y-2 pl-4">
        {report.unverified.map((u, i) => (
          <li key={i}>
            <b className="text-[var(--ink)]">{u.element}</b> — {u.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
