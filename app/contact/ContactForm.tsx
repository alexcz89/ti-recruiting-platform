"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import React, { useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";

import { ANALYTICS_EVENTS, track } from "@/lib/analytics";
import {
  DemoRequestSchema,
  type DemoRequestInput,
} from "@/lib/contact/demo-request";

type SubmissionState = "idle" | "error" | "success";

const defaultValues: DemoRequestInput = {
  name: "",
  company: "",
  email: "",
  role: "",
  hiringNeeds: "",
  message: "",
  website: "",
};

export default function ContactForm() {
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [submissionError, setSubmissionError] = useState("");
  const startedRef = useRef(false);
  const submittingRef = useRef(false);
  const submittedRef = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DemoRequestInput>({
    resolver: zodResolver(DemoRequestSchema),
    defaultValues,
  });

  function markStarted() {
    if (startedRef.current) return;
    startedRef.current = true;
    track(ANALYTICS_EVENTS.demoRequestStarted);
  }

  async function submit(values: DemoRequestInput) {
    if (submittingRef.current || submittedRef.current) return;

    submittingRef.current = true;
    setSubmissionState("idle");
    setSubmissionError("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string; ok?: boolean }
        | null;

      if (!response.ok || result?.ok !== true) {
        throw new Error(
          result?.error || "No pudimos enviar tu solicitud. Intenta de nuevo.",
        );
      }

      submittedRef.current = true;
      track(ANALYTICS_EVENTS.demoRequestSubmitted);
      setSubmissionState("success");
    } catch (error) {
      setSubmissionState("error");
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "No pudimos enviar tu solicitud. Intenta de nuevo.",
      );
    } finally {
      submittingRef.current = false;
    }
  }

  if (submissionState === "success") {
    return (
      <div
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
        role="status"
      >
        <h2 className="text-xl font-semibold">Solicitud recibida</h2>
        <p className="mt-2 leading-7">
          Gracias. Recibimos tu solicitud y te contactaremos pronto.
        </p>
      </div>
    );
  }

  return (
    <form
      className="relative rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-950"
      noValidate
      onChangeCapture={markStarted}
      onSubmit={handleSubmit(submit)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Nombre" error={errors.name?.message} required>
          <input
            {...register("name")}
            autoComplete="name"
            className={inputClass}
            id="name"
            maxLength={80}
            aria-required="true"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
        </Field>

        <Field id="company" label="Empresa" error={errors.company?.message} required>
          <input
            {...register("company")}
            autoComplete="organization"
            className={inputClass}
            id="company"
            maxLength={100}
            aria-required="true"
            aria-invalid={Boolean(errors.company)}
            aria-describedby={errors.company ? "company-error" : undefined}
          />
        </Field>

        <Field id="email" label="Correo de trabajo" error={errors.email?.message} required>
          <input
            {...register("email")}
            autoComplete="email"
            className={inputClass}
            id="email"
            inputMode="email"
            maxLength={254}
            type="email"
            aria-required="true"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
        </Field>

        <Field id="role" label="Cargo" error={errors.role?.message}>
          <input
            {...register("role")}
            autoComplete="organization-title"
            className={inputClass}
            id="role"
            maxLength={80}
            aria-invalid={Boolean(errors.role)}
            aria-describedby={errors.role ? "role-error" : undefined}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field
          id="hiringNeeds"
          label="¿Qué perfiles necesitas contratar?"
          error={errors.hiringNeeds?.message}
          required
        >
          <textarea
            {...register("hiringNeeds")}
            className={`${inputClass} min-h-28 resize-y`}
            id="hiringNeeds"
            maxLength={300}
            placeholder="Ej. Backend Python, Data Engineer, QA Automation..."
            aria-required="true"
            aria-invalid={Boolean(errors.hiringNeeds)}
            aria-describedby={errors.hiringNeeds ? "hiringNeeds-error" : undefined}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field id="message" label="Mensaje adicional" error={errors.message?.message}>
          <textarea
            {...register("message")}
            className={`${inputClass} min-h-24 resize-y`}
            id="message"
            maxLength={1000}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? "message-error" : undefined}
          />
        </Field>
      </div>

      <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="website">Sitio web</label>
        <input {...register("website")} autoComplete="off" id="website" tabIndex={-1} />
      </div>

      <div className="mt-5" aria-live="polite">
        {submissionState === "error" ? (
          <p className="mb-4 text-sm text-red-700 dark:text-red-300" role="alert">
            {submissionError}
          </p>
        ) : null}

        <button
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 dark:focus-visible:outline-emerald-400"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Enviando…" : "Solicitar demo"}
        </button>
      </div>
    </form>
  );
}

function Field({
  children,
  error,
  id,
  label,
  required = false,
}: {
  children: ReactNode;
  error?: string;
  id: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100" htmlFor={id}>
        {label}
        {required ? <span className="ml-1 text-red-600" aria-hidden="true">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-sm text-red-700 dark:text-red-300" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  "block min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-slate-700 focus:ring-2 focus:ring-slate-700/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300 dark:focus:ring-zinc-300/15";
