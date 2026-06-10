/**
 * API Response Utilities
 * Clean, normalize, and optimize API responses
 */

import { NextResponse } from "next/server";

/**
 * Remove null and undefined values from objects
 * Reduces JSON payload by removing empty fields
 */
export function cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
  if (!obj || typeof obj !== "object") return obj;

  const cleaned: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    const value = obj[key];

    // Skip null, undefined, empty strings, empty arrays
    if (value === null || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      // Keep arrays only if not empty
      if (value.length > 0) {
        cleaned[key] = value.map((item) =>
          typeof item === "object" ? cleanObject(item) : item
        );
      }
    } else if (typeof value === "object") {
      const cleanedNested = cleanObject(value);
      // Only add if has properties after cleaning
      if (Object.keys(cleanedNested).length > 0) {
        cleaned[key] = cleanedNested;
      }
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/**
 * Create optimized JSON response with compression headers
 */
export function jsonResponse<T>(
  data: T,
  options: {
    status?: number;
    maxAge?: number;
    sMaxAge?: number;
    clean?: boolean;
    version?: string;
  } = {}
): NextResponse<T> {
  const {
    status = 200,
    maxAge = 60,
    sMaxAge = 3600,
    clean = true,
    version = "1",
  } = options;

  const body = clean ? cleanObject(data as any) : data;

  const response = NextResponse.json(body, { status });

  // Set cache headers
  response.headers.set(
    "Cache-Control",
    `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${
      sMaxAge * 24
    }`
  );

  // Compression headers
  response.headers.set("Vary", "Accept-Encoding");
  response.headers.set("Content-Encoding", "gzip");

  // API versioning header
  response.headers.set("X-API-Version", version);

  // Security
  response.headers.set("X-Content-Type-Options", "nosniff");

  return response;
}

/**
 * Create response for frequently accessed data (use aggressive caching)
 */
export function cachedJsonResponse<T>(
  data: T,
  cacheSeconds: number = 3600
): NextResponse<T> {
  return jsonResponse(data, {
    maxAge: Math.min(60, cacheSeconds), // Client: min 1 min
    sMaxAge: cacheSeconds, // CDN: configurable
    clean: true,
  });
}

/**
 * Create response for real-time data (minimal caching)
 */
export function realtimeJsonResponse<T>(data: T): NextResponse<T> {
  return jsonResponse(data, {
    maxAge: 0, // No client cache
    sMaxAge: 10, // Only CDN cache 10 sec
    clean: true,
  });
}

/**
 * Format list response with pagination
 */
export function listResponse<T>(
  items: T[],
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    cursor?: string | null;
  },
  cacheSeconds: number = 300
) {
  const response = {
    items: items.map((item) => cleanObject(item as any)),
    pagination: {
      total: pagination.total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(pagination.total / pagination.pageSize),
      ...(pagination.cursor && { nextCursor: pagination.cursor }),
    },
  };

  return cachedJsonResponse(response, cacheSeconds);
}

/**
 * Normalize field names for consistency
 * Example: "companyLogoUrl" → "logoUrl"
 */
export function normalizeJob(job: any) {
  return cleanObject({
    id: job.id,
    slug: job.slug,
    title: job.title,
    company: job.company,
    companyObj: job.companyObj,
    logo: job.logoUrl || job.companyLogoUrl,
    location: job.location,
    locationType: job.locationType,
    country: job.country,
    admin1: job.admin1,
    city: job.city,
    remote: job.remote,
    employmentType: job.employmentType,
    seniority: job.seniority,
    description: job.description,
    descriptionHtml: job.descriptionHtml,
    skills: job.skills,
    salary: {
      min: job.salaryMin,
      max: job.salaryMax,
      currency: job.currency,
      show: job.showSalary,
    },
    benefits: job.benefitsJson,
    education: job.educationJson,
    schedule: job.schedule,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    confidential: job.companyConfidential,
  });
}

/**
 * Normalize candidate data
 */
export function normalizeCandidate(user: any) {
  return cleanObject({
    id: user.id,
    name: user.name,
    email: user.email,
    location: user.location,
    country: user.country,
    city: user.city,
    phone: user.phone,
    linkedin: user.linkedin,
    github: user.github,
    resumeUrl: user.resumeUrl,
    skills: user.candidateSkills?.map((s: any) => ({
      name: s.term?.label,
      level: s.level,
    })),
    languages: user.candidateLanguages?.map((l: any) => ({
      name: l.term?.label,
      level: l.level,
    })),
    education: user.educations?.map((e: any) => ({
      program: e.program,
      institution: e.institution,
      level: e.level,
      status: e.status,
    })),
    experience: user.experiences?.map((e: any) => ({
      role: e.role,
      company: e.company,
      startDate: e.startDate,
      endDate: e.endDate,
    })),
    createdAt: user.createdAt,
    emailVerified: user.emailVerified,
  });
}

/**
 * Error response with proper caching
 */
export function errorResponse(message: string, status: number = 400) {
  const response = NextResponse.json({ error: message }, { status });
  // Errors should not be cached
  response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  return response;
}
