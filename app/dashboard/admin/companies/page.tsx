// app/dashboard/admin/companies/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Building2, ArrowLeft } from "lucide-react";
import { CompanyActionsClient } from "./CompanyActionsClient";

export const metadata = { title: "Admin · Empresas" };
export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if ((session.user as any)?.role !== "ADMIN") redirect("/");

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, domain: true,
      assessmentCredits: true,
      assessmentCreditsUsed: true,
      assessmentCreditsReserved: true,
      assessmentPlan: true,
      assessmentPlanCreditsPerMonth: true,
      createdAt: true,
      _count: { select: { jobs: true } },
    },
  });

  // Server Action — actualizar créditos
  async function updateCreditsAction(fd: FormData) {
    "use server";
    const s = await getServerSession(authOptions);
    if (!s?.user || (s.user as any)?.role !== "ADMIN") return { error: "Sin permisos" };

    const companyId = String(fd.get("companyId") || "");
    const credits = Number(fd.get("credits") || 0);

    if (!companyId || isNaN(credits) || credits < 0) return { error: "Datos inválidos" };

    await prisma.company.update({
      where: { id: companyId },
      data: { assessmentCredits: credits },
    });

    revalidatePath("/dashboard/admin/companies");
    return { ok: true };
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 p-2.5 shadow-md">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-zinc-900 dark:text-white">Empresas</h1>
              <p className="text-sm text-zinc-500">{companies.length} empresas registradas</p>
            </div>
          </div>
        </div>

        {/* Tabla de empresas */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800/50 dark:bg-zinc-900 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase text-zinc-400">Empresa</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase text-zinc-400">Dominio</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase text-zinc-400">Créditos disp.</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase text-zinc-400">Usados</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase text-zinc-400">Plan</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase text-zinc-400">Vacantes</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase text-zinc-400">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">{company.name}</p>
                      <p className="text-[11px] text-zinc-400 font-mono">{company.id.slice(-8)}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{company.domain || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono font-bold text-emerald-600">{Number(company.assessmentCredits)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-zinc-500">{Number(company.assessmentCreditsUsed)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        company.assessmentPlan
                          ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}>
                        {company.assessmentPlan || "Free"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500">{company._count.jobs}</td>
                    <td className="px-4 py-3 text-right">
                      <CompanyActionsClient
                        companyId={company.id}
                        companyName={company.name}
                        currentCredits={Number(company.assessmentCredits)}
                        onUpdateCredits={updateCreditsAction}
                      />
                    </td>
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