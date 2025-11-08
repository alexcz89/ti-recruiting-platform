"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import LogoUploader from "@/components/LogoUploader";
import { setCompanyLogo, removeCompanyLogo } from "@/app/dashboard/company/actions";

type Props = {
  company: { id: string; name: string; logoUrl?: string | null };
};

export default function CompanyBrandCard({ company }: Props) {
  const [logo, setLogo] = useState(company.logoUrl || "");
  const [isPending, startTransition] = useTransition();

  const handleUploaded = (url: string) => {
    startTransition(async () => {
      const res = await setCompanyLogo(url);
      if (res.ok) {
        setLogo(url);
        toast.success("Logo actualizado");
      } else toast.error(res.message || "Error al guardar logo");
    });
  };

  const handleRemove = () => {
    startTransition(async () => {
      const res = await removeCompanyLogo();
      if (res.ok) {
        setLogo("");
        toast.success("Logo eliminado");
      } else toast.error(res.message || "Error al eliminar logo");
    });
  };

  return (
    <section className="rounded-2xl border glass-card p-4 md:p-6">
      <h2 className="font-semibold">Marca de la empresa</h2>
      <p className="mt-1 text-sm text-zinc-600">
        El logo se mostrará en tus vacantes y en listados públicos.
      </p>

      <div className="mt-4 flex items-start gap-6">
        <div className="w-28 h-28 rounded-xl border bg-zinc-200/60 dark:bg-zinc-700/50 rounded">
          {logo ? (
            <Image
              src={logo}
              alt={company.name}
              width={112}
              height={112}
              className="object-contain"
            />
          ) : (
            <span className="text-xs text-zinc-400">Sin logo</span>
          )}
        </div>

        <div className="flex-1">
          <LogoUploader onUploaded={handleUploaded} label="Archivo" />
          <div className="mt-3 flex gap-2">
            {logo && (
              <button
                onClick={handleRemove}
                disabled={isPending}
                className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Quitar logo
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
