"use client";

import { Plus, Sparkles, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  FIELD_TYPES,
  FIELD_TYPE_LABEL,
  OPTION_FIELD_TYPES,
  type FieldType,
  type FormField,
} from "@/lib/schema/definition";

export function FieldPropertiesSheet({
  field,
  allFields,
  onOpenChange,
  onPatch,
}: {
  field: FormField | null;
  allFields: FormField[];
  onOpenChange: (open: boolean) => void;
  onPatch: (id: string, patch: Partial<FormField>) => void;
}) {
  const open = field !== null;

  function changeType(nextType: FieldType) {
    if (!field) return;
    const wasOption = OPTION_FIELD_TYPES.has(field.type);
    const willBeOption = OPTION_FIELD_TYPES.has(nextType);

    const patch: Partial<FormField> = { type: nextType };
    if (willBeOption && !wasOption) {
      patch.options = ["Option 1"];
      patch.placeholder = null;
    } else if (!willBeOption && wasOption) {
      patch.options = undefined;
    }
    onPatch(field.id, patch);
  }

  function updateOption(idx: number, value: string) {
    if (!field?.options) return;
    const next = [...field.options];
    next[idx] = value;
    onPatch(field.id, { options: next });
  }

  function addOption() {
    if (!field) return;
    const current = field.options ?? [];
    onPatch(field.id, {
      options: [...current, `Option ${current.length + 1}`],
    });
  }

  function removeOption(idx: number) {
    if (!field?.options || field.options.length <= 1) return;
    onPatch(field.id, {
      options: field.options.filter((_, i) => i !== idx),
    });
  }

  // Surface duplicate IDs visibly even though they're auto-generated; an
  // imported sketch could theoretically collide.
  const idClash =
    field && allFields.filter((f) => f.id === field.id).length > 1;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {field && (
          <>
            <SheetHeader>
              <div className="flex items-center justify-between gap-2">
                <SheetTitle>Edit field</SheetTitle>
                {field.needs_review && (
                  <Badge variant="warning">
                    <Sparkles className="size-2.5" />
                    Needs review
                  </Badge>
                )}
              </div>
              <SheetDescription>
                Changes apply immediately. Auto-save runs 5 seconds after your
                last edit.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              <div className="space-y-2">
                <Label htmlFor="field-label">Label</Label>
                <Input
                  id="field-label"
                  value={field.label}
                  onChange={(e) =>
                    onPatch(field.id, { label: e.target.value })
                  }
                  placeholder="What's this field called?"
                />
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <Select<FieldType>
                  value={field.type}
                  onValueChange={(value) => {
                    if (value) changeType(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {FIELD_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-md border bg-card p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="field-required">Required</Label>
                  <p className="text-xs text-muted-foreground">
                    Respondents can&apos;t submit without filling this in.
                  </p>
                </div>
                <Switch
                  id="field-required"
                  checked={field.required}
                  onCheckedChange={(checked) =>
                    onPatch(field.id, { required: checked })
                  }
                />
              </div>

              {!OPTION_FIELD_TYPES.has(field.type) &&
                field.type !== "yes_no" &&
                field.type !== "date" && (
                  <div className="space-y-2">
                    <Label htmlFor="field-placeholder">Placeholder</Label>
                    <Input
                      id="field-placeholder"
                      value={field.placeholder ?? ""}
                      onChange={(e) =>
                        onPatch(field.id, {
                          placeholder:
                            e.target.value.length > 0 ? e.target.value : null,
                        })
                      }
                      placeholder="e.g. you@example.com"
                    />
                  </div>
                )}

              {OPTION_FIELD_TYPES.has(field.type) && (
                <div className="space-y-2">
                  <Label>Options</Label>
                  <ul className="space-y-2">
                    {(field.options ?? []).map((opt, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <Input
                          value={opt}
                          onChange={(e) => updateOption(idx, e.target.value)}
                          placeholder={`Option ${idx + 1}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeOption(idx)}
                          disabled={(field.options ?? []).length <= 1}
                          aria-label="Remove option"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addOption}
                    className="w-full border-dashed font-mono-tech uppercase tracking-[0.15em] text-[10px]"
                  >
                    <Plus />
                    Add option
                  </Button>
                </div>
              )}

              {field.needs_review && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <p className="font-medium">AI flagged this for review.</p>
                  <p className="mt-1">
                    Confirm the label, type, and options look right, then clear
                    the flag.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() =>
                      onPatch(field.id, { needs_review: false })
                    }
                  >
                    Mark reviewed
                  </Button>
                </div>
              )}

              <div className="space-y-2 border-t pt-4">
                <p className="font-mono-tech uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
                  Field id
                </p>
                <code className="block rounded bg-muted px-2 py-1 text-xs">
                  {field.id}
                </code>
                {idClash && (
                  <p className="text-xs text-destructive">
                    This id is duplicated elsewhere in the form — saving is
                    blocked until it&apos;s unique.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Stable across renames. Response payloads key on this id, not
                  the label.
                </p>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
