// app/dashboard/notifications/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { fromNow } from "@/lib/dates";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  Settings,
  FileText,
  ClipboardCheck,
  Briefcase,
} from "lucide-react";
import { NotificationActions } from "./NotificationActions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: {
    type?: string;
    read?: string;
    page?: string;
  };
};

// Icons by notification type
const TYPE_ICONS: Record<string, any> = {
  NEW_APPLICATION: Briefcase,
  APPLICATION_STATUS_CHANGE: FileText,
  ASSESSMENT_INVITATION: ClipboardCheck,
  ASSESSMENT_COMPLETED: CheckCircle2,
  DEFAULT: Bell,
};

const TYPE_LABELS: Record<string, string> = {
  NEW_APPLICATION: "Nueva aplicación",
  APPLICATION_STATUS_CHANGE: "Cambio de estado",
  ASSESSMENT_INVITATION: "Invitación a evaluación",
  ASSESSMENT_COMPLETED: "Evaluación completada",
};

const TYPE_COLORS: Record<string, string> = {
  NEW_APPLICATION:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  APPLICATION_STATUS_CHANGE:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  ASSESSMENT_INVITATION:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  ASSESSMENT_COMPLETED:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

export default async function NotificationsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard/notifications");
  }

  const userId = session.user.id;

  // Parse filters
  const typeFilter = searchParams?.type;
  const readFilter =
    searchParams?.read === "true"
      ? true
      : searchParams?.read === "false"
        ? false
        : undefined;
  const page = parseInt(searchParams?.page || "1", 10);
  const limit = 20;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = { userId, archived: false };
  if (typeFilter) where.type = typeFilter;
  if (readFilter !== undefined) where.read = readFilter;

  // Fetch notifications
  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  // Generate action URLs based on notification type and metadata
  const enrichedNotifications = notifications.map((n) => {
    let actionUrl = "/dashboard";
    const meta = n.metadata as any;

    switch (n.type) {
      case "NEW_APPLICATION":
        if (meta?.jobId && meta?.applicationId) {
          actionUrl = `/dashboard/jobs/${meta.jobId}/applications`;
        }
        break;

      case "APPLICATION_STATUS_CHANGE":
        actionUrl = "/jobs?applied=1"; // Candidate's applications
        break;

      case "ASSESSMENT_INVITATION":
        actionUrl = "/candidate/assessments";
        break;

      case "ASSESSMENT_COMPLETED":
        // ✅ FIX Bug #10: usar la nueva ruta de resultados por attemptId
        if (meta?.attemptId) {
          actionUrl = `/dashboard/assessments/attempts/${meta.attemptId}/results`;
        } else if (meta?.jobId) {
          actionUrl = `/dashboard/jobs/${meta.jobId}/applications`;
        }
        break;
    }

    return { ...n, actionUrl };
  });

  // Count by type for tabs
  const typeCounts = await prisma.notification.groupBy({
    by: ["type"],
    where: { userId },
    _count: true,
  });

  const typeCountMap = typeCounts.reduce((acc, t) => {
    acc[t.type] = t._count;
    return acc;
  }, {} as Record<string, number>);

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1200px] space-y-6 px-6 py-8 lg:px-10">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold leading-tight">
              <Bell className="h-7 w-7 text-blue-600" />
              Notificaciones
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {unreadCount > 0 ? (
                <>
                  Tienes{" "}
                  <span className="font-semibold text-blue-600">
                    {unreadCount}
                  </span>{" "}
                  notificación{unreadCount !== 1 ? "es" : ""} sin leer
                </>
              ) : (
                "Todas las notificaciones leídas"
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/notifications/preferences"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
            >
              <Settings className="h-4 w-4" />
              Configuración
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
            >
              Volver al Panel
            </Link>
          </div>
        </header>

        {/* Filters */}
        <section className="glass-card rounded-2xl border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <FilterTab
              href="/dashboard/notifications"
              active={!typeFilter && readFilter === undefined}
              label={`Todas (${total})`}
            />
            <FilterTab
              href="/dashboard/notifications?read=false"
              active={readFilter === false && !typeFilter}
              label={`Sin leer (${unreadCount})`}
            />
            <FilterTab
              href="/dashboard/notifications?read=true"
              active={readFilter === true && !typeFilter}
              label={`Leídas (${total - unreadCount})`}
            />

            <div className="mx-2 h-6 w-px bg-gray-200 dark:bg-gray-700" />

            {Object.entries(TYPE_LABELS).map(([type, label]) => (
              <FilterTab
                key={type}
                href={`/dashboard/notifications?type=${type}`}
                active={typeFilter === type}
                label={`${label} (${typeCountMap[type] || 0})`}
              />
            ))}
          </div>
        </section>

        {/* Notifications List */}
        {enrichedNotifications.length === 0 ? (
          <div className="glass-card rounded-2xl border border-dashed p-8 text-center">
            <Bell className="mx-auto mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="text-base font-medium text-gray-800 dark:text-gray-200">
              No hay notificaciones
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {typeFilter || readFilter !== undefined
                ? "Intenta ajustar los filtros"
                : "Cuando recibas notificaciones aparecerán aquí"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {enrichedNotifications.map((notification) => {
              const Icon = TYPE_ICONS[notification.type] ?? TYPE_ICONS.DEFAULT;
              const typeLabel =
                TYPE_LABELS[notification.type] ?? notification.type;
              const typeColor =
                TYPE_COLORS[notification.type] ??
                "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";

              return (
                <div
                  key={notification.id}
                  className={[
                    "glass-card rounded-2xl border p-4 transition",
                    notification.read
                      ? "border-gray-200/70 dark:border-gray-700/70"
                      : "border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/20",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${typeColor}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {notification.title}
                          </p>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {notification.message}
                          </p>

                          <div className="mt-2 flex items-center gap-3">
                            <span className="text-xs text-gray-500">
                              {fromNow(notification.createdAt)}
                            </span>

                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${typeColor}`}
                            >
                              {typeLabel}
                            </span>

                            {!notification.read && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                                <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                                Nueva
                              </span>
                            )}
                          </div>
                        </div>

                        <NotificationActions
                          notificationId={notification.id}
                          isRead={notification.read}
                          actionUrl={notification.actionUrl}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            {hasPrevPage && (
              <Link
                href={`/dashboard/notifications?${new URLSearchParams({
                  ...(typeFilter && { type: typeFilter }),
                  ...(readFilter !== undefined && { read: String(readFilter) }),
                  page: String(page - 1),
                }).toString()}`}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
              >
                ← Anterior
              </Link>
            )}

            <span className="px-4 text-sm text-gray-600 dark:text-gray-400">
              Página {page} de {totalPages}
            </span>

            {hasNextPage && (
              <Link
                href={`/dashboard/notifications?${new URLSearchParams({
                  ...(typeFilter && { type: typeFilter }),
                  ...(readFilter !== undefined && { read: String(readFilter) }),
                  page: String(page + 1),
                }).toString()}`}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
              >
                Siguiente →
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function FilterTab({
  href,
  active,
  label,
}: {
  href: string;
  active?: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`
        inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium border transition
        ${
          active
            ? "border-blue-600 bg-blue-600 text-white"
            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        }
      `}
    >
      {label}
    </Link>
  );
}