import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const entry = await prisma.codexEntry.findUnique({ where: { slug: params.slug } });
  if (!entry || !entry.published) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(entry);
}

// TODO: protege con auth (solo admins)
export async function PUT(req: Request, { params }: { params: { slug: string } }) {
  const data = await req.json();
  const updated = await prisma.codexEntry.update({ where: { slug: params.slug }, data });
  return NextResponse.json(updated);
}
