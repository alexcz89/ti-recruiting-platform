import { toast } from "sonner";

/**
 * ✅ Helpers de toasts centralizados
 * Uso:
 *   toastSuccess("Guardado con éxito");
 *   toastError("Ocurrió un error");
 *   toastInfo("Mensaje informativo");
 *   toastPromise(fetch(...), { loading: "Guardando…" });
 */

// Éxito
export function toastSuccess(msg: string, opts?: Parameters<typeof toast.success>[1]) {
  return toast.success(msg, {
    id: "ok-" + msg,
    ...opts,
  });
}

// Error
export function toastError(msg: string, opts?: Parameters<typeof toast.error>[1]) {
  return toast.error(msg, {
    id: "err-" + msg,
    ...opts,
  });
}

// Info neutro
export function toastInfo(msg: string, opts?: Parameters<typeof toast>[1]) {
  return toast(msg, {
    id: "info-" + msg,
    ...opts,
  });
}

// Envolver promesas con carga/éxito/error
export function toastPromise<T>(
  promise: Promise<T>,
  labels?: {
    loading?: string;
    success?: string | ((data: T) => string);
    error?: string | ((e: any) => string);
  }
) {
  const {
    loading = "Procesando…",
    success = "Completado",
    error = "Ocurrió un error",
  } = labels || {};
  return toast.promise(promise, {
    loading,
    success,
    error,
  });
}
