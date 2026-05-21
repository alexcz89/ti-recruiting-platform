"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";

import {
  type PasswordActionState,
  updateAccountPassword,
} from "@/app/account/security/actions";
import { toastError, toastSuccess } from "@/lib/ui/toast";

type Props = {
  hasPassword: boolean;
  compact?: boolean;
};

const initialState: PasswordActionState = {
  ok: false,
  message: "",
};

function PasswordInput({
  id,
  name,
  label,
  placeholder,
  error,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  error?: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={`min-h-11 w-full rounded-2xl border bg-white px-3 py-2 pr-11 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 ${
            error
              ? "border-red-300 dark:border-red-800"
              : "border-zinc-200 dark:border-zinc-800"
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export default function PasswordSettingsCard({
  hasPassword: initialHasPassword,
  compact = false,
}: Props) {
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [state, setState] = useState<PasswordActionState>(initialState);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement | null>(null);

  const copy = useMemo(() => {
    if (hasPassword) {
      return {
        label: "Seguridad",
        title: "Cambiar contraseña",
        body: "Actualiza tu contraseña usando la contraseña actual para proteger tu cuenta.",
        button: "Actualizar contraseña",
      };
    }

    return {
      label: "Cuenta Google",
      title: "Crear contraseña",
      body: "Tu cuenta puede entrar con Google. Crea una contraseña para iniciar sesión también con email.",
      button: "Crear contraseña",
    };
  }, [hasPassword]);

  return (
    <section
      className={`overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 ${
        compact ? "" : "p-0"
      }`}
    >
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {hasPassword ? (
              <LockKeyhole className="h-5 w-5" />
            ) : (
              <KeyRound className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              {copy.label}
            </div>
            <h2 className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {copy.title}
            </h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              {copy.body}
            </p>
          </div>
        </div>
      </div>

      <form
        ref={formRef}
        action={(formData: FormData) => {
          startTransition(async () => {
            const result = await updateAccountPassword(state, formData);
            setState(result);

            if (result.ok) {
              toastSuccess(result.message);
              if (typeof result.hasPassword === "boolean") {
                setHasPassword(result.hasPassword);
              }
              formRef.current?.reset();
            } else {
              toastError(result.message);
            }
          });
        }}
        className="space-y-4 p-5"
      >
        {hasPassword && (
          <PasswordInput
            id="current-password"
            name="currentPassword"
            label="Contraseña actual"
            placeholder="Tu contraseña actual"
            autoComplete="current-password"
            error={state.fieldErrors?.currentPassword}
          />
        )}

        <PasswordInput
          id="new-password"
          name="newPassword"
          label="Nueva contraseña"
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
          error={state.fieldErrors?.newPassword}
        />

        <PasswordInput
          id="confirm-password"
          name="confirmPassword"
          label="Confirmar contraseña"
          placeholder="Repite la nueva contraseña"
          autoComplete="new-password"
          error={state.fieldErrors?.confirmPassword}
        />

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
          <div className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              Usa al menos 8 caracteres con mayúscula, minúscula y número.
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {pending ? "Guardando..." : copy.button}
        </button>
      </form>
    </section>
  );
}
