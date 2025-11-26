// app/onboarding/company/page.tsx
"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  OnboardingCompanyStep1Schema,
  OnboardingCompanyStep2Schema,
  SIZE_OPTIONS,
  type OnboardingCompanyStep1Input,
  type OnboardingCompanyStep2Input,
} from "@/lib/validation/recruiter/onboarding";
import { saveCompanyStep1, saveCompanyStep2 } from "./actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Step = 1 | 2;

export default function CompanyOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [pending, startTransition] = useTransition();

  // STEP 1 form
  const form1 = useForm<OnboardingCompanyStep1Input>({
    resolver: zodResolver(OnboardingCompanyStep1Schema),
    defaultValues: { companyName: "", size: undefined as any },
  });

  // STEP 2 form — industry y description siguen existiendo en el front,
  // pero NO se enviarán al backend porque Company no tiene esos campos.
  const form2 = useForm<OnboardingCompanyStep2Input>({
    resolver: zodResolver(OnboardingCompanyStep2Schema),
    defaultValues: {
      country: "",
      city: "",
      website: "",
      industry: "",      // ❗ Se usa en UI, pero no se guardará en DB
      description: "",   // ❗ Se usa en UI, pero no se guardará en DB
    },
  });

  const submitStep1 = (values: OnboardingCompanyStep1Input) => {
    startTransition(async () => {
      const res = await saveCompanyStep1(values).catch((e) => ({
        ok: false,
        error: e?.message,
      }));

      if ((res as any)?.ok) {
        toast.success("Empresa guardada");
        setStep(2);
      } else {
        toast.error((res as any)?.error || "Error al guardar");
      }
    });
  };

  const submitStep2 = (values: OnboardingCompanyStep2Input) => {
    startTransition(async () => {
      // 👇 limpiamos los campos que NO existen en Company
      const payload = {
        country: values.country,
        city: values.city,
        website: values.website,
        logoUrl: undefined, // si algún día quieres añadir upload
      };

      const res = await saveCompanyStep2(payload as any).catch((e) => ({
        ok: false,
        error: e?.message,
      }));

      if ((res as any)?.ok) {
        toast.success("¡Listo! Onboarding completado");
        router.push("/dashboard");
      } else {
        toast.error((res as any)?.error || "Error al guardar");
      }
    });
  };

  return (
    <div className="mx-auto max-w-2xl py-10">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Configura tu empresa</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Solo pedimos lo esencial. Podrás completar el resto más tarde.
        </p>
      </div>

      {/* Steps indicator */}
      <div className="mb-8 flex items-center gap-3 text-sm">
        <StepDot active={step === 1}>Empresa</StepDot>
        <div className="h-px flex-1 bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
        <StepDot active={step === 2}>Detalles</StepDot>
      </div>

      {step === 1 ? (
        /* ------------ STEP 1 ------------ */
        <form
          onSubmit={form1.handleSubmit(submitStep1)}
          className="rounded-2xl border glass-card p-4 md:p-6"
        >
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Nombre comercial
              </label>
              <input
                {...form1.register("companyName")}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Mi Empresa S.A."
              />
              {form1.formState.errors.companyName && (
                <p className="mt-1 text-xs text-red-600">
                  {form1.formState.errors.companyName.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Tamaño</label>
              <select
                {...form1.register("size")}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                defaultValue=""
              >
                <option value="" disabled>
                  Selecciona…
                </option>
                {SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {form1.formState.errors.size && (
                <p className="mt-1 text-xs text-red-600">
                  {form1.formState.errors.size.message}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending ? "Guardando…" : "Continuar"}
            </button>
          </div>
        </form>
      ) : (
        /* ------------ STEP 2 ------------ */
        <form
          onSubmit={form2.handleSubmit(submitStep2)}
          className="rounded-2xl border glass-card p-4 md:p-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Country */}
            <div>
              <label className="mb-1 block text-sm font-medium">País</label>
              <input
                {...form2.register("country")}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="México"
              />
            </div>

            {/* City */}
            <div>
              <label className="mb-1 block text-sm font-medium">Ciudad</label>
              <input
                {...form2.register("city")}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Monterrey"
              />
            </div>

            {/* Website */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">
                Sitio web (opcional)
              </label>
              <input
                {...form2.register("website")}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="https://miempresa.com"
              />
            </div>

            {/* Industry – UI only */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Industria (solo informativo)
              </label>
              <input
                {...form2.register("industry")}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Tecnología / Software"
              />
            </div>

            {/* Description – UI only */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">
                Descripción (solo informativo)
              </label>
              <textarea
                {...form2.register("description")}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Describe brevemente a la empresa (máx. 240 caracteres)"
                rows={3}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Atrás
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => (window.location.href = "/dashboard")}
                className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:underline"
              >
                Saltar por ahora
              </button>

              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {pending ? "Guardando…" : "Finalizar"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

function StepDot({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-2.5 w-2.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-zinc-300"
        }`}
      />
      <span className={active ? "font-medium" : "text-zinc-500"}>
        {children}
      </span>
    </div>
  );
}
