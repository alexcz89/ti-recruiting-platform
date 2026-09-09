"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { ArrowRight, CheckCircle2, Loader2, Mail, UserRound } from "lucide-react";
import {
  MEXICO_TIMEZONES,
  contestLanguageLabel,
  contestRegistrationSchema,
  isContestRegistrationLanguage,
  type ContestRegistrationInput,
} from "@/lib/contests/domain";

type ExistingRegistration = {
  assessmentUrl: string | null;
  status: string;
  score: number | null;
  resultUrl: string | null;
  certificateUrl: string | null;
  challengeMessage: string | null;
};

type SessionUser = {
  name?: string | null;
  email?: string | null;
  role?: string;
};

const inputClass = "mt-2 min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:disabled:bg-zinc-900";
const errorClass = "mt-1.5 text-sm text-red-700 dark:text-red-300";

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessmentUrl, setAssessmentUrl] = useState(existing?.assessmentUrl ?? null);
  const [registered, setRegistered] = useState(Boolean(existing));
  const [challengeMessage, setChallengeMessage] = useState(existing?.challengeMessage ?? null);
  const sessionUser = session?.user as SessionUser | undefined;
  const isCandidate = sessionStatus === "authenticated" && String(sessionUser?.role ?? "").toUpperCase() === "CANDIDATE";
  const callbackUrl = `/concursos/${slug}#registro`;
  const registrationLanguages = languages.filter(
    isContestRegistrationLanguage,
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContestRegistrationInput>({
    resolver: zodResolver(contestRegistrationSchema) as Resolver<ContestRegistrationInput>,
    mode: "onBlur",
    defaultValues: {
      language: registrationLanguages[0] ?? "PYTHON",
      city: "",
      countryCode: "MX",
      timezone: "America/Mexico_City",
      yearsExperience: 0,
      experienceLevel: "JUNIOR",
      linkedinUrl: "",
      githubUrl: "",
      rankingConsent: false,
      jobInterest: false,
      aiToolDisclosure: "",
      aiFreeCategory: false,
      eligibilityConfirmed: false,
      termsAccepted: false,
      privacyAccepted: false,
    },
  });

  async function submitRegistration(payload: ContestRegistrationInput) {
    setError(null);
    if (!isCandidate) return;

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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos completar el registro");
    } finally {
      setSubmitting(false);
    }
  }

  if (registered) {
    return (
      <div id="registro" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900/60 dark:bg-emerald-950/30 sm:p-8">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-bold text-zinc-950 dark:text-white">Registro confirmado</h2>
        <p className="mt-2 text-base leading-7 text-zinc-700 dark:text-zinc-300">
          Tu cuenta está vinculada al challenge. Una vez iniciado, tendrás un solo intento continuo de 60 minutos.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {!existing?.resultUrl && !assessmentUrl && challengeMessage ? (
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{challengeMessage}</p>
          ) : null}
          {existing?.resultUrl ? (
            <a className="btn btn-primary min-h-11 justify-center" href={existing.resultUrl}>Ver resultado</a>
          ) : assessmentUrl ? (
            <a className="btn btn-primary min-h-11 justify-center" href={assessmentUrl}>
              {existing?.status === "IN_PROGRESS" ? "Continuar reto" : "Comenzar reto"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : null}
          <a className="btn btn-ghost min-h-11 justify-center" href="#ranking">Ver ranking</a>
          {existing?.certificateUrl ? <a className="btn btn-ghost min-h-11 justify-center" href={existing.certificateUrl}>Ver certificado</a> : null}
        </div>
      </div>
    );
  }

  return (
    <form id="registro" onSubmit={handleSubmit(submitRegistration)} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
      <h2 className="text-2xl font-bold text-zinc-950 dark:text-white">Registro al challenge</h2>
      <p className="mt-2 text-base leading-7 text-zinc-600 dark:text-zinc-400">
        Edición para estudiantes, recién egresados y perfiles junior con máximo dos años de experiencia profesional en México.
      </p>

      <div className="mt-6 rounded-xl bg-zinc-100 p-4 dark:bg-zinc-950">
        {sessionStatus === "authenticated" ? (
          <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <p className="flex items-center gap-2"><UserRound className="h-4 w-4 text-emerald-600" aria-hidden="true" /><strong>{sessionUser?.name || "Candidato TaskIO"}</strong></p>
            <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-emerald-600" aria-hidden="true" />{sessionUser?.email || "Correo verificado en tu cuenta"}</p>
            {!isCandidate ? <p className="font-medium text-red-700 dark:text-red-300">Necesitas una cuenta con rol de candidato para participar.</p> : null}
          </div>
        ) : (
          <div>
            <p className="font-semibold text-zinc-900 dark:text-white">Accede con tu cuenta TaskIO</p>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">La cuenta confirma tu identidad, guarda el progreso y permite comunicar resultados.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="btn btn-primary min-h-11">Iniciar sesión</Link>
              <Link href="/auth/signup/candidate" className="btn btn-ghost min-h-11">Crear cuenta de candidato</Link>
            </div>
          </div>
        )}
      </div>

      <fieldset disabled={!isCandidate || !registrationOpen || submitting} className="mt-6 grid gap-5 disabled:opacity-60 sm:grid-cols-2">
        <input type="hidden" {...register("countryCode")} />
        <input type="hidden" {...register("experienceLevel")} />

        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Lenguaje
          <select {...register("language")} className={inputClass}>
            {registrationLanguages.map((language) => <option key={language} value={language}>{contestLanguageLabel(language)}</option>)}
          </select>
          {errors.language ? <span className={errorClass}>{errors.language.message}</span> : null}
        </label>

        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Experiencia profesional
          <select {...register("yearsExperience", { valueAsNumber: true })} className={inputClass}>
            <option value={0}>Sin experiencia profesional</option>
            <option value={1}>Hasta 1 año</option>
            <option value={2}>Entre 1 y 2 años</option>
          </select>
          {errors.yearsExperience ? <span className={errorClass}>{errors.yearsExperience.message}</span> : null}
        </label>

        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Ciudad
          <input {...register("city")} maxLength={120} className={inputClass} placeholder="Monterrey, Nuevo León" />
          {errors.city ? <span className={errorClass}>{errors.city.message}</span> : null}
        </label>

        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          País
          <input value="México" readOnly className={inputClass} />
        </label>

        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200 sm:col-span-2">
          Zona horaria
          <select {...register("timezone")} className={inputClass}>
            {MEXICO_TIMEZONES.map((timezone) => <option key={timezone.value} value={timezone.value}>{timezone.label}</option>)}
          </select>
          {errors.timezone ? <span className={errorClass}>{errors.timezone.message}</span> : null}
        </label>

        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200 sm:col-span-2">
          LinkedIn
          <input {...register("linkedinUrl")} type="url" className={inputClass} placeholder="https://linkedin.com/in/..." />
          {errors.linkedinUrl ? <span className={errorClass}>{errors.linkedinUrl.message}</span> : null}
        </label>

        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200 sm:col-span-2">
          GitHub <span className="font-normal text-zinc-500">(opcional)</span>
          <input {...register("githubUrl")} type="url" className={inputClass} placeholder="https://github.com/..." />
          {errors.githubUrl ? <span className={errorClass}>{errors.githubUrl.message}</span> : null}
        </label>

        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200 sm:col-span-2">
          Herramienta de IA que planeas usar <span className="font-normal text-zinc-500">(opcional)</span>
          <input {...register("aiToolDisclosure")} maxLength={200} className={inputClass} placeholder="Ej. ChatGPT para consultar documentación" />
        </label>
      </fieldset>

      <div className="mt-6 space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <label className="flex min-h-11 items-start gap-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950">
          <input className="mt-1 h-4 w-4" type="checkbox" {...register("eligibilityConfirmed")} />
          <span>Confirmo que vivo en México y tengo máximo dos años de experiencia profesional.</span>
        </label>
        {errors.eligibilityConfirmed ? <p className={errorClass}>{errors.eligibilityConfirmed.message}</p> : null}

        <label className="flex min-h-11 items-start gap-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950">
          <input className="mt-1 h-4 w-4" type="checkbox" {...register("termsAccepted")} />
          <span>Acepto las <a href="#reglas" className="font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-300">bases y reglas del challenge</a>.</span>
        </label>
        {errors.termsAccepted ? <p className={errorClass}>{errors.termsAccepted.message}</p> : null}

        <label className="flex min-h-11 items-start gap-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950">
          <input className="mt-1 h-4 w-4" type="checkbox" {...register("privacyAccepted")} />
          <span>Acepto el <Link href="/privacy" className="font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-300">aviso de privacidad</Link>.</span>
        </label>
        {errors.privacyAccepted ? <p className={errorClass}>{errors.privacyAccepted.message}</p> : null}
      </div>

      <div className="mt-5 border-t border-zinc-200 pt-5 text-sm leading-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        <p className="mb-3 font-semibold text-zinc-800 dark:text-zinc-200">Permisos opcionales</p>
        <label className="flex min-h-11 items-start gap-3"><input className="mt-1 h-4 w-4" type="checkbox" {...register("rankingConsent")} /><span>Autorizo mostrar mi nombre abreviado, lenguaje y resultado en el ranking público.</span></label>
        <label className="mt-2 flex min-h-11 items-start gap-3"><input className="mt-1 h-4 w-4" type="checkbox" {...register("jobInterest")} /><span>Autorizo incluir mi perfil en el directorio de talento de TaskIO.</span></label>
        <label className="mt-2 flex min-h-11 items-start gap-3"><input className="mt-1 h-4 w-4" type="checkbox" {...register("aiFreeCategory")} /><span>Quiero participar en la distinción “Código sin IA” y acepto una sesión supervisada o grabada.</span></label>
      </div>

      {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}
      {!registrationOpen ? <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{closedReason}</p> : null}

      {isCandidate ? (
        <button type="submit" disabled={!registrationOpen || submitting} className="btn btn-primary mt-6 min-h-12 w-full justify-center px-5 disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Registrando…</> : <>Registrarme al challenge <ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
        </button>
      ) : null}
    </form>
  );
}