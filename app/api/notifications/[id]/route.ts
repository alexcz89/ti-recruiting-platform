// app/api/notifications/[id]/route.ts
// DELETE /api/notifications/:id - Delete (archive) notification

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { NotificationService } from '@/lib/notifications/service';

export async function DELETE(
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

    // 2. Archive notification
    const notification = await NotificationService.archive(
      params.id,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      data: { notification },
      message: 'Notification deleted',
    });

  } catch (error: any) {
    console.error('[API] Error deleting notification:', error);
    
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
        error: 'Failed to delete notification',
        details: error.message,
      },
      { status: 500 }
    );
  }
}