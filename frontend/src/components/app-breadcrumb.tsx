"use client";

import { usePathname } from "next/navigation";

const labels: Record<string, string> = {
  home: "Home",
  forms: "Forms",
  create: "Create",
  responses: "Responses",
};

export function AppBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 font-mono-tech uppercase tracking-[0.18em] text-[11px] text-muted-foreground"
    >
      <span className="text-foreground/80">Workspace</span>
      {segments.map((seg, i) => (
        <span key={seg + i} className="flex items-center gap-2">
          <span className="text-border">/</span>
          <span
            className={
              i === segments.length - 1 ? "text-brand" : "text-muted-foreground"
            }
          >
            {labels[seg] ?? seg.replace(/-/g, " ")}
          </span>
        </span>
      ))}
    </nav>
  );
}
