// lib/auth.ts
import { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaClient, Role } from "@prisma/client"

const prisma = new PrismaClient()

export const authOptions: NextAuthOptions = {
  // ✅ Solo Credentials: sin Google/GitHub
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email:    { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        // el form debe mandar un hidden input con el rol que intenta usar
        role:     { label: "Role", type: "text" }, // "RECRUITER" | "CANDIDATE"
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email.toLowerCase().trim()
        const intendedRole: Role =
          credentials.role === "RECRUITER" ? "RECRUITER" : "CANDIDATE"

        // 🔐 Busca el usuario por email
        let dbUser = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true, email: true, name: true,
            role: true, companyId: true, passwordHash: true
          },
        })

        // ⚠️ IMPORTANTE:
        // Para employers, la autenticación es SOLO por email/contraseña (este provider).
        // Aquí no hay OAuth, y si el usuario existe con un rol diferente, se rechaza.
        if (!dbUser) {
          // Si no existe, lo creamos con el rol solicitado (MVP simple con password "demo").
          dbUser = await prisma.user.create({
            data: {
              email,
              name: email.split("@")[0],
              passwordHash: "demo", // ⚠️ MVP: sin verificación de password real
              role: intendedRole,
            },
            select: { id: true, email: true, name: true, role: true, companyId: true },
          })
        } else {
          // Si el usuario existe pero intenta entrar con un rol distinto → rechaza
          if (dbUser.role !== intendedRole) {
            return null
          }
        }

        // Retorna el shape que NextAuth usará para firmar el JWT
        return {
          id: dbUser.id,
          name: dbUser.name ?? email.split("@")[0],
          email: dbUser.email,
          role: dbUser.role,
          companyId: dbUser.companyId ?? null,
        } as any
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      // Primer login: propaga datos del usuario al token
      if (user) {
        token.email = (user as any).email
        ;(token as any).id = (user as any).id
        ;(token as any).role = (user as any).role
        ;(token as any).companyId = (user as any).companyId ?? null
        return token
      }

      // Renovaciones: sincroniza rol/ids desde BD por seguridad
      const email = token.email as string | undefined
      if (email) {
        const dbUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true, role: true, companyId: true },
        })
        if (dbUser) {
          ;(token as any).id = dbUser.id
          ;(token as any).role = dbUser.role
          ;(token as any).companyId = dbUser.companyId ?? null
        }
      }
      return token
    },

    async session({ session, token }) {
      ;(session.user as any).id = (token as any).id ?? null
      ;(session.user as any).role = (token as any).role ?? "CANDIDATE"
      ;(session.user as any).companyId = (token as any).companyId ?? null
      return session
    },
  },

  pages: {
    signIn: "/signin",
  },
}
