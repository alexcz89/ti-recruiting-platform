/**
 * SEO Keywords Strategy for TaskIO
 * Defines keywords by page type and content
 */

import { Job } from "@prisma/client";

export const SITE_KEYWORDS = {
  HOME: "vacantes tecnología México, empleos TI, dev jobs, ofertas trabajo IT",
  JOBS_LIST: "vacantes desarrollo, empleos programador, jobs TI Mexico, remote jobs",
  ABOUT: "sobre TaskIO, plataforma empleo TI, bolsa trabajo Mexico",
  CONTACT: "contacto TaskIO, soporte empleo",
} as const;

/**
 * Generate keywords for a specific job posting
 * Based on: title, skills, location, seniority
 */
export function generateJobKeywords(job: any): string {
  const parts: string[] = [];

  // Job title keywords
  if (job.title) {
    parts.push(job.title);
  }

  // Seniority level
  if (job.seniority) {
    parts.push(`${job.seniority} developer`);
  }

  // Location keywords
  if (job.city) {
    parts.push(`${job.title} ${job.city}`);
    parts.push(`vacante ${job.city}`);
  }

  // Skills keywords (top 5)
  if (job.skills && Array.isArray(job.skills)) {
    const topSkills = job.skills.slice(0, 3);
    parts.push(...topSkills);
    parts.push(`${topSkills[0]} developer`);
  }

  // Employment type
  if (job.employmentType) {
    parts.push(job.employmentType.toLowerCase().replace(/_/g, " "));
  }

  // Remote indicator
  if (job.remote) {
    parts.push("remote job");
    parts.push("trabajo remoto");
  }

  // Salary range (if available)
  if (job.salaryMin && job.salaryMax) {
    parts.push(`${job.salaryMin}-${job.salaryMax}`);
  }

  // Remove duplicates and limit to 12 keywords
  return Array.from(new Set(parts))
    .slice(0, 12)
    .join(", ");
}

/**
 * Generate meta description for job posting
 * Optimal length: 150-160 characters
 */
export function generateJobMetaDescription(job: any): string {
  const parts: string[] = [];

  // Title
  parts.push(job.title);

  // Company
  if (job.company && !job.companyConfidential) {
    parts.push(`en ${job.company}`);
  }

  // Location
  if (job.city) {
    parts.push(job.city);
  }

  // Salary
  if (job.salaryMin && job.salaryMax && job.showSalary) {
    parts.push(`$${job.salaryMin}-${job.salaryMax} MXN`);
  }

  // Description snippet (first 80 chars)
  if (job.description) {
    const snippet = job.description
      .replace(/<[^>]*>/g, "") // Remove HTML
      .substring(0, 80)
      .trim();
    parts.push(`. ${snippet}...`);
  }

  const description = parts.join(" ");

  // Ensure 150-160 characters
  if (description.length > 160) {
    return description.substring(0, 157) + "...";
  }

  return description;
}

/**
 * Generate title tag for job posting
 * Optimal length: 50-60 characters
 */
export function generateJobTitle(job: any): string {
  const parts: string[] = [];

  parts.push(job.title);

  if (job.city) {
    parts.push(job.city);
  } else if (job.remote) {
    parts.push("Remote");
  }

  return parts.join(" | ") + " | TaskIO";
}

/**
 * Generate page description for static pages
 */
export const PAGE_DESCRIPTIONS = {
  HOME: "Encuentra las mejores vacantes de tecnología en México. TaskIO conecta talento TI con empresas líderes. +500 ofertas activas.",
  JOBS: "Explora ofertas de trabajo en tecnología. Filtra por skill, ciudad, salario. React, Python, Java y más.",
  ABOUT: "TaskIO es la bolsa de trabajo #1 para profesionales TI en México. Conectando talento con oportunidades.",
  CONTACT: "Contacta al equipo de TaskIO. Soporte, partnerships, y más información sobre la plataforma.",
} as const;

/**
 * Get canonical URL for page
 */
export function getCanonicalUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.taskio.com.mx";
  return `${baseUrl}${path}`;
}
