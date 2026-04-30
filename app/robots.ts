// app/robots.ts
import { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.taskio.com.mx";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/jobs", "/jobs/", "/about", "/contact"],
        disallow: [
          "/dashboard/",
          "/api/",
          "/auth/",
          "/profile/",
          "/assessments/",
          "/admin/",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}