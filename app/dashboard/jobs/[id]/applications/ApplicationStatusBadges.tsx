import React from "react";
import type { RecruitingPresentation } from "@/lib/hiring-process/recruiting-presentation";
import type { RecruiterListAssessment } from "@/lib/hiring-process/recruiter-list";

export default function ApplicationStatusBadges({ presentation, assessment, showStage = true }: { presentation: RecruitingPresentation; assessment: RecruiterListAssessment; showStage?: boolean }) {
  if (!showStage && !presentation.preselected && !presentation.assessmentStage && assessment === "NONE") return null;
  return <div className="flex flex-wrap items-center gap-1">
    {showStage && <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
      {presentation.label}
    </span>}
    {presentation.preselected && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Preselecto</span>}
    {presentation.assessmentStage && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-900/30 dark:text-sky-200">Evaluación técnica</span>}
    {assessment !== "NONE" && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-800 dark:bg-teal-900/30 dark:text-teal-200">{({ SENT: "Evaluación enviada", STARTED: "Evaluación iniciada", COMPLETED: "Evaluación completada", EXPIRED: "Evaluación vencida" } as Record<string, string>)[assessment]}</span>}
  </div>;
}
