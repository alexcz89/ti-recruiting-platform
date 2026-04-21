// app/dashboard/profile/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { redirect } from "next/navigation";
import ProfileForm from "./ProfileForm";
import CompanyForm from "./CompanyForm";
import {
  Mail,
  CheckCircle,
  XCircle,
  Calendar,
  Building2,
  Briefcase,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const user = session.user as any;
  const userId = user.id as string;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      createdAt: true,
      recruiterProfile: {
        select: {
          companyId: true,
        },
      },
    },
  });

  if (!dbUser) redirect("/auth/signin");

  const companyId = dbUser.recruiterProfile?.companyId ?? undefined;

  const [profile, company] = await Promise.all([
    prisma.recruiterProfile.findUnique({
      where: { userId },
      select: {
        phone: true,
        directPhone: true,
        linkedinUrl: true,
        jobTitle: true,
        status: true,
      },
    }),
    companyId
      ? prisma.company.findUnique({
          where: { id: companyId },
          select: {
            id: true,
            name: true,
            size: true,
            logoUrl: true,
            website: true,
            assessmentCredits: true,
            _count: { select: { jobs: true } },
          },
        })
      : null,
  ]);

  const emailVerified = !!dbUser.emailVerified;
  const profileStatus = profile?.status || "PENDING";
  const assessmentCredits = Number(company?.assessmentCredits ?? 0);

  const initials =
    dbUser.name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

  const memberSince = dbUser.createdAt
    ? new Date(dbUser.createdAt).toLocaleDateString("es-MX", {
        year: "numeric",
        month: "long",
      })
    : "Sin fecha";

  return (
    <main className="w-full">
      <div className="mx-auto max-w-[1500px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 xl:px-10">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="bg-gradient-to-r from-zinc-50 via-white to-zinc-50 px-5 py-6 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900 sm:px-6 sm:py-7 lg:px-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-900/10 dark:text-emerald-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    Perfil profesional
                  </div>

                  <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
                    Mi perfil
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400 sm:text-base">
                    Administra tus datos de contacto, la información de tu empresa
                    y la identidad visual de tu cuenta de reclutador.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[520px]">
                  <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Empresa
                    </div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {company?.name || "Sin empresa"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Vacantes activas
                    </div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {company?._count.jobs ?? 0}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Créditos
                    </div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {assessmentCredits} disponibles
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-6">
              <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Tu cuenta
                  </h2>
                </div>

                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-lg font-bold text-white shadow-sm">
                      {initials}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        {dbUser.name || "Usuario"}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                        <Mail className="h-4 w-4" />
                        <span className="truncate">{dbUser.email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        <Calendar className="h-3.5 w-3.5" />
                        Miembro desde
                      </div>
                      <div className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {memberSince}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Estado del correo
                      </div>
                      <div className="mt-1 inline-flex items-center gap-2 text-sm font-medium">
                        {emailVerified ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-emerald-700 dark:text-emerald-300">
                              Verificado
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <span className="text-amber-700 dark:text-amber-300">
                              Pendiente de verificación
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        <Briefcase className="h-3.5 w-3.5" />
                        Estado del perfil
                      </div>
                      <div className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {profileStatus}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-3xl border border-blue-200 bg-blue-50/70 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/30">
                <div className="p-5">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    Soporte
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-blue-800/80 dark:text-blue-200/80">
                    Si necesitas ayuda con tu cuenta o quieres actualizar información
                    sensible, contáctanos.
                  </p>

                  <a
                    href="mailto:support@taskit.com"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900/50"
                  >
                    <Mail className="h-4 w-4" />
                    support@taskit.com
                  </a>
                </div>
              </section>
            </aside>

            <section className="space-y-6">
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Datos de contacto
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Estos datos facilitan el contacto contigo dentro del flujo de
                    reclutamiento.
                  </p>
                </div>

                <ProfileForm
                  initial={{
                    phone: profile?.phone || "",
                    website: company?.website || "",
                    jobTitle: profile?.jobTitle || "",
                    linkedinUrl: profile?.linkedinUrl || "",
                    directPhone: profile?.directPhone || "",
                  }}
                />
              </div>

              {companyId && (
                <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                        Mi empresa
                      </h2>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Configura la información principal y la identidad visual de{" "}
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {company?.name || "tu empresa"}
                        </span>
                        .
                      </p>
                    </div>

                    {company && company._count.jobs > 0 && (
                      <div className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-300">
                        <Building2 className="h-4 w-4" />
                        {company._count.jobs} vacante
                        {company._count.jobs !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>

                  <CompanyForm
                    companyId={companyId}
                    initial={{
                      name: company?.name || "",
                      size: company?.size || "",
                      logoUrl: company?.logoUrl || "",
                      assessmentCredits: assessmentCredits,
                    }}
                  />
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}