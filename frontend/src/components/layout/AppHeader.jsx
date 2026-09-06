import { useState } from "react";
import { Activity, GraduationCap, Loader2, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/lib/theme";
import { checkHealth } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_COPY = {
  unknown: "Not checked",
  checking: "Checking…",
  online: "API reachable",
  offline: "API unreachable",
};

function AppHeader({ apiBaseUrl, onApiBaseUrlChange }) {
  const { theme, toggle } = useTheme();
  const [health, setHealth] = useState("unknown");
  const [latency, setLatency] = useState(null);

  const runCheck = async () => {
    setHealth("checking");
    setLatency(null);
    const result = await checkHealth(apiBaseUrl);
    setHealth(result.ok ? "online" : "offline");
    setLatency(result.ok ? result.latencyMs : null);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:flex">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-base leading-tight font-semibold text-foreground">Study Desk</p>
              <p className="truncate text-[11px] text-muted-foreground">Academic productivity workspace</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={toggle}
            className="shrink-0 rounded-md border border-border lg:hidden"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-card px-2 lg:w-72 lg:flex-none">
            <span className="hidden shrink-0 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sm:inline">API</span>
            <Input
              value={apiBaseUrl}
              onChange={(e) => onApiBaseUrlChange(e.target.value)}
              placeholder="https://api.example.com"
              aria-label="API base URL"
              className="h-9 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>

          <Button variant="outline" size="sm" onClick={runCheck} disabled={health === "checking"} className="h-9">
            {health === "checking" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
            Check Health
          </Button>

          <div
            className={cn(
              "flex h-9 items-center gap-2 rounded-md border px-2.5 text-xs font-medium",
              health === "online" && "border-success/40 bg-success/10 text-success",
              health === "offline" && "border-destructive/40 bg-destructive/10 text-destructive",
              (health === "unknown" || health === "checking") && "border-border bg-secondary text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                health === "online" && "bg-success",
                health === "offline" && "bg-destructive",
                health === "checking" && "animate-pulse bg-warning",
                health === "unknown" && "bg-muted-foreground/60",
              )}
            />
            <span className="whitespace-nowrap">
              {STATUS_COPY[health]}
              {latency !== null ? ` · ${latency}ms` : ""}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={toggle}
            className="hidden h-9 w-9 shrink-0 rounded-md border border-border lg:inline-flex"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}

export { AppHeader };
