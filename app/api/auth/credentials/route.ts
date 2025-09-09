import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return Response.json({ ok: false, error: "Usuario no encontrado" }, { status: 401 });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return Response.json({ ok: false, error: "Credenciales inválidas" }, { status: 401 });
  // For MVP we just confirm login (no session). In production, integrate NextAuth properly.
  return Response.json({ ok: true, role: user.role });
}
