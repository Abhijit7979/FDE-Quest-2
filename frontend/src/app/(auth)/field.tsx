import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Label + input pair used by every auth form. Mono uppercase label,
 * brand focus ring on the input, optional right-aligned slot (e.g. a
 * "Forgot?" link) and an optional helper hint.
 */
export function AuthField({
  id,
  name,
  type,
  label,
  autoComplete,
  required,
  placeholder,
  minLength,
  hint,
  rightSlot,
}: {
  id: string;
  name: string;
  type: string;
  label: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  minLength?: number;
  hint?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label
          htmlFor={id}
          className="font-mono-tech uppercase tracking-[0.18em] text-[10px] text-muted-foreground"
        >
          {label}
        </Label>
        {rightSlot}
      </div>
      <Input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        minLength={minLength}
        className="h-11 bg-card border-border focus-visible:ring-brand/40 focus-visible:border-brand transition-colors"
      />
      {hint ? (
        <p className="text-[11px] text-muted-foreground/80">{hint}</p>
      ) : null}
    </div>
  );
}
