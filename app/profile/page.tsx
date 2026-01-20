// app/profile/page.tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from '@/lib/server/auth';
import ProfileSummary from "@/components/profile/ProfileSummary";

export const metadata = { title: "Mi perfil | Bolsa TI" };

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/signin?callbackUrl=/profile");

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Resumen de perfil</h1>
      </div>
      <ProfileSummary />
    </main>
  );
}
