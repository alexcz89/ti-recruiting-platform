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
  PhoneCall,
  Linkedin,
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
            assessmentCreditsReserved: true,
            assessmentCreditsUsed: true,
            _count: { select: { jobs: true } },
          },
        })
      : null,
  ]);

  const emailVerified = !!dbUser.emailVerified;
  const profileStatus = profile?.status || "PENDING";

  return (
    <main className="w-full">
      <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] px-3 py-3 sm:px-6 sm:py-4 lg:px-10 space-y-4 sm:space-y-6">
        <div className="rounded-2xl border glass-card p-4 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-default">
            Mi perfil
          </h1>
          <p className="mt-1 text-sm text-muted">
            Actualiza tus datos de contacto y la información básica de tu
            empresa.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          <div className="space-y-4 sm:space-y-6 lg:order-2 lg:col-span-1">
            <section className="rounded-2xl border glass-card p-4 sm:p-6">
              <h2 className="mb-4 text-base sm:text-lg font-semibold text-default">
                Tu cuenta
              </h2>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-base font-bold text-white sm:h-12 sm:w-12 sm:text-lg">
                    {dbUser.name?.charAt(0).toUpperCase() || "U"}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-semibold text-default">
                      {dbUser.name || "Usuario"}
                    </p>

                    {profile?.jobTitle && (
                      <p className="inline-flex items-center gap-1 text-xs text-muted">
                        <Briefcase className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{profile.jobTitle}</span>
                      </p>
                    )}

                    <p className="flex items-center gap-1 truncate text-xs text-muted">
                      <Mail className="h-3 w-3 shrink-0" />
                      {dbUser.email}
                    </p>

                    {profile?.directPhone && (
                      <p className="flex items-center gap-1 truncate text-xs text-muted">
                        <PhoneCall className="h-3 w-3 shrink-0" />
                        {profile.directPhone}
                      </p>
                    )}

                    {profile?.linkedinUrl && (
                      <a
                        href={
                          profile.linkedinUrl.startsWith("http")
                            ? profile.linkedinUrl
                            : `https://${profile.linkedinUrl}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        <Linkedin className="h-3 w-3 shrink-0" />
                        Ver LinkedIn
                      </a>
                    )}
                  </div>
                </div>

                <div className="h-px bg-zinc-200 dark:bg-zinc-700" />

                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-2 dark:bg-zinc-900/50">
                    <span className="text-sm text-muted">Email</span>
                    {emailVerified ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        <CheckCircle className="h-3.5 w-3.5" /> Verificado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                        <XCircle className="h-3.5 w-3.5" /> Sin verificar
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-2 dark:bg-zinc-900/50">
                    <span className="text-sm text-muted">Estado</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                        profileStatus === "APPROVED"
                          ? "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}
                    >
                      {profileStatus === "APPROVED" ? (
                        <>
                          <CheckCircle className="h-3 w-3" /> Aprobado
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3" /> Pendiente
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-2 dark:bg-zinc-900/50">
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

            <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 sm:p-6 dark:border-blue-500/30 dark:bg-blue-900/20">
              <h3 className="mb-2 text-sm font-semibold text-blue-900 dark:text-blue-100">
                ¿Necesitas ayuda?
              </h3>
              <p className="mb-3 text-xs text-blue-700 dark:text-blue-300">
                Si tienes problemas con tu cuenta o necesitas cambiar
                información, contáctanos.
              </p>
              <a
                href="mailto:support@taskit.com"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                <Mail className="h-3.5 w-3.5" />
                support@taskit.com
              </a>
            </section>
          </div>

          <div className="space-y-4 sm:space-y-6 lg:order-1 lg:col-span-2">
            <section className="rounded-2xl border glass-card p-4 sm:p-6">
              <div className="mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-default">
                  Datos de contacto
                </h2>
                <p className="text-sm text-muted">
                  Estos datos ayudan a que te ubiquen y te contacten más
                  rápido.
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
            </section>

            {companyId && (
              <section className="rounded-2xl border glass-card p-4 sm:p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-semibold text-default">
                      Mi empresa
                    </h2>
                    <p className="text-sm text-muted">
                      Empresa actual:{" "}
                      <span className="font-medium text-default">
                        {company?.name || ""}
                      </span>
                    </p>
                  </div>

                  {company && company._count.jobs > 0 && (
                    <div className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 dark:border-emerald-500/40 dark:bg-emerald-900/30">
                      <Building2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {company._count.jobs} vacante
                        {company._count.jobs !== 1 ? "s" : ""}
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
                    assessmentCredits: company?.assessmentCredits ?? 0,
                    assessmentCreditsReserved: company?.assessmentCreditsReserved ?? 0,
                    assessmentCreditsUsed: company?.assessmentCreditsUsed ?? 0,
                  }}
                />
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}