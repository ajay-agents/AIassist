// Deterministic color per subject name so the same subject reads
// consistently everywhere it appears (subject row, every day of the
// roadmap) without needing a color picker or any stored state. Chosen to
// stay distinct from the brand accent (gold) and the semantic status
// colors (info/attention/success/danger) so a subject dot never reads as
// a status signal.
const PALETTE = [
  { dot: "bg-teal-600" },
  { dot: "bg-sky-600" },
  { dot: "bg-purple-600" },
  { dot: "bg-orange-600" },
  { dot: "bg-emerald-600" },
  { dot: "bg-cyan-600" },
  { dot: "bg-fuchsia-600" },
  { dot: "bg-lime-700" },
] as const;

export function subjectColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
