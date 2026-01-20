// app/cv/builder/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import Link from "next/link";
import CvBuilder from "@/components/cv/CvBuilder";

export const metadata = { title: "CV Builder | Bolsa TI" };

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

export default async function CvBuilderPage() {
  const session = await getServerSession(authOptions);
  const isLoggedIn = !!session?.user;

  // Catálogo global de skills / idiomas para autocomplete
  const [skillTerms, languageTerms] = await Promise.all([
    prisma.taxonomyTerm.findMany({
      where: { kind: "SKILL" },
      select: { id: true, label: true },
      orderBy: { label: "asc" },
    }),
    prisma.taxonomyTerm.findMany({
      where: { kind: "LANGUAGE" },
      select: { id: true, label: true },
      orderBy: { label: "asc" },
    }),
  ]);

  const skillOptions = skillTerms.map((t) => ({ termId: t.id, label: t.label }));
  const languageOptions = languageTerms.map((t) => ({ termId: t.id, label: t.label }));

  // ---------- initial base para invitados ----------
  let initial: any = {
    identity: {
      firstName: "",
      lastName1: "",
      lastName2: "",
      email: "",
      phone: "",
      location: "",
      linkedin: "",
      github: "",
      birthdate: "",
    },
    experiences: [],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
  };

  let user: any = null;

  // ---------- Si hay sesión, usamos datos reales ----------
  if (isLoggedIn) {
    const dbUser = await prisma.user.upsert({
      where: { email: session!.user!.email! },
      update: {},
      create: {
        email: session!.user!.email!,
        name: session!.user!.name ?? session!.user!.email!.split("@")[0],
        passwordHash: "demo",
        role: "CANDIDATE",
      },
    });

    user = await prisma.user.findUnique({
      where: { id: dbUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        location: true,
        linkedin: true,
        github: true,
        resumeUrl: true,
        certifications: true,
        birthdate: true,
      },
    });

    const experiences = await prisma.workExperience.findMany({
      where: { userId: dbUser.id },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        role: true,
        company: true,
        startDate: true,
        endDate: true,
        isCurrent: true,
      },
    });

    const education = await prisma.education.findMany({
      where: { userId: dbUser.id },
      orderBy: [
        { sortIndex: "asc" },
        { startDate: "desc" },
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        level: true,
        status: true,
        institution: true,
        program: true,
        startDate: true,
        endDate: true,
        sortIndex: true,
      },
    });

    const candidateSkills = await prisma.candidateSkill.findMany({
      where: { userId: dbUser.id },
      include: { term: { select: { id: true, label: true } } },
      orderBy: [{ level: "desc" }, { term: { label: "asc" } }],
    });

    const candidateLangs = await prisma.candidateLanguage.findMany({
      where: { userId: dbUser.id },
      include: { term: { select: { id: true, label: true } } },
    });

    const { firstName, lastName1, lastName2 } = splitName(user?.name);

    initial = {
      identity: {
        firstName,
        lastName1,
        lastName2,
        email: user?.email ?? "",
        phone: user?.phone ?? "",
        location: user?.location ?? "",
        linkedin: user?.linkedin ?? "",
        github: user?.github ?? "",
        birthdate: user?.birthdate
          ? user.birthdate.toISOString().slice(0, 10)
          : "",
      },
      experiences: experiences.map((e) => ({
        id: e.id,
        role: e.role,
        company: e.company,
        startDate: e.startDate ? e.startDate.toISOString().slice(0, 7) : "",
        endDate: e.endDate ? e.endDate.toISOString().slice(0, 7) : "",
        isCurrent: !!e.isCurrent,
      })),
      education: education.map((ed) => ({
        id: ed.id,
        level: ed.level,
        status: ed.status,
        institution: ed.institution ?? "",
        program: ed.program ?? "",
        startDate: ed.startDate ? ed.startDate.toISOString().slice(0, 7) : "",
        endDate: ed.endDate ? ed.endDate.toISOString().slice(0, 7) : "",
        sortIndex: ed.sortIndex ?? 0,
      })),
      skills: candidateSkills.map((s) => ({
        termId: s.termId,
        label: s.term?.label || "",
        level: s.level as 1 | 2 | 3 | 4 | 5,
      })),
      languages: candidateLangs.map((l) => ({
        termId: l.termId,
        label: l.term?.label || "",
        level: l.level,
      })),
      certifications: user?.certifications ?? [],
    };
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CV Builder</h1>
          {isLoggedIn ? (
            <p className="text-sm text-zinc-600">
              Sesión: <span className="font-medium">{user?.email}</span>
            </p>
          ) : (
            <p className="text-sm text-zinc-600">
              Sin registro: completa tu CV y descárgalo. Si quieres guardarlo en
              tu cuenta y postularte en un clic, al final podrás crear tu cuenta
              gratis.
            </p>
          )}
        </div>

        {isLoggedIn && (
          <Link
            href="/profile/summary"
            className="inline-flex items-center text-sm text-zinc-600 hover:text-zinc-900 border rounded-lg px-3 py-2 hover:bg-gray-50"
          >
            ← Volver a mi perfil
          </Link>
        )}
      </header>

      <section className="border rounded-xl glass-card p-4 md:p-6">
        <CvBuilder
          initial={initial as any}
          skillOptions={skillOptions}
          languageOptions={languageOptions}
        />
      </section>
    </main>
  );
}
