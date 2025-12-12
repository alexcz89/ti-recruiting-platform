// app/auth/signin/SignInRecruiterForm.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { recruiterSignInSchema } from "@/lib/validation/recruiter/signin";

type Props = {
  callbackUrl?: string;
  showEmailOnly?: boolean;
};

export default function SignInRecruiterForm({ callbackUrl, showEmailOnly = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = recruiterSignInSchema.parse(form);
      setLoading(true);

      const res = await signIn("credentials", {
        redirect: false,
        email: parsed.email,
        password: parsed.password,
        role: "RECRUITER",
        callbackUrl: callbackUrl || "/dashboard/overview",
      });

      if (res?.error) {
        toast.error("Correo o contraseña incorrectos");
      } else {
        toast.success("Bienvenido de nuevo");
        router.push(res?.url || "/dashboard/overview");
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors?.[0]?.message || "Datos inválidos");
      } else {
        toast.error("Error al iniciar sesión");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border glass-card p-4 md:p-6">
      <h1 className="mb-4 text-center text-2xl font-semibold text-zinc-800 dark:text-zinc-100">
        Acceso para reclutadores
      </h1>
      <p className="mb-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Usa tu correo corporativo para ingresar a tu panel.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Correo corporativo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={handleChange}
            placeholder="tu@empresa.com"
            className="mt-1 w-full rounded-lg border border-zinc-300 glass-card p-4 md:p-6"
          />
        </div>

        {!showEmailOnly && (
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border border-zinc-300 glass-card p-4 md:p-6"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Ingresando..." : "Iniciar sesión"}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
        ¿Aún no tienes cuenta?{" "}
        <a href="/auth/signup/recruiter" className="text-emerald-600 hover:underline dark:text-emerald-400">
          Crear cuenta
        </a>
      </div>
    </div>
  );
}
