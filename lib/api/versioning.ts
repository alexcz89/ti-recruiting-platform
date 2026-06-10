/**
 * API Versioning Support
 * Allows gradual migration of API clients
 */

import { NextRequest } from "next/server";

/**
 * API Versions for TaskIO
 * v1: Original API (deprecated, for backward compatibility)
 * v2: Optimized API with cleaned responses
 * v3: Future improvements
 */
export const API_VERSIONS = {
  V1: "1",
  V2: "2", // Current recommended version
  V3: "3",
} as const;

export type ApiVersion = (typeof API_VERSIONS)[keyof typeof API_VERSIONS];

/**
 * Get requested API version from request
 * Checks: query param, header, or defaults to v2
 */
export function getApiVersion(request: NextRequest): ApiVersion {
  // Check query param: ?v=2
  const url = new URL(request.url);
  const vParam = url.searchParams.get("v");
  if (vParam && Object.values(API_VERSIONS).includes(vParam as ApiVersion)) {
    return vParam as ApiVersion;
  }

  // Check header: X-API-Version: 2
  const vHeader = request.headers.get("x-api-version");
  if (vHeader && Object.values(API_VERSIONS).includes(vHeader as ApiVersion)) {
    return vHeader as ApiVersion;
  }

  // Default to v2
  return API_VERSIONS.V2;
}

/**
 * Version-specific response transformers
 * Each version can transform data differently
 */
export const versionHandlers = {
  [API_VERSIONS.V1]: {
    description: "Original API - no data cleaning",
    transformJob: (job: any) => job, // Keep as-is
    transformList: (items: any[]) => items,
  },
  [API_VERSIONS.V2]: {
    description: "Optimized API - clean null values, normalize fields",
    transformJob: (job: any) => ({
      id: job.id,
      slug: job.slug,
      title: job.title,
      company: job.company,
      logo: job.logoUrl || job.companyLogoUrl,
      location: job.location,
      remote: job.remote,
      employmentType: job.employmentType,
      description: job.description,
      descriptionHtml: job.descriptionHtml,
      skills: job.skills || [],
      salary: job.salaryMin || job.salaryMax ? {
        min: job.salaryMin,
        max: job.salaryMax,
        currency: job.currency,
      } : undefined,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    }),
    transformList: (items: any[]) =>
      items.map((item) => versionHandlers[API_VERSIONS.V2].transformJob(item)),
  },
  [API_VERSIONS.V3]: {
    description: "Future API - enhanced features",
    transformJob: (job: any) => {
      // To be implemented in future
      return versionHandlers[API_VERSIONS.V2].transformJob(job);
    },
    transformList: (items: any[]) => items,
  },
};

/**
 * Transform response based on API version
 */
export function transformByVersion<T>(
  data: T,
  version: ApiVersion
): T {
  const handler = versionHandlers[version];
  if (!handler) {
    return data;
  }

  if (Array.isArray(data)) {
    return handler.transformList(data) as T;
  }

  if (data && typeof data === "object" && "id" in data) {
    return handler.transformJob(data) as T;
  }

  return data;
}

/**
 * Generate deprecation warning
 */
export function getDeprecationWarning(version: ApiVersion): string | null {
  if (version === API_VERSIONS.V1) {
    return `API v1 is deprecated and will be removed on 2026-12-31. Please migrate to v2.`;
  }
  return null;
}

/**
 * Get version info for response headers
 */
export function getVersionInfo(version: ApiVersion) {
  const handler = versionHandlers[version];
  return {
    version,
    description: handler?.description || "Unknown version",
    deprecated: version === API_VERSIONS.V1,
    deprecationWarning: getDeprecationWarning(version),
  };
}
