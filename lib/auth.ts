// lib/auth.ts
import { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Whitelists de ejemplo (ajusta a tus correos reales si quieres)
const ADMIN_EMAILS = new Set(["admin@demo.local"]);
const RECRUITER_EMAILS = new Set(["recruiter@demo.local"]);

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase();

        // 1) Intenta leer usuario desde BD
        let dbUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, role: true, passwordHash: true },
        });

        // 2) Si no existe, créalo con un rol razonable (demo)
        if (!dbUser) {
          const role = ADMIN_EMAILS.has(email)
            ? "ADMIN"
            : RECRUITER_EMAILS.has(email)
            ? "RECRUITER"
            : "CANDIDATE";

          dbUser = await prisma.user.create({
            data: {
              email,
              name: email.split("@")[0],
              passwordHash: "demo", // demo: no validamos pass real
              role,
            },
            select: { id: true, email: true, name: true, role: true },
          });
        }

        // DEV: acepta cualquier password (demo). En producción valida hash.
        return {
          id: dbUser.id,
          name: dbUser.name ?? email.split("@")[0],
          email: dbUser.email,
          role: dbUser.role,
        } as any;
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      // Si acaba de loguearse vía Credentials, ya viene user con role
      if (user?.email) {
        token.email = user.email;
        (token as any).role = (user as any).role;
        return token;
      }

      // Sesiones subsecuentes: resuelve rol desde BD o whitelist
      const email = token.email as string | undefined;
      if (email) {
        const dbUser = await prisma.user.findUnique({
          where: { email },
          select: { role: true },
        });
        if (dbUser?.role) {
          (token as any).role = dbUser.role;
        } else {
          if (ADMIN_EMAILS.has(email)) (token as any).role = "ADMIN";
          else if (RECRUITER_EMAILS.has(email)) (token as any).role = "RECRUITER";
          else (token as any).role = "CANDIDATE";
        }
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as any).role = (token as any).role ?? "CANDIDATE";
      return session;
    },
  },
};
