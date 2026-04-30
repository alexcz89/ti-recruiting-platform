// app/sitemap.ts
import { MetadataRoute } from "next";
import { prisma } from "@/lib/server/prisma";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.taskio.com.mx";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Páginas estáticas
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: APP_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${APP_URL}/jobs`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${APP_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${APP_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  // Vacantes activas
  const jobs = await prisma.job.findMany({
    where: { status: "OPEN" as any },
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 5000,
  });

  const jobPages: MetadataRoute.Sitemap = jobs.map((job) => ({
    url: `${APP_URL}/jobs/${job.id}`,
    lastModified: job.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...jobPages];
}