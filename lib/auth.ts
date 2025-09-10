// lib/auth.ts
import { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";

export const authOptions: NextAuthOptions = {
  providers: [
    // OAuth (configura tus envs)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID ?? "",
      clientSecret: process.env.GITHUB_SECRET ?? "",
    }),

    // Credenciales (ejemplo mínimo — AJÚSTALO a tu DB real)
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // TODO: valida en tu DB (bcrypt, etc.)
        if (!credentials?.email || !credentials?.password) return null;

        // DEMO: acepta cualquier email y password (cámbialo por tu lógica real)
        return {
          id: "user-demo",
          name: "Usuario Demo",
          email: credentials.email,
          role: "CANDIDATE",
        } as any;
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user && (user as any).role) token.role = (user as any).role;
      return token;
    },
    async session({ session, token }) {
      (session.user as any).role = (token as any).role ?? "CANDIDATE";
      return session;
    },
  },
};
