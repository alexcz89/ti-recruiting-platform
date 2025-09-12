// app/dashboard/jobs/JobForm.tsx
"use client";

import { useState } from "react";

const EMPLOYMENT_TYPES = ["FULL_TIME","PART_TIME","CONTRACT","INTERNSHIP"] as const;
const SENIORITIES = ["JUNIOR","MID","SENIOR","LEAD"] as const;

export type JobInitial = {
  title?: string;
  company?: string;
  location?: string;
  employmentType?: string;
  seniority?: string;
  description?: string;
  skills?: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  remote?: boolean;
};

export default function JobForm({
  initial,
  onSubmit,
  submitLabel = "Guardar vacante",
}: {
  initial?: JobInitial;
  onSubmit: (fd: FormData) => Promise<void>;
  submitLabel?: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [employmentType, setEmploymentType] = useState(initial?.employmentType ?? "FULL_TIME");
  const [seniority, setSeniority] = useState(initial?.seniority ?? "MID");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [skills, setSkills] = useState((initial?.skills ?? []).join(", "));
  const [salaryMin, setSalaryMin] = useState(initial?.salaryMin ?? 0);
  const [salaryMax, setSalaryMax] = useState(initial?.salaryMax ?? 0);
  const [currency, setCurrency] = useState(initial?.currency ?? "MXN");
  const [remote, setRemote] = useState(initial?.remote ?? false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("title", title);
    fd.set("company", company);
    fd.set("location", location);
    fd.set("employmentType", employmentType);
    fd.set("seniority", seniority);
    fd.set("description", description);
    fd.set("skills", skills); // coma separada
    fd.set("salaryMin", String(salaryMin || ""));
    fd.set("salaryMax", String(salaryMax || ""));
    fd.set("currency", currency || "");
    fd.set("remote", String(remote));
    await onSubmit(fd);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
      <div className="grid md:grid-cols-2 gap-3">
        <div className="grid gap-2">
          <label className="text-sm">Título *</label>
          <input className="border rounded-xl p-3" value={title} onChange={e=>setTitle(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <label className="text-sm">Empresa *</label>
          <input className="border rounded-xl p-3" value={company} onChange={e=>setCompany(e.target.value)} required />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="grid gap-2">
          <label className="text-sm">Ubicación *</label>
          <input className="border rounded-xl p-3" value={location} onChange={e=>setLocation(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <label className="text-sm">Tipo de contrato *</label>
          <select className="border rounded-xl p-3" value={employmentType} onChange={e=>setEmploymentType(e.target.value)}>
            {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="grid gap-2">
          <label className="text-sm">Seniority *</label>
          <select className="border rounded-xl p-3" value={seniority} onChange={e=>setSeniority(e.target.value)}>
            {SENIORITIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm">Descripción *</label>
        <textarea className="border rounded-xl p-3" rows={8} value={description} onChange={e=>setDescription(e.target.value)} required />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="grid gap-2">
          <label className="text-sm">Skills (separadas por coma)</label>
          <input className="border rounded-xl p-3" value={skills} onChange={e=>setSkills(e.target.value)} placeholder="react, node, sql" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-2">
            <label className="text-sm">Salario mín.</label>
            <input type="number" className="border rounded-xl p-3" value={salaryMin ?? 0} onChange={e=>setSalaryMin(Number(e.target.value))} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm">Salario máx.</label>
            <input type="number" className="border rounded-xl p-3" value={salaryMax ?? 0} onChange={e=>setSalaryMax(Number(e.target.value))} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm">Moneda</label>
            <input className="border rounded-xl p-3" value={currency ?? ""} onChange={e=>setCurrency(e.target.value)} placeholder="MXN" />
          </div>
        </div>
      </div>

      <label className="inline-flex items-center gap-2">
        <input type="checkbox" checked={remote} onChange={e=>setRemote(e.target.checked)} />
        <span className="text-sm">Remoto</span>
      </label>

      <div>
        <button className="border rounded-xl px-4 py-2">{submitLabel}</button>
      </div>
    </form>
  );
}
