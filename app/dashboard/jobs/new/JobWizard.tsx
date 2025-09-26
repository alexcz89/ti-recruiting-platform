// app/dashboard/jobs/new/JobWizard.tsx
"use client";

import { useMemo, useState, useRef } from "react";
import clsx from "clsx";
import LocationAutocomplete from "@/components/LocationAutocomplete";

type PresetCompany = { id: string | null; name: string | null };
type Props = {
  onSubmit: (fd: FormData) => Promise<any>;
  presetCompany: PresetCompany;
  skillsOptions: string[];
  certOptions: string[];
};

type LocationType = "REMOTE" | "HYBRID" | "ONSITE";
type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
type Currency = "MXN" | "USD";

const BENEFITS = [
  { key: "aguinaldo", label: "Aguinaldo", def: true },
  { key: "vacaciones", label: "Vacaciones", def: true },
  { key: "primaVac", label: "Prima vacacional", def: true },
  { key: "utilidades", label: "Utilidades", def: true },
  { key: "bonos", label: "Bonos", def: false },
  { key: "vales", label: "Vales de despensa", def: false },
  { key: "fondoAhorro", label: "Fondo de ahorro", def: false },
  { key: "combustible", label: "Combustible", def: false },
  { key: "comedor", label: "Comedor subsidiado", def: false },
  { key: "celular", label: "Celular", def: false },
  { key: "sgmm", label: "SGMM", def: false },
  { key: "vida", label: "Seguro de vida", def: false },
  { key: "auto", label: "Automóvil", def: false },
  { key: "otros", label: "Otros", def: false },
];

// ✅ clase reutilizable para textos largos
const reviewBox =
  "mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words break-all rounded border bg-gray-50 p-2";

export default function JobWizard({ onSubmit, presetCompany, skillsOptions, certOptions }: Props) {
  const [step, setStep] = useState(1);

  // ---------- Paso 1 ----------
  const [title, setTitle] = useState("");
  const [companyMode, setCompanyMode] = useState<"own" | "other" | "confidential">(
    presetCompany?.id ? "own" : "other"
  );
  const [companyOtherName, setCompanyOtherName] = useState("");
  const [locationType, setLocationType] = useState<LocationType>("ONSITE"); // Presencial por defecto
  const [city, setCity] = useState("");
  const [currency, setCurrency] = useState<Currency>("MXN");
  const [salaryMin, setSalaryMin] = useState<string>("");
  const [salaryMax, setSalaryMax] = useState<string>("");
  const [showSalary, setShowSalary] = useState(false);

  const canNext1 = useMemo(() => {
    if (!title.trim()) return false;
    if (companyMode === "other" && !companyOtherName.trim()) return false;
    if ((locationType === "HYBRID" || locationType === "ONSITE") && !city.trim()) return false;
    if (salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax)) return false;
    return true;
  }, [title, companyMode, companyOtherName, locationType, city, salaryMin, salaryMax]);

  // ---------- Paso 2 ----------
  const [employmentType, setEmploymentType] = useState<EmploymentType>("FULL_TIME");
  const [schedule, setSchedule] = useState("");
  const canNext2 = true;

  // ---------- Paso 3 ----------
  const [showBenefits, setShowBenefits] = useState(true);
  const [benefits, setBenefits] = useState<Record<string, boolean>>(
    BENEFITS.reduce((acc, b) => ((acc[b.key] = b.def), acc), {} as Record<string, boolean>)
  );
  const [aguinaldoDias, setAguinaldoDias] = useState<number>(15);
  const [vacacionesDias, setVacacionesDias] = useState<number>(12);
  const [primaVacPct, setPrimaVacPct] = useState<number>(25);

  // ---------- Paso 4 ----------
  const [description, setDescription] = useState("");
  const [responsibilities, setResponsibilities] = useState("");

  const descRef = useRef<HTMLTextAreaElement | null>(null);
  const respRef = useRef<HTMLTextAreaElement | null>(null);
  function insertPrefix(ref: React.RefObject<HTMLTextAreaElement>, prefix: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const lineStart = before.lastIndexOf("\n") + 1;
    const newBefore = before.slice(0, lineStart) + prefix + before.slice(lineStart);
    const newCursor = start + prefix.length;
    el.value = newBefore + after;
    el.setSelectionRange(newCursor, newCursor);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  const [skillQuery, setSkillQuery] = useState("");
  const [addAsRequired, setAddAsRequired] = useState(true);
  const [skills, setSkills] = useState<Array<{ name: string; required: boolean }>>([]);

  const filteredSkills = useMemo(() => {
    const q = skillQuery.trim().toLowerCase();
    const base = skillsOptions || [];
    if (!q) return base.slice(0, 30);
    return base.filter((s) => s.toLowerCase().includes(q)).slice(0, 50);
  }, [skillQuery, skillsOptions]);

  const addSkill = (name: string, required = addAsRequired) => {
    const n = name.trim();
    if (!n) return;
    if (skills.some((s) => s.name.toLowerCase() === n.toLowerCase())) return;
    setSkills((prev) => [...prev, { name: n, required }]);
    setSkillQuery("");
  };
  const toggleSkillType = (name: string) =>
    setSkills((prev) => prev.map((s) => (s.name === name ? { ...s, required: !s.required } : s)));
  const removeSkill = (name: string) => setSkills((prev) => prev.filter((s) => s.name !== name));

  const [certQuery, setCertQuery] = useState("");
  const [certs, setCerts] = useState<string[]>([]);
  const filteredCerts = useMemo(() => {
    const q = certQuery.trim().toLowerCase();
    const base = certOptions || [];
    if (!q) return base.slice(0, 30);
    return base.filter((c) => c.toLowerCase().includes(q)).slice(0, 50);
  }, [certQuery, certOptions]);
  const addCert = (c: string) => {
    const n = c.trim();
    if (!n) return;
    if (certs.some((x) => x.toLowerCase() === n.toLowerCase())) return;
    setCerts((prev) => [...prev, n]);
    setCertQuery("");
  };
  const removeCert = (c: string) => setCerts((prev) => prev.filter((x) => x !== c));

  const canNext4 = description.replace(/\s+/g, "").length >= 50;

  // ---------- Submit ----------
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setError(null);
    setBusy(true);

    const fd = new FormData();
    // p1
    fd.set("title", title.trim());
    fd.set("companyMode", companyMode);
    fd.set("companyOtherName", companyOtherName.trim());
    fd.set("locationType", locationType);
    fd.set("city", city.trim());
    fd.set("currency", currency);
    if (salaryMin) fd.set("salaryMin", String(Math.max(0, Number(salaryMin))));
    if (salaryMax) fd.set("salaryMax", String(Math.max(0, Number(salaryMax))));
    fd.set("showSalary", String(showSalary));
    // p2
    fd.set("employmentType", employmentType);
    if (schedule) fd.set("schedule", schedule);
    // p3
    const benefitsPayload = {
      ...benefits,
      aguinaldoDias,
      vacacionesDias,
      primaVacPct,
      showBenefits,
    };
    fd.set("showBenefits", String(showBenefits));
    fd.set("benefitsJson", JSON.stringify(benefitsPayload));
    // p4
    fd.set("description", description.trim());
    fd.set("responsibilities", responsibilities.trim());
    fd.set("skillsJson", JSON.stringify(skills));
    fd.set("certsJson", JSON.stringify(certs));

    const res = await onSubmit(fd);
    setBusy(false);
    if (res?.error) setError(res.error);
  }

  return (
    <div className="space-y-6">
      {/* pasos */}
      <ol className="flex items-center gap-2 text-xs">
        {[1, 2, 3, 4, 5].map((n) => (
          <li
            key={n}
            className={clsx(
              "px-2 py-1 rounded-full",
              n <= step ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-700"
            )}
          >
            Paso {n}
          </li>
        ))}
      </ol>

      {/* Paso 1 */}
      {step === 1 && (
        <section className="grid gap-4 rounded-xl border p-4">
          <h3 className="font-semibold">1) Datos básicos</h3>
          <div className="grid gap-1">
            <label className="text-sm">Nombre de la vacante *</label>
            <input className="rounded-md border p-2" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid gap-1">
            <label className="text-sm">Empresa *</label>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="companyMode"
                  value="own"
                  checked={companyMode === "own"}
                  onChange={() => setCompanyMode("own")}
                  disabled={!presetCompany?.id}
                />
                <span>Mi empresa {presetCompany?.name ? `(${presetCompany.name})` : "(no asignada)"}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="companyMode"
                  value="other"
                  checked={companyMode === "other"}
                  onChange={() => setCompanyMode("other")}
                />
                <span>Publicar a nombre de otra empresa</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="companyMode"
                  value="confidential"
                  checked={companyMode === "confidential"}
                  onChange={() => setCompanyMode("confidential")}
                />
                <span>Confidencial</span>
              </label>
            </div>
            {companyMode === "other" && (
              <input
                className="mt-2 rounded-md border p-2"
                placeholder="Nombre de la empresa"
                value={companyOtherName}
                onChange={(e) => setCompanyOtherName(e.target.value)}
              />
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="text-sm">Ubicación *</label>
              <select
                className="rounded-md border p-2"
                value={locationType}
                onChange={(e) => setLocationType(e.target.value as LocationType)}
              >
                <option value="REMOTE">Remoto</option>
                <option value="HYBRID">Híbrido</option>
                <option value="ONSITE">Presencial</option>
              </select>
              {(locationType === "HYBRID" || locationType === "ONSITE") && (
                <div className="mt-2">
                  <LocationAutocomplete
                    value={city}
                    onChange={setCity}
                    countries={["mx"]}
                    placeholder="Ciudad de la vacante (ej. CDMX, Monterrey)"
                    className="w-full rounded-md border p-2"
                  />
                </div>
              )}
            </div>

            <div className="grid gap-1">
              <label className="text-sm">Sueldo (opcional)</label>
              <div className="flex gap-2">
                <select className="w-28 rounded-md border p-2" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
                <input className="flex-1 rounded-md border p-2" type="number" placeholder="Mín." value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} min={0} />
                <input className="flex-1 rounded-md border p-2" type="number" placeholder="Máx." value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} min={0} />
              </div>
              <label className="mt-1 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showSalary} onChange={(e) => setShowSalary(e.target.checked)} />
                {/* texto actualizado */}
                Mostrar sueldo
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button className="rounded-md border px-4 py-2" disabled>
              Atrás
            </button>
            <button
              className={clsx("rounded-md px-4 py-2 text-white", canNext1 ? "bg-emerald-600 hover:bg-emerald-500" : "bg-emerald-300")}
              disabled={!canNext1}
              onClick={() => setStep(2)}
            >
              Siguiente
            </button>
          </div>
        </section>
      )}

      {/* Paso 2 */}
      {step === 2 && (
        <section className="grid gap-4 rounded-xl border p-4">
          <h3 className="font-semibold">2) Tipo de empleo</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="text-sm">Tipo *</label>
              <select className="rounded-md border p-2" value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}>
                <option value="FULL_TIME">Tiempo completo</option>
                <option value="PART_TIME">Medio tiempo</option>
                <option value="CONTRACT">Por periodo</option>
                <option value="INTERNSHIP">Prácticas profesionales</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Horario (opcional)</label>
              <input className="rounded-md border p-2" placeholder="Ej. L-V 9:00–18:00" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-between">
            <button className="rounded-md border px-4 py-2" onClick={() => setStep(1)}>
              Atrás
            </button>
            <button className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500" onClick={() => setStep(3)}>
              Siguiente
            </button>
          </div>
        </section>
      )}

      {/* Paso 3 */}
      {step === 3 && (
        <section className="grid gap-4 rounded-xl border p-4">
          <h3 className="font-semibold">3) Prestaciones</h3>

          <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-3 flex items-center justify-between">
            <div className="text-sm">
              <strong>Visibilidad:</strong> Mostrar prestaciones en la publicación
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showBenefits} onChange={(e) => setShowBenefits(e.target.checked)} />
              {showBenefits ? "Sí" : "No"}
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {BENEFITS.map((b) => {
              const checked = !!benefits[b.key];
              const setChecked = (val: boolean) => setBenefits((prev) => ({ ...prev, [b.key]: val }));

              return (
                <div key={b.key} className="rounded-md border p-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                    {b.label}
                  </label>

                  {b.key === "aguinaldo" && checked && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span>Días:</span>
                      <input type="number" min={0} className="w-24 rounded border p-1" value={aguinaldoDias} onChange={(e) => setAguinaldoDias(Number(e.target.value || 0))} />
                    </div>
                  )}
                  {b.key === "vacaciones" && checked && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span>Días:</span>
                      <input type="number" min={0} className="w-24 rounded border p-1" value={vacacionesDias} onChange={(e) => setVacacionesDias(Number(e.target.value || 0))} />
                    </div>
                  )}
                  {b.key === "primaVac" && checked && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span>%:</span>
                      <input type="number" min={0} max={100} className="w-24 rounded border p-1" value={primaVacPct} onChange={(e) => setPrimaVacPct(Number(e.target.value || 0))} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-between">
            <button className="rounded-md border px-4 py-2" onClick={() => setStep(2)}>
              Atrás
            </button>
            <button className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500" onClick={() => setStep(4)}>
              Siguiente
            </button>
          </div>
        </section>
      )}

      {/* Paso 4 */}
      {step === 4 && (
        <section className="grid gap-4 rounded-xl border p-4">
          <h3 className="font-semibold">4) Descripción, responsabilidades y skills</h3>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-600">Formato rápido:</span>
            <button type="button" className="rounded border px-2 py-1 hover:bg-gray-50" onClick={() => insertPrefix(descRef, "• ")}>• Viñeta (Descripción)</button>
            <button type="button" className="rounded border px-2 py-1 hover:bg-gray-50" onClick={() => insertPrefix(descRef, "1. ")}>1. Número (Descripción)</button>
            <span className="mx-2 text-zinc-300">|</span>
            <button type="button" className="rounded border px-2 py-1 hover:bg-gray-50" onClick={() => insertPrefix(respRef, "• ")}>• Viñeta (Resp.)</button>
            <button type="button" className="rounded border px-2 py-1 hover:bg-gray-50" onClick={() => insertPrefix(respRef, "1. ")}>1. Número (Resp.)</button>
          </div>

          <div className="grid gap-1">
            <label className="text-sm">Descripción de la vacante *</label>
            <textarea ref={descRef} className="min-h-[140px] rounded-md border p-3" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe la posición, equipo, retos, etc. (mín. 50 caracteres)" />
            <div className={clsx("text-xs", canNext4 ? "text-emerald-600" : "text-zinc-500")}>
              {description.replace(/\s+/g, "").length} / 50
            </div>
          </div>

          <div className="grid gap-1">
            <label className="text-sm">Responsabilidades (opcional)</label>
            <textarea ref={respRef} className="min-h-[100px] rounded-md border p-3" value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} placeholder="Lista breve de responsabilidades (puedes usar viñetas o números)" />
          </div>

          {/* Skills */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm">Skills / Lenguajes</label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={addAsRequired} onChange={(e) => setAddAsRequired(e.target.checked)} />
                Agregar como <b>{addAsRequired ? "Obligatoria" : "Deseable"}</b>
              </label>
            </div>

            <div className="relative">
              <input
                className="w-full rounded-md border p-2"
                placeholder="Busca (ej. Python, AWS, React Native...) y selecciona"
                value={skillQuery}
                onChange={(e) => setSkillQuery(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === "Tab") && skillQuery.trim()) {
                    e.preventDefault();
                    addSkill(filteredSkills[0] || skillQuery.trim(), addAsRequired);
                  }
                }}
              />
              {skillQuery && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white shadow">
                  {filteredSkills.length === 0 ? (
                    <div className="p-2 text-sm text-zinc-500">Sin resultados</div>
                  ) : (
                    filteredSkills.map((s) => (
                      <button key={s} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => addSkill(s, addAsRequired)}>
                        {s}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {skills.length ? (
              <div className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <span
                    key={s.name}
                    className={clsx(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                      s.required ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-zinc-100 text-zinc-700 border-zinc-200"
                    )}
                  >
                    {s.name}
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={s.required} onChange={() => toggleSkillType(s.name)} />
                      Obligatoria
                    </label>
                    <button type="button" className="text-red-600" onClick={() => removeSkill(s.name)} title="Quitar">×</button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Aún no has agregado skills.</p>
            )}
          </div>

          {/* Certificaciones */}
          <div className="grid gap-2">
            <label className="text-sm">Certificaciones (opcional)</label>
            <div className="relative">
              <input
                className="w-full rounded-md border p-2"
                placeholder="Busca y selecciona (ej. AWS SAA, CCNA...)"
                value={certQuery}
                onChange={(e) => setCertQuery(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === "Tab") && certQuery.trim()) {
                    e.preventDefault();
                    addCert(filteredCerts[0] || certQuery.trim());
                  }
                }}
              />
              {certQuery && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white shadow">
                  {filteredCerts.length === 0 ? (
                    <div className="p-2 text-sm text-zinc-500">Sin resultados</div>
                  ) : (
                    filteredCerts.map((c) => (
                      <button key={c} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => addCert(c)}>
                        {c}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {certs.length ? (
              <div className="flex flex-wrap gap-2">
                {certs.map((c) => (
                  <span key={c} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
                    {c}
                    <button type="button" className="text-red-600" onClick={() => removeCert(c)} title="Quitar">×</button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Opcional.</p>
            )}
          </div>

          <div className="flex justify-between">
            <button className="rounded-md border px-4 py-2" onClick={() => setStep(3)}>
              Atrás
            </button>
            <button className={clsx("rounded-md px-4 py-2 text-white", canNext4 ? "bg-emerald-600 hover:bg-emerald-500" : "bg-emerald-300")} disabled={!canNext4} onClick={() => setStep(5)}>
              Siguiente
            </button>
          </div>
        </section>
      )}

      {/* Paso 5 */}
      {step === 5 && (
        <section className="grid gap-4 rounded-xl border p-4">
          <h3 className="font-semibold">5) Revisión y publicación</h3>

          <div className="grid gap-3 text-sm">
            <div><strong>Vacante:</strong> {title}</div>
            <div>
              <strong>Empresa:</strong>{" "}
              {companyMode === "own" ? (presetCompany?.name || "Mi empresa") : companyMode === "confidential" ? "Confidencial" : companyOtherName}
            </div>
            <div>
              <strong>Ubicación:</strong>{" "}
              {locationType === "REMOTE" ? "Remoto" : `${locationType === "HYBRID" ? "Híbrido" : "Presencial"} · ${city}`}
            </div>
            <div>
              <strong>Sueldo:</strong>{" "}
              {salaryMin || salaryMax ? `${currency} ${salaryMin || "—"} - ${salaryMax || "—"} ${showSalary ? "(visible)" : "(oculto)"}` : "No especificado"}
            </div>
            <div><strong>Tipo:</strong> {labelEmployment(employmentType)}</div>
            {schedule && <div><strong>Horario:</strong> {schedule}</div>}
            <div><strong>Prestaciones visibles:</strong> {showBenefits ? "Sí" : "No"}</div>
            {showBenefits && (
              <ul className="ml-4 list-disc">
                {Object.entries(benefits)
                  .filter(([, v]) => v)
                  .map(([k]) => {
                    if (k === "aguinaldo") return <li key={k}>Aguinaldo: {aguinaldoDias} días</li>;
                    if (k === "vacaciones") return <li key={k}>Vacaciones: {vacacionesDias} días</li>;
                    if (k === "primaVac") return <li key={k}>Prima vacacional: {primaVacPct}%</li>;
                    const lbl = BENEFITS.find((b) => b.key === k)?.label ?? k;
                    return <li key={k}>{lbl}</li>;
                  })}
              </ul>
            )}

            <div>
              <strong>Descripción:</strong>
              <div className={reviewBox}>{description || "—"}</div>
            </div>

            {responsibilities && (
              <div>
                <strong>Responsabilidades:</strong>
                <div className={reviewBox}>{responsibilities}</div>
              </div>
            )}

            <div>
              <strong>Skills:</strong>{" "}
              {skills.length ? skills.map((s) => `${s.required ? "Req" : "Dese"}: ${s.name}`).join(", ") : "—"}
            </div>
            <div>
              <strong>Certificaciones:</strong>{" "}
              {certs.length ? certs.join(", ") : "—"}
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* ✅ barra de acciones fija para no perder el botón */}
          <div className="sticky bottom-0 mt-2 -mx-4 border-t bg-white/90 px-4 py-3 backdrop-blur">
            <div className="flex justify-between">
              <button className="rounded-md border px-4 py-2" onClick={() => setStep(4)}>
                Atrás
              </button>
              <button
                className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:bg-emerald-300"
                disabled={busy}
                onClick={handlePublish}
              >
                {busy ? "Publicando..." : "Publicar vacante"}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function labelEmployment(e: EmploymentType) {
  switch (e) {
    case "FULL_TIME": return "Tiempo completo";
    case "PART_TIME": return "Medio tiempo";
    case "CONTRACT":  return "Por periodo";
    case "INTERNSHIP":return "Prácticas profesionales";
  }
}
