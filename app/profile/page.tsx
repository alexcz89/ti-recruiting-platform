// app/profile/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Mi perfil | Bolsa TI" };

export default async function ProfileIndex() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/signin?role=CANDIDATE&callbackUrl=/profile/summary");
  redirect("/profile/summary");
}
