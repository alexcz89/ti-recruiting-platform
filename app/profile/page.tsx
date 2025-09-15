// app/profile/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ProfileRootRedirect() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin?callbackUrl=/profile/summary");

  const role = (session.user as any)?.role;
  // Candidatos al resumen, reclutadores/admin a su panel
  if (role === "CANDIDATE") redirect("/profile/summary");
  redirect("/dashboard");
}
