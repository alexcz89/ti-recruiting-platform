"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { contestLanguageLabel, contestRegistrationSchema, type ContestLanguageValue, type ContestRegistrationInput } from "@/lib/contests/domain";

type ExistingRegistration = {
  assessmentUrl: string | null;
  status: string;
  score: number | null;
  resultUrl: string | null;
  certificateUrl: string | null;
  challengeMessage: string | null;
};

export default function ContestRegistrationForm({
  slug,
  languages,
  registrationOpen,
  closedReason,
  existing,
}: {
  slug: string;
  languages: string[];
  registrationOpen: boolean;
  closedReason: string | null;
  existing: ExistingRegistration | null;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessmentUrl, setAssessmentUrl] = useState(existing?.assessmentUrl ?? null);
  const [registered, setRegistered] = useState(Boolean(existing));
  const [challengeMessage, setChallengeMessage] = useState(existing?.challengeMessage ?? null);
  const { register, handleSubmit: submitForm, formState: { errors } } = useForm<ContestRegistrationInput>({
    resolver: zodResolver(contestRegistrationSchema),
    defaultValues: {
      language: (languages[0] as ContestLanguageValue | undefined) ?? "PYTHON",
      experienceLevel: "JUNIOR",
      city: "",
      linkedinUrl: "",
      githubUrl: "",
      rankingConsent: false,
      jobInterest: false,
      aiToolDisclosure: "",
      aiFreeCategory: false,
    },
  });
  const validationError = Object.values(errors)[0]?.message;

  async function handleRegistration(payload: ContestRegistrationInput) {
    setError(null);

    if (sessionStatus !== "authenticated") {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(`/concursos/${slug}`)}`);
      return;
    }

    const role = String((session?.user as { role?: string })?.role ?? "").toUpperCase();
    if (role !== "CANDIDATE") {
      setError("Regístrate con una cuenta de candidato para participar.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/contests/${encodeURIComponent(slug)}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No pudimos completar el registro");
      setAssessmentUrl(data.assessmentUrl ?? null);
      setChallengeMessage(data.challengeMessage ?? null);
      setRegistered(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos completar el registro");
    } finally {
      setSubmitting(false);
    }
  }

  if (registered) {
    return (
      <div id="registro" className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/30 sm:p-8">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        <h2 className="mt-4 text-2xl font-bold text-zinc-950 dark:text-white">Tu lugar está confirmado</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          Tienes un solo intento de 60 minutos. El cronómetro comienza cuando abras el reto.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {!existing?.resultUrl && !assessmentUrl && challengeMessage ? <p className="sm:col-span-2 text-sm font-medium text-amber-700 dark:text-amber-300">{challengeMessage}</p> : null}
          {existing?.resultUrl ? (
            <a className="btn btn-primary justify-center" href={existing.resultUrl}>Ver resultado</a>
          ) : assessmentUrl ? (
            <a className="btn btn-primary justify-center" href={assessmentUrl}>
              {existing?.status === "IN_PROGRESS" ? "Continuar reto" : "Comenzar reto"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          ) : null}
          <a className="btn btn-ghost justify-center" href="#ranking">Ver ranking</a>
          {existing?.certificateUrl ? <a className="btn btn-ghost justify-center" href={existing.certificateUrl}>Ver certificado</a> : null}
        </div>
      </div>
    );
  }

  return (
    <form id="registro" onSubmit={submitForm(handleRegistration)} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">Registro</p>
      <h2 className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">Participa en el primer challenge</h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Una participación por persona. GitHub es opcional.</p>

      <fieldset disabled={!registrationOpen || submitting} className="mt-6 grid gap-4 sm:grid-cols-2 disabled:opacity-60">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Lenguaje
          <select {...register("language")} required className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-3 dark:border-zinc-700">
            {languages.map((language) => <option key={language} value={language}>{contestLanguageLabel(language)}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Nivel de experiencia
          <select {...register("experienceLevel")} required className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-3 dark:border-zinc-700">
            <option value="JUNIOR">Junior</option>
            <option value="MID">Intermedio</option>
            <option value="SENIOR">Senior</option>
            <option value="LEAD">Lead</option>
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Ciudad
          <input {...register("city")} required maxLength={120} className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-3 dark:border-zinc-700" placeholder="Monterrey, NL" />
        </label>
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          LinkedIn
          <input {...register("linkedinUrl")} required type="url" className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-3 dark:border-zinc-700" placeholder="https://linkedin.com/in/..." />
        </label>
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200 sm:col-span-2">
          GitHub <span className="font-normal text-zinc-400">(opcional)</span>
          <input {...register("githubUrl")} type="url" className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-3 dark:border-zinc-700" placeholder="https://github.com/..." />
        </label>
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200 sm:col-span-2">
          Herramienta de IA que planeas usar <span className="font-normal text-zinc-400">(opcional; se permite con declaración)</span>
          <input {...register("aiToolDisclosure")} maxLength={200} className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-3 dark:border-zinc-700" placeholder="Ej. ChatGPT para consultar documentación" />
        </label>
      </fieldset>

      <div className="mt-5 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
        <label className="flex items-start gap-3"><input className="mt-1" type="checkbox" {...register("rankingConsent")} /> <span>Autorizo mostrar mi nombre abreviado, lenguaje y resultado en el ranking público.</span></label>
        <label className="flex items-start gap-3"><input className="mt-1" type="checkbox" {...register("jobInterest")} /> <span>Me interesa recibir oportunidades laborales relacionadas con mi perfil.</span></label>
        <label className="flex items-start gap-3"><input className="mt-1" type="checkbox" {...register("aiFreeCategory")} /> <span>Quiero participar en la categoría “Código sin IA” y acepto una sesión supervisada o grabada.</span></label>
      </div>

      {validationError && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{String(validationError)}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {!registrationOpen && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{closedReason}</p>}

      <button type="submit" disabled={!registrationOpen || submitting} className="btn btn-primary mt-6 w-full justify-center py-3 disabled:cursor-not-allowed disabled:opacity-50">
        {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registrando…</> : <>Asegurar mi lugar <ArrowRight className="ml-2 h-4 w-4" /></>}
      </button>
    </form>
  );
}