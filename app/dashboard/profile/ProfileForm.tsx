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
    phone:       string;
    website:     string;
    jobTitle:    string;
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

  const [jobTitle,    setJobTitle]    = useState(initial.jobTitle    || "");
  const [phone,       setPhone]       = useState(initial.phone       || "");
  const [directPhone, setDirectPhone] = useState(initial.directPhone || "");
  const [website,     setWebsite]     = useState(initial.website     || "");
  const [linkedinUrl, setLinkedinUrl] = useState(initial.linkedinUrl || "");

  const [hasChanges,     setHasChanges]     = useState(false);
  const [isValidWebsite, setIsValidWebsite] = useState(false);
  const [isValidLinkedin,setIsValidLinkedin]= useState(false);

  useEffect(() => {
    setHasChanges(
      jobTitle    !== (initial.jobTitle    || "") ||
      phone       !== (initial.phone       || "") ||
      directPhone !== (initial.directPhone || "") ||
      website     !== (initial.website     || "") ||
      linkedinUrl !== (initial.linkedinUrl || ""),
    );
  }, [jobTitle, phone, directPhone, website, linkedinUrl, initial]);

  useEffect(() => {
    if (!website) { setIsValidWebsite(false); return; }
    try { new URL(normalizeUrl(website)); setIsValidWebsite(true); }
    catch { setIsValidWebsite(false); }
  }, [website]);

  useEffect(() => {
    if (!linkedinUrl) { setIsValidLinkedin(false); return; }
    try {
      const parsed   = new URL(normalizeUrl(linkedinUrl));
      const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
      setIsValidLinkedin(hostname === "linkedin.com" || hostname.endsWith(".linkedin.com"));
    } catch { setIsValidLinkedin(false); }
  }, [linkedinUrl]);

  const handleDiscard = () => {
    setJobTitle(initial.jobTitle    || "");
    setPhone(initial.phone          || "");
    setDirectPhone(initial.directPhone || "");
    setWebsite(initial.website      || "");
    setLinkedinUrl(initial.linkedinUrl || "");
  };

  const profileSummary = useMemo(() => ({
    role:     jobTitle    || "Sin cargo definido",
    website:  website     || "No agregado",
    linkedin: linkedinUrl || "No agregado",
  }), [jobTitle, website, linkedinUrl]);

  return (
    <form
      action={(formData: FormData) => {
        formData.set("jobTitle",    jobTitle);
        formData.set("phone",       phone);
        formData.set("directPhone", directPhone);
        formData.set("website",     normalizeUrl(website));
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
      id="contact"
    >
      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 sm:text-lg">
                Datos de contacto
              </h2>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400 hidden sm:block">
                Mantén actualizada tu información profesional para facilitar la
                comunicación con candidatos y clientes.
              </p>
            </div>

            {/* Status badge — visible on all sizes */}
            <div className="shrink-0">
              {hasChanges ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-900/10 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Pendiente
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-900/10 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Guardado
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="grid gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_260px]">

          {/* Form fields — always first / full width on mobile */}
          <div className="space-y-5">

            {/* Cargo */}
            <div className="space-y-1.5">
              <label htmlFor="job-title" className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Cargo
                <span className="ml-1 text-xs font-normal text-zinc-400">(opcional)</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Briefcase className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  id="job-title"
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Senior Technical Recruiter"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 pl-10 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            {/* Teléfono principal */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
              <PhoneInputField
                value={phone}
                onChange={setPhone}
                label="Teléfono"
                helperText="Guardamos el número en formato internacional para llamadas y WhatsApp."
              />
            </div>

            {/* Teléfono directo */}
            <div className="space-y-1.5">
              <label htmlFor="direct-phone" className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Teléfono directo
                <span className="ml-1 text-xs font-normal text-zinc-400">(opcional)</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <PhoneCall className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  id="direct-phone"
                  type="text"
                  value={directPhone}
                  onChange={(e) => setDirectPhone(e.target.value)}
                  placeholder="+52 81 1234 5678"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 pl-10 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            {/* Sitio web */}
            <div className="space-y-1.5">
              <label htmlFor="website" className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Sitio web
                <span className="ml-1 text-xs font-normal text-zinc-400">(opcional)</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Globe className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  id="website"
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="miempresa.com"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                {website && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3.5">
                    {isValidWebsite
                      ? <Check className="h-4 w-4 text-emerald-600" />
                      : <X     className="h-4 w-4 text-red-500"     />}
                  </div>
                )}
              </div>
              {website && isValidWebsite && (
                <a href={normalizeUrl(website)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400">
                  Vista previa <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            {/* LinkedIn */}
            <div className="space-y-1.5">
              <label htmlFor="linkedin" className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                LinkedIn
                <span className="ml-1 text-xs font-normal text-zinc-400">(opcional)</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Linkedin className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  id="linkedin"
                  type="text"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="linkedin.com/in/tu-perfil"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                {linkedinUrl && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3.5">
                    {isValidLinkedin
                      ? <Check className="h-4 w-4 text-emerald-600" />
                      : <X     className="h-4 w-4 text-red-500"     />}
                  </div>
                )}
              </div>
              {linkedinUrl && isValidLinkedin && (
                <a href={normalizeUrl(linkedinUrl)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400">
                  Abrir perfil <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={pending || !hasChanges}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 sm:w-auto"
              >
                {pending ? <Spinner /> : <Save className="h-4 w-4" />}
                {pending ? "Guardando..." : "Guardar cambios"}
              </button>

              <button
                type="button"
                onClick={handleDiscard}
                disabled={pending || !hasChanges}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:w-auto"
              >
                <Undo2 className="h-4 w-4" />
                Restablecer
              </button>
            </div>
          </div>

          {/* Vista rápida — desktop only */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Vista rápida
              </h3>
              <div className="space-y-2.5">
                {([
                  { label: "Cargo",    value: profileSummary.role     },
                  { label: "Sitio web",value: profileSummary.website  },
                  { label: "LinkedIn", value: profileSummary.linkedin },
                ] as const).map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      {label}
                    </div>
                    <div className="mt-0.5 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </form>
  );
}
