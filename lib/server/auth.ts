// lib/server/auth.ts

import "server-only";
import { PrismaClient, Role } from "@prisma/client";
import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { ensureUserCompanyByEmail } from "@/lib/company";

const prisma = (globalThis as any).prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  (globalThis as any).prisma = prisma;
}

const SESSION_MAX_AGE_DEFAULT = 60 * 60 * 8; // 8 horas
const SESSION_MAX_AGE_REMEMBER = 60 * 60 * 24 * 30; // 30 días

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string | null;
  rememberMe?: boolean;
};

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

    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" },
        rememberMe: { label: "Remember Me", type: "text" },
      },
      async authorize(credentials) {
        try {
          console.log("[AUTH] authorize start", {
            hasEmail: Boolean(credentials?.email),
            hasPassword: Boolean(credentials?.password),
            role: credentials?.role ?? null,
            rememberMe: credentials?.rememberMe ?? null,
          });

          if (!credentials?.email || !credentials?.password) {
            console.log("[AUTH] missing credentials");
            return null;
          }

          const email = credentials.email.toLowerCase().trim();
          const intendedRole: Role =
            credentials.role === "RECRUITER" ? "RECRUITER" : "CANDIDATE";

          console.log("[AUTH] normalized input", {
            email,
            intendedRole,
            passwordLength: credentials.password.length,
          });

          const dbUser = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              passwordHash: true,
              emailVerified: true,
              recruiterProfile: {
                select: {
                  companyId: true,
                },
              },
            },
          });

          console.log("[AUTH] dbUser found", {
            exists: Boolean(dbUser),
            id: dbUser?.id ?? null,
            email: dbUser?.email ?? null,
            role: dbUser?.role ?? null,
            hasPasswordHash: Boolean(dbUser?.passwordHash),
            emailVerified: dbUser?.emailVerified ?? null,
            recruiterCompanyId: dbUser?.recruiterProfile?.companyId ?? null,
          });

          if (!dbUser || !dbUser.passwordHash) {
            console.log("[AUTH] user not found or without passwordHash");
            return null;
          }

          const isValidPassword = await bcrypt.compare(
            credentials.password,
            dbUser.passwordHash
          );

          console.log("[AUTH] password result", {
            email,
            isValidPassword,
          });

          if (!isValidPassword) {
            console.log("[AUTH] password check failed");
            return null;
          }

          console.log("[AUTH] role check", {
            dbRole: dbUser.role,
            intendedRole,
            matches: dbUser.role === intendedRole,
          });

          // ADMIN puede autenticarse desde el tab de Reclutador
          if (dbUser.role !== intendedRole && dbUser.role !== "ADMIN") {
            console.log("[AUTH] role mismatch");
            return null;
          }

          if (!dbUser.emailVerified) {
            console.log("[AUTH] email not verified");
            throw new Error("EMAIL_NOT_VERIFIED:" + email);
          }

          let companyId = dbUser.recruiterProfile?.companyId ?? null;

          console.log("[AUTH] company before ensure", {
            email,
            intendedRole,
            companyId,
          });

          if (intendedRole === "RECRUITER" && !companyId) {
            console.log("[AUTH] recruiter without companyId, ensuring company");
            const company = await ensureUserCompanyByEmail({
              userId: dbUser.id,
              email,
              suggestedName: null,
              country: null,
              city: null,
            });
            companyId = company?.id ?? null;

            console.log("[AUTH] ensureUserCompanyByEmail result", {
              email,
              companyId,
            });
          }

          const authUser: AuthUser = {
            id: dbUser.id,
            name: dbUser.name ?? email.split("@")[0],
            email: dbUser.email,
            role: dbUser.role,
            companyId,
            rememberMe: credentials.rememberMe === "true",
          };

          console.log("[AUTH] authorize success", {
            id: authUser.id,
            email: authUser.email,
            role: authUser.role,
            companyId: authUser.companyId,
            rememberMe: authUser.rememberMe,
          });

          return authUser;
        } catch (error) {
          console.error("[AUTH] authorize exception", error);
          throw error;
        }
      },
    }),

    CredentialsProvider({
      id: "auto-login-token",
      name: "AutoLoginToken",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        try {
          console.log("[AUTH] auto-login start", {
            hasToken: Boolean(credentials?.token),
          });

          if (!credentials?.token) {
            console.log("[AUTH] auto-login missing token");
            return null;
          }

          const record = await prisma.autoLoginToken.findUnique({
            where: { token: credentials.token },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  role: true,
                  emailVerified: true,
                  recruiterProfile: {
                    select: {
                      companyId: true,
                    },
                  },
                },
              },
            },
          });

          console.log("[AUTH] auto-login record", {
            exists: Boolean(record),
            usedAt: record?.usedAt ?? null,
            expiresAt: record?.expiresAt ?? null,
            userId: record?.user?.id ?? null,
            recruiterCompanyId:
              record?.user?.recruiterProfile?.companyId ?? null,
          });

          if (!record) return null;
          if (record.usedAt) return null;
          if (record.expiresAt < new Date()) return null;

          await prisma.autoLoginToken.update({
            where: { token: credentials.token },
            data: { usedAt: new Date() },
          });

          const user = record.user;

          let companyId = user.recruiterProfile?.companyId ?? null;

          if (user.role === "RECRUITER" && !companyId) {
            console.log("[AUTH] auto-login recruiter without companyId");
            const company = await ensureUserCompanyByEmail({
              userId: user.id,
              email: user.email,
              suggestedName: null,
              country: null,
              city: null,
            });
            companyId = company?.id ?? null;
          }

          const authUser: AuthUser = {
            id: user.id,
            name: user.name ?? user.email.split("@")[0],
            email: user.email,
            role: user.role,
            companyId,
            rememberMe: false,
          };

          console.log("[AUTH] auto-login success", {
            id: authUser.id,
            email: authUser.email,
            role: authUser.role,
            companyId: authUser.companyId,
          });

          return authUser;
        } catch (error) {
          console.error("[AUTH] auto-login exception", error);
          throw error;
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_DEFAULT,
  },

  jwt: {
    maxAge: SESSION_MAX_AGE_REMEMBER,
  },

  callbacks: {
    async signIn({ user, account }) {
      console.log("[AUTH] signIn callback", {
        provider: account?.provider ?? null,
        email: user.email ?? null,
      });

      if (account?.provider === "google") {
        const email = user.email?.toLowerCase().trim();
        if (!email) return false;

        const existingUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true, role: true, emailVerified: true },
        });

        console.log("[AUTH] google signIn existingUser", {
          email,
          exists: Boolean(existingUser),
          role: existingUser?.role ?? null,
          emailVerified: existingUser?.emailVerified ?? null,
        });

        if (existingUser) {
          // Usuario existente — solo CANDIDATE puede entrar por Google
          if (existingUser.role !== "CANDIDATE") return false;

          // Auto-verificar email si aún no está verificado
          if (!existingUser.emailVerified) {
            await prisma.user.update({
              where: { email },
              data: { emailVerified: new Date() },
            });
          }
          return true;
        }

        // ✅ Usuario nuevo → crear automáticamente como CANDIDATE
        // Google ya verificó el email, no necesitamos confirmación adicional
        const googleName = user.name ?? email.split("@")[0];
        await prisma.user.create({
          data: {
            email,
            name: googleName,
            role: "CANDIDATE",
            emailVerified: new Date(), // Google garantiza el email
            passwordHash: null,        // Sin contraseña — acceso solo via Google
          },
        });

        console.log("[AUTH] google signIn newUser created", { email, name: googleName });
        return true;
      }

      return true;
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        const authUser = user as AuthUser;
        token.email = authUser.email;
        (token as any).id = authUser.id;
        (token as any).role = authUser.role;
        (token as any).companyId = authUser.companyId ?? null;
        (token as any).rememberMe = Boolean(authUser.rememberMe);
        (token as any).sessionMode = authUser.rememberMe
          ? "extended"
          : "default";

        console.log("[AUTH] jwt initial user", {
          email: authUser.email,
          id: authUser.id,
          role: authUser.role,
          companyId: authUser.companyId,
          rememberMe: authUser.rememberMe,
        });
      }

      if (trigger === "update" && session) {
        if (typeof (session as any).rememberMe === "boolean") {
          (token as any).rememberMe = Boolean((session as any).rememberMe);
          (token as any).sessionMode = (session as any).rememberMe
            ? "extended"
            : "default";
        }

        console.log("[AUTH] jwt update trigger", {
          rememberMe: (token as any).rememberMe,
          sessionMode: (token as any).sessionMode,
        });
      }

      const email = token.email as string | undefined;

      if (email) {
        const dbUser = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            role: true,
            emailVerified: true,
            recruiterProfile: {
              select: {
                companyId: true,
              },
            },
          },
        });

        if (dbUser) {
          (token as any).id = dbUser.id;
          (token as any).role = dbUser.role;
          (token as any).companyId =
            dbUser.recruiterProfile?.companyId ?? null;
          (token as any).emailVerified = dbUser.emailVerified ?? null;

          console.log("[AUTH] jwt refresh", {
            email,
            id: dbUser.id,
            role: dbUser.role,
            companyId: dbUser.recruiterProfile?.companyId ?? null,
            emailVerified: dbUser.emailVerified ?? null,
          });
        } else {
          console.log("[AUTH] jwt refresh missing dbUser", { email });
        }
      }

      return token;
    },

    async session({ session, token }) {
      (session.user as any).id = (token as any).id ?? null;
      (session.user as any).role = (token as any).role ?? "CANDIDATE";
      (session.user as any).companyId = (token as any).companyId ?? null;
      (session.user as any).emailVerified =
        (token as any).emailVerified ?? null;
      (session as any).rememberMe = Boolean((token as any).rememberMe);
      (session as any).sessionMode =
        (token as any).sessionMode ?? "default";

      console.log("[AUTH] session callback", {
        userId: (session.user as any).id ?? null,
        role: (session.user as any).role ?? null,
        companyId: (session.user as any).companyId ?? null,
        emailVerified: (session.user as any).emailVerified ?? null,
        rememberMe: (session as any).rememberMe,
        sessionMode: (session as any).sessionMode,
      });

      return session;
    },
  },

  pages: {
    signIn: "/auth/signin",
  },

  secret: process.env.NEXTAUTH_SECRET,
};