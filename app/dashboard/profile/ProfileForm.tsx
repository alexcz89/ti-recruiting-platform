"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Briefcase,
  Check,
  CheckCircle2,
  ExternalLink,
  Globe,
  Linkedin,
  Loader2,
  PhoneCall,
  Save,
  Undo2,
  X,
} from "lucide-react";

import { toastError, toastSuccess } from "@/lib/ui/toast";
import PhoneInputField from "@/components/PhoneInputField";
import { saveRecruiterProfile } from "./actions";

type Props = {
  initial: {
    phone: string;
    website: string;
    jobTitle: string;
    linkedinUrl: string;
    directPhone: string;
  };
};

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;
}

function normalizeUrl(url: string) {
  if (!url) return "";
  return url.startsWith("http") ? url : `https://${url}`;
}

export default function ProfileForm({ initial }: Props) {
  const [pending, startTransition] = useTransition();

  const [jobTitle, setJobTitle] = useState(initial.jobTitle || "");
  const [phone, setPhone] = useState(initial.phone || "");
  const [directPhone, setDirectPhone] = useState(initial.directPhone || "");
  const [website, setWebsite] = useState(initial.website || "");
  const [linkedinUrl, setLinkedinUrl] = useState(initial.linkedinUrl || "");

  const [hasChanges, setHasChanges] = useState(false);
  const [isValidWebsite, setIsValidWebsite] = useState(false);
  const [isValidLinkedin, setIsValidLinkedin] = useState(false);

  useEffect(() => {
    const changed =
      jobTitle !== (initial.jobTitle || "") ||
      phone !== (initial.phone || "") ||
      directPhone !== (initial.directPhone || "") ||
      website !== (initial.website || "") ||
      linkedinUrl !== (initial.linkedinUrl || "");

    setHasChanges(changed);
  }, [jobTitle, phone, directPhone, website, linkedinUrl, initial]);

  useEffect(() => {
    if (!website) {
      setIsValidWebsite(false);
      return;
    }

    try {
      new URL(normalizeUrl(website));
      setIsValidWebsite(true);
    } catch {
      setIsValidWebsite(false);
    }
  }, [website]);

  useEffect(() => {
    if (!linkedinUrl) {
      setIsValidLinkedin(false);
      return;
    }

    try {
      const parsed = new URL(normalizeUrl(linkedinUrl));
      const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();

      setIsValidLinkedin(
        hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")
      );
    } catch {
      setIsValidLinkedin(false);
    }
  }, [linkedinUrl]);

  const handleDiscard = () => {
    setJobTitle(initial.jobTitle || "");
    setPhone(initial.phone || "");
    setDirectPhone(initial.directPhone || "");
    setWebsite(initial.website || "");
    setLinkedinUrl(initial.linkedinUrl || "");
  };

  const profileSummary = useMemo(() => {
    return {
      role: jobTitle || "Sin cargo definido",
      website: website || "No agregado",
      linkedin: linkedinUrl || "No agregado",
    };
  }, [jobTitle, website, linkedinUrl]);

  return (
    <form
      action={(formData: FormData) => {
        formData.set("jobTitle", jobTitle);
        formData.set("phone", phone);
        formData.set("directPhone", directPhone);
        formData.set("website", normalizeUrl(website));
        formData.set("linkedinUrl", normalizeUrl(linkedinUrl));

        startTransition(async () => {
          const res = await saveRecruiterProfile(null as any, formData);

          if (res?.ok) {
            toastSuccess(res.message || "Perfil actualizado");
            setHasChanges(false);
          } else {
            toastError(res?.message || "Error al guardar");
          }
        });
      }}
      className="space-y-6"
      id="contact"
    >
      <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-4 py-5 dark:border-zinc-800 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Contact settings
              </div>

              <h2 className="mt-3 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-2xl">
                Datos de contacto
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                Mantén actualizada tu información profesional para facilitar la
                comunicación con candidatos, clientes y tu equipo.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:min-w-[420px]">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Cargo
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {profileSummary.role}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Estado
                </div>
                <div className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {hasChanges ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Cambios pendientes
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Actualizado
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="order-2 lg:order-1">
            <div className="rounded-[24px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">
              <div className="space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="job-title"
                    className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    Cargo
                    <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      (opcional)
                    </span>
                  </label>

                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <Briefcase className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                    </div>

                    <input
                      id="job-title"
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="Senior Technical Recruiter"
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 pl-11 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </div>

                  <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    Ayuda a identificar tu rol dentro del proceso de reclutamiento.
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <PhoneInputField
                    value={phone}
                    onChange={setPhone}
                    label="Teléfono"
                    helperText="Guardamos el número en formato internacional para que funcionen mejor llamadas y WhatsApp."
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="direct-phone"
                    className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    Teléfono directo
                    <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      (opcional)
                    </span>
                  </label>

                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <PhoneCall className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                    </div>

                    <input
                      id="direct-phone"
                      type="text"
                      value={directPhone}
                      onChange={(e) => setDirectPhone(e.target.value)}
                      placeholder="+52 81 1234 5678"
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 pl-11 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </div>

                  <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    Úsalo si quieres separar tu contacto principal del número directo.
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="website"
                    className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    Sitio web
                    <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      (opcional)
                    </span>
                  </label>

                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <Globe className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                    </div>

                    <input
                      id="website"
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="miempresa.com"
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 pl-11 pr-11 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-zinc-800 dark:bg-zinc-950"
                    />

                    {website && (
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                        {isValidWebsite ? (
                          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      Puedes escribir <span className="font-medium">miempresa.com</span> o la URL completa.
                    </p>

                    {website && isValidWebsite && (
                      <a
                        href={normalizeUrl(website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        Vista previa
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="linkedin"
                    className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    LinkedIn
                    <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      (opcional)
                    </span>
                  </label>

                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <Linkedin className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                    </div>

                    <input
                      id="linkedin"
                      type="text"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="linkedin.com/in/tu-perfil"
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 pl-11 pr-11 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-zinc-800 dark:bg-zinc-950"
                    />

                    {linkedinUrl && (
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                        {isValidLinkedin ? (
                          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      Agrega tu perfil profesional para generar más confianza.
                    </p>

                    {linkedinUrl && isValidLinkedin && (
                      <a
                        href={normalizeUrl(linkedinUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        Abrir perfil
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800 sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  type="submit"
                  disabled={pending || !hasChanges}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {pending ? <Spinner /> : <Save className="h-4 w-4" />}
                  {pending ? "Guardando..." : "Guardar cambios"}
                </button>

                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={pending || !hasChanges}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                >
                  <Undo2 className="h-4 w-4" />
                  Restablecer
                </button>

                <div className="text-xs text-zinc-500 dark:text-zinc-400 sm:ml-auto">
                  {hasChanges ? (
                    <span className="inline-flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Cambios pendientes
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Todo está guardado
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className="order-1 lg:order-2">
            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Vista rápida
                </h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  Un resumen compacto de tu presencia profesional.
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Cargo
                  </div>
                  <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {profileSummary.role}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Sitio web
                  </div>
                  <div className="mt-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {profileSummary.website}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    LinkedIn
                  </div>
                  <div className="mt-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {profileSummary.linkedin}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </form>
  );
}