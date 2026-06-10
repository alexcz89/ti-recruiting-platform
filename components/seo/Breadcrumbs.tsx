/**
 * Breadcrumb Navigation with Schema.org Markup
 * Accessible and SEO-friendly breadcrumbs
 */

"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { generateBreadcrumbSchema } from "@/lib/seo/schema";

export type BreadcrumbItem = {
  label: string;
  href?: string; // If not provided, treated as current page
};

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  // Generate schema for this breadcrumb path
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.taskio.com.mx";
  const schemaItems = items.map((item) => ({
    name: item.label,
    url: item.href ? `${baseUrl}${item.href}` : baseUrl,
  }));

  const schema = generateBreadcrumbSchema(schemaItems);

  return (
    <>
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* Visual Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className={`flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400 ${className}`}
      >
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
            )}

            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-zinc-900 dark:hover:text-zinc-50 hover:underline transition"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-zinc-900 dark:text-zinc-50 font-medium">
                {item.label}
              </span>
            )}
          </div>
        ))}
      </nav>
    </>
  );
}

/**
 * Convenience component for job detail page breadcrumbs
 */
export function JobBreadcrumbs({ jobTitle }: { jobTitle: string }) {
  return (
    <Breadcrumbs
      items={[
        { label: "Inicio", href: "/" },
        { label: "Vacantes", href: "/jobs" },
        { label: jobTitle },
      ]}
      className="mb-6"
    />
  );
}

/**
 * Convenience component for jobs list breadcrumbs
 */
export function JobsListBreadcrumbs() {
  return (
    <Breadcrumbs
      items={[
        { label: "Inicio", href: "/" },
        { label: "Vacantes" },
      ]}
      className="mb-6"
    />
  );
}
