// types/resume.ts
import { EducationLevel, EducationStatus, LanguageProficiency } from "@prisma/client";

export type CandidateBase = {
  name?: string | null;
  location?: string | null;
  highestEducationLevel?: EducationLevel;
  linkedin?: string | null;
  github?: string | null;
  phone?: string | null;
  summary?: string | null; // opcional: guárdalo en otro campo si lo agregas
};

export type CandidateExperience = {
  id?: string;
  company: string;
  role: string;
  startDate: string; // ISO
  endDate?: string | null; // ISO
  isCurrent?: boolean;
  city?: string | null;
  description?: string | null;
  highlights?: string[]; // bullets
};

export type CandidateEducation = {
  id?: string;
  institution: string;
  program?: string | null;
  level?: EducationLevel | null;
  status: EducationStatus;
  country?: string | null;
  city?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  grade?: string | null;
  description?: string | null;
  sortIndex?: number;
};

export type CandidateSkill = {
  id?: string;
  name: string;           // TaxonomyTerm.label
  level?: number | null;  // 1-5 opcional
  years?: number | null;
};

export type CandidateLanguage = {
  id?: string;
  name: string;                    // TaxonomyTerm.label
  level: LanguageProficiency;
};

export type CandidateCertification = {
  id?: string;
  name: string;       // TaxonomyTerm.label
  issuer?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  credentialId?: string | null;
  url?: string | null;
};

export type ResumePayload = {
  base: CandidateBase;
  experiences: CandidateExperience[];
  education: CandidateEducation[];
  skills: CandidateSkill[];
  languages: CandidateLanguage[];
  certifications: CandidateCertification[];
  links?: { type: "github" | "linkedin" | "portfolio" | string; url: string }[]; // si luego agregas SocialLink
};
