// components/PhoneInputField.tsx
"use client";

import { useMemo } from "react";
import PhoneInput from "react-phone-input-2";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  helperText?: string;
  error?: string;
};

export default function PhoneInputField({
  value,
  onChange,
  label,
  helperText,
  error,
}: Props) {
  // La librería maneja el valor SIN '+', pero en tu modelo lo guardas con '+'
  const internalValue = useMemo(
    () => (value || "").replace(/^\+/, ""),
    [value]
  );

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100 mb-1">
          {label}
        </label>
      )}

      <PhoneInput
        country="mx"
        value={internalValue}
        onChange={(val) => {
          const next = val ? `+${val.replace(/^\+/, "")}` : "";
          onChange(next);
        }}
        containerClass="bt-phone-input"
        inputClass="bt-phone-input-input"
        buttonClass="bt-phone-input-flag"
        inputProps={{
          name: "phone",
          autoComplete: "tel",
        }}
      />

      {helperText && !error && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {helperText}
        </p>
      )}

      {error && (
        <p className="mt-1 text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
