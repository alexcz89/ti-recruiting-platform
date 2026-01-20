// app/profile/edit/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import Link from "next/link";
import { prisma } from '@/lib/server/prisma';

// Form de cliente (tu archivo existente en app/profile/ProfileForm.tsx)
import ProfileForm from "@/app/profile/ProfileForm";
import { updateProfileAction } from "../actions";

// Catálogos
import {
  getSkillsFromDB,
  getCertificationsFromDB,
  LANGUAGES_FALLBACK,
} from "@/lib/skills";

export const metadata = { title: "Mi perfil | Bolsa TI" };

/** Divide nombre completo a { firstName, lastName1, lastName2 } */
function splitName(full?: string | null) {
  const parts = (full ?? "").trim().split(/\s+/);
  if (parts.length === 0) return { firstName: "", lastName1: "", lastName2: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName1: "", lastName2: "" };
  if (parts.length === 2) return { firstName: parts[0], lastName1: parts[1], lastName2: "" };
  const lastName2 = parts.pop() as string;
  const lastName1 = parts.pop() as string;
  const firstName = parts.join(" ");
  return { firstName, lastName1, lastName2 };
}

/** E.164 -> { phoneCountry, phoneLocal } (heurística simple con MX por defecto) */
function parseE164ToParts(e164?: string | null) {
  if (!e164) return { phoneCountry: "52", phoneLocal: "" };
  const digits = e164.replace(/\D+/g, "");
  if (digits.startsWith("52")) return { phoneCountry: "52", phoneLocal: digits.slice(-10) };
  let countryLen = 1;
  if (digits.length > 9) countryLen = 3;
  else if (digits.length > 8) countryLen = 2;
  const phoneCountry = digits.slice(0, countryLen) || "52";
  const phoneLocal = digits.slice(countryLen);
  return { phoneCountry, phoneLocal };
}

export default async function ProfileEditPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/signin?callbackUrl=/profile/edit");

  const me = session.user as any;
  if (me.role === "RECRUITER" || me.role === "ADMIN") redirect("/dashboard");

  // Asegura que exista el usuario (MVP)
  const dbUser = await prisma.user.upsert({
    where: { email: me.email! },
    update: {},
    create: {
      email: me.email!,
      name: me.name ?? me.email!.split("@")[0],
      passwordHash: "demo",
      role: "CANDIDATE",
    },
  });

  // Datos principales del usuario
  const fullUser = await prisma.user.findUnique({
    where: { id: dbUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      location: true,
      birthdate: true,
      linkedin: true,
      github: true,
      resumeUrl: true,
      skills: true,
      certifications: true,
    },
  });
  if (!fullUser) redirect("/profile");

  // Experiencias (más reciente primero)
  const experiences = await prisma.workExperience.findMany({
    where: { userId: dbUser.id },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, role: true, company: true, startDate: true, endDate: true, isCurrent: true },
  });

  // Educación ordenada
  const education = await prisma.education.findMany({
    where: { userId: dbUser.id },
    orderBy: [{ sortIndex: "asc" }, { startDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true, level: true, status: true, institution: true, program: true,
      startDate: true, endDate: true, sortIndex: true
    },
  });

  // Idiomas: catálogos + valores del candidato (filtrados por lista oficial)
  const allLangTerms = await prisma.taxonomyTerm.findMany({
    where: { kind: "LANGUAGE" },
    select: { id: true, label: true },
    orderBy: { label: "asc" },
  });
  const allowedSet = new Set(LANGUAGES_FALLBACK.map((x) => x.toLowerCase()));
  const languageOptions = allLangTerms
    .filter((t) => allowedSet.has(t.label.toLowerCase()))
    .map((t) => ({ id: t.id, label: t.label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const candidateLangsRaw = await prisma.candidateLanguage.findMany({
    where: { userId: dbUser.id },
    include: { term: { select: { id: true, label: true } } },
  });
  const candidateLangs = candidateLangsRaw
    .filter((l) => allowedSet.has(l.term.label.toLowerCase()))
    .map((l) => ({ termId: l.termId, label: l.term.label, level: l.level }));

  // Skills catálogos
  const [skillsOptions, certOptions] = await Promise.all([
    getSkillsFromDB(),
    getCertificationsFromDB(),
  ]);

  // Términos SKILL (para agregar con id real)
  const skillTermsFromDB = await prisma.taxonomyTerm.findMany({
    where: { kind: "SKILL" },
    select: { id: true, label: true },
    orderBy: { label: "asc" },
  });
  // De-dup entre DB terms y fallback list
  const seen = new Set<string>();
  const skillTermOptions = [
    ...skillTermsFromDB
      .map((t) => ({ id: t.id, label: t.label }))
      .filter((t) => {
        const k = t.label.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }),
    ...skillsOptions
      .map((label) => ({ id: "", label }))
      .filter((t) => {
        const k = t.label.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }),
  ].sort((a, b) => a.label.localeCompare(b.label));

  // Skills actuales con nivel del candidato
  const candidateSkillsRaw = await prisma.candidateSkill.findMany({
    where: { userId: dbUser.id },
    include: { term: { select: { id: true, label: true } } },
    orderBy: [{ level: "desc" }, { term: { label: "asc" } }],
  });
  const candidateSkills = candidateSkillsRaw.map((s) => ({
    termId: s.termId,
    label: s.term?.label || "",
    level: s.level as 1 | 2 | 3 | 4 | 5,
  }));

  // Iniciales para el form
  const { firstName, lastName1, lastName2 } = splitName(fullUser.name);
  const phoneParts = parseE164ToParts(fullUser.phone);

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-7xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Mi perfil</h1>
          <div className="flex gap-2">
            <Link href="/profile/summary" className="text-sm border rounded-lg px-3 py-2 hover:bg-gray-50">
              Ver resumen
            </Link>
            {/* ⛔️ Se eliminó el botón de CV Builder aquí */}
          </div>
        </div>

        {/* Aviso */}
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-medium">Importante</div>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>Al guardar aquí se actualiza tu perfil completo (reemplaza educación, experiencia, skills e idiomas).</li>
            <li>Tu correo de sesión está bloqueado: <span className="font-medium">{fullUser.email}</span>.</li>
          </ul>
        </div>

        {/* Grid con sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Formulario */}
          <div className="lg:col-span-8 space-y-6">
            <section className="border rounded-2xl glass-card p-4 md:p-6">
              <ProfileForm
                initial={{
                  firstName,
                  lastName1,
                  lastName2,
                  email: fullUser.email,
                  phoneCountry: phoneParts.phoneCountry,
                  phoneLocal:
                    phoneParts.phoneCountry === "52"
                      ? (phoneParts.phoneLocal || "").replace(/\D+/g, "").slice(-10)
                      : (phoneParts.phoneLocal || "").replace(/\D+/g, "").slice(0, 15),
                  location: fullUser.location ?? "",
                  birthdate: fullUser.birthdate ? fullUser.birthdate.toISOString().slice(0, 10) : "",
                  linkedin: fullUser.linkedin ?? "",
                  github: fullUser.github ?? "",
                  resumeUrl: fullUser.resumeUrl ?? "",
                  certifications: fullUser.certifications ?? [],
                  experiences: experiences.map((e) => ({
                    id: e.id,
                    role: e.role,
                    company: e.company,
                    startDate: e.startDate ? e.startDate.toISOString().slice(0, 7) : "",
                    endDate: e.endDate ? e.endDate.toISOString().slice(0, 7) : "",
                    isCurrent: e.isCurrent,
                  })),
                  languages: candidateLangs,
                  education: education.map((ed, i) => ({
                    id: ed.id,
                    level: (ed.level as any) ?? null,
                    status: (ed.status as any) ?? "COMPLETED",
                    institution: ed.institution ?? "",
                    program: ed.program ?? "",
                    startDate: ed.startDate ? ed.startDate.toISOString().slice(0, 7) : "",
                    endDate: ed.endDate ? ed.endDate.toISOString().slice(0, 7) : "",
                    sortIndex: typeof ed.sortIndex === "number" ? ed.sortIndex : i,
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

          {/* Sidebar */}
          <aside className="lg:col-span-4">
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
