import type { ReactNode } from "react";
import { ErrorIcon, LearnIcon, PracticeIcon, ReviseIcon, Spinner, WarningIcon } from "./Icon";
export { Spinner } from "./Icon";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border border-rule bg-surface p-5 shadow-[0_1px_2px_rgba(22,35,61,0.06)] ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeading({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <h3 className="mb-2 flex items-center gap-2 text-[0.8rem] font-semibold tracking-[0.04em] text-ink uppercase">
      <span aria-hidden className="inline-block h-2.5 w-2.5 bg-accent" />
      {children}
      {count !== undefined && <span className="font-data text-xs font-normal tracking-normal text-muted normal-case">({count})</span>}
    </h3>
  );
}

export function Callout({ label = "Summary", children }: { label?: string; children: ReactNode }) {
  return (
    <div className="rounded-md bg-accent/10 px-4 py-3">
      <p className="mb-1 text-[0.68rem] font-semibold tracking-[0.08em] text-accent-ink uppercase">{label}</p>
      <p className="text-sm leading-relaxed text-ink">{children}</p>
    </div>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="mr-1.5 mb-1.5 inline-block rounded-sm border border-accent/30 bg-accent/10 px-2.5 py-1 text-sm font-medium text-accent-ink">
      {children}
    </span>
  );
}

const KIND_STYLES: Record<string, { text: string; Icon: typeof LearnIcon }> = {
  learn: { text: "text-info", Icon: LearnIcon },
  practice: { text: "text-attention", Icon: PracticeIcon },
  revise: { text: "text-success", Icon: ReviseIcon },
};

export function KindBadge({ kind }: { kind: string }) {
  const style = KIND_STYLES[kind];
  const Icon = style?.Icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[0.7rem] font-semibold tracking-wide uppercase ${style?.text ?? "text-muted"}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {kind}
    </span>
  );
}

export function SubjectDot({ colorClass }: { colorClass: string }) {
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${colorClass}`} />;
}

export function FrequencyBar({
  label,
  count,
  percentage,
  rank,
}: {
  label: string;
  count: number;
  percentage: number;
  rank?: number;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      {rank !== undefined && (
        <span className="font-data w-4 shrink-0 text-xs text-muted">{rank}</span>
      )}
      <div className="w-32 shrink-0 truncate text-sm text-ink">{label}</div>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-rule"
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${percentage.toFixed(0)}% of questions, ${count} question${count === 1 ? "" : "s"}`}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
      <div className="font-data w-20 shrink-0 text-right text-xs text-muted tabular-nums">
        {percentage.toFixed(0)}% ({count})
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading && <Spinner className="text-paper" />}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border border-rule px-3 py-1.5 text-sm font-medium text-ink transition hover:border-ink ${className}`}
    >
      {children}
    </button>
  );
}

const inputClasses =
  "rounded-md border border-rule bg-surface px-3 py-2 text-sm text-ink transition placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-muted">{label}</span>
      <input
        className={inputClasses}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-muted">{label}</span>
      <input
        type="number"
        className={`${inputClasses} font-data tabular-nums`}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 8,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-muted">{label}</span>
      <textarea
        className={`${inputClasses} resize-y leading-relaxed`}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex gap-2.5 rounded-md bg-danger/10 px-4 py-3 text-sm leading-relaxed text-ink">
      <ErrorIcon className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
      <span>{message}</span>
    </div>
  );
}

export function WarningBanner({ message }: { message: string }) {
  return (
    <div className="flex gap-2.5 rounded-md bg-attention/10 px-4 py-3 text-sm leading-relaxed text-ink">
      <WarningIcon className="mt-0.5 h-4 w-4 shrink-0 text-attention" />
      <span>{message}</span>
    </div>
  );
}

export function LlmMetaLine({
  provider,
  model,
  tier,
  insightProvider,
  elapsedMs,
}: {
  provider: string;
  model: string;
  tier: string;
  insightProvider?: string;
  elapsedMs: number;
}) {
  return (
    <div className="font-data flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.72rem] text-muted tabular-nums">
      <span>{provider}</span>
      <span className="text-rule">·</span>
      <span>{model}</span>
      <span className="text-rule">·</span>
      <span className="uppercase">{tier}</span>
      {insightProvider && (
        <>
          <span className="text-rule">·</span>
          <span>insight: {insightProvider}</span>
        </>
      )}
      <span className="text-rule">·</span>
      <span>{(elapsedMs / 1000).toFixed(1)}s</span>
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 divide-x divide-rule border border-rule sm:grid-cols-4">{children}</div>;
}

export function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-3">
      <span className="font-data text-lg font-medium text-ink tabular-nums">{value}</span>
      <span className="text-[0.66rem] tracking-[0.04em] text-muted uppercase">{label}</span>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-rule px-6 py-16 text-center">
      <p className="font-display text-lg text-ink">{title}</p>
      <p className="max-w-xs text-sm text-muted">{description}</p>
    </div>
  );
}
