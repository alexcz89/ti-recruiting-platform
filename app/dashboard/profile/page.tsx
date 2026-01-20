// app/dashboard/profile/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { redirect } from "next/navigation";
import ProfileForm from "./ProfileForm";
import CompanyForm from "./CompanyForm";
import { Mail, CheckCircle, XCircle, Calendar, Building2 } from "lucide-react";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const user = session.user as any;
  const userId = user.id as string;
  const companyId = user.companyId as string | undefined;

  const [dbUser, profile, company] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        createdAt: true,
      },
    }),
    prisma.recruiterProfile.findUnique({
      where: { userId },
      select: { phone: true, website: true, status: true },
    }),
    companyId
      ? prisma.company.findUnique({
          where: { id: companyId },
          select: {
            id: true,
            name: true,
            size: true,
            logoUrl: true,
            _count: { select: { jobs: true } },
          },
        })
      : null,
  ]);

  if (!dbUser) redirect("/auth/signin");

  const emailVerified = !!dbUser.emailVerified;
  const profileStatus = profile?.status || "PENDING";

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] px-6 lg:px-10 py-4 space-y-6">
        {/* Header */}
        <div className="rounded-2xl border glass-card p-6">
          <h1 className="text-3xl font-bold text-default">Mi perfil</h1>
          <p className="mt-1 text-sm text-muted">
            Actualiza tus datos de contacto y la información básica de tu empresa.
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Spans 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Information */}
            <section className="rounded-2xl border glass-card p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-default">Datos de contacto</h2>
                <p className="text-sm text-muted">
                  Estos datos ayudan a que te ubiquen y te contacten más rápido.
                </p>
              </div>

              <ProfileForm
                initial={{
                  phone: profile?.phone || "",
                  website: profile?.website || "",
                }}
              />
            </section>

            {/* Company Information */}
            {companyId && (
              <section className="rounded-2xl border glass-card p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-default">Mi empresa</h2>
                    <p className="text-sm text-muted">
                      Empresa actual: <span className="font-medium text-default">{company?.name || "TestCorp"}</span>
                    </p>
                  </div>
                  
                  {company && company._count.jobs > 0 && (
                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-500/40 px-3 py-1.5">
                      <Building2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {company._count.jobs} vacante{company._count.jobs !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>

                <CompanyForm
                  companyId={companyId}
                  initial={{
                    name: company?.name || "",
                    size: company?.size || "",
                    logoUrl: company?.logoUrl || "",
                  }}
                />
              </section>
            )}
          </div>

          {/* Sidebar - Account Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Account Card */}
            <section className="rounded-2xl border glass-card p-6">
              <h2 className="text-lg font-semibold text-default mb-4">Tu cuenta</h2>
              
              <div className="space-y-4">
                {/* User Info */}
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                    {dbUser.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-default truncate">
                      {dbUser.name || "Usuario"}
                    </p>
                    <p className="text-sm text-muted truncate flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {dbUser.email}
                    </p>
                  </div>
                </div>

                <div className="h-px bg-zinc-200 dark:bg-zinc-700" />

                {/* Status Badges */}
                <div className="space-y-2">
                  {/* Email Verification */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                    <span className="text-sm text-muted">Email</span>
                    {emailVerified ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Verificado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                        <XCircle className="h-3.5 w-3.5" />
                        Sin verificar
                      </span>
                    )}
                  </div>

                  {/* Profile Status */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                    <span className="text-sm text-muted">Estado</span>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        profileStatus === "APPROVED"
                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40"
                          : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40"
                      }`}
                    >
                      {profileStatus === "APPROVED" ? (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          Aprobado
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3" />
                          Pendiente
                        </>
                      )}
                    </span>
                  </div>

                  {/* Member Since */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                    <span className="text-sm text-muted">Miembro desde</span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-default">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(dbUser.createdAt).toLocaleDateString("es-MX", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </section>
            {/* Help Card */}
            <section className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-900/20 p-6">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                ¿Necesitas ayuda?
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                Si tienes problemas con tu cuenta o necesitas cambiar información,
                contáctanos.
              </p>

              <a
                href="mailto:support@taskit.com"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Mail className="h-3.5 w-3.5" />
                support@taskit.com
              </a>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
