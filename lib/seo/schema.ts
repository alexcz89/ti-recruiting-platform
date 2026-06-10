/**
 * JSON-LD Schema.org Generators
 * For JobPosting, Organization, Breadcrumb
 */

import { Job } from "@prisma/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.taskio.com.mx";

/**
 * Generate JobPosting schema for Google for Jobs
 * https://schema.org/JobPosting
 */
export function generateJobPostingSchema(job: any) {
  // Ensure valid date 60 days from now
  const validThrough = new Date();
  validThrough.setDate(validThrough.getDate() + 60);

  const schema: any = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    "id": `${APP_URL}/jobs/${job.slug || job.id}`,
    "title": job.title,
    "description": job.description,
    "datePosted": new Date(job.createdAt).toISOString(),
    "validThrough": validThrough.toISOString(),

    // Employment type
    "employmentType": mapEmploymentType(job.employmentType),

    // Salary (if available and showSalary)
    ...(job.salaryMin &&
      job.salaryMax &&
      job.showSalary && {
        baseSalary: {
          "@type": "PriceSpecification",
          "currency": "MXN",
          "minValue": job.salaryMin,
          "maxValue": job.salaryMax,
          "unitText": "MONTH",
        },
      }),

    // Job location
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "",
        "addressLocality": job.city || "",
        "addressRegion": job.admin1 || "",
        "addressCountry": "MX",
      },
    },

    // Work location type
    "workLocationDetails": {
      "@type": "WorkLocationDetails",
      "workLocation": {
        "@type": "Place",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": job.city || "",
          "addressRegion": job.admin1 || "",
          "addressCountry": "MX",
        },
      },
    },

    // Hiring organization
    "hiringOrganization": {
      "@type": "Organization",
      "name": job.company || "TaskIO",
      ...(job.logoUrl && { "logo": job.logoUrl }),
      "url": APP_URL,
    },

    // Apply action
    "applicantLocationRequirements": {
      "@type": "Country",
      "name": "MX",
    },
  };

  // Add location type indicator
  if (job.remote) {
    schema.jobLocationType = "TELECOMMUTE";
  } else if (job.locationType === "HYBRID") {
    schema.jobLocationType = "HYBRID";
  } else {
    schema.jobLocationType = "PHYSICAL";
  }

  // Add benefits if available
  if (job.benefitsJson && typeof job.benefitsJson === "object") {
    const benefits = Object.entries(job.benefitsJson)
      .filter(([, value]) => value === true)
      .map(([key]) => formatBenefit(key));

    if (benefits.length > 0) {
      schema.jobBenefits = {
        "@type": "JobBenefits",
        "baseSalary": job.salaryMax,
        "othered_benefits": benefits.join(", "),
      };
    }
  }

  return schema;
}

/**
 * Generate Organization schema
 */
export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": APP_URL,
    "name": "TaskIO",
    "description": "Plataforma de empleos para profesionales de tecnología en México",
    "url": APP_URL,
    "logo": `${APP_URL}/logo.png`,
    "image": `${APP_URL}/og-image.png`,
    "sameAs": [
      "https://www.linkedin.com/company/taskio",
      "https://twitter.com/taskio_mx",
      "https://www.facebook.com/taskio.mx",
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "Customer Service",
      "email": "hola@taskio.com.mx",
      "areaServed": "MX",
      "availableLanguage": ["es"],
    },
    "areaServed": [
      {
        "@type": "City",
        "name": "Mexico City",
      },
      {
        "@type": "City",
        "name": "Monterrey",
      },
      {
        "@type": "City",
        "name": "Guadalajara",
      },
    ],
    "founded": "2024",
    "foundingLocation": "Mexico City, Mexico",
  };
}

/**
 * Generate WebSite schema with search action
 */
export function generateWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "url": APP_URL,
    "name": "TaskIO",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${APP_URL}/jobs?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Generate BreadcrumbList schema
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url.startsWith("http") ? item.url : `${APP_URL}${item.url}`,
    })),
  };
}

/**
 * Map employment type to schema.org format
 */
function mapEmploymentType(type: string): string {
  const mapping: Record<string, string> = {
    FULL_TIME: "FULL_TIME",
    PART_TIME: "PART_TIME",
    CONTRACT: "CONTRACT",
    TEMPORARY: "TEMPORARY",
    INTERNSHIP: "INTERNSHIP",
    FREELANCE: "CONTRACTOR",
  };
  return mapping[type] || type || "FULL_TIME";
}

/**
 * Format benefit name for display
 */
function formatBenefit(key: string): string {
  return key
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
