// lib/ui/toast.ts
"use client";

import { toast } from "sonner";

/** Éxito */
export function toastSuccess(
  msg: string,
  opts?: Parameters<typeof toast.success>[1]
) {
  return toast.success(msg, { id: "ok-" + msg, ...opts });
}

/** Error */
export function toastError(
  msg: string,
  opts?: Parameters<typeof toast.error>[1]
) {
  return toast.error(msg, { id: "err-" + msg, ...opts });
}

/** Info neutral */
export function toastInfo(
  msg: string,
  opts?: Parameters<typeof toast>[1]
) {
  return toast(msg, { id: "info-" + msg, ...opts });
}

/** Envolver promesas con loading/success/error */
export function toastPromise<T>(
  promise: Promise<T> | (() => Promise<T>),
  labels?: {
    loading?: string;
    success?: string | ((value: T) => string);
    error?: string | ((err: any) => string);
  }
) {
  const p = typeof promise === "function" ? (promise as () => Promise<T>)() : promise;

  return toast.promise(p, {
    loading: labels?.loading ?? "Cargando…",
    success: (val) =>
      typeof labels?.success === "function"
        ? labels.success(val)
        : labels?.success ?? "Listo",
    error: (err) =>
      typeof labels?.error === "function"
        ? labels.error(err)
        : labels?.error ?? "Ocurrió un error",
  });
}
