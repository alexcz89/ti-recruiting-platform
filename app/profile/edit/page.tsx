// app/profile/edit/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import Link from "next/link";
import { prisma } from '@/lib/server/prisma';

import ProfileForm from "@/app/profile/ProfileForm";
import { updateProfileAction } from "../actions";

import {
  getSkillsFromDB,
  getCertificationsFromDB,
} from "@/lib/server/skills";
import { LANGUAGES_FALLBACK } from "@/lib/shared/skills-data";

export const metadata = { title: "Mi perfil | Bolsa TI" };

/** E.164 → { phoneCountry, phoneLocal } */
function parseE164ToParts(e164?: string | null) {
  if (!e164) return { phoneCountry: "52", phoneLocal: "" };
  const digits = e164.replace(/\D+/g, "");
  if (digits.startsWith("52")) return { phoneCountry: "52", phoneLocal: digits.slice(-10) };
  let countryLen = 1;
  if (digits.length > 9) countryLen = 3;
  else if (digits.length > 8) countryLen = 2;
  const phoneCountry = digits.slice(0, countryLen) || "52";
  const phoneLocal   = digits.slice(countryLen);
  return { phoneCountry, phoneLocal };
}

export default async function ProfileEditPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/signin?callbackUrl=/profile/edit");

  const me = session.user as any;
  if (me.role === "RECRUITER" || me.role === "ADMIN") redirect("/dashboard");

  const dbUser = await prisma.user.upsert({
    where:  { email: me.email! },
    update: {},
    create: {
      email:        me.email!,
      name:         me.name ?? me.email!.split("@")[0],
      passwordHash: "demo",
      role:         "CANDIDATE",
    },
  });

  const fullUser = await prisma.user.findUnique({
    where:  { id: dbUser.id },
    select: {
      id:             true,
      email:          true,
      firstName:      true,
      lastName:       true,
      maternalSurname: true,
      name:           true,
      phone:          true,
      location:       true,
      birthdate:      true,
      linkedin:       true,
      github:         true,
      resumeUrl:      true,
      certifications: true,
      city:           true,
      admin1:         true,
      country:        true,
    },
  });
  if (!fullUser) redirect("/profile");

  let firstName: string;
  let lastName1:  string;
  let lastName2:  string;

  if (fullUser.firstName) {
    firstName = fullUser.firstName ?? "";
    lastName1 = fullUser.lastName  ?? "";
    lastName2 = fullUser.maternalSurname ?? "";
  } else {
    const parts   = (fullUser.name ?? "").trim().split(/\s+/);
    lastName2     = parts.length >= 3 ? parts.pop()! : "";
    lastName1     = parts.length >= 2 ? parts.pop()! : "";
    firstName     = parts.join(" ");
  }

  const experiences = await prisma.workExperience.findMany({
    where:   { userId: dbUser.id },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select:  { id: true, role: true, company: true, startDate: true, endDate: true, isCurrent: true },
  });

  const education = await prisma.education.findMany({
    where:   { userId: dbUser.id },
    orderBy: [{ sortIndex: "asc" }, { startDate: "desc" }, { createdAt: "desc" }],
    select:  {
      id: true, level: true, status: true, institution: true, program: true,
      startDate: true, endDate: true, sortIndex: true
    },
  });

  const allLangTerms = await prisma.taxonomyTerm.findMany({
    where:   { kind: "LANGUAGE" },
    select:  { id: true, label: true },
    orderBy: { label: "asc" },
  });
  const allowedSet = new Set(LANGUAGES_FALLBACK.map((x: string) => x.toLowerCase()));
  const languageOptions = allLangTerms
    .filter((t) => allowedSet.has(t.label.toLowerCase()))
    .map((t) => ({ id: t.id, label: t.label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const candidateLangsRaw = await prisma.candidateLanguage.findMany({
    where:   { userId: dbUser.id },
    include: { term: { select: { id: true, label: true } } },
  });
  const candidateLangs = candidateLangsRaw
    .filter((l) => allowedSet.has(l.term.label.toLowerCase()))
    .map((l) => ({ termId: l.termId, label: l.term.label, level: l.level }));

  const [skillsOptions, certOptions] = await Promise.all([
    getSkillsFromDB(),
    getCertificationsFromDB(),
  ]);

  const skillTermsFromDB = await prisma.taxonomyTerm.findMany({
    where:   { kind: "SKILL" },
    select:  { id: true, label: true },
    orderBy: { label: "asc" },
  });
  const seen = new Set<string>();
  const skillTermOptions = [
    ...skillTermsFromDB
      .map((t) => ({ id: t.id, label: t.label }))
      .filter((t: any) => {
        const k = t.label.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }),
    ...skillsOptions
      .map((label: string) => ({ id: "", label }))
      .filter((t: any) => {
        const k = t.label.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }),
  ].sort((a, b) => a.label.localeCompare(b.label));

  const candidateSkillsRaw = await prisma.candidateSkill.findMany({
    where:   { userId: dbUser.id },
    include: { term: { select: { id: true, label: true } } },
    orderBy: [{ level: "desc" }, { term: { label: "asc" } }],
  });
  const candidateSkills = candidateSkillsRaw.map((s) => ({
    termId: s.termId,
    label:  s.term?.label || "",
    level:  s.level as 1 | 2 | 3 | 4 | 5,
  }));

  const phoneParts = parseE164ToParts(fullUser.phone);

  return (
    <main className="w-full">
      <div className="mx-auto max-w-7xl 2xl:max-w-screen-2xl px-0 sm:px-4 lg:px-8 py-0 sm:py-6">

        {/* Header — con padding propio en mobile */}
        <div className="flex items-center justify-between px-4 sm:px-0 pt-4 sm:pt-0 mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold">Mi perfil</h1>
          <Link
            href="/profile/summary"
            className="text-sm border rounded-lg px-3 py-2 hover:bg-gray-50"
          >
            Ver resumen
          </Link>
        </div>

        {/* Aviso */}
        <div className="mx-4 sm:mx-0 mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-medium">Importante</div>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>Al guardar aquí se actualiza tu perfil completo (reemplaza educación, experiencia, skills e idiomas).</li>
            <li>Tu correo de sesión está bloqueado: <span className="font-medium">{fullUser.email}</span>.</li>
          </ul>
        </div>

        {/* Grid: formulario ocupa todo en mobile, sidebar solo en lg+ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Formulario — sin padding lateral en mobile */}
          <div className="lg:col-span-8 space-y-6">
            <section className="sm:border sm:rounded-2xl sm:glass-card sm:p-6">
              <ProfileForm
                initial={{
                  firstName,
                  lastName1,
                  lastName2,
                  email:        fullUser.email,
                  phoneCountry: phoneParts.phoneCountry,
                  phoneLocal:
                    phoneParts.phoneCountry === "52"
                      ? (phoneParts.phoneLocal || "").replace(/\D+/g, "").slice(-10)
                      : (phoneParts.phoneLocal || "").replace(/\D+/g, "").slice(0, 15),
                  location:  fullUser.location ?? "",
                  birthdate: fullUser.birthdate
                    ? fullUser.birthdate.toISOString().slice(0, 10)
                    : "",
                  linkedin:       fullUser.linkedin   ?? "",
                  github:         fullUser.github     ?? "",
                  resumeUrl:      fullUser.resumeUrl  ?? "",
                  certifications: fullUser.certifications ?? [],
                  experiences:    experiences.map((e) => ({
                    id:        e.id,
                    role:      e.role,
                    company:   e.company,
                    startDate: e.startDate ? e.startDate.toISOString().slice(0, 7) : "",
                    endDate:   e.endDate   ? e.endDate.toISOString().slice(0, 7)   : "",
                    isCurrent: e.isCurrent,
                  })),
                  languages: candidateLangs,
                  education: education.map((ed, i) => ({
                    id:          ed.id,
                    level:       (ed.level  as any) ?? null,
                    status:      (ed.status as any) ?? "COMPLETED",
                    institution: ed.institution ?? "",
                    program:     ed.program     ?? "",
                    startDate:   ed.startDate   ? ed.startDate.toISOString().slice(0, 7) : "",
                    endDate:     ed.endDate     ? ed.endDate.toISOString().slice(0, 7)   : "",
                    sortIndex:   typeof ed.sortIndex === "number" ? ed.sortIndex : i,
                  })),
                  skillsDetailed: candidateSkills,
                }}
                certOptions={certOptions}
                languageOptions={languageOptions}
                skillTermOptions={skillTermOptions}
                onSubmit={updateProfileAction}
              />
            </section>
          </div>

          {/* Sidebar — solo visible en lg+ */}
          <aside className="hidden lg:block lg:col-span-4">
            <div className="sticky top-20 space-y-6">
              <nav className="border rounded-2xl glass-card p-4 md:p-6">
                <h2 className="font-semibold mb-2">Navegación rápida</h2>
                <ul className="text-sm space-y-1">
                  <li><a className="hover:underline" href="#personal">Datos personales</a></li>
                  <li><a className="hover:underline" href="#contacto">Teléfono y ubicación</a></li>
                  <li><a className="hover:underline" href="#cv">Currículum</a></li>
                  <li><a className="hover:underline" href="#certs">Certificaciones</a></li>
                  <li><a className="hover:underline" href="#skills">Skills</a></li>
                  <li><a className="hover:underline" href="#languages">Idiomas</a></li>
                  <li><a className="hover:underline" href="#education">Educación</a></li>
                  <li><a className="hover:underline" href="#experiencia">Experiencia laboral</a></li>
                </ul>
              </nav>

              <div className="border rounded-2xl glass-card p-4 md:p-6">
                <h3 className="font-semibold mb-1">Consejos</h3>
                <ul className="text-sm list-disc pl-4 space-y-1 text-zinc-600">
                  <li>Completa tu ubicación y teléfono para que te contacten más fácil.</li>
                  <li>Usa meses exactos en educación y experiencia (YYYY-MM).</li>
                  <li>Sube tu CV y mantén tus skills al día.</li>
                </ul>
              </div>

              <div className="border rounded-2xl glass-card p-4 md:p-6">
                <h3 className="font-semibold mb-2">Accesos</h3>
                <div className="flex flex-col gap-2">
                  <Link href="/profile/summary" className="text-sm border rounded-lg px-3 py-2 text-center hover:bg-gray-50">
                    Ver resumen
                  </Link>
                  <Link href="/jobs" className="text-sm border rounded-lg px-3 py-2 text-center hover:bg-gray-50">
                    Buscar vacantes
                  </Link>
                </div>
              </div>
            </div>
          </aside>

        </div>
      </div>
    </main>
  );
}