// components/candidate/ProfileCompletionBanner.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { X, AlertCircle, CheckCircle2, Upload, Zap, Briefcase } from "lucide-react";

interface MissingItem {
  icon: React.ReactNode;
  label: string;
  href: string;
}

interface Props {
  missingCv: boolean;
  missingSkills: boolean;
  missingExperience: boolean;
}

export default function ProfileCompletionBanner({
  missingCv,
  missingSkills,
  missingExperience,
}: Props) {
  const [dismissed, setDismissed] = useState(false);

  const items: MissingItem[] = [
    ...(missingCv
      ? [{ icon: <Upload className="h-3.5 w-3.5" />, label: "Sube tu CV", href: "/cv/builder" }]
      : []),
    ...(missingSkills
      ? [{ icon: <Zap className="h-3.5 w-3.5" />, label: "Agrega tus skills", href: "/profile" }]
      : []),
    ...(missingExperience
      ? [{ icon: <Briefcase className="h-3.5 w-3.5" />, label: "Agrega experiencia", href: "/profile" }]
      : []),
  ];

  if (dismissed || items.length === 0) return null;

  const totalMissing = items.length;
  const completionPct = Math.round(((3 - totalMissing) / 3) * 100);

  return (
    <div className="relative rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/30">
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 text-amber-400 hover:text-amber-600 dark:text-amber-600 dark:hover:text-amber-400 transition"
        aria-label="Cerrar"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Tu perfil está al {completionPct}% — los reclutadores ven tu info antes de contactarte
          </p>
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
            Candidatos con perfil completo reciben{" "}
            <span className="font-semibold">3× más entrevistas</span>. Sólo toma 2 minutos.
          </p>

          <div className="mt-2.5 flex flex-wrap gap-2">
            {items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 shadow-sm transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-200 dark:hover:bg-amber-800/60"
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            <Link
              href="/cv/builder"
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-600"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completar perfil
            </Link>
          </div>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="mt-3 h-1 w-full rounded-full bg-amber-200 dark:bg-amber-800/50">
        <div
          className="h-1 rounded-full bg-amber-500 transition-all"
          style={{ width: `${completionPct}%` }}
        />
      </div>
    </div>
  );
}
