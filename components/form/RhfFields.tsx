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
      {/* ✅ Mobile-optimized label (larger on mobile for better readability) */}
      <label htmlFor={name} className="block mb-2 sm:mb-1 text-base sm:text-sm font-medium text-zinc-900 dark:text-zinc-50">
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
    // ✅ Mobile-optimized input (16px height minimum on mobile to prevent iOS zoom)
    <input
      id={name}
      {...register(name)}
      type={type}
      placeholder={placeholder}
      className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 px-3 py-3 sm:py-2 text-base sm:text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-500 dark:placeholder-zinc-400 focus-ring"
      aria-required="true"
    />
  );
}

export function TextArea({
  register, name, placeholder, rows = 4,
}: { register: UseFormRegister<any>; name: string; placeholder?: string; rows?: number }) {
  return (
    // ✅ Mobile-optimized textarea (better spacing for mobile)
    <textarea
      id={name}
      {...register(name)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 px-3 py-3 sm:py-2 text-base sm:text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-500 dark:placeholder-zinc-400 focus-ring"
      aria-required="true"
    />
  );
}
