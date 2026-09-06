import { cn } from "@/lib/utils";

function ResultCard({ title, subtitle, icon, action, children, className, tone = "default" }) {
  return (
    <section className={cn("surface-panel overflow-hidden", tone === "accent" && "border-primary/30 bg-accent/30", className)}>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border/70 px-5 py-4 sm:flex sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {icon ? (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-card text-primary">{icon}</span>
          ) : null}
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-foreground">{title}</h3>
            {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

export { ResultCard };
