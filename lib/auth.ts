// lib/auth.ts
import { PrismaClient, Role } from "@prisma/client";
import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const prisma = (globalThis as any).prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") (globalThis as any).prisma = prisma;

/* ===========================================================
 * NextAuth configuration
 * =========================================================== */
export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" }, // "RECRUITER" | "CANDIDATE"
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const intendedRole: Role =
          credentials.role === "RECRUITER" ? "RECRUITER" : "CANDIDATE";

        // 🔎 Busca el usuario por email
        let dbUser = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            companyId: true,
            passwordHash: true,
          },
        });

        // ⚠️ MVP: crea usuario si no existe (sin password real)
        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              email,
              name: email.split("@")[0],
              passwordHash: "demo", // ⚠️ Temporal (no producción)
              role: intendedRole,
            },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              companyId: true,
            },
          });
        } else {
          // Si el rol no coincide → rechazo
          if (dbUser.role !== intendedRole) return null;
        }

        return {
          id: dbUser.id,
          name: dbUser.name ?? email.split("@")[0],
          email: dbUser.email,
          role: dbUser.role,
          companyId: dbUser.companyId ?? null,
        } as any;
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      // Primer login → propaga datos del usuario
      if (user) {
        token.email = (user as any).email;
        (token as any).id = (user as any).id;
        (token as any).role = (user as any).role;
        (token as any).companyId = (user as any).companyId ?? null;
        return token;
      }

      // Renovaciones → sincroniza datos por seguridad
      const email = token.email as string | undefined;
      if (email) {
        const dbUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true, role: true, companyId: true },
        });
        if (dbUser) {
          (token as any).id = dbUser.id;
          (token as any).role = dbUser.role;
          (token as any).companyId = dbUser.companyId ?? null;
        }
      }
      return token;
    },

    async session({ session, token }) {
      // ✅ Exponer el ID real del usuario en la sesión
      (session.user as any).id = (token as any).id ?? null;
      (session.user as any).role = (token as any).role ?? "CANDIDATE";
      (session.user as any).companyId = (token as any).companyId ?? null;
      return session;
    },
  },

  pages: {
    signIn: "/auth/signin",
  },

  debug: process.env.NODE_ENV !== "production",
};

export default authOptions;
