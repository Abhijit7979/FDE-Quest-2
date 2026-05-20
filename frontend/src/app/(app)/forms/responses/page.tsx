import Link from "next/link";
import { Filter, Inbox, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Responses" };

export default function ResponsesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-10 anim-rise">
      {/* HEADER */}
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <p className="font-mono-tech uppercase tracking-[0.22em] text-[11px] text-muted-foreground">
            / 03 · Responses
          </p>
          <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1]">
            Every <em className="text-brand">answer</em>,
            <br />
            in one inbox.
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
            Filter by form, export to CSV, dig into individual submissions.
            Owner-only — your respondents stay anonymous to everyone but you.
          </p>
        </div>
      </header>

      {/* FILTER BAR (preview) */}
      <Card className="p-0">
        <CardContent className="flex flex-col md:flex-row gap-3 p-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search responses…"
              disabled
              className="h-11 pl-10 bg-background"
            />
          </div>
          <Button
            variant="outline"
            disabled
            className="h-11 font-mono-tech uppercase tracking-[0.15em] text-[12px]"
          >
            <Filter className="size-4" />
            All forms
          </Button>
          <Button
            disabled
            className="h-11 font-mono-tech uppercase tracking-[0.15em] text-[12px]"
          >
            Export CSV
          </Button>
        </CardContent>
      </Card>

      {/* EMPTY STATE */}
      <Card className="relative overflow-hidden p-0">
        <div
          aria-hidden
          className="absolute inset-0 blueprint-grid-fine opacity-60"
        />
        <div
          aria-hidden
          className="absolute -top-10 left-1/2 -translate-x-1/2 h-32 w-72 rsi-stripes opacity-30"
        />
        <CardContent className="relative flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 blur-xl bg-brand/20 rounded-full" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/30 bg-card text-brand">
              <Inbox className="size-6" />
            </div>
          </div>
          <p className="font-mono-tech uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
            Empty inbox
          </p>
          <h2 className="font-display text-3xl mt-2 tracking-tight">
            No responses <em className="text-brand">yet</em>.
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Once you publish a form and share its link, every answer lands
            here — sorted, filterable, ready to export.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              className="font-mono-tech uppercase tracking-[0.15em] text-[12px]"
              render={<Link href="/forms/create" />}
            >
              Build a form
            </Button>
            <Button
              variant="outline"
              className="font-mono-tech uppercase tracking-[0.15em] text-[12px]"
              render={<Link href="/home" />}
            >
              Back to overview
            </Button>
          </div>
          <p className="mt-8 font-mono-tech uppercase tracking-[0.22em] text-[10px] text-muted-foreground/70">
            ⏳ Detail view lands in P2 (PRD §3.6)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
