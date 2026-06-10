import { MetadataRoute } from 'next';
import { prisma } from '@/lib/server/prisma';

/**
 * ✅ Sitemap dinámico para vacantes
 * Se ejecuta durante build y también en runtime
 * Incluye todas las vacantes OPEN con slug
 *
 * URL: https://taskio.com.mx/sitemap-jobs.xml
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.taskio.com.mx';

  // Obtener todas las vacantes OPEN que tengan slug
  const jobs = await prisma.job.findMany({
    where: {
      status: 'OPEN',
      slug: { not: null },
    },
    select: {
      id: true,
      slug: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 50000, // Límite de Google Sitemap
  });

  // Convertir a formato MetadataRoute.Sitemap
  return jobs.map((job) => ({
    url: `${APP_URL}/jobs/${job.slug || job.id}`,
    lastModified: job.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));
}
