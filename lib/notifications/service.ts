// lib/notifications/service.ts
/**
 * NotificationService
 * 
 * Core service for managing notifications:
 * - Create notifications from templates
 * - Deliver via multiple channels (in-app, email, webhook)
 * - Respect user preferences
 * - Track delivery status
 * - Query notifications with pagination
 */

import { prisma } from '@/lib/server/prisma';
import type {
  Notification,
  NotificationType,
  NotificationChannel,
  NotificationPreference,
} from '@prisma/client';
import type {
  CreateNotificationRequest,
  NotificationListResponse,
  GetNotificationsParams,
  DeliveryResult,
} from './types';
import { NOTIFICATION_TEMPLATES } from './templates';
import { DEFAULT_CHANNELS } from './constants';
import { sendEmailNotification } from './channels/email';
import { sendWebhookNotification } from './channels/webhook';

export class NotificationService {
  /**
   * Create a new notification
   * 
   * @example
   * await NotificationService.create({
   *   userId: 'user-123',
   *   type: 'NEW_APPLICATION',
   *   metadata: {
   *     candidateName: 'Juan Pérez',
   *     jobTitle: 'Senior Developer',
   *     applicationId: 'app-123',
   *     jobId: 'job-123',
   *     candidateId: 'candidate-123',
   *   },
   * });
   */
  static async create<T extends NotificationType>(
    request: CreateNotificationRequest<T>
  ): Promise<Notification | null> {
    const { userId, type, metadata, channels: requestedChannels } = request;

    // 1. Get template for this notification type
    const template = NOTIFICATION_TEMPLATES[type as keyof typeof NOTIFICATION_TEMPLATES];
    if (!template) {
      console.error(`[Notifications] No template found for type: ${type}`);
      return null;
    }

    // 2. Generate content from template
    const title = template.title(metadata as any);
    const message = template.message(metadata as any);
    const actionUrl = template.actionUrl(metadata as any);
    const actionText = template.actionText?.(metadata as any);
    const priority = template.priority;

    // 3. Get user preferences to determine channels
    const userPreferences = await this.getUserPreferences(userId);
    const enabledChannels = this.determineChannels(
      type,
      userPreferences,
      requestedChannels
    );

    // If no channels are enabled, don't create notification
    if (enabledChannels.length === 0) {
      console.log(
        `[Notifications] User ${userId} has disabled all channels for ${type}`
      );
      return null;
    }

    // 4. Create notification in database
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        priority,
        title,
        message,
        metadata: metadata as any,
        actionUrl,
        actionText,
      },
    });

    // 5. Send to each enabled channel (async, don't block)
    this.deliverToChannels(notification, enabledChannels).catch((error) => {
      console.error('[Notifications] Delivery error:', error);
    });

    return notification;
  }

  /**
   * Deliver notification to multiple channels
   */
  private static async deliverToChannels(
    notification: Notification,
    channels: NotificationChannel[]
  ): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];

    for (const channel of channels) {
      const result = await this.deliverToChannel(notification, channel);
      results.push(result);
    }

    return results;
  }

  /**
   * Deliver to a single channel
   */
  private static async deliverToChannel(
    notification: Notification,
    channel: NotificationChannel
  ): Promise<DeliveryResult> {
    try {
      // Create delivery record
      const delivery = await prisma.notificationDelivery.create({
        data: {
          notificationId: notification.id,
          channel,
          sent: false,
        },
      });

      let success = false;
      let error: string | undefined;

      // Handle each channel type
      switch (channel) {
        case 'IN_APP':
          // Already in DB, just mark as sent
          success = true;
          break;

        case 'EMAIL':
          try {
            await sendEmailNotification(notification, delivery.id);
            success = true;
          } catch (err: any) {
            error = err.message;
            console.error('[Notifications] Email delivery failed:', err);
          }
          break;

        case 'WEBHOOK':
          try {
            await sendWebhookNotification(notification, delivery.id);
            success = true;
          } catch (err: any) {
            error = err.message;
            console.error('[Notifications] Webhook delivery failed:', err);
          }
          break;
      }

      // Update delivery record
      const now = new Date();
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: success
          ? {
              sent: true,
              sentAt: now,
              delivered: true,
              deliveredAt: now,
            }
          : {
              failed: true,
              failedAt: now,
              error,
            },
      });

      return {
        success,
        channel,
        sentAt: success ? now : undefined,
        deliveredAt: success ? now : undefined,
        error,
      };
    } catch (error: any) {
      console.error(
        `[Notifications] Channel ${channel} delivery failed:`,
        error
      );
      return {
        success: false,
        channel,
        error: error.message,
      };
    }
  }

  /**
   * Determine which channels should be used based on preferences
   */
  private static determineChannels(
    type: NotificationType,
    preferences: NotificationPreference[],
    requestedChannels?: NotificationChannel[]
  ): NotificationChannel[] {
    // Find preference for this notification type
    const pref = preferences.find((p) => p.type === type);

    if (!pref) {
      // No preference set, use defaults
      return requestedChannels || DEFAULT_CHANNELS[type] || ['IN_APP'];
    }

    // Build list of enabled channels based on preferences
    const channels: NotificationChannel[] = [];
    if (pref.inApp) channels.push('IN_APP');
    if (pref.email) channels.push('EMAIL');
    if (pref.webhook) channels.push('WEBHOOK');

    return channels;
  }

  /**
   * Get user's notification preferences
   */
  private static async getUserPreferences(
    userId: string
  ): Promise<NotificationPreference[]> {
    // Check if user has global notifications disabled
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        emailNotificationsEnabled: true,
        pushNotificationsEnabled: true,
      },
    });

    if (!user?.emailNotificationsEnabled) {
      // User disabled all email notifications
      // Return empty to filter out email channel
      return [];
    }

    // Get user's specific preferences
    const prefs = await prisma.notificationPreference.findMany({
      where: { userId },
    });

    return prefs;
  }

  /**
   * Get user's notifications (paginated)
   */
  static async getUserNotifications(
    userId: string,
    params: GetNotificationsParams = {}
  ): Promise<NotificationListResponse> {
    const {
      page = 1,
      limit = 20,
      unreadOnly = false,
      type,
      priority,
    } = params;

    // Build where clause
    const where: any = {
      userId,
      archived: false,
    };

    if (unreadOnly) {
      where.read = false;
    }

    if (type) {
      where.type = type;
    }

    if (priority) {
      where.priority = priority;
    }

    // Get total count
    const total = await prisma.notification.count({ where });

    // Get paginated notifications
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    });

    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        read: false,
        archived: false,
      },
    });

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
      unreadCount,
    };
  }

  /**
   * Get unread count for badge
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        read: false,
        archived: false,
      },
    });
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(
    notificationId: string,
    userId: string
  ): Promise<Notification> {
    // Verify ownership
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new Error('Notification not found or access denied');
    }

    if (notification.read) {
      return notification; // Already read
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
        archived: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Archive (soft delete) a notification
   */
  static async archive(
    notificationId: string,
    userId: string
  ): Promise<Notification> {
    // Verify ownership
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new Error('Notification not found or access denied');
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: {
        archived: true,
        archivedAt: new Date(),
      },
    });
  }

  /**
   * Create default preferences for a new user
   * Call this when a user signs up
   */
  static async createDefaultPreferences(
    userId: string
  ): Promise<NotificationPreference[]> {
    const defaultPrefs: Array<{
      userId: string;
      type: NotificationType;
      inApp: boolean;
      email: boolean;
      webhook: boolean;
    }> = [];

    // Create a preference for each notification type with defaults
    const allTypes: NotificationType[] = [
      'NEW_APPLICATION',
      'APPLICATION_STATUS_CHANGE',
      'APPLICATION_COMMENT',
      'ASSESSMENT_INVITATION',
      'ASSESSMENT_REMINDER',
      'ASSESSMENT_COMPLETED',
      'ASSESSMENT_RESULTS',
      'JOB_POSTED',
      'JOB_CLOSING_SOON',
      'JOB_EXPIRED',
      'TEAM_MENTION',
      'TEAM_ASSIGNED',
      'ACCOUNT_VERIFIED',
      'PASSWORD_RESET',
      'SUBSCRIPTION_EXPIRING',
    ];

    for (const type of allTypes) {
      const channels = DEFAULT_CHANNELS[type];
      defaultPrefs.push({
        userId,
        type,
        inApp: channels.includes('IN_APP'),
        email: channels.includes('EMAIL'),
        webhook: channels.includes('WEBHOOK'),
      });
    }

    // Use createMany for efficiency
    await prisma.notificationPreference.createMany({
      data: defaultPrefs,
      skipDuplicates: true,
    });

    // Return created preferences
    return prisma.notificationPreference.findMany({
      where: { userId },
    });
  }

  /**
   * Update user preferences
   */
  static async updatePreferences(
    userId: string,
    preferences: Array<{
      type: NotificationType;
      inApp: boolean;
      email: boolean;
      webhook: boolean;
    }>
  ): Promise<NotificationPreference[]> {
    // Update each preference
    for (const pref of preferences) {
      await prisma.notificationPreference.upsert({
        where: {
          userId_type: {
            userId,
            type: pref.type,
          },
        },
        update: {
          inApp: pref.inApp,
          email: pref.email,
          webhook: pref.webhook,
        },
        create: {
          userId,
          type: pref.type,
          inApp: pref.inApp,
          email: pref.email,
          webhook: pref.webhook,
        },
      });
    }

    // Return updated preferences
    return prisma.notificationPreference.findMany({
      where: { userId },
    });
  }
}