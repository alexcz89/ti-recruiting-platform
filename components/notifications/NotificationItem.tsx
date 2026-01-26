// components/notifications/NotificationItem.tsx
'use client';

import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Bell, 
  FileText, 
  MessageSquare, 
  ClipboardCheck, 
  Clock, 
  Briefcase,
  Users,
  Shield,
  Key,
  CreditCard,
  X,
} from 'lucide-react';
import type { Notification, NotificationType } from '@prisma/client';

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onDelete: () => void;
  compact?: boolean;
}

// Icon mapping for each notification type
const NOTIFICATION_ICONS: Record<NotificationType, typeof Bell> = {
  NEW_APPLICATION: FileText,
  APPLICATION_STATUS_CHANGE: ClipboardCheck,
  APPLICATION_COMMENT: MessageSquare,
  ASSESSMENT_INVITATION: ClipboardCheck,
  ASSESSMENT_REMINDER: Clock,
  ASSESSMENT_COMPLETED: ClipboardCheck,
  ASSESSMENT_RESULTS: ClipboardCheck,
  JOB_POSTED: Briefcase,
  JOB_CLOSING_SOON: Clock,
  JOB_EXPIRED: Briefcase,
  TEAM_MENTION: Users,
  TEAM_ASSIGNED: Users,
  ACCOUNT_VERIFIED: Shield,
  PASSWORD_RESET: Key,
  SUBSCRIPTION_EXPIRING: CreditCard,
};

// Color mapping for each priority
const PRIORITY_COLORS = {
  LOW: 'text-gray-500 bg-gray-100',
  MEDIUM: 'text-blue-500 bg-blue-100',
  HIGH: 'text-orange-500 bg-orange-100',
  URGENT: 'text-red-500 bg-red-100',
};

export function NotificationItem({
  notification,
  onClick,
  onDelete,
  compact = false,
}: NotificationItemProps) {
  const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
  const colorClass = PRIORITY_COLORS[notification.priority];

  // Format relative time
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: es,
  });

  return (
    <div
      className={`
        relative group px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer
        ${!notification.read ? 'bg-blue-50/50' : ''}
        ${compact ? 'py-2' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 p-2 rounded-full ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-medium text-gray-900 ${!notification.read ? 'font-semibold' : ''}`}>
              {notification.title}
            </p>
            
            {/* Unread indicator */}
            {!notification.read && (
              <span className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-1" />
            )}
          </div>
          
          <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          
          {!compact && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-500">{timeAgo}</span>
              
              {notification.actionText && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-xs text-blue-600 font-medium">
                    {notification.actionText}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
          title="Eliminar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}