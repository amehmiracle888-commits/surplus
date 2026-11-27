import { cn } from "@/lib/utils";

interface BrandLogoProps {
  brandName?: string;
  logoUrl?: string;
  showWordmark?: boolean;
  subtitle?: string;
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: { box: "h-8 w-8", text: "text-base" },
  md: { box: "h-9 w-9", text: "text-lg" },
  lg: { box: "h-11 w-11", text: "text-xl" },
};

export function BrandLogo({
  brandName = "IPcore",
  logoUrl,
  showWordmark = true,
  subtitle,
  variant = "dark",
  size = "md",
  className,
}: BrandLogoProps) {
  const dims = SIZE_MAP[size];
  const isIpcore = brandName.trim().toLowerCase() === "ipcore";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={brandName}
          className={cn(dims.box, "shrink-0 rounded-xl object-contain")}
        />
      ) : (
        <span
          className={cn(
            dims.box,
            "inline-flex shrink-0 items-center justify-center rounded-xl border shadow-sm",
            variant === "light"
              ? "border-blue-600/30 bg-blue-50 text-blue-600"
              : "border-blue-500/35 bg-[#0B1124] shadow-blue-500/20"
          )}
        >
          <svg
            viewBox="0 0 64 64"
            fill="none"
            className="h-[78%] w-[78%]"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="brandHexGrad" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <path
              d="M32 10L50 20.5V43.5L32 54L14 43.5V20.5L32 10Z"
              stroke="url(#brandHexGrad)"
              strokeWidth="4.5"
              strokeLinejoin="round"
            />
            <path
              d="M32 19V26M22 38L27.5 34.5M42 38L36.5 34.5"
              stroke={variant === "light" ? "#3B82F6" : "#93C5FD"}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle cx="32" cy="32" r="6.5" fill="url(#brandHexGrad)" />
            <circle cx="32" cy="32" r="2.7" fill="#FFFFFF" />
            <circle cx="32" cy="17.5" r="3" fill="#60A5FA" />
            <circle cx="20.5" cy="39" r="3" fill="#818CF8" />
            <circle cx="43.5" cy="39" r="3" fill="#A78BFA" />
          </svg>
        </span>
      )}

      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              dims.text,
              "tracking-tight",
              variant === "light" ? "text-slate-900" : "text-white"
            )}
          >
            {isIpcore ? (
              <>
                <span className="font-extrabold">IP</span>
                <span
                  className={cn(
                    "font-medium",
                    variant === "light" ? "text-blue-600" : "text-blue-300"
                  )}
                >
                  core
                </span>
              </>
            ) : (
              <span className="font-semibold">{brandName}</span>
            )}
          </span>
          {subtitle && (
            <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-violet-400">
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
