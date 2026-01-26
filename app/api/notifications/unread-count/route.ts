// app/api/notifications/unread-count/route.ts
// GET /api/notifications/unread-count - Get unread count for badge

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { NotificationService } from '@/lib/notifications/service';

export async function GET() {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get unread count
    const count = await NotificationService.getUnreadCount(session.user.id);

    return NextResponse.json({
      success: true,
      data: { count },
    });

  } catch (error: any) {
    console.error('[API] Error fetching unread count:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch unread count',
        details: error.message,
      },
      { status: 500 }
    );
  }
}