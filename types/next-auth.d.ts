import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email?: string | null
      name?: string | null
      role?: "ADMIN" | "RECRUITER" | "CANDIDATE"
      companyId?: string | null
    }
    expires: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: "ADMIN" | "RECRUITER" | "CANDIDATE"
    companyId?: string | null
  }
}
