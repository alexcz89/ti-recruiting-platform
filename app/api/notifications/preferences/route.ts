// app/api/notifications/preferences/route.ts
// GET/PUT /api/notifications/preferences - Manage notification preferences

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';

export async function GET(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get preferences
    const preferences = await prisma.notificationPreference.findMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      success: true,
      data: { preferences },
    });

  } catch (error: any) {
    console.error('[API] Error fetching preferences:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch preferences',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse body
    const body = await request.json();
    const { preferences } = body;

    if (!Array.isArray(preferences)) {
      return NextResponse.json(
        { success: false, error: 'Invalid preferences format' },
        { status: 400 }
      );
    }

    // 3. Group preferences by type (schema has: type, inApp, email, webhook)
    const userId = session.user.id;
    
    const grouped = preferences.reduce((acc: any, pref: any) => {
      if (!acc[pref.type]) {
        acc[pref.type] = { type: pref.type, inApp: false, email: false };
      }
      if (pref.channel === 'IN_APP') acc[pref.type].inApp = pref.enabled;
      if (pref.channel === 'EMAIL') acc[pref.type].email = pref.enabled;
      return acc;
    }, {});

    // Delete all existing preferences for this user
    await prisma.notificationPreference.deleteMany({
      where: { userId },
    });

    // Create new preferences (one record per notification type)
    await prisma.notificationPreference.createMany({
      data: Object.values(grouped).map((pref: any) => ({
        userId,
        type: pref.type,
        inApp: pref.inApp,
        email: pref.email,
        webhook: false,
        frequency: 'IMMEDIATE',
      })),
    });

    return NextResponse.json({
      success: true,
      message: 'Preferences updated',
    });

  } catch (error: any) {
    console.error('[API] Error updating preferences:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update preferences',
        details: error.message,
      },
      { status: 500 }
    );
  }
}