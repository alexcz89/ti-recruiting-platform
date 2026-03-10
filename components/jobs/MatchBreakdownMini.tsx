// components/jobs/MatchBreakdownMini.tsx
interface SkillDetail {
  termId: string;
  label: string;
  must: boolean;
  matched: boolean;
  candidateLevel?: number | null;
  jobWeight?: number | null;
}

interface MatchResult {
  score: number;
  matchedCount: number;
  details: SkillDetail[];
  seniorityFit?: "exact" | "close" | "low" | "unknown";
  experienceFit?: "meets" | "close" | "below" | "unknown";
}

type Props = {
  matchResult: MatchResult;
  showCounts?: boolean;
  compact?: boolean;
};

function seniorityText(v?: MatchResult["seniorityFit"]) {
  if (!v || v === "unknown") return null;
  if (v === "exact") return "Seniority ✓";
  if (v === "close") return "Seniority ~";
  return "Seniority ↓";
}

function experienceText(v?: MatchResult["experienceFit"]) {
  if (!v || v === "unknown") return null;
  if (v === "meets") return "Exp ✓";
  if (v === "close") return "Exp ~";
  return "Exp ↓";
}

export default function MatchBreakdownMini({
  matchResult,
  showCounts = true,
  compact = false,
}: Props) {
  const missingCount = matchResult.details.filter((d) => !d.matched).length;
  const parts: string[] = [];

  if (showCounts && matchResult.details.length > 0) {
    parts.push(`Skills ${matchResult.matchedCount}/${matchResult.details.length}`);
    if (missingCount > 0) parts.push(`Faltan ${missingCount}`);
  }

  const s = seniorityText(matchResult.seniorityFit);
  const e = experienceText(matchResult.experienceFit);

  if (s) parts.push(s);
  if (e) parts.push(e);

  if (parts.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-zinc-500 ${compact ? "text-[10px]" : "text-[11px]"}`}>
      {parts.map((part, idx) => (
        <span key={`${part}-${idx}`} className="inline-flex items-center">
          {part}
          {idx < parts.length - 1 && <span className="ml-2 text-zinc-300">·</span>}
        </span>
      ))}
    </div>
  );
}