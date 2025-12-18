// auth.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Centralize auth so all routes use the hardened config in lib/auth
export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
