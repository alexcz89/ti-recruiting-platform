// app/auth/signup/candidate/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { CandidateSignupSchema } from "@/lib/validation"; // estandarizado
import { createCandidateAction } from "./actions";

type FormValues = {
  name: string;
  email: string;
  password: string;
};

export default function CandidateSignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormValues>({
    name: "",
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = CandidateSignupSchema.parse(form);
      setLoading(true);

      const res = await createCandidateAction(parsed);
      if (res?.ok) {
        toast.success("Cuenta creada. Revisa tu correo para verificarla.");
        router.push("/auth/signin?role=CANDIDATE");
      } else {
        toast.error(res?.error || "Error al crear la cuenta");
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) toast.error(err.errors?.[0]?.message || "Datos inválidos");
      else toast.error("Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border glass-card p-4 md:p-6">
      <h1 className="mb-4 text-center text-2xl font-semibold">Registro de Candidato</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Nombre completo</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            autoComplete="name"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Correo electrónico</label>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Contraseña</label>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            autoComplete="new-password"
            placeholder="Mín. 8, 1 mayús, 1 min, 1 número"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Creando..." : "Crear cuenta"}
        </button>
      </form>
    </div>
  );
}
