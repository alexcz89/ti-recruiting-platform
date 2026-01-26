// app/api/notifications/mark-all-read/route.ts
// PATCH /api/notifications/mark-all-read - Mark all notifications as read

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { NotificationService } from '@/lib/notifications/service';

export async function PATCH() {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Mark all as read
    const count = await NotificationService.markAllAsRead(session.user.id);

    return NextResponse.json({
      success: true,
      data: { count },
      message: `${count} notification(s) marked as read`,
    });

  } catch (error: any) {
    console.error('[API] Error marking all notifications as read:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to mark all notifications as read',
        details: error.message,
      },
      { status: 500 }
    );
  }
}