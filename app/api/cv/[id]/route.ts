import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resume = await prisma.resume.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, data: true, htmlSnapshot: true, createdAt: true, userId: true },
  });
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // (Opcional) validar pertenencia
  const me = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!me || me.id !== resume.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ resume });
}
