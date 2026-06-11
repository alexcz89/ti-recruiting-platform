// components/form/RhfFields.tsx
"use client";

import { ReactNode, isValidElement, cloneElement } from "react";
import { UseFormRegister, FieldError } from "react-hook-form";

export function Field({
  label, children, error, name,
}: { label: string; children: ReactNode; error?: FieldError; name?: string }) {
  const errorId = name ? `error-${name}` : undefined;

  return (
    <div className="mb-4">
      <label htmlFor={name} className="block mb-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
        {label}
        {/* Required indicator for accessibility */}
        {/* Add aria-required="true" to inputs if field is required */}
      </label>
      {/* Clone children to add aria-describedby and aria-invalid */}
      {isValidElement(children)
        ? cloneElement(children, {
            ...(errorId && { "aria-describedby": errorId }),
            ...(error && { "aria-invalid": "true" }),
          } as any)
        : children}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1 text-xs text-red-700 dark:text-red-300 font-medium"
        >
          {error.message as string}
        </p>
      )}
    </div>
  );
}

export function TextInput({
  register, name, placeholder, type = "text",
}: { register: UseFormRegister<any>; name: string; placeholder?: string; type?: string; }) {
  return (
    <input
      id={name}
      {...register(name)}
      type={type}
      placeholder={placeholder}
      className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-zinc-900 dark:text-zinc-50 placeholder-zinc-500 dark:placeholder-zinc-400 focus-ring"
      aria-required="true"
    />
  );
}

export function TextArea({
  register, name, placeholder, rows = 4,
}: { register: UseFormRegister<any>; name: string; placeholder?: string; rows?: number }) {
  return (
    <textarea
      id={name}
      {...register(name)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-zinc-900 dark:text-zinc-50 placeholder-zinc-500 dark:placeholder-zinc-400 focus-ring"
      aria-required="true"
    />
  );
}
