// lib/server/auth.ts

import 'server-only';
import { PrismaClient, Role } from "@prisma/client";
import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { ensureUserCompanyByEmail } from "@/lib/company";

const prisma = (globalThis as any).prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") (globalThis as any).prisma = prisma;

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),

    // ✅ Provider normal con email/password
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const intendedRole: Role =
          credentials.role === "RECRUITER" ? "RECRUITER" : "CANDIDATE";

        const dbUser = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            companyId: true,
            passwordHash: true,
            emailVerified: true,
          },
        });

        if (!dbUser || !dbUser.passwordHash) return null;

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          dbUser.passwordHash
        );
        if (!isValidPassword) return null;

        if (dbUser.role !== intendedRole) return null;

        if (!dbUser.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED:" + email);
        }

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

        return {
          id: dbUser.id,
          name: dbUser.name ?? email.split("@")[0],
          email: dbUser.email,
          role: dbUser.role,
          companyId,
        } as any;
      },
    }),

    // ✅ Provider de auto-login con token de un solo uso (post-verificación de email)
    CredentialsProvider({
      id: "auto-login-token",
      name: "AutoLoginToken",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token) return null;

        const record = await prisma.autoLoginToken.findUnique({
          where: { token: credentials.token },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                companyId: true,
                emailVerified: true,
              },
            },
          },
        });

        if (!record) return null;
        if (record.usedAt) return null;
        if (record.expiresAt < new Date()) return null;

        // Marcar como usado (one-time use)
        await prisma.autoLoginToken.update({
          where: { token: credentials.token },
          data: { usedAt: new Date() },
        });

        const user = record.user;

        let companyId = user.companyId ?? null;
        if (user.role === "RECRUITER" && !companyId) {
          const company = await ensureUserCompanyByEmail({
            userId: user.id,
            email: user.email,
            suggestedName: null,
            country: null,
            city: null,
          });
          companyId = company?.id ?? null;
        }

        return {
          id: user.id,
          name: user.name ?? user.email.split("@")[0],
          email: user.email,
          role: user.role,
          companyId,
        } as any;
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email?.toLowerCase().trim();
        if (!email) return false;

        const existingUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true, role: true, emailVerified: true },
        });

        if (existingUser) {
          if (existingUser.role !== "CANDIDATE") return false;

          if (!existingUser.emailVerified) {
            await prisma.user.update({
              where: { email },
              data: { emailVerified: new Date() },
            });
          }
          return true;
        }

        return "/auth/signin?error=google_no_account";
      }

      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.email = (user as any).email;
        (token as any).id = (user as any).id;
        (token as any).role = (user as any).role;
        (token as any).companyId = (user as any).companyId ?? null;
      }

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
    error: "/auth/signin",
  },

  debug: process.env.NODE_ENV !== "production",
};

export default authOptions;