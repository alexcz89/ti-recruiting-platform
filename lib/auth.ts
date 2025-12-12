// lib/auth.ts
import { PrismaClient, Role } from "@prisma/client";
import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { ensureUserCompanyByEmail } from "@/lib/company";

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

        // 🔎 1) Buscar usuario en BD
        const dbUser = await prisma.user.findUnique({
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

        // ❌ Si no existe usuario → credenciales inválidas
        if (!dbUser || !dbUser.passwordHash) {
          return null;
        }

        // 🔐 2) Verificar contraseña con bcrypt
        const isValidPassword = await bcrypt.compare(
          credentials.password,
          dbUser.passwordHash
        );

        if (!isValidPassword) {
          return null;
        }

        // 🎭 3) Rol: solo permitimos entrar al rol correcto
        // (Admin puede entrar a ambos si quieres; aquí lo dejamos estricto)
        if (dbUser.role !== intendedRole) {
          return null;
        }

        // 🏢 4) Si es RECRUITER y no tiene companyId, ligamos por dominio
        let companyId = dbUser.companyId ?? null;
        if (intendedRole === "RECRUITER" && !companyId) {
          const company = await ensureUserCompanyByEmail({
            userId: dbUser.id,
            email,
            suggestedName: null,
            country: null,
            city: null,
          });
          companyId = company?.id ?? null;
        }

        // ✅ Usuario autenticado
        return {
          id: dbUser.id,
          name: dbUser.name ?? email.split("@")[0],
          email: dbUser.email,
          role: dbUser.role,
          companyId,
        } as any;
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      // Primer login → propaga datos básicos
      if (user) {
        token.email = (user as any).email;
        (token as any).id = (user as any).id;
        (token as any).role = (user as any).role;
        (token as any).companyId = (user as any).companyId ?? null;
      }

      // Renovaciones → sincroniza SIEMPRE contra la BD (incluye emailVerified)
      const email = token.email as string | undefined;
      if (email) {
        const dbUser = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            role: true,
            companyId: true,
            emailVerified: true,
          },
        });

        if (dbUser) {
          (token as any).id = dbUser.id;
          (token as any).role = dbUser.role;
          (token as any).companyId = dbUser.companyId ?? null;
          (token as any).emailVerified = dbUser.emailVerified ?? null;
        }
      }

      return token;
    },

    async session({ session, token }) {
      (session.user as any).id = (token as any).id ?? null;
      (session.user as any).role = (token as any).role ?? "CANDIDATE";
      (session.user as any).companyId = (token as any).companyId ?? null;
      (session.user as any).emailVerified = (token as any).emailVerified ?? null;
      return session;
    },
  },

  pages: {
    signIn: "/auth/signin",
  },

  debug: process.env.NODE_ENV !== "production",
};

export default authOptions;
