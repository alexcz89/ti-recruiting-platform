// app/api/profile/resume/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ resumeUrl: null }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { resumeUrl: true },
    });

    return NextResponse.json({ resumeUrl: user?.resumeUrl ?? null });
  } catch (e:any) {
    return NextResponse.json({ resumeUrl: null, error: e?.message }, { status: 500 });
  }
}
