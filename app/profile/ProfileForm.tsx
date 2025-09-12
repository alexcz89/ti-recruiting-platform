"use client";

import { useState } from "react";

type Initial = {
  name: string;
  email: string;
  phone: string;
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
  onSubmit: (fd: FormData) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);

  function handleChange(key: keyof Initial, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData();
    for (const [key, value] of Object.entries(form)) {
      if (Array.isArray(value)) {
        fd.set(key, value.join(", "));
      } else {
        fd.set(key, value ?? "");
      }
    }
    await onSubmit(fd); // el server action puede redirigir a /profile/summary
    setBusy(false);
    // Si tu server action redirige, esta alerta no se verá; si no, te sirve de feedback:
    // alert("Perfil actualizado ✅");
  }

  // --- Subida de CV: envía el archivo a /api/upload y guarda la URL resultante en resumeUrl
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = new FormData();
    data.set("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: data });
      const json = await res.json();
      if (res.ok && json?.url) {
        setForm((prev) => ({ ...prev, resumeUrl: json.url }));
        alert("CV subido ✅");
      } else {
        alert(json?.error ?? "No se pudo subir el archivo");
      }
    } catch (err) {
      alert("Error al subir el archivo");
    } finally {
      // limpia el input file para permitir re-subidas del mismo nombre si hace falta
      e.target.value = "";
    }
  }

  function textAreaField(label: string, key: keyof Initial, placeholder: string) {
    return (
      <div className="grid gap-1">
        <label className="text-sm">{label}</label>
        <textarea
          className="border rounded-xl p-3 font-mono"
          rows={2}
          value={(form[key] as string[]).join(", ")}
          onChange={(e) => handleChange(key, e.target.value)}
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
        <div className="grid gap-1">
          <label className="text-sm">Teléfono</label>
          <input
            className="border rounded-xl p-3"
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
          />
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

      {/* CV: subir archivo o pegar URL */}
      <div className="grid gap-1">
        <label className="text-sm">CV</label>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleUpload}
          />
          <span className="text-xs text-zinc-500">o pega una URL</span>
        </div>
        <input
          className="border rounded-xl p-3"
          value={form.resumeUrl}
          onChange={(e) => setForm((prev) => ({ ...prev, resumeUrl: e.target.value }))}
          placeholder="/uploads/mi-cv.pdf o https://..."
        />
        {!!form.resumeUrl && (
          <a
            href={form.resumeUrl}
            target="_blank"
            className="text-xs text-blue-600 hover:underline"
          >
            Ver CV
          </a>
        )}
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
        value={form.certifications.join(", ")}
        onChange={(e) => handleChange("certifications", e.target.value)}
        placeholder="AWS SAA, CCNA, Scrum Master"
      />

      <button disabled={busy} className="border rounded-xl px-4 py-2">
        {busy ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
