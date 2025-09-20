// app/profile/ProfileForm.tsx
"use client";

import { useMemo, useState, useEffect, useRef } from "react";

/** ---------------------------
 *  Datos base
 *  --------------------------*/
const COUNTRIES = [
  { code: "MX", dial: "52", label: "México (+52)" },
  { code: "US", dial: "1", label: "Estados Unidos (+1)" },
  { code: "AR", dial: "54", label: "Argentina (+54)" },
  { code: "CO", dial: "57", label: "Colombia (+57)" },
  { code: "ES", dial: "34", label: "España (+34)" },
];

const RAW_SKILLS = [
  // Lenguajes
  "Python","Java","C","C++","C#","Go","Rust","Ruby","PHP","Kotlin","Swift","Dart",
  "Julia","Scala","R","Perl","Visual Basic .NET","Objective-C","Assembly","Zig",
  // Web / marcado
  "HTML","CSS","XML","Markdown","LaTeX","Javascript",".NET",
  // Runtimes / frameworks backend
  "Node.js","Django","Flask","FastAPI","Spring Boot","ASP.NET","Ruby on Rails",
  "Laravel","Symfony","Express.js",
  // Mobile
  "React Native","Flutter","Xamarin","Ionic",
  "Native Android (Java/Kotlin)","Native iOS (Swift/Objective-C)",
  // Data/ML/Science
  "TensorFlow","PyTorch","Keras","Scikit-Learn","OpenCV","Apache Spark (MLlib)",
  "Pandas","NumPy","Matplotlib","Seaborn","SciPy","Plotly","D3.js","MATLAB",
  "Simulink","Simulink Test",
  // Cloud / DevOps
  "AWS","Microsoft Azure","Google Cloud Platform","Docker","Kubernetes","Terraform",
  "Ansible","Chef","Puppet","Jenkins","GitLab CI/CD","GitHub Actions",
  // DB/ORM/Query
  "SQL","MySQL","PostgreSQL","Oracle","SQL Server","MongoDB","Cassandra",
  "Couchbase","Redis","DynamoDB","Prisma","Hibernate","SQLAlchemy","Entity Framework","GraphQL",
  // QA / Testing
  "Selenium","Cypress","Puppeteer","JUnit","NUnit","PyTest","TestNG","Postman","Newman",
  // Scripting / Others
  "Bash","PowerShell","LabVIEW","TestStand","VeriStand","dSPACE HIL","Vector CANoe",
  "Arduino IDE","Raspberry Pi GPIO",
];

const SKILLS = Array.from(new Set(RAW_SKILLS)).sort((a, b) =>
  a.localeCompare(b, undefined, { sensitivity: "base" })
);

/** ---------------------------
 *  Tipos de props
 *  --------------------------*/
type Initial = {
  // nombre separado
  firstName: string;
  lastName1: string; // paterno
  lastName2: string; // materno (opcional)
  email: string;

  // Teléfono en partes
  phoneCountry: string; // ej "52"
  phoneLocal: string;   // ej "8112345678"

  location: string;
  birthdate: string;
  linkedin: string;
  github: string;

  // CV
  resumeUrl: string;

  // Skills unificadas
  skills?: string[];
  // certificaciones (opcional)
  certifications?: string[];
};

export default function ProfileForm({
  initial,
  onSubmit,
}: {
  initial: Initial;
  onSubmit: (fd: FormData) => Promise<any>;
}) {
  // Normaliza initial para evitar undefined
  const normalizedInitial = {
    ...initial,
    skills: Array.isArray(initial.skills) ? initial.skills : [],
    certifications: Array.isArray(initial.certifications) ? initial.certifications : [],
  };

  const [form, setForm] = useState<typeof normalizedInitial>(normalizedInitial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  // Si cambian las props initial (SSR → CSR), sincroniza y normaliza
  useEffect(() => {
    setForm({
      ...initial,
      skills: Array.isArray(initial.skills) ? initial.skills : [],
      certifications: Array.isArray(initial.certifications) ? initial.certifications : [],
    });
  }, [initial]);

  const isMX = form.phoneCountry === "52";
  const normalizeDigits = (s: string) => s.replace(/\D+/g, "");

  function handleChange<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /** ----- Skills: búsqueda + selección con chips ----- */
  const [skillQuery, setSkillQuery] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const filteredSkills = useMemo(() => {
    const q = skillQuery.trim().toLowerCase();
    if (!q) return SKILLS.slice(0, 20);
    return SKILLS.filter((s) => s.toLowerCase().includes(q)).slice(0, 30);
  }, [skillQuery]);

  function addSkill(s: string) {
    const existsCI = form.skills!.some((x) => x.toLowerCase() === s.toLowerCase());
    if (!existsCI) {
      handleChange("skills", [...(form.skills || []), s]);
    }
    setSkillQuery("");
  }

  function removeSkill(s: string) {
    handleChange(
      "skills",
      (form.skills || []).filter((x) => x.toLowerCase() !== s.toLowerCase())
    );
  }

  function handleSkillsKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === "Tab") && skillQuery.trim()) {
      e.preventDefault();
      const suggestion = filteredSkills[0];
      addSkill(suggestion || skillQuery.trim());
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validación nombre requerido
    if (!form.firstName.trim() || !form.lastName1.trim()) {
      setError("Nombre y Apellido paterno son obligatorios.");
      return;
    }

    setBusy(true);

    // Validación teléfono (cliente)
    const localDigits = normalizeDigits(form.phoneLocal || "");
    if (isMX && localDigits && localDigits.length !== 10) {
      setBusy(false);
      setError("Para México (+52), el número local debe tener exactamente 10 dígitos.");
      return;
    }
    if (!isMX && localDigits && (localDigits.length < 6 || localDigits.length > 15)) {
      setBusy(false);
      setError("El número local debe tener entre 6 y 15 dígitos.");
      return;
    }

    const fd = new FormData();

    // Nombre separado → lo compone el server (más confiable)
    fd.set("firstName", form.firstName ?? "");
    fd.set("lastName1", form.lastName1 ?? "");
    fd.set("lastName2", form.lastName2 ?? "");

    // Campos simples
    fd.set("location", form.location ?? "");
    fd.set("birthdate", form.birthdate ?? "");
    fd.set("linkedin", form.linkedin ?? "");
    fd.set("github", form.github ?? "");

    // Si no se sube archivo, aún enviamos el URL para compat
    if (!resumeFile && form.resumeUrl) {
      fd.set("resumeUrl", form.resumeUrl);
    }

    // Teléfono en partes
    fd.set("phoneCountry", form.phoneCountry || "52");
    fd.set("phoneLocal", localDigits);

    // Lista única de skills
    fd.set("skills", (form.skills || []).join(", "));

    // Certificaciones (opcional)
    fd.set("certifications", (form.certifications || []).join(", "));

    // Archivo CV (opcional)
    if (resumeFile) {
      fd.set("resume", resumeFile);
    }

    const res = await onSubmit(fd);
    setBusy(false);

    if (res?.error) {
      setError(res.error);
      return;
    }
    // En éxito, el server hace redirect a /profile/summary?updated=1
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" encType="multipart/form-data">
      {/* Nombre separado */}
      <section className="grid md:grid-cols-3 gap-3">
        <div className="grid gap-1">
          <label className="text-sm">Nombre(s) *</label>
          <input
            className="border rounded-xl p-3"
            value={form.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1">
          <label className="text-sm">Apellido paterno *</label>
          <input
            className="border rounded-xl p-3"
            value={form.lastName1}
            onChange={(e) => handleChange("lastName1", e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1">
          <label className="text-sm">Apellido materno</label>
          <input
            className="border rounded-xl p-3"
            value={form.lastName2}
            onChange={(e) => handleChange("lastName2", e.target.value)}
          />
        </div>
      </section>

      {/* Datos básicos */}
      <section className="grid md:grid-cols-2 gap-3">
        {/* Teléfono */}
        <div className="grid gap-1">
          <label className="text-sm">Teléfono</label>
          <div className="flex gap-2">
            <select
              className="border rounded-xl p-3 w-44"
              value={form.phoneCountry}
              onChange={(e) => handleChange("phoneCountry", e.target.value)}
              title="LADA / Código de país"
              autoComplete="tel-country-code"
            >
              {COUNTRIES.map((c) => (
                <option key={c.dial} value={c.dial}>
                  {c.label}
                </option>
              ))}
            </select>

            <input
              key={isMX ? "tel-mx" : `tel-${form.phoneCountry}`}
              type="tel"
              className="border rounded-xl p-3 flex-1"
              placeholder={isMX ? "10 dígitos (solo números)" : "solo dígitos"}
              value={form.phoneLocal}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D+/g, "");
                handleChange("phoneLocal", isMX ? digits.slice(0, 10) : digits.slice(0, 15));
              }}
              onInput={(e) => {
                const t = e.currentTarget as HTMLInputElement;
                const digits = t.value.replace(/\D+/g, "");
                t.value = isMX ? digits.slice(0, 10) : digits.slice(0, 15);
              }}
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={isMX ? 10 : 15}
              minLength={isMX ? 10 : 6}
              pattern={isMX ? "\\d{10}" : "\\d{6,15}"}
              required={Boolean(form.phoneLocal)}
              aria-invalid={
                isMX
                  ? form.phoneLocal.length > 0 && form.phoneLocal.length !== 10
                  : form.phoneLocal.length > 0 &&
                    (form.phoneLocal.length < 6 || form.phoneLocal.length > 15)
              }
            />
          </div>
          <p className="text-xs text-zinc-500">
            {isMX
              ? "Para México (+52) deben ser exactamente 10 dígitos."
              : "Usa de 6 a 15 dígitos según el país."}
          </p>
        </div>

        <div className="grid gap-1">
          <label className="text-sm">Ubicación</label>
          <input
            className="border rounded-xl p-3"
            value={form.location}
            onChange={(e) => handleChange("location", e.target.value)}
            placeholder="CDMX, Remoto, etc."
          />
        </div>

        <div className="grid gap-1">
          <label className="text-sm">Fecha de nacimiento</label>
          <input
            type="date"
            className="border rounded-xl p-3"
            value={form.birthdate}
            onChange={(e) => handleChange("birthdate", e.target.value)}
          />
        </div>

        <div className="grid gap-1">
          <label className="text-sm">LinkedIn</label>
          <input
            className="border rounded-xl p-3"
            value={form.linkedin}
            onChange={(e) => handleChange("linkedin", e.target.value)}
            placeholder="https://www.linkedin.com/in/tu-perfil"
          />
        </div>

        <div className="grid gap-1">
          <label className="text-sm">GitHub</label>
          <input
            className="border rounded-xl p-3"
            value={form.github}
            onChange={(e) => handleChange("github", e.target.value)}
            placeholder="https://github.com/tu-usuario"
          />
        </div>

        {/* CV: subir archivo + mostrar enlace actual si existe */}
        <div className="grid gap-1 md:col-span-2">
          <label className="text-sm">Currículum (PDF/DOC/DOCX)</label>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
            />
            {form.resumeUrl ? (
              <a
                href={form.resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 hover:underline"
                title="Ver CV actual"
              >
                Ver CV actual
              </a>
            ) : (
              <span className="text-xs text-zinc-500">Aún no has subido un CV.</span>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            Si eliges un archivo, reemplazará el CV actual. También puedes dejarlo en blanco para mantenerlo.
          </p>
        </div>
      </section>

      {/* Skills unificadas */}
      <section className="grid gap-2">
        <label className="text-sm font-semibold">Skills / Tecnologías</label>

        {/* Chips seleccionados */}
        {(form.skills || []).length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {(form.skills || []).map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 text-xs bg-gray-100 border rounded-full px-2 py-1"
              >
                {s}
                <button
                  type="button"
                  aria-label={`Quitar ${s}`}
                  className="hover:text-red-600"
                  onClick={() => removeSkill(s)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">Aún no has agregado skills.</p>
        )}

        {/* Buscador de skills */}
        <div className="relative">
          <input
            className="w-full border rounded-xl p-3"
            placeholder="Busca y selecciona (ej. Python, AWS, React Native...)"
            value={skillQuery}
            onChange={(e) => setSkillQuery(e.target.value)}
            onKeyDown={handleSkillsKeyDown}
            aria-autocomplete="list"
            aria-expanded={!!skillQuery}
            aria-controls="skills-suggestions"
          />
          {/* Lista de sugerencias */}
          {skillQuery && (
            <div
              ref={listRef}
              id="skills-suggestions"
              className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-white shadow"
              role="listbox"
            >
              {filteredSkills.length === 0 ? (
                <div className="p-3 text-sm text-zinc-500">Sin resultados</div>
              ) : (
                filteredSkills.map((s) => (
                  <button
                    type="button"
                    key={s}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    onClick={() => addSkill(s)}
                    role="option"
                  >
                    {s}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          Escribe para buscar y presiona Enter/Tab o haz clic en una sugerencia para agregarla.
        </p>
      </section>

      {/* Certificaciones (opcional) */}
      <section className="grid gap-1">
        <label className="text-sm">Certificaciones</label>
        <textarea
          className="border rounded-xl p-3 font-mono"
          rows={3}
          value={(form.certifications || []).join(", ")}
          onChange={(e) =>
            handleChange(
              "certifications",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          placeholder="AWS SAA, CCNA, Scrum Master"
        />
      </section>

      {/* Error */}
      {error && (
        <div className="border border-red-300 bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      <button disabled={busy} className="border rounded-xl px-4 py-2">
        {busy ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
