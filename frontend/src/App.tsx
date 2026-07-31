import { useState } from "react";
import { checkHealth } from "./api/client";
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
  const [health, setHealth] = useState<"idle" | "ok" | "error">("idle");

  async function handleCheckHealth() {
    setHealth("idle");
    try {
      await checkHealth(apiBaseUrl);
      setHealth("ok");
    } catch {
      setHealth("error");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">📚 Study Desk</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Study Plan Generator · PYQ Analysis · Notes Summarizer
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-sm dark:border-slate-800 dark:bg-slate-900">
          <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            API base URL
            <input
              className="w-56 rounded-md border border-slate-300 px-2 py-1 text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
            />
          </label>
          <button
            onClick={handleCheckHealth}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400"
          >
            Check health
          </button>
          {health === "ok" && <span className="text-emerald-600 dark:text-emerald-400">✓ reachable</span>}
          {health === "error" && <span className="text-red-600 dark:text-red-400">✕ unreachable</span>}
        </div>

        <nav className="flex gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {activeTab === "plan" && <StudyPlanTool apiBaseUrl={apiBaseUrl} />}
        {activeTab === "pyq" && <PyqTool apiBaseUrl={apiBaseUrl} />}
        {activeTab === "notes" && <NotesTool apiBaseUrl={apiBaseUrl} />}
      </main>
    </div>
  );
}

export default App;
