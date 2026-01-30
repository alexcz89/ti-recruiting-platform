// lib/ui/toast.ts
"use client";

import { toast } from "sonner";

// 🔒 Set global para trackear toasts activos y prevenir duplicados en StrictMode
const activeToastIds = new Set<string>();

/**
 * Genera un ID único basado en el mensaje
 * Usa el mensaje como base para evitar duplicados del mismo mensaje
 */
function generateToastId(prefix: string, msg: string): string {
  return `${prefix}-${msg.substring(0, 50)}`; // Primeros 50 chars del mensaje
}

/**
 * Limpia el ID del set cuando el toast se cierra
 */
function cleanupToastId(id: string) {
  activeToastIds.delete(id);
}

/**
 * Verifica si un toast ya está activo
 * (No usamos toast.isActive porque no existe en algunos tipos/versiones de sonner)
 */
function isToastActive(id: string): boolean {
  return activeToastIds.has(id);
}

/** Éxito */
export function toastSuccess(
  msg: string,
  opts?: Parameters<typeof toast.success>[1]
) {
  const id = (opts?.id as string | number | undefined) ?? generateToastId("ok", msg);

  if (isToastActive(String(id))) return id;

  activeToastIds.add(String(id));

  return toast.success(msg, {
    ...opts,
    id,
    onDismiss: () => cleanupToastId(String(id)),
    onAutoClose: () => cleanupToastId(String(id)),
  });
}

/** Error */
export function toastError(
  msg: string,
  opts?: Parameters<typeof toast.error>[1]
) {
  const id = (opts?.id as string | number | undefined) ?? generateToastId("err", msg);

  if (isToastActive(String(id))) return id;

  activeToastIds.add(String(id));

  return toast.error(msg, {
    ...opts,
    id,
    onDismiss: () => cleanupToastId(String(id)),
    onAutoClose: () => cleanupToastId(String(id)),
  });
}

/** Info neutral */
export function toastInfo(msg: string, opts?: Parameters<typeof toast>[1]) {
  const id = (opts?.id as string | number | undefined) ?? generateToastId("info", msg);

  if (isToastActive(String(id))) return id;

  activeToastIds.add(String(id));

  return toast(msg, {
    ...opts,
    id,
    onDismiss: () => cleanupToastId(String(id)),
    onAutoClose: () => cleanupToastId(String(id)),
  });
}

/** Warning */
export function toastWarning(
  msg: string,
  opts?: Parameters<typeof toast.warning>[1]
) {
  const id = (opts?.id as string | number | undefined) ?? generateToastId("warn", msg);

  if (isToastActive(String(id))) return id;

  activeToastIds.add(String(id));

  return toast.warning(msg, {
    ...opts,
    id,
    onDismiss: () => cleanupToastId(String(id)),
    onAutoClose: () => cleanupToastId(String(id)),
  });
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
  const p = typeof promise === "function" ? promise() : promise;

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

/** Loading toast */
export function toastLoading(
  msg: string,
  opts?: Parameters<typeof toast.loading>[1]
) {
  const id =
    (opts?.id as string | number | undefined) ?? generateToastId("loading", msg);

  if (isToastActive(String(id))) return id;

  activeToastIds.add(String(id));

  return toast.loading(msg, {
    ...opts,
    id,
    onDismiss: () => cleanupToastId(String(id)),
    onAutoClose: () => cleanupToastId(String(id)),
  });
}

/** Dismiss toast by ID (o todos) */
export function toastDismiss(id?: string | number) {
  if (id !== undefined && id !== null) {
    cleanupToastId(String(id));
    toast.dismiss(id);
    return;
  }

  activeToastIds.clear();
  toast.dismiss();
}

// 🔥 Export del toast original para casos especiales
export { toast as rawToast };
