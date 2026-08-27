import { useState } from "react";
import { checkHealth } from "./api/client";
import { SettingsIcon } from "./components/ui/Icon";
import { NotesTool } from "./features/notes/NotesTool";
import { PyqTool } from "./features/pyq/PyqTool";
import { StudyPlanTool } from "./features/studyPlan/StudyPlanTool";
import { useApiBaseUrl } from "./hooks/useApiBaseUrl";

const TABS = [
  { id: "plan", label: "Study Plan" },
  { id: "pyq", label: "PYQ Analysis" },
  { id: "notes", label: "Notes Summarizer" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function App() {
  const [activeTab, setActiveTab] = useState<TabId>("plan");
  const [apiBaseUrl, setApiBaseUrl] = useApiBaseUrl();
  const [health, setHealth] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function handleCheckHealth() {
    setHealth("checking");
    try {
      await checkHealth(apiBaseUrl);
      setHealth("ok");
    } catch {
      setHealth("error");
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Study Desk</h1>
            <p className="mt-0.5 text-sm text-muted">
              Your study plan, past-paper insights, and notes — organized in one place.
            </p>
          </div>

          <div className="relative">
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              aria-label="Settings"
              aria-expanded={settingsOpen}
              className="flex h-9 w-9 items-center justify-center border border-rule text-muted transition hover:border-ink hover:text-ink"
            >
              <SettingsIcon className="h-4 w-4" />
            </button>

            {settingsOpen && (
              <>
                <button
                  aria-label="Close settings"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setSettingsOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-72 border border-rule bg-surface p-4 text-sm shadow-lg">
                  <p className="mb-2 font-semibold text-ink">Backend connection</p>
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    API base URL
                    <input
                      className="font-data rounded-sm border border-rule px-2.5 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                      value={apiBaseUrl}
                      onChange={(e) => setApiBaseUrl(e.target.value)}
                    />
                  </label>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={handleCheckHealth}
                      className="rounded-sm border border-rule px-2.5 py-1 text-xs font-medium text-ink hover:border-ink"
                    >
                      Check health
                    </button>
                    {health === "checking" && <span className="text-xs text-muted">checking…</span>}
                    {health === "ok" && <span className="text-xs text-success">reachable</span>}
                    {health === "error" && <span className="text-xs text-danger">unreachable</span>}
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    Only relevant if you're pointing this at a non-default backend.
                  </p>
                </div>
              </>
            )}
          </div>
        </header>

        <nav className="flex gap-6 border-b border-rule" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition ${
                activeTab === tab.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <main className="animate-[fadein_0.2s_ease-out]">
          {activeTab === "plan" && <StudyPlanTool apiBaseUrl={apiBaseUrl} />}
          {activeTab === "pyq" && <PyqTool apiBaseUrl={apiBaseUrl} />}
          {activeTab === "notes" && <NotesTool apiBaseUrl={apiBaseUrl} />}
        </main>

        <footer className="border-t border-rule pt-4 text-center text-xs text-muted">
          Study Desk — a curriculum-neutral study companion. Not affiliated with any specific board or exam.
        </footer>
      </div>
    </div>
  );
}

export default App;
