// app/dashboard/components/SubmitButton.tsx
"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        "shrink-0 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60 " +
        className
      }
    >
      {pending ? "Enviando..." : children}
    </button>
  );
}
