import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  const tag = searchParams.get('tag') ?? '';
  const tech = searchParams.get('tech') ?? '';

  const entries = await prisma.codexEntry.findMany({
    where: {
      published: true,
      AND: [
        q ? { OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { content: { contains: q, mode: 'insensitive' } }
        ] } : {},
        tag ? { tags: { has: tag } } : {},
        tech ? { tech: { equals: tech } } : {},
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: { id:true, title:true, slug:true, excerpt:true, tags:true, tech:true, createdAt:true }
  });
  return NextResponse.json(entries);
}

// TODO: protege con auth (solo admins)
export async function POST(req: Request) {
  const data = await req.json();
  const created = await prisma.codexEntry.create({ data });
  return NextResponse.json(created, { status: 201 });
}
