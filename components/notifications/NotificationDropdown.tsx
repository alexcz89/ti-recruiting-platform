// components/notifications/NotificationDropdown.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, CheckCheck, Bell } from 'lucide-react';
import { NotificationItem } from './NotificationItem';
import type { Notification } from '@prisma/client';
import Link from 'next/link';

interface NotificationDropdownProps {
  onClose: () => void;
  onCountUpdate: (count: number) => void;
}

export function NotificationDropdown({
  onClose,
  onCountUpdate,
}: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/notifications?limit=10');

      if (response.ok) {
        const data = await response.json();
        const nextNotifications = data.data.notifications as Notification[];
        const unreadCount = data.data.unreadCount as number;

        setNotifications(nextNotifications);
        onCountUpdate(unreadCount);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onCountUpdate]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [onClose]);

  const handleMarkAllRead = async () => {
    try {
      setIsMarkingAllRead(true);

      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
      });

      if (response.ok) {
        await fetchNotifications();
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const getActionUrl = (notification: Notification): string => {
    const meta = notification.metadata as any;

    switch (notification.type) {
      case 'NEW_APPLICATION':
        if (meta?.jobId) return `/dashboard/jobs/${meta.jobId}/applications`;
        break;

      case 'APPLICATION_STATUS_CHANGE':
        return '/jobs?applied=1';

      case 'ASSESSMENT_INVITATION':
        if (meta?.templateId && meta?.attemptId) {
          return `/assessments/${meta.templateId}?attemptId=${meta.attemptId}${
            meta?.token ? `&token=${meta.token}` : ''
          }`;
        }
        console.error('ASSESSMENT_INVITATION sin metadata completa', notification);
        return '/dashboard';

      case 'ASSESSMENT_COMPLETED':
        if (meta?.attemptId) {
          return `/dashboard/assessments/attempts/${meta.attemptId}/results`;
        }
        if (meta?.jobId) return `/dashboard/jobs/${meta.jobId}/applications`;
        break;
    }

    return '/dashboard';
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await fetch(`/api/notifications/${notification.id}/read`, {
          method: 'PATCH',
        });

        setNotifications((prev) => {
          const updated = prev.map((n) =>
            n.id === notification.id ? { ...n, read: true } : n
          );

          const unread = updated.filter((n) => !n.read).length;
          onCountUpdate(unread);

          return updated;
        });
      } catch (error) {
        console.error('Error marking as read:', error);
      }
    }

    const url = getActionUrl(notification);
    window.location.href = url;
  };

  const handleDelete = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotifications((prev) => {
          const deletedNotification = prev.find((n) => n.id === notificationId);
          const updated = prev.filter((n) => n.id !== notificationId);

          if (deletedNotification && !deletedNotification.read) {
            const unread = updated.filter((n) => !n.read).length;
            onCountUpdate(unread);
          }

          return updated;
        });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 mt-2 z-50 w-[calc(100vw-1rem)] max-w-96 rounded-lg border border-gray-200 bg-white shadow-lg sm:w-96"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900">Notificaciones</h3>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500">{unreadCount} sin leer</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={isMarkingAllRead}
              className="rounded p-2 text-gray-600 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
              title="Marcar todas como leídas"
            >
              <CheckCheck className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={onClose}
            className="rounded p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            aria-label="Cerrar notificaciones"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto sm:max-h-[500px]">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-gray-500">
            Cargando...
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell className="mx-auto mb-2 h-12 w-12 text-gray-300" />
            <p className="text-gray-500">No tienes notificaciones</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={() => handleNotificationClick(notification)}
                onDelete={() => handleDelete(notification.id)}
              />
            ))}
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="border-t border-gray-200 px-4 py-3">
          <Link
            href="/dashboard/notifications"
            className="inline-flex min-h-[44px] items-center text-sm font-medium text-blue-600 hover:text-blue-800"
            onClick={onClose}
          >
            Ver todas las notificaciones →
          </Link>
        </div>
      )}
    </div>
  );
}