// components/form/RhfFields.tsx
"use client";

import { ReactNode } from "react";
import { UseFormRegister, FieldError } from "react-hook-form";

export function Field({
  label, children, error,
}: { label: string; children: ReactNode; error?: FieldError }) {
  return (
    <div className="mb-4">
      <label className="block mb-1 text-sm font-medium">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error.message as string}</p>}
    </div>
  );
}

export function TextInput({
  register, name, placeholder, type = "text",
}: { register: UseFormRegister<any>; name: string; placeholder?: string; type?: string; }) {
  return (
    <input
      {...register(name)}
      type={type}
      placeholder={placeholder}
      className="w-full rounded-md border px-3 py-2"
    />
  );
}

export function TextArea({
  register, name, placeholder, rows = 4,
}: { register: UseFormRegister<any>; name: string; placeholder?: string; rows?: number }) {
  return (
    <textarea
      {...register(name)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-md border px-3 py-2"
    />
  );
}
