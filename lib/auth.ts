// lib/auth.ts
import { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email:   { label: "Email", type: "email" },
        password:{ label: "Password", type: "password" },
        role:    { label: "Role", type: "text" },      // "RECRUITER" | "CANDIDATE"
        signup:  { label: "Signup", type: "text" },    // opcional (UX)
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email.toLowerCase()
        const intendedRole =
          credentials.role === "RECRUITER" ? "RECRUITER" : "CANDIDATE"

        // 1) Busca usuario
        let dbUser = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true, email: true, name: true,
            role: true, companyId: true, passwordHash: true
          },
        })

        // 2) Si no existe, auto-crear con el rol solicitado (MVP)
        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              email,
              name: email.split("@")[0],
              passwordHash: "demo",   // MVP: sin validar contraseña real
              role: intendedRole,
            },
            select: { id: true, email: true, name: true, role: true, companyId: true },
          })
        } else {
          // 3) Si ya existe pero su rol NO coincide con lo que intenta loguear → rechaza
          if (dbUser.role !== intendedRole) {
            // hará que NextAuth devuelva CredentialsSignin
            return null
          }
        }

        // 4) Retorna shape que NextAuth pondrá en "user" (primera vez del login)
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
      // Primer login de la sesión: viene "user" desde authorize()
      if (user) {
        token.email = (user as any).email
        ;(token as any).id = (user as any).id
        ;(token as any).role = (user as any).role
        ;(token as any).companyId = (user as any).companyId ?? null
        return token
      }

      // Renovaciones subsecuentes: asegura id/role/companyId buscando en BD
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
      // Propaga al cliente lo que necesitamos en todas las páginas/API
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
