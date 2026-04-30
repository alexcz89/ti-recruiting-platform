// app/profile/summary/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { fromNow } from "@/lib/dates";
import { getSkillsFromDB, getCertificationsFromDB } from "@/lib/server/skills";
import { LANGUAGES_FALLBACK } from "@/lib/shared/skills-data";
import ProfileSummaryClient from "./ProfileSummaryClient";

export const metadata = { title: "Mi perfil | Bolsa TI" };

export default async function ProfileSummaryPage({
  searchParams,
}: {
  searchParams?: { updated?: string; applied?: string; cvImported?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin?callbackUrl=/profile/summary");

  const meEmail = session.user?.email!;
  const me = await prisma.user.findUnique({
    where: { email: meEmail },
    select: {
      id: true,
      role: true,
      name: true,
      firstName: true,
      lastName: true,
      maternalSurname: true,
      email: true,
      phone: true,
      location: true,
      birthdate: true,
      linkedin: true,
      github: true,
      resumeUrl: true,
      certifications: true,
      highestEducationLevel: true,
      seniority: true,
      yearsExperience: true,
      desiredSalaryMin: true,
      seekingRemote: true,
      seekingHybrid: true,
      seekingOnsite: true,
    },
  });

  if (!me) redirect("/profile/edit");
  if (me.role !== "CANDIDATE") redirect("/dashboard");

  const experiences = await prisma.workExperience.findMany({
    where: { userId: me.id },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true, role: true, company: true,
      startDate: true, endDate: true, isCurrent: true,
    },
  });

  const education = await prisma.education.findMany({
    where: { userId: me.id },
    orderBy: [{ sortIndex: "asc" }, { startDate: "desc" }, { createdAt: "asc" }],
    select: {
      id: true, level: true, status: true, institution: true,
      program: true, startDate: true, endDate: true, sortIndex: true,
    },
  });

  const languages = await prisma.candidateLanguage.findMany({
    where: { userId: me.id },
    include: { term: { select: { id: true, label: true } } },
    orderBy: { term: { label: "asc" } },
  });

  const candidateSkills = await prisma.candidateSkill.findMany({
    where: { userId: me.id },
    include: { term: { select: { id: true, label: true } } },
    orderBy: [{ level: "desc" }, { term: { label: "asc" } }],
  });

  const myApps = await prisma.application.findMany({
    where: { candidateId: me.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      job: {
        select: { id: true, slug: true, title: true, company: { select: { name: true } }, updatedAt: true },
      },
    },
  });

  // Language options for editing
  const allLangTerms = await prisma.taxonomyTerm.findMany({
    where: { kind: "LANGUAGE" },
    select: { id: true, label: true },
    orderBy: { label: "asc" },
  });
  const allowedSet = new Set(LANGUAGES_FALLBACK.map((x: string) => x.toLowerCase()));
  const languageOptions = allLangTerms
    .filter((t) => allowedSet.has(t.label.toLowerCase()))
    .map((t) => ({ id: t.id, label: t.label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Skill options for editing
  const skillTermsFromDB = await prisma.taxonomyTerm.findMany({
    where: { kind: "SKILL" },
    select: { id: true, label: true },
    orderBy: { label: "asc" },
  });
  const skillsOptions = await getSkillsFromDB();
  const certOptions = await getCertificationsFromDB();
  const seen = new Set<string>();
  const skillTermOptions = [
    ...skillTermsFromDB.map((t) => ({ id: t.id, label: t.label })).filter((t) => {
      const k = t.label.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }),
    ...skillsOptions.map((label: string) => ({ id: "", label })).filter((t: any) => {
      const k = t.label.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }),
  ].sort((a: any, b: any) => a.label.localeCompare(b.label));

  // Compute totals
  const totalYears = (() => {
    try {
      const sum = experiences.reduce((acc, e) => {
        const start = e.startDate ? new Date(e.startDate) : null;
        const end = e.isCurrent || !e.endDate ? new Date() : new Date(e.endDate!);
        if (!start || isNaN(start.getTime()) || isNaN(end.getTime())) return acc;
        return acc + Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      }, 0);
      return Math.round(sum * 10) / 10;
    } catch { return null; }
  })();

  // Parse name parts
  let firstName = me.firstName ?? "";
  let lastName1 = me.lastName ?? "";
  let lastName2 = me.maternalSurname ?? "";
  if (!firstName) {
    const parts = (me.name ?? "").trim().split(/\s+/);
    lastName2 = parts.length >= 3 ? parts.pop()! : "";
    lastName1 = parts.length >= 2 ? parts.pop()! : "";
    firstName = parts.join(" ");
  }

  const appliedMsg =
    searchParams?.applied === "1"
      ? { text: "¡Postulación enviada! 🎉", tone: "emerald" as const }
      : searchParams?.applied === "existing"
      ? { text: "Ya habías postulado a esta vacante.", tone: "amber" as const }
      : null;

  return (
    <ProfileSummaryClient
      user={{
        id: me.id,
        email: me.email,
        firstName,
        lastName1,
        lastName2,
        phone: me.phone ?? "",
        location: me.location ?? "",
        birthdate: me.birthdate ? me.birthdate.toISOString().slice(0, 10) : "",
        linkedin: me.linkedin ?? "",
        github: me.github ?? "",
        resumeUrl: me.resumeUrl ?? "",
        certifications: me.certifications ?? [],
        seniority: (me.seniority as any) ?? null,
        yearsExperience: me.yearsExperience ?? null,
        desiredSalary: me.desiredSalaryMin ?? null,
        seekingRemote: me.seekingRemote ?? false,
        seekingHybrid: me.seekingHybrid ?? false,
        seekingOnsite: me.seekingOnsite ?? false,
      }}
      experiences={experiences.map((e) => ({
        id: e.id,
        role: e.role,
        company: e.company,
        startDate: e.startDate ? e.startDate.toISOString().slice(0, 7) : "",
        endDate: e.endDate ? e.endDate.toISOString().slice(0, 7) : null,
        isCurrent: e.isCurrent,
      }))}
      education={education.map((ed, i) => ({
        id: ed.id,
        level: (ed.level as any) ?? null,
        status: (ed.status as any) ?? "COMPLETED",
        institution: ed.institution ?? "",
        program: ed.program ?? "",
        startDate: ed.startDate ? ed.startDate.toISOString().slice(0, 7) : "",
        endDate: ed.endDate ? ed.endDate.toISOString().slice(0, 7) : "",
        sortIndex: typeof ed.sortIndex === "number" ? ed.sortIndex : i,
      }))}
      languages={languages.map((l) => ({
        termId: l.termId,
        label: l.term.label,
        level: l.level as any,
      }))}
      skills={candidateSkills.map((s) => ({
        termId: s.termId,
        label: s.term.label,
        level: s.level as any,
      }))}
      applications={myApps.map((a) => ({
        id: a.id,
        createdAt: a.createdAt.toISOString(),
        jobId: a.job?.id ?? "",
        jobSlug: a.job?.slug ?? null,
        jobTitle: a.job?.title ?? "—",
        companyName: a.job?.company?.name ?? "—",
      }))}
      totalYears={totalYears}
      languageOptions={languageOptions}
      skillTermOptions={skillTermOptions}
      certOptions={certOptions}
      flashUpdated={searchParams?.updated === "1"}
      flashCvImported={searchParams?.cvImported === "1"}
      appliedMsg={appliedMsg}
    />
  );
}