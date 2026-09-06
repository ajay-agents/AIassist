import { useState } from "react";
import { ChevronDown, Clock, CalendarDays } from "lucide-react";
import { StatusPill } from "@/components/ui-kit/StatusBadges";
import { formatMinutes } from "@/lib/api";
import { cn } from "@/lib/utils";

const KIND_LABEL = { learn: "Learning", practice: "Practice", revise: "Revision" };
const KIND_STYLES = {
  learn: "border-info/30 bg-info/10 text-info",
  practice: "border-primary/30 bg-primary/10 text-primary",
  revise: "border-success/30 bg-success/10 text-success",
};

function DayCard({ day, budgetMinutes, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const usage = Math.min(100, Math.round((day.total_minutes / Math.max(budgetMinutes, 1)) * 100));
  const label = day.day === 1 ? "Today" : day.day === 2 ? "Tomorrow" : `Day ${day.day}`;

  return (
    <article className="surface-panel overflow-hidden transition-shadow duration-200 hover:shadow-lift">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/50 sm:px-5"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border bg-surface text-sm font-semibold tabular-nums text-foreground">
            {day.day}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{label}</p>
            <p className="truncate text-xs text-muted-foreground">
              {day.sessions.map((s) => `${s.subject} — ${s.topic}`).join(" · ") || "No sessions scheduled"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground sm:flex">
            <Clock className="h-3.5 w-3.5" />
            {formatMinutes(day.total_minutes)} / {formatMinutes(budgetMinutes)}
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
        </div>
      </button>

      <div className="px-4 pb-3 sm:px-5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all duration-500", usage > 95 ? "bg-warning" : "bg-primary")}
            style={{ width: `${usage}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {usage}% of the day&apos;s {formatMinutes(budgetMinutes)} budget allocated
        </p>
      </div>

      {open ? (
        <div className="space-y-2 border-t border-border/70 bg-surface/50 px-4 py-4 sm:px-5">
          {day.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions scheduled.</p>
          ) : (
            day.sessions.map((session, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {session.subject} <span className="font-normal text-muted-foreground">— {session.topic}</span>
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusPill className={KIND_STYLES[session.kind]}>{KIND_LABEL[session.kind] ?? session.kind}</StatusPill>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatMinutes(session.minutes)}</span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </article>
  );
}

function PlanResult({ plan, gradeLevel, hoursPerDay }) {
  const budgetMinutes = Math.max(hoursPerDay * 60, 1);
  const totalMinutes = plan.days.reduce((sum, d) => sum + d.total_minutes, 0);

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">Your Study Roadmap</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {gradeLevel} · {plan.days.length} days · {formatMinutes(totalMinutes)} total
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" /> Generated plan
        </span>
      </div>

      {plan.summary ? <p className="surface-panel px-5 py-4 text-sm leading-relaxed text-foreground">{plan.summary}</p> : null}

      <div className="space-y-3">
        {plan.days.map((day, i) => (
          <DayCard key={day.day} day={day} budgetMinutes={budgetMinutes} defaultOpen={i < 2} />
        ))}
      </div>
    </section>
  );
}

export { PlanResult };
