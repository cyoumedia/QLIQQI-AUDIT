export function Legend() {
  const items = [
    { color: "var(--good)", label: "Good (80+)" },
    { color: "var(--caution)", label: "Caution (50–79)" },
    { color: "var(--fault)", label: "Fault (<50)" },
    { color: "var(--unknown)", label: "Unverified — needs direct file/source access" },
  ];

  return (
    <div className="legend mt-2 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
