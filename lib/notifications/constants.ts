// lib/notifications/constants.ts
// Constants for the notifications system

import type {
  NotificationType,
  NotificationChannel,
  NotificationPriority,
} from '@prisma/client';

/**
 * Default priority for each notification type
 */
export const NOTIFICATION_PRIORITIES: Record<
  NotificationType,
  NotificationPriority
> = {
  NEW_APPLICATION: 'MEDIUM',
  APPLICATION_STATUS_CHANGE: 'HIGH',
  APPLICATION_COMMENT: 'LOW',
  ASSESSMENT_INVITATION: 'HIGH',
  ASSESSMENT_REMINDER: 'URGENT',
  ASSESSMENT_COMPLETED: 'MEDIUM',
  ASSESSMENT_RESULTS: 'HIGH',
  JOB_POSTED: 'LOW',
  JOB_CLOSING_SOON: 'MEDIUM',
  JOB_EXPIRED: 'MEDIUM',
  TEAM_MENTION: 'MEDIUM',
  TEAM_ASSIGNED: 'HIGH',
  ACCOUNT_VERIFIED: 'MEDIUM',
  PASSWORD_RESET: 'HIGH',
  SUBSCRIPTION_EXPIRING: 'HIGH',
};

/**
 * Default channels for each notification type
 */
export const DEFAULT_CHANNELS: Record<
  NotificationType,
  NotificationChannel[]
> = {
  NEW_APPLICATION: ['IN_APP', 'EMAIL'],
  APPLICATION_STATUS_CHANGE: ['IN_APP', 'EMAIL'],
  APPLICATION_COMMENT: ['IN_APP'],
  ASSESSMENT_INVITATION: ['IN_APP', 'EMAIL'],
  ASSESSMENT_REMINDER: ['IN_APP', 'EMAIL'],
  ASSESSMENT_COMPLETED: ['IN_APP', 'EMAIL'],
  ASSESSMENT_RESULTS: ['IN_APP', 'EMAIL'],
  JOB_POSTED: ['IN_APP'],
  JOB_CLOSING_SOON: ['IN_APP'],
  JOB_EXPIRED: ['IN_APP', 'EMAIL'],
  TEAM_MENTION: ['IN_APP', 'EMAIL'],
  TEAM_ASSIGNED: ['IN_APP', 'EMAIL'],
  ACCOUNT_VERIFIED: ['IN_APP', 'EMAIL'],
  PASSWORD_RESET: ['IN_APP', 'EMAIL'],
  SUBSCRIPTION_EXPIRING: ['IN_APP', 'EMAIL'],
};

/**
 * Limits for notifications
 */
export const NOTIFICATION_LIMITS = {
  MAX_UNREAD: 999, // Show "999+" for anything above
  MAX_PER_PAGE: 100,
  DEFAULT_PAGE_SIZE: 20,
  CACHE_TTL_SECONDS: 30,
} as const;