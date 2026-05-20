import Link from "next/link";
import { Camera, FileText, ScanLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SketchUploader } from "./sketch-uploader";

export const metadata = { title: "Create form" };

const stages = [
  {
    num: "01",
    title: "Preprocess",
    desc: "Deskew, denoise, crop to the page bounds.",
    icon: ScanLine,
  },
  {
    num: "02",
    title: "Vision extract",
    desc: "Read labels, options, and field types straight off the page.",
    icon: Camera,
  },
  {
    num: "03",
    title: "Structure",
    desc: "Assign stable slug IDs and resolve dependencies.",
    icon: FileText,
  },
  {
    num: "04",
    title: "Validate + repair",
    desc: "One retry with the validator's error message — then ship.",
    icon: Sparkles,
  },
];

export default function CreateFormPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-12 anim-rise">
      {/* HERO */}
      <header className="space-y-4">
        <p className="font-mono-tech uppercase tracking-[0.22em] text-[11px] text-muted-foreground">
          / 03 · Create form
        </p>
        <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1]">
          Draw it. <em className="text-brand">Drop it.</em>
          <br />
          Done.
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
          Upload a hand-drawn or printed form and our pipeline will extract every
          field — radios, checkboxes, text inputs, the lot — into a typed schema
          you can edit and publish.
        </p>
      </header>

      {/* DROP ZONE */}
      <Card className="relative overflow-hidden p-0 border-dashed border-2 border-brand/40 bg-brand-tint/40">
        <div
          aria-hidden
          className="absolute inset-0 blueprint-grid opacity-50"
        />
        <div
          aria-hidden
          className="absolute -top-10 -right-20 h-56 w-80 -rotate-3 rsi-stripes opacity-30"
        />
        <CardContent className="relative p-0">
          <SketchUploader />
        </CardContent>
      </Card>

      {/* PIPELINE */}
      <section className="space-y-6">
        <div className="space-y-1.5">
          <p className="font-mono-tech uppercase tracking-[0.22em] text-[11px] text-muted-foreground">
            / Pipeline
          </p>
          <h2 className="font-display text-3xl tracking-tight">
            What happens after you upload
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl">
            Four LangGraph nodes work the page over. If anything looks shaky,
            it&apos;s flagged for your review — never silently guessed.
          </p>
        </div>

        <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stages.map((s, i) => (
            <li
              key={s.num}
              className={cn(
                "relative rounded-lg border bg-card p-5 anim-rise",
                "before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-brand before:rounded-l-lg",
                "transition-transform hover:-translate-y-0.5",
              )}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono-tech text-[10px] tracking-[0.22em] text-muted-foreground">
                  Stage {s.num}
                </span>
                <s.icon className="size-4 text-brand" />
              </div>
              <h3 className="mt-3 font-display italic text-2xl leading-none">
                {s.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* OR FROM SCRATCH */}
      <Card className="relative overflow-hidden p-0">
        <CardContent className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-6">
          <div className="space-y-1.5">
            <p className="font-mono-tech uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
              No paper handy?
            </p>
            <p className="font-display text-2xl">Start from a blank canvas.</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Same editor, no AI pass — useful when you already know the schema
              in your head.
            </p>
          </div>
          <Button
            variant="outline"
            className="font-mono-tech uppercase tracking-[0.15em] text-[12px]"
            render={<Link href="/forms/create/blank" />}
          >
            Blank form →
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
