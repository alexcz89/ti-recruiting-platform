// components/dashboard/DeleteJobForm.tsx
"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";

type Props = {
  jobId: string;
  action: (formData: FormData) => Promise<void>;
};

export default function DeleteJobForm({ jobId, action }: Props) {
  const formRef = React.useRef<HTMLFormElement>(null);

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!confirm("¿Eliminar esta vacante? Esta acción no se puede deshacer.")) {
      e.preventDefault();
      return;
    }
    formRef.current?.requestSubmit();
  };

  return (
    <form ref={formRef} action={action} className="inline">
      <input type="hidden" name="jobId" value={jobId} />
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 border rounded-lg px-2 py-1 text-xs hover:bg-red-50 text-red-700 border-red-200"
        title="Borrar vacante"
      >
        <Trash2 className="h-4 w-4" />
        Borrar
      </button>
    </form>
  );
}
