import { cn } from "@/lib/utils";

const PRIORITY_STYLES = {
  High: "border-destructive/30 bg-destructive/10 text-destructive",
  Medium: "border-warning/40 bg-warning/15 text-warning",
  Low: "border-info/30 bg-info/10 text-info",
};

const DIFFICULTY_STYLES = {
  Easy: "border-success/30 bg-success/10 text-success",
  Moderate: "border-warning/40 bg-warning/15 text-warning",
  Difficult: "border-destructive/30 bg-destructive/10 text-destructive",
};

function PriorityBadge({ value }) {
  return <StatusPill className={PRIORITY_STYLES[value]}>{value} priority</StatusPill>;
}

function DifficultyBadge({ value }) {
  return <StatusPill className={DIFFICULTY_STYLES[value]}>{value}</StatusPill>;
}

function StatusPill({ children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Which provider/model actually answered a request, read from the
 * backend's X-LLM-* response headers — never part of the JSON body, so
 * the data contract stays fixed regardless of which provider answers. */
function LlmMetaPill({ provider, model, tier, elapsedMs }) {
  return (
    <StatusPill className="border-border bg-surface text-muted-foreground">
      {provider} · {model} · {tier} · {Math.round(elapsedMs)}ms
    </StatusPill>
  );
}

export { DifficultyBadge, LlmMetaPill, PriorityBadge, StatusPill };
