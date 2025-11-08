// app/api/profile/set-resume/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }
    const { resumeUrl } = await req.json() as { resumeUrl?: string };
    if (!resumeUrl) {
      return NextResponse.json({ message: "Falta resumeUrl" }, { status: 400 });
    }

    await prisma.user.update({
      where: { email: session.user.email },
      data: { resumeUrl },
    });

    return NextResponse.json({ ok: true });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ message: e?.message || "Error actualizando resumeUrl" }, { status: 500 });
  }
}
