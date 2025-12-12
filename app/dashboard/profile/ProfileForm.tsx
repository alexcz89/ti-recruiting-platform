// app/dashboard/profile/ProfileForm.tsx
"use client";

import { useTransition, useState } from "react";
import { toast } from "sonner";
import { saveRecruiterProfile } from "./actions";
import PhoneInputField from "@/components/PhoneInputField";

type Props = {
  initial: { phone: string; website: string };
};

export default function ProfileForm({ initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [phone, setPhone] = useState(initial.phone || "");

  return (
    <form
      action={(formData: FormData) => {
        formData.set("phone", phone); // 👈 aseguramos que se envíe el valor del phone input

        startTransition(async () => {
          const res = await saveRecruiterProfile(null as any, formData);
          if (res?.ok) toast.success(res.message || "Perfil actualizado");
          else toast.error(res?.message || "Error al guardar");
        });
      }}
      className="space-y-4"
      id="contact"
    >
      <PhoneInputField
        value={phone}
        onChange={setPhone}
        label="Teléfono"
        helperText="Guardamos el número en formato internacional para que funcionen los botones de WhatsApp y llamadas."
      />

      <div>
        <label className="block text-sm font-medium text-zinc-700">Sitio web</label>
        <input
          name="website"
          defaultValue={initial.website}
          placeholder="miempresa.com o https://miempresa.com"
          className="mt-1 w-full rounded-lg border border-zinc-300 glass-card p-3"
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
