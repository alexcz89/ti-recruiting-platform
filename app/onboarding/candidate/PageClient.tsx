// app/onboarding/candidate/PageClient.tsx
"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Plus, Sparkles, FileText, Loader2, CheckCircle2 } from "lucide-react";
import {
  OnboardingCandidateStep2Schema,
  OnboardingCandidateStep3Schema,
  type OnboardingCandidateStep2Input,
  type OnboardingCandidateStep3Input,
} from "@/lib/shared/validation/candidate/onboarding";
import {
  saveCandidateStep1,
  saveCandidateStep2,
  saveCandidateStep3,
} from "./actions";
import { toastSuccess, toastError } from "@/lib/ui/toast";
import PhoneInputField from "@/components/PhoneInputField";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { StepSkills } from "./StepSkills";

type Step = 1 | 2 | 3 | 4;

interface Props {
  userName?: string;
  initialStep?: number;
  initialSkills?: string[];
  initialPhone?: string;
  initialCerts?: string[];
  initialLocation?: string;
  skillOptions?: string[];
  certOptions?: string[];
}

export default function CandidateOnboardingPage({
  userName = "",
  initialStep = 1,
  initialSkills = [],
  initialPhone = "",
  initialCerts = [],
  initialLocation = "",
  skillOptions = [],
  certOptions = [],
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(
    Math.min(Math.max(initialStep, 1), 4) as Step
  );
  const [pending, startTransition] = useTransition();
  const [cvState, setCvState] = useState<"idle" | "parsing" | "done">("idle");
  const [certInput, setCertInput] = useState("");
  const [certDropdownOpen, setCertDropdownOpen] = useState(false);

  const firstName = userName.split(" ")[0];

  // ── Step 2: Skills ──
  const form2 = useForm<OnboardingCandidateStep2Input>({
    resolver: zodResolver(OnboardingCandidateStep2Schema),
    defaultValues: { skills: initialSkills },
  });
  const selectedSkills: string[] = form2.watch("skills") ?? [];

  // ── Step 3: Contact ──
  const form3 = useForm<OnboardingCandidateStep3Input>({
    resolver: zodResolver(OnboardingCandidateStep3Schema),
    defaultValues: { phone: initialPhone, certs: initialCerts, location: initialLocation },
  });
  const certs: string[] = useMemo(
    () => form3.watch("certs") ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form3.watch("certs")]
  );

  // ── Cert autocomplete ──
  const filteredCerts = useMemo(() => {
    const q = certInput.trim().toLowerCase();
    const chosen = new Set(certs.map((c) => c.toLowerCase()));
    return (q ? certOptions.filter((c) => c.toLowerCase().includes(q)) : certOptions)
      .filter((c) => !chosen.has(c.toLowerCase()))
      .slice(0, 20);
  }, [certInput, certOptions, certs]);

  function addCert(label?: string) {
    const val = (label ?? certInput).trim();
    if (!val) return;
    const current = form3.getValues("certs") ?? [];
    if (!current.map((c) => c.toLowerCase()).includes(val.toLowerCase())) {
      form3.setValue("certs", [...current, val]);
    }
    setCertInput("");
    setCertDropdownOpen(false);
  }

  function removeCert(cert: string) {
    form3.setValue(
      "certs",
      (form3.getValues("certs") ?? []).filter((c) => c !== cert)
    );
  }

  // ── Handlers ──
  function handleCvParsed(cvUrl?: string) {
    startTransition(async () => {
      const res = await saveCandidateStep1(cvUrl).catch((e) => ({
        ok: false,
        error: e?.message,
      }));
      if ((res as any)?.ok) {
        toastSuccess("CV analizado correctamente");
        setStep(2);
      } else {
        toastError((res as any)?.error || "Error al guardar");
        setCvState("idle");
      }
    });
  }

  const submitStep2 = (values: OnboardingCandidateStep2Input) => {
    startTransition(async () => {
      const res = await saveCandidateStep2(values).catch((e) => ({
        ok: false,
        error: e?.message,
      }));
      if ((res as any)?.ok) {
        setStep(3);
      } else {
        toastError((res as any)?.error || "Error al guardar");
      }
    });
  };

  const submitStep3 = (values: OnboardingCandidateStep3Input) => {
    startTransition(async () => {
      const res = await saveCandidateStep3(values).catch((e) => ({
        ok: false,
        error: e?.message,
      }));
      if ((res as any)?.ok) {
        toastSuccess("¡Listo! Tu perfil está configurado");
        router.push("/jobs");
      } else {
        toastError((res as any)?.error || "Error al guardar");
      }
    });
  };

  async function parseCv(file: File) {
    setCvState("parsing");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ai/cv/upload-and-parse", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toastError(err?.error || "Error al analizar el CV. Intenta de nuevo.");
        setCvState("idle");
        return;
      }

      const data = await res.json();

      if (Array.isArray(data.analysis?.skills) && data.analysis.skills.length > 0) {
        const current = form2.getValues("skills") ?? [];
        const merged = [...new Set([...current, ...data.analysis.skills])];
        form2.setValue("skills", merged);
      }

      if (data.analysis?.phonePrimary && !form3.getValues("phone")) {
        form3.setValue("phone", data.analysis.phonePrimary);
      }

      if (data.analysis?.location && !form3.getValues("location")) {
        form3.setValue("location", data.analysis.location);
      }

      if (data.analysis?.phoneWarning) {
        toastError(data.analysis.phoneWarning);
      }

      setCvState("done");
      handleCvParsed(data.url);
    } catch {
      toastError("Error al analizar el CV. Intenta de nuevo.");
      setCvState("idle");
    }
  }

  return (
    <div className="mx-auto max-w-lg py-10 px-4">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-1">
          TASK<span className="text-emerald-600">IO</span>
        </p>
        <h1 className="text-2xl font-semibold">
          {step === 1 && (firstName ? `Hola, ${firstName}. Sube tu CV` : "Sube tu CV")}
          {step === 2 && "Tus skills"}
          {step === 3 && "Contacto y ubicación"}
          {step === 4 && "¡Perfil listo!"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {step === 1 && "La IA extrae tu experiencia y skills automáticamente."}
          {step === 2 && "Los reclutadores filtran por tecnología. Sé específico."}
          {step === 3 && "Para que los reclutadores te contacten y encuentren vacantes cerca de ti."}
          {step === 4 && "Puedes editar todo desde tu perfil en cualquier momento."}
        </p>
      </div>

      {/* Step pills */}
      <div className="mb-8 flex gap-1.5">
        {([1, 2, 3, 4] as Step[]).map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              s <= step ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-700"
            }`}
          />
        ))}
      </div>

      {/* ── STEP 1: CV ── */}
      {step === 1 && (
        <div className="rounded-2xl border glass-card p-4 md:p-6">
          <div className="flex gap-2.5 items-start bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 rounded-xl px-3.5 py-3 mb-5">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
              El parser analiza tu CV y llena los campos automáticamente — experiencia, skills, educación y más.
            </p>
          </div>

          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file && cvState === "idle") parseCv(file);
            }}
            className={`
              flex flex-col items-center justify-center gap-3
              border-2 border-dashed rounded-xl py-10 px-6 cursor-pointer
              transition-all duration-200 mb-4
              ${cvState === "done"
                ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 pointer-events-none"
                : cvState === "parsing"
                ? "border-emerald-300 bg-emerald-50/50 pointer-events-none"
                : "border-zinc-200 dark:border-zinc-700 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
              }
            `}
          >
            <input
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              disabled={cvState !== "idle"}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) parseCv(file);
              }}
            />
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors
              ${cvState === "done" ? "bg-emerald-500" : "bg-zinc-100 dark:bg-zinc-800"}`}
            >
              {cvState === "parsing" ? (
                <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
              ) : cvState === "done" ? (
                <CheckCircle2 className="w-6 h-6 text-white" />
              ) : (
                <FileText className="w-6 h-6 text-zinc-400" />
              )}
            </div>
            <div className="text-center">
              <p className={`text-sm font-medium mb-0.5 ${
                cvState === "done"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-zinc-700 dark:text-zinc-300"
              }`}>
                {cvState === "idle" && "Arrastra o toca para subir"}
                {cvState === "parsing" && "Analizando tu CV…"}
                {cvState === "done" && "¡CV analizado correctamente!"}
              </p>
              <p className="text-xs text-zinc-400">
                {cvState === "idle" && "PDF o DOCX — máx 5 MB"}
                {cvState === "parsing" && "Extrayendo experiencia y skills"}
                {cvState === "done" && "Experiencia, skills y educación extraídas"}
              </p>
            </div>
          </label>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
            <span className="text-xs text-zinc-400">o sin CV</span>
            <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full rounded-lg border px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          >
            Llenar manualmente
          </button>
        </div>
      )}

      {/* ── STEP 2: Skills ── */}
      {step === 2 && (
        <form
          onSubmit={form2.handleSubmit(submitStep2)}
          className="rounded-2xl border glass-card p-4 md:p-6"
        >
          <StepSkills
            skills={selectedSkills}
            onChange={(s) => form2.setValue("skills", s)}
            skillOptions={skillOptions}
          />

          <div className="flex items-center justify-between gap-3">
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
                onClick={() => setStep(3)}
                className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:underline"
              >
                Saltar por ahora
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {pending ? "Guardando…" : "Continuar"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── STEP 3: Contact + Location + Certs ── */}
      {step === 3 && (
        <form
          onSubmit={form3.handleSubmit(submitStep3)}
          className="rounded-2xl border glass-card p-4 md:p-6"
        >
          <div className="grid grid-cols-1 gap-4">

            {/* Teléfono con selector de lada */}
            <PhoneInputField
              label="Teléfono"
              helperText="Para que empresas puedan contactarte por WhatsApp"
              value={form3.watch("phone") ?? ""}
              onChange={(val) => form3.setValue("phone", val)}
              error={form3.formState.errors.phone?.message}
            />

            {/* Ubicación */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Ubicación{" "}
                <span className="text-xs font-normal text-zinc-400">(opcional)</span>
              </label>
              <LocationAutocomplete
                value={form3.watch("location") ?? ""}
                onChange={(val) => form3.setValue("location", val)}
                placeholder="Ciudad o estado"
                className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Te mostraremos vacantes cerca de ti y opciones remotas
              </p>
            </div>

            {/* Certificaciones con autocomplete */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Certificaciones{" "}
                <span className="text-xs font-normal text-zinc-400">(opcional)</span>
              </label>

              {certs.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-2">
                  {certs.map((c) => (
                    <div
                      key={c}
                      className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="flex-1 text-zinc-700 dark:text-zinc-300">{c}</span>
                      <button
                        type="button"
                        onClick={() => removeCert(c)}
                        className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <input
                    value={certInput}
                    onChange={(e) => {
                      setCertInput(e.target.value);
                      setCertDropdownOpen(true);
                    }}
                    onFocus={() => setCertDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setCertDropdownOpen(false), 150)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addCert())
                    }
                    placeholder="ej. AWS Solutions Architect"
                    className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />

                  {certDropdownOpen && filteredCerts.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
                      {filteredCerts.map((c) => (
                        <li key={c}>
                          <button
                            type="button"
                            onMouseDown={() => addCert(c)}
                            className="w-full px-3 py-2 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                          >
                            {c}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => addCert()}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Atrás
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => submitStep3({ phone: "", certs: [], location: "" })}
                className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:underline"
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

      {/* ── STEP 4: Done ── */}
      {step === 4 && (
        <div className="rounded-2xl border glass-card p-4 md:p-6 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-sm text-zinc-500 mb-6">
            Puedes editar experiencia laboral, educación e idiomas desde tu perfil.
          </p>
          <button
            onClick={() => router.push("/jobs")}
            className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition"
          >
            Ver vacantes →
          </button>
        </div>
      )}
    </div>
  );
}