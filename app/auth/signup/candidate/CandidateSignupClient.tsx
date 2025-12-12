// app/auth/signup/candidate/CandidateSignupClient.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { signIn } from "next-auth/react";
import {
  CandidateSignupSchema,
  type CandidateSignupInput,
} from "@/lib/validation";
import { createCandidateAction } from "./actions";

// Schema local: agrega confirmPassword y valida que coincida
const CandidateSignupWithConfirmSchema = CandidateSignupSchema.extend({
  confirmPassword: z.string().min(8, "Confirma tu contraseña"),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
  }
);

type CandidateSignupWithConfirmInput = z.infer<
  typeof CandidateSignupWithConfirmSchema
>;

export default function CandidateSignupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromCvBuilder = searchParams?.get("from") === "cv-builder";

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<CandidateSignupWithConfirmInput>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = CandidateSignupWithConfirmSchema.parse(form);
      setLoading(true);

      const { confirmPassword, ...payload } = parsed;

      // 1) Crear cuenta en nuestra BD
      const res = await createCandidateAction(payload as CandidateSignupInput);

      if (!res?.ok) {
        toast.error(res?.error || "Error al crear la cuenta");
        return;
      }

      // 2) Iniciar sesión automáticamente
      const callbackUrl = fromCvBuilder
        ? "/profile/summary?updated=1&cvImported=1"
        : "/jobs";

      const signInRes = await signIn("credentials", {
        redirect: false,
        email: parsed.email,
        password: parsed.password,
        role: "CANDIDATE",
        callbackUrl,
      });

      if (signInRes?.error) {
        toast.error("Cuenta creada, pero hubo un problema al iniciar sesión.");
        router.push("/auth/signin?role=CANDIDATE");
        return;
      }

      toast.success(
        fromCvBuilder
          ? "Cuenta creada. Importamos tu CV a tu perfil 🎉"
          : "Cuenta creada correctamente."
      );

      router.push(signInRes?.url || callbackUrl);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors?.[0]?.message || "Datos inválidos");
      } else {
        toast.error("Error al crear la cuenta");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border glass-card p-4 md:p-6">
      <h1 className="mb-2 text-center text-2xl font-semibold">
        Registro de Candidato
      </h1>

      {fromCvBuilder ? (
        <p className="mb-4 text-center text-xs text-zinc-500">
          Usaremos estos datos para crear tu cuenta y guardar el CV que acabas
          de armar en tu perfil. Después podrás editar todo con calma.
        </p>
      ) : (
        <p className="mb-4 text-center text-xs text-zinc-500">
          Crea tu cuenta para postularte a vacantes y guardar tu CV.
        </p>
      )}

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
          <label className="block text-sm font-medium">
            Correo electrónico
          </label>
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

        <div>
          <label className="block text-sm font-medium">
            Repite tu contraseña
          </label>
          <input
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            autoComplete="new-password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading
            ? fromCvBuilder
              ? "Creando cuenta e importando CV..."
              : "Creando..."
            : fromCvBuilder
            ? "Crear cuenta y guardar CV"
            : "Crear cuenta"}
        </button>

        <p className="mt-2 text-center text-[11px] text-zinc-400">
          Al crear tu cuenta aceptas recibir notificaciones sobre tus
          postulaciones. Nada de spam.
        </p>
      </form>
    </div>
  );
}
