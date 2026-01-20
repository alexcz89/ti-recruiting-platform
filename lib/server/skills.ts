// lib/server/skills.ts
import 'server-only';
import { prisma } from '@/lib/server/prisma';
import { ALL_SKILLS, CERTIFICATIONS, LANGUAGES_FALLBACK } from '@/lib/shared/skills-data';

/**
 * Obtiene skills desde la base de datos
 * Fallback a lista estática si falla o está vacía
 */
export async function getSkillsFromDB(): Promise<string[]> {
  try {
    const rows = await prisma.taxonomyTerm.findMany({
      where: { kind: 'SKILL' },
      select: { label: true },
      orderBy: { label: 'asc' },
    });
    return rows.map((r) => r.label).length ? rows.map((r) => r.label) : [...ALL_SKILLS];
  } catch {
    return [...ALL_SKILLS];
  }
}

/**
 * Obtiene certificaciones desde la base de datos
 * Fallback a lista estática si falla o está vacía
 */
export async function getCertificationsFromDB(): Promise<string[]> {
  try {
    const rows = await prisma.taxonomyTerm.findMany({
      where: { kind: 'CERTIFICATION' },
      select: { label: true },
      orderBy: { label: 'asc' },
    });
    return rows.map((r) => r.label).length ? rows.map((r) => r.label) : [...CERTIFICATIONS];
  } catch {
    return [...CERTIFICATIONS];
  }
}

/**
 * Obtiene idiomas desde la base de datos
 * Fallback a lista estática si falla o está vacía
 */
export async function getLanguagesFromDB(): Promise<string[]> {
  try {
    const rows = await prisma.taxonomyTerm.findMany({
      where: { kind: 'LANGUAGE' },
      select: { label: true },
      orderBy: { label: 'asc' },
    });
    return rows.map((r) => r.label).length ? rows.map((r) => r.label) : [...LANGUAGES_FALLBACK];
  } catch {
    return [...LANGUAGES_FALLBACK];
  }
}