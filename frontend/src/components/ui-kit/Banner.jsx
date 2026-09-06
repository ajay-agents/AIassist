import { AlertTriangle, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE_STYLES = {
  warning: "border-warning/40 bg-warning/10 text-warning",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
};

const TONE_ICONS = {
  warning: AlertTriangle,
  error: CircleAlert,
};

function Banner({ tone = "warning", children, className }) {
  const Icon = TONE_ICONS[tone];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-relaxed", TONE_STYLES[tone], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

export { Banner };
