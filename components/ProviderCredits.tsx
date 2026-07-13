import Image from "next/image";
import type { ProviderId } from "@/lib/audit/scorer";
import { providerLabel } from "@/lib/theme";

interface ProviderCreditsProps {
  providers: ProviderId[];
  className?: string;
}

export function ProviderCredits({ providers, className = "" }: ProviderCreditsProps) {
  if (providers.length === 0) return null;

  const getProviderConfig = (id: ProviderId) => {
    switch (id) {
      case "openai":
        return {
          label: "ChatGPT",
          imgSrc: "/brand/chatgpt.svg",
          imgClass: "group-hover:rotate-45",
        };
      case "claude":
        return {
          label: "Claude",
          imgSrc: "/brand/claude.svg",
          imgClass: "group-hover:scale-110",
        };
      case "grok":
        return {
          label: "Grok",
          imgSrc: "/brand/grok.svg",
          imgClass: "group-hover:-rotate-12",
        };
      default:
        return {
          label: providerLabel(id),
          imgSrc: null,
          imgClass: "",
        };
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--faint)] uppercase">
        AI Visibility Scored By
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {providers.map((id) => {
          const config = getProviderConfig(id);
          return (
            <span
              key={id}
              className="group inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] shadow-xs transition-all duration-300 hover:border-slate-300 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] hover:-translate-y-[0.5px]"
            >
              {config.imgSrc && (
                <Image
                  src={config.imgSrc}
                  alt={config.label}
                  width={18}
                  height={18}
                  className={`h-4.5 w-4.5 object-contain transition-transform duration-500 ${config.imgClass}`}
                />
              )}
              <span>{config.label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

