// lib/notifications/types.ts
// TypeScript types for the Notifications System

import type { 
  Notification, 
  NotificationDelivery, 
  NotificationPreference,
  NotificationType,
  NotificationChannel,
  NotificationPriority 
} from '@prisma/client';

// ============================================
// Core Types - Re-export from Prisma
// ============================================

export type {
  Notification,
  NotificationDelivery,
  NotificationPreference,
  NotificationType,
  NotificationChannel,
  NotificationPriority,
};

// ============================================
// API Response Types
// ============================================

export interface NotificationListResponse {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  unreadCount: number;
}

export interface GetNotificationsParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
  priority?: NotificationPriority;
}

// ============================================
// Notification Creation Types
// ============================================

export type CreateNotificationRequest<T extends NotificationType> = {
  userId: string;
  type: T;
  metadata: NotificationMetadata[T];
  channels?: NotificationChannel[];
};

// ============================================
// Metadata Types for Each Notification
// ============================================

export type NotificationMetadata = {
  NEW_APPLICATION: {
    candidateName: string;
    candidateId: string;
    jobTitle: string;
    jobId: string;
    applicationId: string;
  };
  
  APPLICATION_STATUS_CHANGE: {
    jobTitle: string;
    jobId: string;
    applicationId: string;
    oldStatus: string;
    newStatus: string;
  };
  
  APPLICATION_COMMENT: {
    jobTitle: string;
    jobId: string;
    applicationId: string;
    authorId: string;
    authorName: string;
  };
  
  ASSESSMENT_INVITATION: {
    jobTitle: string;
    jobId: string;
    assessmentId: string;
    templateId: string;
    dueDate: Date;
  };
  
  ASSESSMENT_REMINDER: {
    jobTitle: string;
    jobId: string;
    assessmentId: string;
    templateId: string;
    hoursLeft: number;
  };
  
  ASSESSMENT_COMPLETED: {
    candidateName: string;
    candidateId: string;
    jobTitle: string;
    jobId: string;
    assessmentId: string;
    attemptId: string;
    score: number;
    passed: boolean;
  };
  
  ASSESSMENT_RESULTS: {
    jobTitle: string;
    jobId: string;
    assessmentId: string;
    attemptId: string;
    score: number;
    passed: boolean;
  };
  
  JOB_POSTED: {
    jobId: string;
    jobTitle: string;
    companyName: string;
    location: string;
  };
  
  JOB_CLOSING_SOON: {
    jobId: string;
    jobTitle: string;
    daysLeft: number;
  };
  
  JOB_EXPIRED: {
    jobId: string;
    jobTitle: string;
    applicationsCount: number;
  };
  
  TEAM_MENTION: {
    mentionedBy: string;
    mentionedByName: string;
    contextType: string;
  };
  
  TEAM_ASSIGNED: {
    assignedBy: string;
    assignedByName: string;
    candidateId: string;
    candidateName: string;
    jobId: string;
    jobTitle: string;
  };
  
  ACCOUNT_VERIFIED: {
    verifiedAt: Date;
  };
  
  PASSWORD_RESET: {
    requestedAt: Date;
    expiresAt: Date;
  };
  
  SUBSCRIPTION_EXPIRING: {
    planName: string;
    daysLeft: number;
  };
};

// ============================================
// Delivery Types
// ============================================

export type DeliveryResult = {
  success: boolean;
  channel: NotificationChannel;
  sentAt?: Date;
  deliveredAt?: Date;
  error?: string;
};