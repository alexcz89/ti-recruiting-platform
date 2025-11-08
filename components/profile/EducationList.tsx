// components/profile/EducationList.tsx
"use client";

type Education = {
  id: string;
  level: string | null;
  status: "ONGOING" | "COMPLETED" | "INCOMPLETE";
  institution: string;
  program?: string | null;
  country?: string | null;
  city?: string | null;
  startDate?: string | null;
  endDate?: string | null;
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

function fmtMonth(dateISO?: string | null) {
  if (!dateISO) return "";
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export default function EducationList({
  highestEducationLevel,
  items,
}: {
  highestEducationLevel?: string | null;
  items: Education[];
}) {
  const highest = highestEducationLevel
    ? LEVEL_LABELS[highestEducationLevel] || highestEducationLevel
    : null;

  if (!items?.length && !highest) {
    return (
      <section className="rounded-2xl border glass-card p-4 md:p-6">
        <h3 className="text-sm font-semibold mb-2">Educación</h3>
        <p className="text-sm text-zinc-600">Sin información de escolaridad.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border glass-card p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Educación</h3>
        {highest && (
          <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">
            Nivel máximo: {highest}
          </span>
        )}
      </div>

      <ul className="mt-3 space-y-3">
        {items
          .slice()
          .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
          .map((e) => {
            const start = fmtMonth(e.startDate);
            const end =
              e.status === "ONGOING"
                ? "Actualidad"
                : fmtMonth(e.endDate) || "";
            return (
              <li key={e.id} className="border rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium break-anywhere">
                      {e.institution}
                      {e.program ? (
                        <span className="text-zinc-600"> — {e.program}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-zinc-600">
                      {start || "—"} {start || end ? "–" : ""} {end || "—"}
                      {(e.city || e.country) && (
                        <>
                          {" · "}
                          {e.city || ""}
                          {e.city && e.country ? ", " : ""}
                          {e.country || ""}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex gap-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full border bg-gray-50">
                      {LEVEL_LABELS[e.level || ""] || e.level || "—"}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full border bg-gray-50">
                      {e.status}
                    </span>
                  </div>
                </div>
                {e.grade && (
                  <p className="text-xs text-zinc-600 mt-1">Promedio: {e.grade}</p>
                )}
                {e.description && (
                  <p className="text-sm text-zinc-700 mt-2 whitespace-pre-wrap break-anywhere">
                    {e.description}
                  </p>
                )}
              </li>
            );
          })}
      </ul>
    </section>
  );
}
