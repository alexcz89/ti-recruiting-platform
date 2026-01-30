// app/auth/signup/candidate/CandidateSignupClient.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toastSuccess, toastError, toastInfo, toastWarning } from "@/lib/ui/toast";
import { z } from "zod";
import {
  CandidateSignupSchema,
  type CandidateSignupInput,
} from "@/lib/validation";
import { createCandidateAction } from "./actions";
import { Eye, EyeOff } from "lucide-react";

// ⚠️ Debe coincidir con el de CvBuilder.tsx
const LS_KEY = "cv_builder_draft_v1";

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

// Resumen detallado de lo que se va a importar
type DraftSummary = {
  exp: { lines: string[]; total: number };
  edu: { lines: string[]; total: number };
  skills: { items: string[]; total: number };
  languages: { items: string[]; total: number };
};

const EMPTY_FORM: CandidateSignupWithConfirmInput = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export default function CandidateSignupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromCvBuilder = searchParams?.get("from") === "cv-builder";

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<CandidateSignupWithConfirmInput>(EMPTY_FORM);

  const [draftSummary, setDraftSummary] = useState<DraftSummary | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const updateForm = useCallback(
    (
      updates:
        | Partial<CandidateSignupWithConfirmInput>
        | ((
            prev: CandidateSignupWithConfirmInput
          ) => Partial<CandidateSignupWithConfirmInput>)
    ) => {
      setForm((prev) => ({
        ...prev,
        ...(typeof updates === "function" ? updates(prev) : updates),
      }));
    },
    []
  );

  const handleChange =
    <K extends keyof CandidateSignupWithConfirmInput>(field: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateForm({ [field]: e.target.value });
    };

  // ===== Prefill desde el CV Builder (localStorage) + resumen =====
  useEffect(() => {
    if (!fromCvBuilder) return;
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return;

      const draft = JSON.parse(raw) as {
        identity?: {
          firstName?: string;
          lastName1?: string;
          lastName2?: string;
          email?: string;
        };
        experiences?: any[];
        education?: any[];
        skills?: any[];
        languages?: any[];
      } | null;

      // Prefill nombre y correo
      const identity = draft?.identity;
      if (identity) {
        const fullName = [
          identity.firstName,
          identity.lastName1,
          identity.lastName2,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();

        updateForm((prev) => ({
          name: fullName || prev.name,
          email: identity.email || prev.email,
        }));
      }

      // Construimos resumen legible de lo que se va a importar
      const exps = Array.isArray(draft?.experiences)
        ? draft!.experiences
        : [];
      const edus = Array.isArray(draft?.education) ? draft!.education : [];
      const skills = Array.isArray(draft?.skills) ? draft!.skills : [];
      const languages = Array.isArray(draft?.languages)
        ? draft!.languages
        : [];

      const expItems = exps.filter(
        (e) => (e.company || "").trim() || (e.role || "").trim()
      );
      const eduItems = edus.filter(
        (e) => (e.institution || "").trim() || (e.program || "").trim()
      );
      const skillItems = skills.filter((s) => (s.label || "").trim());
      const langItems = languages.filter((l) => (l.label || "").trim());

      const expLines = expItems.slice(0, 2).map((e) => {
        const company = (e.company || "").trim() || "Empresa";
        const role = (e.role || "").trim();
        return role ? `${company} — ${role}` : company;
      });

      const eduLines = eduItems.slice(0, 2).map((e) => {
        const inst = (e.institution || "").trim() || "Institución";
        const prog = (e.program || "").trim();
        return prog ? `${inst} — ${prog}` : inst;
      });

      const skillNames = skillItems
        .map((s) => (s.label || "").trim())
        .filter(Boolean)
        .slice(0, 4);

      const langNames = langItems
        .map((l) => (l.label || "").trim())
        .filter(Boolean)
        .slice(0, 4);

      if (
        expItems.length ||
        eduItems.length ||
        skillItems.length ||
        langItems.length
      ) {
        setDraftSummary({
          exp: { lines: expLines, total: expItems.length },
          edu: { lines: eduLines, total: eduItems.length },
          skills: { items: skillNames, total: skillItems.length },
          languages: { items: langNames, total: langItems.length },
        });
      }
    } catch (err) {
      console.error("Error leyendo draft de CV en signup:", err);
    }
  }, [fromCvBuilder, updateForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = CandidateSignupWithConfirmSchema.parse(form);
      setLoading(true);

      const { confirmPassword, ...payload } = parsed;

      // Si venimos del CV Builder, leemos el draft completo para importarlo
      let rawDraft: unknown = undefined;
      if (fromCvBuilder && typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(LS_KEY);
          if (raw) {
            rawDraft = JSON.parse(raw);
          }
        } catch (err) {
          console.error("Error parseando draft de CV en submit:", err);
        }
      }

      // 1) Crear cuenta en nuestra BD (con posible import del CV)
      const res = await createCandidateAction(
        payload as CandidateSignupInput,
        rawDraft
      );

      if (!res?.ok) {
        toastError(res?.error || "Error al crear la cuenta");
        return;
      }

      // Si todo salió bien, avisamos y mandamos a la pantalla de "revisa tu correo"
      toastSuccess(
        fromCvBuilder
          ? "Cuenta creada. Te enviamos un enlace para confirmar tu cuenta y guardar tu CV."
          : "Cuenta creada. Te enviamos un enlace para confirmar tu cuenta."
      );

      // Opcional: limpiar el draft del CV del localStorage
      if (fromCvBuilder && typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(LS_KEY);
        } catch {
          // ignorar errores de localStorage
        }
      }

      router.push("/auth/verify/check-email?role=CANDIDATE");
      return;
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toastError(err.errors?.[0]?.message || "Datos inválidos");
      } else {
        toastError("Error al crear la cuenta");
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
        <>
          <p className="mb-2 text-center text-xs text-zinc-500">
            Usaremos estos datos para crear tu cuenta, guardar el CV que acabas
            de armar en tu perfil y enviarte un enlace para confirmar tu correo.
          </p>
          {draftSummary && (
            <div className="mb-4 space-y-1 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-[11px] text-emerald-900">
              <p className="text-[11px] font-semibold uppercase tracking-wide">
                Importaremos a tu perfil:
              </p>

              {draftSummary.exp.total > 0 && (
                <p>
                  <span className="font-semibold">Experiencia:</span>{" "}
                  {draftSummary.exp.lines.join(" · ")}
                  {draftSummary.exp.total >
                    draftSummary.exp.lines.length &&
                    ` + ${
                      draftSummary.exp.total - draftSummary.exp.lines.length
                    } puesto(s) más`}
                </p>
              )}

              {draftSummary.edu.total > 0 && (
                <p>
                  <span className="font-semibold">Escolaridad:</span>{" "}
                  {draftSummary.edu.lines.join(" · ")}
                  {draftSummary.edu.total >
                    draftSummary.edu.lines.length &&
                    ` + ${
                      draftSummary.edu.total - draftSummary.edu.lines.length
                    } estudio(s) más`}
                </p>
              )}

              {draftSummary.skills.total > 0 && (
                <p>
                  <span className="font-semibold">Skills:</span>{" "}
                  {draftSummary.skills.items.join(", ")}
                  {draftSummary.skills.total >
                    draftSummary.skills.items.length &&
                    ` + ${
                      draftSummary.skills.total -
                      draftSummary.skills.items.length
                    } más`}
                </p>
              )}

              {draftSummary.languages.total > 0 && (
                <p>
                  <span className="font-semibold">Idiomas:</span>{" "}
                  {draftSummary.languages.items.join(", ")}
                  {draftSummary.languages.total >
                    draftSummary.languages.items.length &&
                    ` + ${
                      draftSummary.languages.total -
                      draftSummary.languages.items.length
                    } más`}
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="mb-4 text-center text-xs text-zinc-500">
          Crea tu cuenta para postularte a vacantes, guardar tu CV y recibir un
          enlace para confirmar tu correo.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Nombre completo</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange("name")}
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
            onChange={handleChange("email")}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Contraseña</label>
          <div className="relative">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={handleChange("password")}
              className="w-full rounded-lg border px-3 py-2 pr-10 text-sm"
              autoComplete="new-password"
              placeholder="Mín. 8, 1 mayús, 1 min, 1 número"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-2 flex items-center text-zinc-400 hover:text-zinc-600"
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">
            Repite tu contraseña
          </label>
          <div className="relative">
            <input
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={handleChange("confirmPassword")}
              className="w-full rounded-lg border px-3 py-2 pr-10 text-sm"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute inset-y-0 right-2 flex items-center text-zinc-400 hover:text-zinc-600"
              aria-label={
                showConfirmPassword
                  ? "Ocultar contraseña"
                  : "Mostrar contraseña"
              }
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
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
