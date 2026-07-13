import Image from "next/image";
import { brand } from "@/lib/brand";

interface LogoProps {
  variant?: "wordmark" | "compact";
  className?: string;
}

export function Logo({ variant = "wordmark", className = "" }: LogoProps) {
  if (variant === "compact") {
    const height = 40;
    return (
      <div className={`flex items-center ${className}`}>
        <Image
          src={brand.logoSrc}
          alt={brand.name}
          height={height}
          width={Math.round(height * brand.logoAspectRatio)}
          priority
          className="h-10 w-auto"
        />
      </div>
    );
  }

  const height = 80;
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <Image
        src={brand.logoSrc}
        alt={brand.name}
        height={height}
        width={Math.round(height * brand.logoAspectRatio)}
        priority
        className="h-16 w-auto md:h-20"
      />
      {brand.tagline && (
        <p className="mt-2 text-sm tracking-[0.35em] text-[var(--muted)] uppercase">
          {brand.tagline}
        </p>
      )}
    </div>
  );
}
