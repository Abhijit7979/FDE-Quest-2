import { cn } from "@/lib/utils";

/**
 * The signature mark — five horizontal cobalt stripes echoing the RSI logo,
 * locked up with the product wordmark.
 */
export function BrandMark({
  className,
  size = "md",
  variant = "default",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "compact" | "stacked";
}) {
  const dims = {
    sm: { box: "h-7 w-7", title: "text-[15px]", sub: "text-[10px]" },
    md: { box: "h-9 w-9", title: "text-[17px]", sub: "text-[11px]" },
    lg: { box: "h-12 w-12", title: "text-2xl", sub: "text-xs" },
  }[size];

  return (
    <div
      className={cn(
        "flex items-center gap-2.5",
        variant === "stacked" && "flex-col items-start gap-3",
        className,
      )}
    >
      <Stripes className={cn(dims.box, "shrink-0")} />
      {variant !== "compact" && (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              "font-display italic tracking-tight text-foreground",
              dims.title,
            )}
          >
            sketch<span className="text-brand">·</span>to<span className="text-brand">·</span>form
          </span>
          <span
            className={cn(
              "font-mono-tech uppercase tracking-[0.2em] text-muted-foreground mt-1",
              dims.sub,
            )}
          >
            RSI / paper → live
          </span>
        </div>
      )}
    </div>
  );
}

/** Just the five-stripe icon, scaled to the container. */
export function Stripes({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      aria-hidden="true"
      className={cn("text-brand", className)}
    >
      <g fill="currentColor">
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x={2 + i * 0.6}
            y={6 + i * 5}
            width={32 - i * 1.2}
            height={2.4}
            rx={1.2}
          />
        ))}
        {/* vertical accent — echoes the "I" stroke on the right of the RSI logo */}
        <rect x={32} y={6} width={2.4} height={24} rx={1.2} />
      </g>
    </svg>
  );
}
