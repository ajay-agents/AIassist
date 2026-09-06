import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui-kit/SelectField";
import { DifficultyBadge, PriorityBadge } from "@/components/ui-kit/StatusBadges";

const PRIORITIES = ["High", "Medium", "Low"];
const DIFFICULTIES = ["Easy", "Moderate", "Difficult"];

function SubjectEditor({ value, onSave, onCancel, saveLabel = "Save subject" }) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="surface-panel space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`name-${draft.id}`} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Subject name
          </Label>
          <Input
            id={`name-${draft.id}`}
            value={draft.name}
            placeholder="Physics"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="h-10 bg-card"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Priority" value={draft.priority} options={PRIORITIES} onChange={(v) => setDraft({ ...draft, priority: v })} />
          <SelectField
            label="Difficulty"
            value={draft.difficulty}
            options={DIFFICULTIES}
            onChange={(v) => setDraft({ ...draft, difficulty: v })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`topics-${draft.id}`} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Topics / syllabus
        </Label>
        <Textarea
          id={`topics-${draft.id}`}
          value={draft.topics}
          rows={3}
          placeholder="Mechanics, thermodynamics, waves, optics..."
          onChange={(e) => setDraft({ ...draft, topics: e.target.value })}
          className="resize-y bg-card text-sm leading-relaxed"
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
        <Button size="sm" onClick={() => onSave(draft)} disabled={!draft.name.trim()}>
          <Check className="h-3.5 w-3.5" /> {saveLabel}
        </Button>
      </div>
    </div>
  );
}

function SubjectCard({ subject, onEdit, onRemove }) {
  return (
    <article className="surface-panel group p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-foreground">{subject.name}</h4>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{subject.topics.trim() || "No topics added yet"}</p>
        </div>
        <div className="flex shrink-0 gap-1 opacity-70 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon" aria-label="Edit subject" onClick={onEdit} className="h-8 w-8">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove subject"
            onClick={onRemove}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <PriorityBadge value={subject.priority} />
        <DifficultyBadge value={subject.difficulty} />
      </div>
    </article>
  );
}

export { SubjectCard, SubjectEditor };
