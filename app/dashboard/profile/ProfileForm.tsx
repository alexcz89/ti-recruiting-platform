"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { saveRecruiterProfile } from "./actions";

type Props = {
  initial: { phone: string; website: string };
};

export default function ProfileForm({ initial }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData: FormData) => {
        startTransition(async () => {
          const res = await saveRecruiterProfile(null as any, formData);
          if (res?.ok) toast.success(res.message || "Perfil actualizado");
          else toast.error(res?.message || "Error al guardar");
        });
      }}
      className="space-y-4"
      id="contact"
    >
      <div>
        <label className="block text-sm font-medium text-zinc-700">Teléfono</label>
        <input
          name="phone"
          defaultValue={initial.phone}
          placeholder="+52 81 1234 5678"
          className="mt-1 w-full rounded-lg border border-zinc-300 glass-card p-4 md:p-6"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Guarda cualquier formato breve (ej. +52 81 1234 5678). Opcional.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Sitio web</label>
        <input
          name="website"
          defaultValue={initial.website}
          placeholder="miempresa.com o https://miempresa.com"
          className="mt-1 w-full rounded-lg border border-zinc-300 glass-card p-4 md:p-6"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Puedes escribir “miempresa.com” o la URL completa. Opcional.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
