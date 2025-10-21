// app/candidate/resume/page.tsx
import { getCandidateResume } from "@/lib/db/candidate";
import ResumeWizard from "@/components/resume/ResumeWizard";
import { auth } from "@/lib/auth";

export default async function CandidateResumePage() {
  const session = await auth();
  if (!session?.user?.id) {
    // redirige a login si aplica
    return null;
  }
  const data = await getCandidateResume(session.user.id);

  // Adaptar a props iniciales del wizard
  const initial = {
    base: {
      name: data?.name ?? "",
      location: data?.location ?? "",
      highestEducationLevel: data?.highestEducationLevel ?? "NONE",
      linkedin: data?.linkedin ?? "",
      github: data?.github ?? "",
      phone: data?.phone ?? "",
    },
    experiences: (data?.experiences ?? []).map((e) => ({
      id: e.id,
      company: e.company,
      role: e.role,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate ? e.endDate.toISOString() : null,
      isCurrent: e.isCurrent,
    })),
    education: (data?.education ?? []).map((ed) => ({
      id: ed.id,
      institution: ed.institution,
      program: ed.program,
      level: ed.level,
      status: ed.status,
      startDate: ed.startDate ? ed.startDate.toISOString() : null,
      endDate: ed.endDate ? ed.endDate.toISOString() : null,
      country: ed.country,
      city: ed.city,
      grade: ed.grade,
      description: ed.description,
      sortIndex: ed.sortIndex,
    })),
    skills: (data?.candidateSkills ?? []).map((s) => ({
      id: s.id,
      name: s.term.label,
      level: s.level,
      years: s.years,
    })),
    languages: (data?.candidateLanguages ?? []).map((l) => ({
      id: l.id,
      name: l.term.label,
      level: l.level,
    })),
    certifications: (data?.candidateCredentials ?? []).map((c) => ({
      id: c.id,
      name: c.term.label,
      issuer: c.issuer,
      issuedAt: c.issuedAt ? c.issuedAt.toISOString() : null,
      expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
      credentialId: c.credentialId,
      url: c.url,
    })),
  };

  return <ResumeWizard initial={initial} />;
}
