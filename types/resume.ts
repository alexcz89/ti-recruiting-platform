// types/resume.ts
import { EducationLevel, EducationStatus, LanguageProficiency } from "@prisma/client";

/* =========================================================
 * NUEVA ESTRUCTURA (alineada al wizard y a /api/.../resume)
 * ========================================================= */

export type PersonalInfo = {
  /** Nombre completo mostrado en el CV */
  fullName: string;
  /** Email del candidato (normalmente viene del User) */
  email?: string;
  phone?: string | null;
  /** Ciudad/estado/país en texto libre (ej. "Monterrey, NL, México") */
  location?: string | null;
  /** YYYY-MM-DD */
  birthDate?: string | null;
  linkedin?: string | null;
  github?: string | null;
  /** Nivel educativo más alto (se puede calcular del arreglo education) */
  highestEducationLevel?: EducationLevel;
};

export type WorkItem = {
  id?: string;
  company: string;
  role: string;
  /** YYYY-MM-DD */
  startDate?: string | null;
  /** YYYY-MM-DD */
  endDate?: string | null;
  isCurrent?: boolean;
  /** Ciudad opcional (si la guardas en tu modelo) */
  city?: string | null;
  /** Párrafo o bullets en texto plano */
  description?: string | null;
  /** Opcional: bullets individuales */
  highlights?: string[];
};

export type EducationItem = {
  id?: string;
  institution: string;
  program?: string | null;
  level?: EducationLevel | null;
  status?: EducationStatus | null;
  country?: string | null;
  city?: string | null;
  /** YYYY-MM-DD */
  startDate?: string | null;
  /** YYYY-MM-DD */
  endDate?: string | null;
  grade?: string | null;
  description?: string | null;
  /** Para ordenar visualmente en el CV */
  sortIndex?: number;
};

export type SkillItem = {
  id?: string;
  /** TaxonomyTerm.label */
  name: string;
  /** 0–5 opcional */
  level?: number | null;
  /** Años de experiencia (si lo manejas) */
  years?: number | null;
};

export type LanguageItem = {
  id?: string;
  /** TaxonomyTerm.label */
  name: string;
  /** Enum en BD; si en UI usas "B2/C1", normaliza antes de persistir */
  level: LanguageProficiency;
};

export type CertificationItem = {
  id?: string;
  /** TaxonomyTerm.label */
  name: string;
  issuer?: string | null;
  /** YYYY-MM-DD */
  issuedAt?: string | null;
  /** YYYY-MM-DD */
  expiresAt?: string | null;
  credentialId?: string | null;
  url?: string | null;
};

export type SocialLink = {
  type: "github" | "linkedin" | "portfolio" | string;
  url: string;
};

export type ResumeData = {
  personal: PersonalInfo;
  /** Resumen profesional / about me */
  about?: string | null;
  experience: WorkItem[];
  education: EducationItem[];
  skills: SkillItem[];
  languages: LanguageItem[];
  certifications: CertificationItem[];
  /** Enlaces adicionales (portafolio, etc.) */
  links?: SocialLink[];
};

/* =========================================================
 * COMPATIBILIDAD HACIA ATRÁS (DEPRECATED)
 * Mantengo tus nombres originales como alias para no romper
 * imports existentes. Preferir los tipos de arriba.
 * ========================================================= */

/** @deprecated Usa PersonalInfo (mantengo campos para compatibilidad) */
export type CandidateBase = {
  /** Equivale a PersonalInfo.fullName */
  name?: string | null;
  location?: string | null;
  highestEducationLevel?: EducationLevel;
  linkedin?: string | null;
  github?: string | null;
  phone?: string | null;
  /** Equivale a ResumeData.about */
  summary?: string | null;
};

/** @deprecated Usa WorkItem */
export type CandidateExperience = WorkItem;

/** @deprecated Usa EducationItem */
export type CandidateEducation = EducationItem;

/** @deprecated Usa SkillItem */
export type CandidateSkill = SkillItem;

/** @deprecated Usa LanguageItem */
export type CandidateLanguage = LanguageItem;

/** @deprecated Usa CertificationItem */
export type CandidateCertification = CertificationItem;

/** @deprecated Usa ResumeData */
export type ResumePayload = {
  /** Equivalente aproximado a ResumeData.personal */
  base: CandidateBase;
  /** Equivalente a ResumeData.experience */
  experiences: CandidateExperience[];
  /** Equivalente a ResumeData.education */
  education: CandidateEducation[];
  /** Equivalente a ResumeData.skills */
  skills: CandidateSkill[];
  /** Equivalente a ResumeData.languages */
  languages: CandidateLanguage[];
  /** Equivalente a ResumeData.certifications */
  certifications: CandidateCertification[];
  /** Equivalente a ResumeData.links */
  links?: SocialLink[];
};
