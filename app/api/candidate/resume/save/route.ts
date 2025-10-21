// app/api/candidate/resume/save/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma"; // ajusta si tu cliente está en otra ruta
import { upsertCandidateResume } from "@/lib/db/candidate";
import { ResumePayloadSchema } from "@/types/resume"; // ya lo tienes

// ⚠️ Cambia esto por tu forma real de obtener el userId (NextAuth, session, etc.)
async function getCurrentUserId() {
  // Ejemplo: const session = await auth();
  // if (!session?.user?.id) return null;
  // return session.user.id;
  return null; // <- placeholder
}

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = ResumePayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await upsertCandidateResume(prisma, userId, parsed.data);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[resume/save] error", err);
    return NextResponse.json(
      { error: "No se pudo guardar el CV" },
      { status: 500 }
    );
  }
}
