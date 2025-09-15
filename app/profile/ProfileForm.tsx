"use client";

import { useState } from "react";

const COUNTRIES = [
  { code: "MX", dial: "52", label: "México (+52)" },
  { code: "US", dial: "1", label: "Estados Unidos (+1)" },
  { code: "AR", dial: "54", label: "Argentina (+54)" },
  { code: "CO", dial: "57", label: "Colombia (+57)" },
  { code: "ES", dial: "34", label: "España (+34)" },
  // agrega más si los necesitas
];

type Initial = {
  name: string;
  email: string;
  // Teléfono separado en partes
  phoneCountry: string; // ej "52"
  phoneLocal: string;   // ej "8112345678"
  location: string;
  birthdate: string;
  linkedin: string;
  github: string;
  resumeUrl: string;
  frontend: string[];
  backend: string[];
  mobile: string[];
  cloud: string[];
  database: string[];
  cybersecurity: string[];
  testing: string[];
  ai: string[];
  certifications: string[];
};

export default function ProfileForm({
  initial,
  onSubmit,
}: {
  initial: Initial;
  onSubmit: (fd: FormData) => Promise<any>; // ← leemos posible { error }
}) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeDigits = (s: string) => s.replace(/\D+/g, "");
  const isMX = form.phoneCountry === "52";

  function handleChange<K extends keyof Initial>(key: K, value: Initial[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    // --- Validación de teléfono (cliente) ---
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

    // Campos simples
    fd.set("name", form.name ?? "");
    fd.set("location", form.location ?? "");
    fd.set("birthdate", form.birthdate ?? "");
    fd.set("linkedin", form.linkedin ?? "");
    fd.set("github", form.github ?? "");
    fd.set("resumeUrl", form.resumeUrl ?? "");

    // Teléfono en partes (el server los combinará a E.164)
    fd.set("phoneCountry", form.phoneCountry || "52");
    fd.set("phoneLocal", normalizeDigits(form.phoneLocal || ""));

    // Arrays (como CSV)
    fd.set("frontend", (form.frontend || []).join(", "));
    fd.set("backend", (form.backend || []).join(", "));
    fd.set("mobile", (form.mobile || []).join(", "));
    fd.set("cloud", (form.cloud || []).join(", "));
    fd.set("database", (form.database || []).join(", "));
    fd.set("cybersecurity", (form.cybersecurity || []).join(", "));
    fd.set("testing", (form.testing || []).join(", "));
    fd.set("ai", (form.ai || []).join(", "));
    fd.set("certifications", (form.certifications || []).join(", "));

    // Ejecuta la Server Action y revisa respuesta (posible error)
    const res = await onSubmit(fd);
    setBusy(false);

    if (res?.error) {
      setError(res.error);
      return;
    }
    // En éxito, el server redirige a /profile/summary
  }

  function textAreaField(label: string, key: keyof Initial, placeholder: string) {
    const value = (form[key] as string[]).join(", ");
    return (
      <div className="grid gap-1">
        <label className="text-sm">{label}</label>
        <textarea
          className="border rounded-xl p-3 font-mono"
          rows={2}
          value={value}
          onChange={(e) =>
            handleChange(
              key as any,
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean) as any
            )
          }
          placeholder={placeholder}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Datos básicos */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="grid gap-1">
          <label className="text-sm">Nombre</label>
          <input
            className="border rounded-xl p-3"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        {/* Teléfono con selector de país */}
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

            {/* Input con remount por país + corte en vivo */}
            <input
              key={isMX ? "tel-mx" : `tel-${form.phoneCountry}`} // remonta al cambiar país
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
              required={Boolean(form.phoneLocal)} // si escribe algo, debe cumplir el patrón
              aria-invalid={
                isMX
                  ? form.phoneLocal.length > 0 && form.phoneLocal.length !== 10
                  : form.phoneLocal.length > 0 && (form.phoneLocal.length < 6 || form.phoneLocal.length > 15)
              }
            />
          </div>
          <p className="text-xs text-zinc-500">
            {isMX
              ? "Para México (+52) deben ser exactamente 10 dígitos."
              : "Usa de 6 a 15 dígitos según el país."}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
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
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="grid gap-1">
          <label className="text-sm">LinkedIn</label>
          <input
            className="border rounded-xl p-3"
            value={form.linkedin}
            onChange={(e) => handleChange("linkedin", e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <label className="text-sm">GitHub</label>
          <input
            className="border rounded-xl p-3"
            value={form.github}
            onChange={(e) => handleChange("github", e.target.value)}
          />
        </div>
      </div>

      {/* Skills por categorías */}
      <h2 className="font-semibold mt-6">Skills</h2>
      {textAreaField("Frontend", "frontend", "React, Angular, Vue")}
      {textAreaField("Backend", "backend", "Node.js, .NET, Java")}
      {textAreaField("Móviles", "mobile", "Android, iOS, React Native")}
      {textAreaField("Cloud", "cloud", "AWS, Azure, GCP")}
      {textAreaField("Bases de Datos", "database", "PostgreSQL, MySQL, MongoDB")}
      {textAreaField("Ciberseguridad", "cybersecurity", "CompTIA Security+, SIEM")}
      {textAreaField("Testing / QA", "testing", "Selenium, Cypress")}
      {textAreaField("IA / Machine Learning", "ai", "Python, TensorFlow, ML.NET")}

      {/* Certificaciones */}
      <h2 className="font-semibold mt-6">Certificaciones</h2>
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

      {/* Error de validación */}
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
