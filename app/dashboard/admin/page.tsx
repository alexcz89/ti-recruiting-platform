// app/dashboard/admin/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import Link from "next/link";
import {
  Building2, Users, BookOpen, BarChart3, ChevronRight,
  Shield, Layers, Settings, TrendingUp
} from "lucide-react";

export const metadata = { title: "Admin Panel | TaskIO" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  const role = (session.user as any)?.role;
  if (role !== "ADMIN") redirect("/");

  // Stats globales
  const [
    totalCompanies,
    totalUsers,
    totalTemplates,
    totalAttempts,
    completedAttempts,
    globalTemplates,
    customTemplates,
    recentCompanies,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.user.count(),
    prisma.assessmentTemplate.count({ where: { isActive: true } }),
    prisma.assessmentAttempt.count(),
    prisma.assessmentAttempt.count({ where: { status: "SUBMITTED" as any } }),
    prisma.assessmentTemplate.count({ where: { isActive: true, isGlobal: true } }),
    prisma.assessmentTemplate.count({ where: { isActive: true, isGlobal: false } }),
    prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true, name: true, assessmentCredits: true,
        assessmentPlan: true, createdAt: true,
        _count: { select: { jobs: true } },
      },
    }),
  ]);

  const avgScore = await prisma.assessmentAttempt.aggregate({
    where: { status: "SUBMITTED" as any, totalScore: { not: null } },
    _avg: { totalScore: true },
  });

  const stats = [
    { label: "Empresas", value: totalCompanies, icon: Building2, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", href: "/dashboard/admin/companies" },
    { label: "Usuarios", value: totalUsers, icon: Users, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30", href: "/dashboard/admin/users" },
    { label: "Templates activos", value: totalTemplates, icon: BookOpen, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", href: "/dashboard/admin/templates" },
    { label: "Evaluaciones", value: totalAttempts, icon: BarChart3, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", href: "#" },
  ];

  const modules = [
    {
      href: "/dashboard/admin/companies",
      icon: Building2,
      title: "Empresas",
      description: "Gestiona empresas, créditos y planes",
      color: "from-blue-500 to-cyan-500",
      items: [`${totalCompanies} empresas registradas`],
    },
    {
      href: "/dashboard/admin/users",
      icon: Users,
      title: "Usuarios",
      description: "Administra recruiters y candidatos",
      color: "from-violet-500 to-purple-500",
      items: [`${totalUsers} usuarios totales`],
    },
    {
      href: "/dashboard/admin/templates",
      icon: BookOpen,
      title: "Templates",
      description: "Crea y gestiona templates globales",
      color: "from-emerald-500 to-teal-500",
      items: [`${globalTemplates} globales`, `${customTemplates} de empresas`],
    },
    {
      href: "/dashboard/admin/taxonomy",
      icon: Layers,
      title: "Taxonomía",
      description: "Edita skills y certificaciones",
      color: "from-amber-500 to-orange-500",
      items: ["Skills y tecnologías", "Certificaciones"],
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 p-3 shadow-lg shadow-red-500/20">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-zinc-900 dark:text-white">Panel de Administrador</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Gestión completa de la plataforma TaskIO</p>
            </div>
          </div>
          <Link
            href="/dashboard/overview"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition"
          >
            ← Volver al panel
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, color, bg, href }) => (
            <Link
              key={label}
              href={href}
              className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800/50 dark:bg-zinc-900 p-4 shadow-sm hover:shadow-md transition-all group"
            >
              <div className={`inline-flex rounded-xl p-2 ${bg} mb-3`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <p className="text-2xl font-black text-zinc-900 dark:text-white">{value}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{label}</p>
            </Link>
          ))}
        </div>

        {/* Stats secundarias */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800/50 dark:bg-zinc-900 p-4 shadow-sm text-center">
            <p className="text-3xl font-black text-emerald-600">{completedAttempts}</p>
            <p className="text-xs text-zinc-500 mt-1">Evaluaciones completadas</p>
          </div>
          <div className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800/50 dark:bg-zinc-900 p-4 shadow-sm text-center">
            <p className="text-3xl font-black text-blue-600">{Math.round(avgScore._avg.totalScore ?? 0)}%</p>
            <p className="text-xs text-zinc-500 mt-1">Score promedio global</p>
          </div>
          <div className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800/50 dark:bg-zinc-900 p-4 shadow-sm text-center">
            <p className="text-3xl font-black text-violet-600">{globalTemplates}</p>
            <p className="text-xs text-zinc-500 mt-1">Templates globales</p>
          </div>
        </div>

        {/* Módulos */}
        <div>
          <h2 className="text-lg font-black text-zinc-900 dark:text-white mb-4">Módulos de administración</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {modules.map(({ href, icon: Icon, title, description, color, items }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800/50 dark:bg-zinc-900 p-5 shadow-sm hover:shadow-lg transition-all flex items-start gap-4"
              >
                <div className={`rounded-2xl bg-gradient-to-br ${color} p-3 shadow-md shrink-0`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-zinc-900 dark:text-white">{title}</h3>
                    <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</p>
                  <div className="flex gap-2 mt-2">
                    {items.map((item) => (
                      <span key={item} className="text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full px-2 py-0.5">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Empresas recientes */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-zinc-900 dark:text-white">Empresas recientes</h2>
            <Link href="/dashboard/admin/companies" className="text-sm text-violet-600 hover:underline">
              Ver todas →
            </Link>
          </div>
          <div className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800/50 dark:bg-zinc-900 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase text-zinc-400">Empresa</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase text-zinc-400">Plan</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase text-zinc-400">Créditos</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase text-zinc-400">Vacantes</th>
                </tr>
              </thead>
              <tbody>
                {recentCompanies.map((company) => (
                  <tr key={company.id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{company.name}</td>
                    <td className="px-4 py-3 text-zinc-500">{company.assessmentPlan || "Free"}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">{Number(company.assessmentCredits)}</td>
                    <td className="px-4 py-3 text-right text-zinc-500">{company._count.jobs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}