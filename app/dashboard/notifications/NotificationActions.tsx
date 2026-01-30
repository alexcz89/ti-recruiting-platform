// app/dashboard/notifications/NotificationActions.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, ExternalLink } from "lucide-react";
import { toastSuccess, toastError, toastInfo, toastWarning } from "@/lib/ui/toast";

interface NotificationActionsProps {
  notificationId: string;
  isRead: boolean;
  actionUrl: string;
}

export function NotificationActions({
  notificationId,
  isRead,
  actionUrl,
}: NotificationActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleMarkAsRead = async () => {
    if (isRead) return;

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/notifications/${notificationId}/read`,
          { method: "PATCH" }
        );

        if (response.ok) {
          toastSuccess("Marcada como leída");
          router.refresh();
        } else {
          toastError("Error al marcar como leída");
        }
      } catch (error) {
        console.error("Error marking as read:", error);
        toastError("Error al marcar como leída");
      }
    });
  };

  const handleDelete = async () => {
    if (!confirm("¿Eliminar esta notificación?")) return;

    setIsDeleting(true);

    // Optimistic UI: deshabilitar visualmente el elemento
    const notificationElement = document.querySelector<HTMLElement>(
      `[data-notification-id="${notificationId}"]`
    );

    if (notificationElement) {
      notificationElement.style.opacity = "0.5";
      notificationElement.style.pointerEvents = "none";
    }

    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toastSuccess("Notificación eliminada");
        window.location.href = "/dashboard/notifications";
        return;
      }

      // Restore UI if failed
      if (notificationElement) {
        notificationElement.style.opacity = "1";
        notificationElement.style.pointerEvents = "auto";
      }

      const error = await response.json().catch(() => ({}));
      console.error("Delete error:", error);
      toastError(error.error || "Error al eliminar");
      setIsDeleting(false);
    } catch (error) {
      // Restore UI if failed
      if (notificationElement) {
        notificationElement.style.opacity = "1";
        notificationElement.style.pointerEvents = "auto";
      }

      console.error("Error deleting notification:", error);
      toastError("Error al eliminar");
      setIsDeleting(false);
    }
  };

  const handleViewDetails = async () => {
    // Mark as read when clicking view details
    if (!isRead) {
      try {
        await fetch(`/api/notifications/${notificationId}/read`, {
          method: "PATCH",
        });
      } catch (error) {
        console.error("Error marking as read:", error);
      }
    }

    router.push(actionUrl);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleViewDetails}
        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition"
        title="Ver detalles"
      >
        <ExternalLink className="w-4 h-4" />
      </button>

      {!isRead && (
        <button
          onClick={handleMarkAsRead}
          disabled={isPending}
          className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-lg transition disabled:opacity-50"
          title="Marcar como leída"
        >
          <Check className="w-4 h-4" />
        </button>
      )}

      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition disabled:opacity-50"
        title="Eliminar"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
