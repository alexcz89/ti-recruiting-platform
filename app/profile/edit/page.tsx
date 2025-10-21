// app/profile/edit/page.tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfileForm from "../ProfileForm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

// Catálogo central
import {
  getSkillsFromDB,
  getCertificationsFromDB,
  LANGUAGES_FALLBACK, // lista oficial de 30 idiomas
} from "@/lib/skills";

// Server action centralizada
import { updateProfileAction } from "../actions";

export const metadata = { title: "Mi perfil | Bolsa TI" };

/** Divide un nombre en {firstName, lastName1, lastName2} */
function splitName(full?: string | null) {
  const parts = (full ?? "").trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return { firstName: "", lastName1: "", lastName2: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName1: "", lastName2: "" };
  if (parts.length === 2) return { firstName: parts[0], lastName1: parts[1], lastName2: "" };
  const lastName2 = parts.pop() as string;
  const lastName1 = parts.pop() as string;
  const firstName = parts.join(" ");
  return { firstName, lastName1, lastName2 };
}

/** Split E.164 -> parts con heurística simple (MX = últimos 10) */
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

  // Asegura registro (MVP)
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

  // Experiencias (más reciente primero)
  const experiences = await prisma.workExperience.findMany({
    where: { userId: dbUser.id },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, role: true, company: true, startDate: true, endDate: true, isCurrent: true },
  });

  // Idiomas: traer todos y filtrar a los 30 oficiales
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

  // Idiomas del candidato (filtrados por los 30 oficiales)
  const candidateLangsRaw = await prisma.candidateLanguage.findMany({
    where: { userId: dbUser.id },
    include: { term: { select: { id: true, label: true } } },
  });
  const candidateLangs = candidateLangsRaw
    .filter((l) => allowedSet.has(l.term.label.toLowerCase()))
    .map((l) => ({ termId: l.termId, label: l.term.label, level: l.level }));

  // === SKILLS: catálogos (DB + fallback)
  const [skillsOptions, certOptions] = await Promise.all([getSkillsFromDB(), getCertificationsFromDB()]);
  const skillTermsFromDB = await prisma.taxonomyTerm.findMany({
    where: { kind: "SKILL" },
    select: { id: true, label: true },
    orderBy: { label: "asc" },
  });
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

  // Usuario (para iniciales)
  const fullUser = await prisma.user.findUnique({
    where: { id: dbUser.id },
    select: {
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

  // 🔹 Escolaridad inicial (ordenada por sortIndex asc)
  const education = await prisma.education.findMany({
    where: { userId: dbUser.id },
    orderBy: [{ sortIndex: "asc" }, { startDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, level: true, status: true, institution: true, program: true, startDate: true, endDate: true, sortIndex: true },
  });

  // 🔹 Skills actuales del candidato (para poder quitarlas en el form)
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

  const parts = parseE164ToParts(fullUser.phone);
  const { firstName, lastName1, lastName2 } = splitName(fullUser.name);

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-7xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Mi perfil</h1>
          <Link href="/profile/summary" className="text-sm border rounded-lg px-3 py-2 hover:bg-gray-50">
            Ver resumen
          </Link>
        </div>

        {/* Grid ancho con sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Formulario (8/12) */}
          <div className="lg:col-span-8 space-y-6">
            <section className="border rounded-2xl bg-white p-5">
              <ProfileForm
                initial={{
                  firstName,
                  lastName1,
                  lastName2,
                  email: fullUser.email,
                  phoneCountry: parts.phoneCountry || "52",
                  phoneLocal:
                    parts.phoneCountry === "52"
                      ? (parts.phoneLocal || "").replace(/\D+/g, "").slice(-10)
                      : (parts.phoneLocal || "").replace(/\D+/g, "").slice(0, 15),
                  location: fullUser.location ?? "",
                  birthdate: fullUser.birthdate ? fullUser.birthdate.toISOString().slice(0, 10) : "",
                  linkedin: fullUser.linkedin ?? "",
                  github: fullUser.github ?? "",
                  resumeUrl: fullUser.resumeUrl ?? "",
                  skills: fullUser.skills ?? [],
                  certifications: fullUser.certifications ?? [],
                  experiences: experiences.map((e) => ({
                    id: e.id,
                    role: e.role,
                    company: e.company,
                    startDate: e.startDate.toISOString().slice(0, 7),
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
                // estos dos siguen siendo útiles para chips/legacy y certs
                skillsOptions={skillsOptions}
                certOptions={certOptions}
                // catálogos estrictos
                languageOptions={languageOptions}
                skillTermOptions={skillTermOptions}
                onSubmit={updateProfileAction}
              />
            </section>
          </div>

          {/* Sidebar (4/12) */}
          <aside className="lg:col-span-4">
            <div className="sticky top-20 space-y-6">
              {/* Navegación rápida */}
              <nav className="border rounded-2xl bg-white p-4">
                <h2 className="font-semibold mb-2">Navegación rápida</h2>
                <ul className="text-sm space-y-1">
                  <li><a className="hover:underline" href="#personal">Datos personales</a></li>
                  <li><a className="hover:underline" href="#contacto">Teléfono y ubicación</a></li>
                  <li><a className="hover:underline" href="#cv">Currículum</a></li>
                  <li><a className="hover:underline" href="#certs">Certificaciones</a></li>
                  <li><a className="hover:underline" href="#skills">Skills</a></li>
                  <li><a className="hover:underline" href="#languages">Idiomas</a></li>
                  <li><a className="hover:underline" href="#education">Educación</a></li>
                </ul>
              </nav>

              {/* Tips */}
              <div className="border rounded-2xl bg-white p-4">
                <h3 className="font-semibold mb-1">Consejos</h3>
                <ul className="text-sm list-disc pl-4 space-y-1 text-zinc-600">
                  <li>Completa tu ubicación y teléfono para que te contacten más fácil.</li>
                  <li>Sube tu CV y mantén tus skills al día.</li>
                  <li>Usa meses exactos en educación (YYYY-MM).</li>
                </ul>
              </div>

              {/* Accesos rápidos */}
              <div className="border rounded-2xl bg-white p-4">
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
