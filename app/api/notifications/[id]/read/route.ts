// app/api/notifications/[id]/read/route.ts
// PATCH /api/notifications/:id/read - Mark notification as read

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { NotificationService } from '@/lib/notifications/service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Mark as read
    const notification = await NotificationService.markAsRead(
      params.id,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      data: { notification },
    });

  } catch (error: any) {
    console.error('[API] Error marking notification as read:', error);
    
    if (error.message.includes('not found')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Notification not found or access denied',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to mark notification as read',
        details: error.message,
      },
      { status: 500 }
    );
  }
}