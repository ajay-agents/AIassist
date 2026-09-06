import { Minus, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function NumberInput({ label, value, onChange, min = 1, max = 99, step = 1, suffix, hint, className, id }) {
  const clamp = (n) => Math.min(max, Math.max(min, n));
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </Label>
      <div className="flex h-10 items-center rounded-md border border-input bg-card transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clamp(value - step))}
          className="grid h-full w-9 shrink-0 place-items-center rounded-l-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
          <input
            id={id}
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
            className="w-full min-w-0 bg-transparent text-center text-sm font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {suffix ? <span className="shrink-0 pr-1 text-xs text-muted-foreground">{suffix}</span> : null}
        </div>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clamp(value + step))}
          className="grid h-full w-9 shrink-0 place-items-center rounded-r-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export { NumberInput };
