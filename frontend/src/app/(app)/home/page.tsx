import Link from "next/link";
import {
  ArrowUpRight,
  FilePlus2,
  FileText,
  Inbox,
  ScanLine,
  Sparkles,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { count: formsCount } = await supabase
    .from("forms")
    .select("*", { count: "exact", head: true });

  const { count: responsesCount } = await supabase
    .from("form_responses")
    .select("*", { count: "exact", head: true });

  const { count: publishedCount } = await supabase
    .from("forms")
    .select("*", { count: "exact", head: true })
    .eq("status", "published");

  const { data: recentForms } = await supabase
    .from("forms")
    .select("id, title, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);

  const firstName = user?.email?.split("@")[0] ?? "there";

  return (
    <div className="mx-auto max-w-6xl space-y-12 anim-rise">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card noise-overlay">
        <div
          aria-hidden
          className="absolute inset-0 blueprint-grid-fine opacity-60"
        />
        <div
          aria-hidden
          className="absolute -top-8 -right-10 h-44 w-72 rsi-stripes opacity-50"
        />
        <div
          aria-hidden
          className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent"
        />
        <div className="relative grid md:grid-cols-[1.4fr_1fr] gap-10 p-8 md:p-10">
          <div className="space-y-6">
            <p className="font-mono-tech uppercase tracking-[0.22em] text-[11px] text-muted-foreground">
              Workspace · Overview
            </p>
            <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1] text-balance">
              Hello, <em className="text-brand">{firstName}</em>.
              <br />
              Let&apos;s turn paper
              <br />
              into <span className="text-brand">live forms.</span>
            </h1>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              Snap a sketch, watch RSI&apos;s vision pipeline reconstruct it as
              a typed, validated, shareable artifact. No drag-and-drop. No
              busywork.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="h-11 font-mono-tech uppercase tracking-[0.15em] text-[12px]"
                render={<Link href="/forms/create" />}
              >
                <FilePlus2 className="size-4" />
                New from sketch
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 font-mono-tech uppercase tracking-[0.15em] text-[12px]"
                render={<Link href="/forms/responses" />}
              >
                <Inbox className="size-4" />
                Browse responses
              </Button>
            </div>
          </div>

          {/* Pipeline stages — decorative */}
          <div className="relative hidden md:block">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                {[
                  { label: "Paper", num: "01", icon: ScanLine },
                  { label: "Vision", num: "02", icon: Sparkles },
                  { label: "Schema", num: "03", icon: FileText },
                  { label: "Live", num: "04", icon: ArrowUpRight },
                ].map((s, i) => (
                  <div
                    key={s.label}
                    className={cn(
                      "relative rounded-lg border bg-background/80 backdrop-blur-sm p-4 flex flex-col gap-2 transition-transform hover:-translate-y-0.5 anim-rise",
                      i === 0 && "border-brand bg-brand-tint",
                    )}
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <s.icon
                        className={cn(
                          "size-4",
                          i === 0 ? "text-brand" : "text-muted-foreground",
                        )}
                      />
                      <span
                        className={cn(
                          "font-mono-tech text-[10px] tracking-[0.18em]",
                          i === 0 ? "text-brand" : "text-muted-foreground/70",
                        )}
                      >
                        {s.num}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "font-display italic text-lg leading-none",
                        i === 0 ? "text-brand" : "text-foreground",
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KPI ROW */}
      <section>
        <SectionHeading
          tag="01"
          title="By the numbers"
          subtitle="A snapshot of your workspace."
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Total forms"
            value={formsCount ?? 0}
            icon={FileText}
            footer="All drafts + published"
            accent
          />
          <Stat
            label="Published"
            value={publishedCount ?? 0}
            icon={ArrowUpRight}
            footer={`${formsCount ? Math.round(((publishedCount ?? 0) / formsCount) * 100) : 0}% of total`}
          />
          <Stat
            label="Responses collected"
            value={responsesCount ?? 0}
            icon={Inbox}
            footer="Across every form"
          />
        </div>
      </section>

      {/* RECENT */}
      <section>
        <div className="flex items-end justify-between gap-4">
          <SectionHeading
            tag="02"
            title="Recently touched"
            subtitle="Your last five edits, freshest first."
          />
          <Link
            href="/forms/create"
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline underline-offset-4"
          >
            Start a new one →
          </Link>
        </div>

        <Card className="mt-6 overflow-hidden p-0">
          {recentForms && recentForms.length > 0 ? (
            <ul>
              {recentForms.map((form, i) => (
                <li key={form.id}>
                  {i > 0 && <Separator />}
                  <Link
                    href={`/forms/${form.id}/edit`}
                    className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/40"
                  >
                    <span className="font-mono-tech text-[11px] tracking-[0.18em] text-muted-foreground w-8">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg leading-tight truncate">
                        {form.title || "Untitled form"}
                      </p>
                      <p className="font-mono-tech uppercase tracking-[0.16em] text-[10px] text-muted-foreground mt-1">
                        Updated{" "}
                        {new Date(form.updated_at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <StatusPill status={form.status} />
                    <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState />
          )}
        </Card>
      </section>
    </div>
  );
}

function SectionHeading({
  tag,
  title,
  subtitle,
}: {
  tag: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono-tech uppercase tracking-[0.22em] text-[11px] text-muted-foreground">
        / {tag}
      </p>
      <h2 className="font-display text-3xl tracking-tight">{title}</h2>
      {subtitle ? (
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  footer,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  footer: string;
  accent?: boolean;
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden",
        accent && "border-brand/40 bg-brand-tint",
      )}
    >
      {accent && (
        <div
          aria-hidden
          className="absolute -top-5 -right-8 h-24 w-32 rsi-stripes opacity-40"
        />
      )}
      <CardContent className="relative space-y-4 p-5">
        <div className="flex items-center justify-between">
          <span className="font-mono-tech uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
            {label}
          </span>
          <Icon
            className={cn(
              "size-4",
              accent ? "text-brand" : "text-muted-foreground",
            )}
          />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-5xl leading-none tracking-tight">
            {value.toLocaleString()}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground font-mono-tech uppercase tracking-[0.14em]">
          {footer}
        </p>
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: string | null }) {
  const map: Record<
    string,
    { label: string; dot: string; text: string; bg: string }
  > = {
    published: {
      label: "Published",
      dot: "bg-emerald-500",
      text: "text-emerald-700",
      bg: "bg-emerald-50",
    },
    draft: {
      label: "Draft",
      dot: "bg-amber-500",
      text: "text-amber-700",
      bg: "bg-amber-50",
    },
    archived: {
      label: "Archived",
      dot: "bg-slate-400",
      text: "text-slate-600",
      bg: "bg-slate-50",
    },
  };
  const s = map[status ?? "draft"] ?? map.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-mono-tech uppercase tracking-[0.16em] text-[10px]",
        s.bg,
        s.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="relative p-10 text-center overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 blueprint-grid-fine opacity-40"
      />
      <div
        aria-hidden
        className="absolute -top-6 left-1/2 -translate-x-1/2 h-24 w-48 rsi-stripes opacity-30"
      />
      <div className="relative space-y-3">
        <p className="font-mono-tech uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
          Empty workspace
        </p>
        <p className="font-display italic text-2xl">
          No forms yet — let&apos;s draw one.
        </p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Upload a sketch and we&apos;ll do the rest. Two-finger work, max.
        </p>
        <Button
          className="mt-2 font-mono-tech uppercase tracking-[0.15em] text-[12px]"
          render={<Link href="/forms/create" />}
        >
          <FilePlus2 className="size-4" />
          Create your first form
        </Button>
      </div>
    </div>
  );
}
