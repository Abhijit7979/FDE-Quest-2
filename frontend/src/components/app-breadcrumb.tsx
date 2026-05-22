"use client";

import { usePathname } from "next/navigation";

const labels: Record<string, string> = {
  home: "Home",
  forms: "Forms",
  create: "Create",
  drafts: "Drafts",
  trash: "Trash",
  published: "Published",
  responses: "Responses",
};

export function AppBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 flex-1 items-center overflow-hidden font-mono-tech uppercase tracking-[0.18em] text-[11px] text-muted-foreground"
    >
      <p className="truncate">
        <span className="text-foreground/80">Workspace</span>
        {segments.map((seg, i) => (
          <span key={seg + i}>
            <span className="text-border"> / </span>
            <span
              className={
                i === segments.length - 1 ? "text-brand" : "text-muted-foreground"
              }
            >
              {labels[seg] ?? seg.replace(/-/g, " ")}
            </span>
          </span>
        ))}
      </p>
    </nav>
  );
}
