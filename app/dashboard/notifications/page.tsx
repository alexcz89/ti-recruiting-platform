// app/dashboard/notifications/page.tsx
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fromNow } from "@/lib/dates";
import Link from "next/link";
import { 
  Bell, 
  CheckCircle2, 
  XCircle, 
  Settings,
  FileText,
  ClipboardCheck,
  User,
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
  NEW_APPLICATION: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  APPLICATION_STATUS_CHANGE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  ASSESSMENT_INVITATION: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  ASSESSMENT_COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

export default async function NotificationsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/dashboard/notifications');
  }

  const userId = session.user.id;
  
  // Parse filters
  const typeFilter = searchParams?.type;
  const readFilter = searchParams?.read === 'true' ? true : searchParams?.read === 'false' ? false : undefined;
  const page = parseInt(searchParams?.page || '1');
  const limit = 20;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = { userId,  archived: false };
  if (typeFilter) where.type = typeFilter;
  if (readFilter !== undefined) where.read = readFilter;

  // Fetch notifications
  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
    let actionUrl = '/dashboard';
    const meta = n.metadata as any;

    switch (n.type) {
      case 'NEW_APPLICATION':
        if (meta?.jobId && meta?.applicationId) {
          actionUrl = `/dashboard/jobs/${meta.jobId}/applications`;
        }
        break;
      case 'APPLICATION_STATUS_CHANGE':
        actionUrl = '/jobs?applied=1'; // Candidate's applications
        break;
      case 'ASSESSMENT_INVITATION':
        actionUrl = '/candidate/assessments';
        break;
      case 'ASSESSMENT_COMPLETED':
        if (meta?.jobId) {
          actionUrl = `/dashboard/jobs/${meta.jobId}/applications`;
        }
        break;
    }

    return { ...n, actionUrl };
  });

  // Count by type for tabs
  const typeCounts = await prisma.notification.groupBy({
    by: ['type'],
    where: { userId },
    _count: true,
  });

  const typeCountMap = typeCounts.reduce((acc, t) => {
    acc[t.type] = t._count;
    return acc;
  }, {} as Record<string, number>);

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-10 py-8 space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold leading-tight flex items-center gap-3">
              <Bell className="w-7 h-7 text-blue-600" />
              Notificaciones
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {unreadCount > 0 ? (
                <>
                  Tienes <span className="font-semibold text-blue-600">{unreadCount}</span> notificación{unreadCount !== 1 ? 'es' : ''} sin leer
                </>
              ) : (
                'Todas las notificaciones leídas'
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/notifications/preferences"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm"
            >
              <Settings className="w-4 h-4" />
              Configuración
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm"
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
            
            {/* Divider */}
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-2" />
            
            {/* Type filters */}
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
            <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-base font-medium text-gray-800 dark:text-gray-200">
              No hay notificaciones
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {typeFilter || readFilter !== undefined
                ? 'Intenta ajustar los filtros'
                : 'Cuando recibas notificaciones aparecerán aquí'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {enrichedNotifications.map((notification) => {
              const Icon = TYPE_ICONS[notification.type] || TYPE_ICONS.DEFAULT;
              const typeColor = TYPE_COLORS[notification.type] || TYPE_COLORS.NEW_APPLICATION;
              const typeLabel = TYPE_LABELS[notification.type] || notification.type;

              return (
                <div
                  key={notification.id}
                  data-notification-id={notification.id}
                  className={`
                    glass-card rounded-xl border p-4 transition-all
                    ${!notification.read 
                      ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20' 
                      : 'border-gray-200 dark:border-gray-800'}
                    hover:shadow-md
                  `}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`shrink-0 p-2 rounded-lg ${typeColor}`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-gray-500">
                              {fromNow(notification.createdAt)}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${typeColor}`}>
                              {typeLabel}
                            </span>
                            {!notification.read && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                                <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                                Nueva
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
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
          <div className="flex items-center justify-center gap-2 mt-6">
            {hasPrevPage && (
              <Link
                href={`/dashboard/notifications?${new URLSearchParams({
                  ...(typeFilter && { type: typeFilter }),
                  ...(readFilter !== undefined && { read: String(readFilter) }),
                  page: String(page - 1),
                }).toString()}`}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm"
              >
                ← Anterior
              </Link>
            )}
            
            <span className="text-sm text-gray-600 dark:text-gray-400 px-4">
              Página {page} de {totalPages}
            </span>
            
            {hasNextPage && (
              <Link
                href={`/dashboard/notifications?${new URLSearchParams({
                  ...(typeFilter && { type: typeFilter }),
                  ...(readFilter !== undefined && { read: String(readFilter) }),
                  page: String(page + 1),
                }).toString()}`}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm"
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

/* =================== UI Components =================== */

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
        ${active
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
        }
      `}
    >
      {label}
    </Link>
  );
}