"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { Field, TextInput } from "@/components/form/RhfFields";
import { SignInSchema } from "@/lib/validation";

type FormData = z.infer<typeof SignInSchema>;

export default function SignInCandidateForm({
  initialRole,
  isSignup,
  callbackUrl,
}: {
  initialRole?: "RECRUITER" | "CANDIDATE";
  isSignup?: boolean;
  callbackUrl?: string;
}) {
  const isRecruiter = initialRole === "RECRUITER";

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: isRecruiter ? "recruiter@demo.local" : "candidate@demo.local",
      password: "demo",
    },
  });

  const onSubmit = async (data: FormData) => {
    const res = await signIn("credentials", {
      redirect: false,
      email: data.email,
      password: data.password,
      role: isRecruiter ? "RECRUITER" : "CANDIDATE",
      callbackUrl: callbackUrl || (isRecruiter ? "/dashboard/overview" : "/jobs"),
    });

    if (res?.error) {
      setError("root", { type: "auth", message: "No se pudo iniciar sesión. Verifica tus datos." });
      return;
    }
    window.location.href = res?.url || callbackUrl || (isRecruiter ? "/dashboard/overview" : "/jobs");
  };

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="text-3xl font-semibold">Iniciar sesión</h1>
      <p className="mt-2 text-sm text-zinc-500">
        {isRecruiter ? "Acceso para reclutadores." : "Acceso para talento."}
      </p>

      {!isRecruiter && (
        <>
          <div className="mt-6 space-y-3">
            <button type="button" disabled className="w-full rounded-xl border px-4 py-3 text-sm text-zinc-500">
              Continuar con Google
            </button>
            <button type="button" disabled className="w-full rounded-xl border px-4 py-3 text-sm text-zinc-500">
              Continuar con GitHub
            </button>
          </div>
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
            <span className="text-xs text-zinc-500">o con tu correo</span>
            <div className="h-px flex-1 bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Email" error={errors.email}>
          <TextInput
            register={register}
            name="email"
            type="email"
            placeholder={isRecruiter ? "recruiter@demo.local" : "tu@email.com"}
          />
        </Field>

        <Field label="Password" error={errors.password}>
          <TextInput register={register} name="password" type="password" placeholder="••••••••" />
        </Field>

        {errors.root?.message && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errors.root.message}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60"
        >
          {isSubmitting ? "Ingresando..." : "Ingresar"}
        </button>

        <div className="mt-4 space-y-1 text-xs text-zinc-500">
          {isRecruiter ? (
            <div>
              Recruiter demo: <b>recruiter@demo.local</b> / <b>demo</b>
            </div>
          ) : (
            <>
              <div>
                Candidate demo: <b>candidate@demo.local</b> / <b>demo</b>
              </div>
              <div>
                Admin demo: <b>admin@demo.local</b> / <b>demo</b>
              </div>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
