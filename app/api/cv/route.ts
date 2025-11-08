import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { title = "Mi CV", data, html } = body || {};

  if (!data || !html) {
    return NextResponse.json({ error: "Missing data/html" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const resume = await prisma.resume.create({
    data: {
      userId: user.id,
      title,
      data,
      htmlSnapshot: String(html),
    },
    select: { id: true, title: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, resume });
}
