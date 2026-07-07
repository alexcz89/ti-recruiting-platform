// app/dashboard/admin/companies/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Building2, ArrowLeft, Globe, MapPin, Calendar, Mail, Phone, User, Briefcase } from "lucide-react";
import { CompanyActionsClient } from "./CompanyActionsClient";

export const metadata = { title: "Admin · Empresas" };
export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

const PLAN_COLORS: Record<string, string> = {
  FREE:     "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  PRO:      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  BUSINESS: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  AGENCY:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export default async function AdminCompaniesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if ((session.user as any)?.role !== "ADMIN") redirect("/");

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      domain: true,
      website: true,
      city: true,
      state: true,
      industry: true,
      billingPlan: true,
      assessmentCredits: true,
      assessmentCreditsUsed: true,
      assessmentPlan: true,
      createdAt: true,
      _count: { select: { jobs: true } },
      recruiters: {
        take: 1,
        orderBy: { createdAt: "asc" },
        select: {
          jobTitle: true,
          status: true,
          phone: true,
          user: {
            select: {
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  async function updateCreditsAction(fd: FormData) {
    "use server";
    const s = await getServerSession(authOptions);
    if (!s?.user || (s.user as any)?.role !== "ADMIN") return { error: "Sin permisos" };

    const companyId = String(fd.get("companyId") || "");
    const credits = Number(fd.get("credits") || 0);
    if (!companyId || isNaN(credits) || credits < 0) return { error: "Datos invalidos" };

    await prisma.company.update({
      where: { id: companyId },
      data: { assessmentCredits: credits },
    });

    revalidatePath("/dashboard/admin/companies");
    return { ok: true };
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-6">

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

        {/* Cards */}
        <div className="space-y-3">
          {companies.map((company) => {
            const recruiter = company.recruiters[0];
            const contactName = recruiter?.user
              ? (recruiter.user.firstName && recruiter.user.lastName
                  ? `${recruiter.user.firstName} ${recruiter.user.lastName}`
                  : recruiter.user.name) ?? "—"
              : "—";
            const contactEmail = recruiter?.user?.email ?? null;
            const contactPhone = recruiter?.phone ?? recruiter?.user?.phone ?? null;
            const contactTitle = recruiter?.jobTitle ?? null;
            const plan = company.billingPlan ?? "FREE";
            const planColor = PLAN_COLORS[plan] ?? PLAN_COLORS.FREE;
            const location = [company.city, company.state].filter(Boolean).join(", ");

            return (
              <div
                key={company.id}
                className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800/50 dark:bg-zinc-900 shadow-sm overflow-hidden"
              >
                {/* Card top row */}
                <div className="flex flex-wrap items-start gap-4 px-5 py-4">

                  {/* ── Empresa ── */}
                  <div className="min-w-[180px] flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-zinc-900 dark:text-zinc-100 text-base leading-tight">{company.name}</p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${planColor}`}>
                        {plan}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-mono">{company.id.slice(-8)}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
                      {company.domain && (
                        <span className="inline-flex items-center gap-1">
                          <Globe className="h-3 w-3 shrink-0" />
                          {company.domain}
                        </span>
                      )}
                      {company.website && (
                        <a
                          href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-500 hover:underline"
                        >
                          <Globe className="h-3 w-3 shrink-0" />
                          Sitio web
                        </a>
                      )}
                      {location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {location}
                        </span>
                      )}
                      {company.industry && (
                        <span className="inline-flex items-center gap-1">
                          <Briefcase className="h-3 w-3 shrink-0" />
                          {company.industry}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── Contacto ── */}
                  <div className="min-w-[200px] flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Contacto</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-sm">
                        <User className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        <span className="text-zinc-800 dark:text-zinc-200 font-medium">{contactName}</span>
                        {contactTitle && (
                          <span className="text-zinc-400 text-xs">· {contactTitle}</span>
                        )}
                      </div>
                      {contactEmail ? (
                        <a
                          href={`mailto:${contactEmail}`}
                          className="flex items-center gap-1.5 text-sm text-blue-500 hover:underline"
                        >
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          {contactEmail}
                        </a>
                      ) : (
                        <p className="flex items-center gap-1.5 text-sm text-zinc-400">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          Sin email
                        </p>
                      )}
                      {contactPhone ? (
                        <a
                          href={`tel:${contactPhone}`}
                          className="flex items-center gap-1.5 text-sm text-blue-500 hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          {contactPhone}
                        </a>
                      ) : (
                        <p className="flex items-center gap-1.5 text-sm text-zinc-400">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          Sin telefono
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ── Stats ── */}
                  <div className="flex items-center gap-6 self-center">
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Vacantes</p>
                      <p className="text-xl font-black text-zinc-900 dark:text-zinc-100 mt-0.5">{company._count.jobs}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Creditos</p>
                      <p className="text-xl font-black text-emerald-600 mt-0.5">{Number(company.assessmentCredits)}</p>
                      <p className="text-[10px] text-zinc-400">{Number(company.assessmentCreditsUsed)} usados</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Registro</p>
                      <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(company.createdAt)}
                      </p>
                    </div>
                    <div>
                      <CompanyActionsClient
                        companyId={company.id}
                        companyName={company.name}
                        currentCredits={Number(company.assessmentCredits)}
                        onUpdateCredits={updateCreditsAction}
                      />
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>

      </div>
    </main>
  );
}
