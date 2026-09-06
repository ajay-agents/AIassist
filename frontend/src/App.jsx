import { useState } from "react";
import { CalendarRange, BarChart3, FileText } from "lucide-react";
import { ThemeProvider } from "@/lib/theme";
import { AppHeader } from "@/components/layout/AppHeader";
import { StudyPlanTab } from "@/features/studyPlan/StudyPlanTab";
import { PyqTab } from "@/features/pyq/PyqTab";
import { NotesTab } from "@/features/notes/NotesTab";
import { useApiBaseUrl } from "@/hooks/useApiBaseUrl";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "plan", label: "Study Plan", icon: CalendarRange },
  { id: "pyq", label: "PYQ Analysis", icon: BarChart3 },
  { id: "notes", label: "Notes Summarizer", icon: FileText },
];

function App() {
  const [tab, setTab] = useState("plan");
  const [apiBaseUrl, setApiBaseUrl] = useApiBaseUrl();

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <AppHeader apiBaseUrl={apiBaseUrl} onApiBaseUrlChange={setApiBaseUrl} />

        <nav className="border-b border-border/80 bg-surface/60">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="-mb-px flex gap-1 overflow-x-auto">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={tab === id ? "page" : undefined}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors sm:px-4",
                    tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </nav>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          {tab === "plan" ? <StudyPlanTab apiBaseUrl={apiBaseUrl} /> : tab === "pyq" ? <PyqTab apiBaseUrl={apiBaseUrl} /> : <NotesTab apiBaseUrl={apiBaseUrl} />}
        </main>

        <footer className="border-t border-border/80 py-6">
          <p className="mx-auto max-w-6xl px-4 text-xs text-muted-foreground sm:px-6">
            Study Desk · a curriculum-neutral study companion, connected to {apiBaseUrl}.
          </p>
        </footer>
      </div>
    </ThemeProvider>
  );
}

export default App;
