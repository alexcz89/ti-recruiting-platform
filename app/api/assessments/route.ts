// app/api/assessments/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/assessments - Lista todos los templates disponibles
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const templates = await prisma.assessmentTemplate.findMany({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        type: true,
        difficulty: true,
        totalQuestions: true,
        passingScore: true,
        timeLimit: true,
        sections: true,
        _count: {
          select: {
            questions: true,
            codingChallenges: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Error al cargar templates' },
      { status: 500 }
    );
  }
}