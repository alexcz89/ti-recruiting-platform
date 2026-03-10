// components/jobs/MatchScoreBadge.tsx
type Props = {
  score: number;
  label: string;
  scoreColor: string;
  scoreTextColor: string;
  compact?: boolean;
};

export default function MatchScoreBadge({
  score,
  label,
  scoreColor,
  scoreTextColor,
  compact = false,
}: Props) {
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div className={compact ? "inline-flex items-center gap-1.5" : "inline-flex items-center gap-2"}>
      <span className={`${compact ? "text-sm" : "text-base"} font-black leading-none ${scoreTextColor}`}>
        {clamped}%
      </span>
      <div className={`${compact ? "w-14" : "w-20"} h-1.5 rounded-full bg-zinc-200/70 dark:bg-zinc-700/60`}>
        <div className={`h-1.5 rounded-full ${scoreColor}`} style={{ width: `${clamped}%` }} />
      </div>
      {!compact && <span className="text-[11px] text-zinc-500">{label}</span>}
    </div>
  );
}