// app/auth/signup/recruiter/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastError, toastInfo, toastWarning } from "@/lib/ui/toast";
import { z } from "zod";
import {
  RecruiterSimpleSignupSchema,
  type RecruiterSimpleSignupInput,
} from "@/lib/shared/validation/recruiter/simple";
import { createRecruiterAction } from "./actions";

const SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

export default function RecruiterSignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<RecruiterSimpleSignupInput>({
    companyName: "",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
    size: "1-10",
  });

  const onChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed =
        RecruiterSimpleSignupSchema.parse(form);
      setLoading(true);
      const res = await createRecruiterAction(parsed);
      if (res.ok) {
        toastSuccess(
          res.warningDomain
            ? "Cuenta creada. Revisa tu correo. (Ojo: el dominio del email no coincide con el del sitio)."
            : "Cuenta creada. Revisa tu correo para verificarla."
        );
        router.push("/auth/signin?role=RECRUITER");
      } else {
        toastError(
          res.message || "Error al crear la cuenta"
        );
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toastError(
          err.errors?.[0]?.message || "Datos inválidos"
        );
      } else {
        toastError("Error al crear la cuenta");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-12 max-w-xl rounded-2xl border glass-card p-4 md:p-6">
      <h1 className="mb-2 text-center text-2xl font-semibold">
        Registro de Reclutador
      </h1>
      <p className="mb-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Usa un <b>correo corporativo</b> (no aceptamos dominios gratuitos).
      </p>

      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-4"
      >
        <div>
          <label className="block text-sm font-medium">
            Nombre de la empresa
          </label>
          <input
            name="companyName"
            value={form.companyName}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">
              Nombre(s)
            </label>
            <input
              name="firstName"
              value={form.firstName}
              onChange={onChange}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              Apellidos
            </label>
            <input
              name="lastName"
              value={form.lastName}
              onChange={onChange}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">
            Correo corporativo
          </label>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={onChange}
            placeholder="tu@empresa.com"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">
              Contraseña
            </label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              required
            />
            <p className="mt-1 text-xs text-zinc-500">
              Mín. 8, 1 mayús, 1 min, 1 número
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium">
              Validar contraseña
            </label>
            <input
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={onChange}
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">
            Tamaño de la empresa
          </label>
          <select
            name="size"
            value={form.size}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            required
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {loading
            ? "Creando..."
            : "Crear cuenta y verificar correo"}
        </button>
      </form>
    </div>
  );
}
