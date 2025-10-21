"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { ResumePayload } from "@/types/resume";

export default function ResumeWizard({ initial }: { initial?: Partial<ResumePayload> }) {
  const [base, setBase] = useState(initial?.base ?? {});
  const [experiences, setExperiences] = useState<any[]>(initial?.experiences ?? []);
  const [education, setEducation] = useState<any[]>(initial?.education ?? []);
  const [skills, setSkills] = useState<any[]>(initial?.skills ?? []);
  const [languages, setLanguages] = useState<any[]>(initial?.languages ?? []);
  const [certifications, setCertifications] = useState<any[]>(initial?.certifications ?? []);
  const [busy, setBusy] = useState(false);

 async function handleSave(payload: ResumePayload) {
  try {
    const res = await fetch("/api/candidate/resume/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(data);
      toast.error(data?.error || "No se pudo guardar");
      return;
    }
    toast.success("CV guardado correctamente");
    // opcional: router.push("/candidate/profile") o vista previa PDF
  } catch (e) {
    console.error(e);
    toast.error("Error de red");
  }
}
  return (
    <div className="space-y-6">
      {/* Aquí tus pasos/tabs bonitos… base, experiencia, educación, skills, idiomas, certs */}
      {/* …inputs para editar los estados anteriores… */}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={busy}
          className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar CV"}
        </button>
      </div>
    </div>
  );
}
