import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </div>
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border-l-4 border-indigo-500 bg-indigo-50 px-4 py-3 text-sm text-slate-700 dark:bg-indigo-950/40 dark:text-slate-200">
      {children}
    </div>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="mr-1.5 mb-1.5 inline-block rounded-full bg-indigo-50 px-3 py-0.5 text-sm text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
      {children}
    </span>
  );
}

const KIND_STYLES: Record<string, string> = {
  learn: "bg-blue-600",
  practice: "bg-amber-600",
  revise: "bg-emerald-600",
};

export function KindBadge({ kind }: { kind: string }) {
  return (
    <span
      className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide text-white ${
        KIND_STYLES[kind] ?? "bg-slate-500"
      }`}
    >
      {kind}
    </span>
  );
}

export function FrequencyBar({ label, count, percentage }: { label: string; count: number; percentage: number }) {
  return (
    <div className="flex items-center gap-3 py-1.5" title={`${count} question(s)`}>
      <div className="w-36 shrink-0 truncate text-sm text-slate-700 dark:text-slate-300">{label}</div>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-indigo-600"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="w-24 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
        {percentage.toFixed(0)}% ({count})
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

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
      <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <input
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
      <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <input
        type="number"
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
      <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <textarea
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
    </label>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      {message}
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
    <p className="text-xs text-slate-500 dark:text-slate-400">
      provider: <span className="font-medium">{provider}</span> · model:{" "}
      <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">{model}</code> · tier: {tier}
      {insightProvider && (
        <>
          {" "}
          · insight provider: <span className="font-medium">{insightProvider}</span>
        </>
      )}{" "}
      · {(elapsedMs / 1000).toFixed(1)}s
    </p>
  );
}
