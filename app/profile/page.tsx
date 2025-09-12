// app/profile/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfileForm from "./ProfileForm";

export const metadata = { title: "Mi perfil | Bolsa TI" };

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin?callbackUrl=/profile");

  const user = session.user as any;

  // Solo candidatos en /profile; recruiters/admin → dashboard
  if (user?.role === "RECRUITER" || user?.role === "ADMIN") {
    redirect("/dashboard");
  }

  // Asegura que el usuario exista (primer login) para evitar 404/redirects
  const dbUser = await prisma.user.upsert({
    where: { email: user.email! },
    update: {},
    create: {
      email: user.email!,
      name: user.name ?? user.email!.split("@")[0],
      passwordHash: "demo",
      role: "CANDIDATE",
    },
  });

  // Server Action: actualizar perfil
  async function updateAction(fd: FormData) {
    "use server";
    const certsRaw = String(fd.get("certifications") || "");
    const certifications = certsRaw.split(",").map(s => s.trim()).filter(Boolean);

    const toList = (k: string) =>
      String(fd.get(k) || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        name: String(fd.get("name") || ""),
        phone: String(fd.get("phone") || ""),
        location: String(fd.get("location") || ""),
        birthdate: fd.get("birthdate") ? new Date(String(fd.get("birthdate"))) : null,
        linkedin: String(fd.get("linkedin") || ""),
        github: String(fd.get("github") || ""),
        resumeUrl: String(fd.get("resumeUrl") || ""),
        frontend: toList("frontend"),
        backend: toList("backend"),
        mobile: toList("mobile"),
        cloud: toList("cloud"),
        database: toList("database"),
        cybersecurity: toList("cybersecurity"),
        testing: toList("testing"),
        ai: toList("ai"),
        certifications,
      },
    });
	redirect("/profile/summary")
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Mi perfil</h1>
      <ProfileForm
        initial={{
          name: dbUser.name ?? "",
          email: dbUser.email,
          phone: dbUser.phone ?? "",
          location: dbUser.location ?? "",
          birthdate: dbUser.birthdate ? dbUser.birthdate.toISOString().slice(0, 10) : "",
          linkedin: dbUser.linkedin ?? "",
          github: dbUser.github ?? "",
          resumeUrl: dbUser.resumeUrl ?? "",
          frontend: dbUser.frontend ?? [],
          backend: dbUser.backend ?? [],
          mobile: dbUser.mobile ?? [],
          cloud: dbUser.cloud ?? [],
          database: dbUser.database ?? [],
          cybersecurity: dbUser.cybersecurity ?? [],
          testing: dbUser.testing ?? [],
          ai: dbUser.ai ?? [],
          certifications: dbUser.certifications ?? [],
        }}
        onSubmit={updateAction}
      />
    </main>
  );
}
