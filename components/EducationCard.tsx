"use client";

type Education = {
  id: string;
  level: string | null;
  status: "ONGOING" | "COMPLETED" | "INCOMPLETE";
  institution: string;
  program?: string | null;
  country?: string | null;
  city?: string | null;
  startDate?: string | null; // ISO
  endDate?: string | null;   // ISO
  grade?: string | null;
  description?: string | null;
  sortIndex: number;
};

const LEVEL_LABELS: Record<string, string> = {
  NONE: "Sin estudios",
  PRIMARY: "Primaria",
  SECONDARY: "Secundaria",
  HIGH_SCHOOL: "Preparatoria",
  TECHNICAL: "Técnico/TSU",
  BACHELOR: "Licenciatura",
  MASTER: "Maestría",
  DOCTORATE: "Doctorado",
  OTHER: "Otro",
};

// tonos Tailwind para chips
function Chip({
  children,
  tone = "zinc",
  outline = false,
  className = "",
}: {
  children: React.ReactNode;
  tone?: "zinc" | "blue" | "emerald" | "amber" | "violet" | "rose";
  outline?: boolean;
  className?: string;
}) {
  const tones: Record<string, string> = {
    zinc: outline ? "border-zinc-300 text-zinc-700" : "bg-zinc-100 text-zinc-800",
    blue: outline ? "border-blue-300 text-blue-700" : "bg-blue-50 text-blue-700",
    emerald: outline ? "border-emerald-300 text-emerald-700" : "bg-emerald-50 text-emerald-700",
    amber: outline ? "border-amber-300 text-amber-700" : "bg-amber-50 text-amber-700",
    violet: outline ? "border-violet-300 text-violet-700" : "bg-violet-50 text-violet-700",
    rose: outline ? "border-rose-300 text-rose-700" : "bg-rose-50 text-rose-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${tones[tone]} ${outline ? "bg-white" : ""} ${className}`}
    >
      {children}
    </span>
  );
}

function fmtMonth(dateISO?: string | null) {
  if (!dateISO) return "";
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return "";
  // Mes corto + año (ej: "sep 2025")
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export default function EducationCard({
  edu,
  onEdit,
  onDelete,
}: {
  edu: Education;
  onEdit: (patch: Partial<Education>) => void;
  onDelete: () => void;
}) {
  const isOngoing = edu.status === "ONGOING";
  const start = fmtMonth(edu.startDate);
  const end = isOngoing ? "Actualidad" : fmtMonth(edu.endDate) || "";

  const levelLabel = (edu.level && LEVEL_LABELS[edu.level]) || edu.level || "—";

  const statusTone =
    edu.status === "COMPLETED" ? "emerald" :
    edu.status === "ONGOING" ? "amber" :
    "rose";

  const toggleLabel =
    edu.status === "ONGOING" ? "Marcar como completado" : "Marcar como en curso";

  return (
    <div className="border rounded-xl p-4 bg-white flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium break-anywhere">
            {edu.institution}
            {edu.program ? <span className="text-zinc-600"> — {edu.program}</span> : null}
          </div>

          <div className="text-xs text-zinc-600">
            {start || "—"} {start || end ? "–" : ""} {end || (isOngoing ? "Actualidad" : "—")}
            {(edu.city || edu.country) && (
              <>
                {" · "}
                {edu.city || ""}
                {edu.city && edu.country ? ", " : ""}
                {edu.country || ""}
              </>
            )}
          </div>

          {/* Chips */}
          <div className="mt-1 flex flex-wrap gap-2">
            <Chip tone="blue">{levelLabel}</Chip>
            <Chip tone={statusTone as any}>{edu.status}</Chip>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="text-xs border rounded px-2 py-1 hover:bg-gray-50"
            onClick={() =>
              onEdit({
                status: edu.status === "ONGOING" ? "COMPLETED" : "ONGOING",
                endDate: edu.status === "ONGOING" ? new Date().toISOString().slice(0, 10) : null,
              })
            }
            title={toggleLabel}
          >
            {toggleLabel}
          </button>
          <button
            className="text-xs border rounded px-2 py-1 hover:bg-gray-50 text-rose-600"
            onClick={() => {
              if (confirm("¿Eliminar esta entrada de escolaridad?")) onDelete();
            }}
          >
            Eliminar
          </button>
        </div>
      </div>

      {edu.description && (
        <p className="text-sm text-zinc-700 whitespace-pre-wrap break-anywhere">
          {edu.description}
        </p>
      )}

      {edu.grade && (
        <p className="text-xs text-zinc-600">Promedio/Grado: {edu.grade}</p>
      )}
    </div>
  );
}
