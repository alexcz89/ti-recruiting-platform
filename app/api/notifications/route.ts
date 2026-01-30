// app/api/notifications/route.ts
// GET /api/notifications - List user notifications (paginated)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { NotificationService } from '@/lib/notifications/service';
import type { GetNotificationsParams } from '@/lib/notifications/types';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    
    const params: GetNotificationsParams = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      unreadOnly: searchParams.get('unreadOnly') === 'true',
      type: searchParams.get('type') as any,
      priority: searchParams.get('priority') as any,
    };

    // Validate limits
    if (params.limit && params.limit > 100) {
      params.limit = 100;
    }

    // 3. Get notifications
    const result = await NotificationService.getUserNotifications(
      session.user.id,
      params
    );

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { headers: { "Cache-Control": "no-store" } }
    );

  } catch (error: any) {
    console.error('[API] Error fetching notifications:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch notifications',
        details: error.message,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
