import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session) redirect(`/signin?callbackUrl=/dashboard`);
  if (role !== "RECRUITER" && role !== "ADMIN") redirect("/");

  const tabs = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/jobs", label: "Vacantes" },
    { href: "/dashboard/applications", label: "Postulaciones" },
    { href: "/dashboard/candidates", label: "Candidatos" },
    { href: "/dashboard/codex", label: "Codex" }, // ya implementado
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Panel</h1>
      <nav className="flex gap-3 mb-6 flex-wrap">
        {tabs.map(t => (
          <Link key={t.href} href={t.href} className="border rounded-xl px-3 py-1 hover:bg-gray-50">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
