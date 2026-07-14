import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import {
  CvImportApplySchema,
  educationFingerprint,
  experienceFingerprint,
  normalizeComparison,
  parseYearMonth,
  yearMonthFromDate,
} from "@/lib/profile/cv-import";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { checkActionRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonNoStore(body: unknown, status = 200, extraHeaders?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return jsonNoStore({ error: "No autenticado" }, 401);
    }

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        role: true,
        phone: true,
        location: true,
        linkedin: true,
        github: true,
        seniority: true,
        yearsExperience: true,
      },
    });
    if (!me || me.role !== "CANDIDATE") {
      return jsonNoStore({ error: "No autorizado" }, 403);
    }

    const rateLimit = checkActionRateLimit("cv-apply", me.id, {
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return jsonNoStore(
        { error: "Demasiados intentos. Intenta nuevamente más tarde." },
        429,
        { "Retry-After": String(rateLimit.retryAfter ?? 60) }
      );
    }

    const parsed = CvImportApplySchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonNoStore(
        { error: "Los datos detectados no son válidos", details: parsed.error.flatten() },
        400
      );
    }

    const { resumeUrl, sections, analysis } = parsed.data;
    const result = await prisma.$transaction(async (tx) => {
      const personalData: Record<string, string | number> = {};
      const personalUpdated: string[] = [];

      if (sections.personal) {
        const candidates = [
          ["phone", me.phone, analysis.phonePrimary],
          ["location", me.location, analysis.location],
          ["linkedin", me.linkedin, analysis.linkedin],
          ["github", me.github, analysis.github],
        ] as const;
        for (const [field, current, incoming] of candidates) {
          if (!String(current ?? "").trim() && String(incoming ?? "").trim()) {
            personalData[field] = String(incoming).trim();
            personalUpdated.push(field);
          }
        }
        if (!me.seniority && analysis.seniority) {
          personalData.seniority = analysis.seniority.toUpperCase();
          personalUpdated.push("seniority");
        }
        if (me.yearsExperience == null && analysis.yearsExperience > 0) {
          personalData.yearsExperience = analysis.yearsExperience;
          personalUpdated.push("yearsExperience");
        }
      }

      await tx.user.update({
        where: { id: me.id },
        data: { resumeUrl, ...personalData },
      });

      let experiencesAdded = 0;
      if (sections.experiences && analysis.experiences.length > 0) {
        const existing = await tx.workExperience.findMany({
          where: { userId: me.id },
          select: { role: true, company: true, startDate: true },
        });
        const fingerprints = new Set(
          existing.map((item) =>
            experienceFingerprint({
              role: item.role,
              company: item.company,
              startDate: yearMonthFromDate(item.startDate),
            })
          )
        );
        const additions = analysis.experiences.flatMap((item) => {
          const startDate = parseYearMonth(item.startDate);
          if (!item.role || !item.company || !startDate) return [];
          const fingerprint = experienceFingerprint(item);
          if (fingerprints.has(fingerprint)) return [];
          fingerprints.add(fingerprint);
          return [{
            userId: me.id,
            role: item.role,
            company: item.company,
            startDate,
            endDate: item.isCurrent ? null : parseYearMonth(item.endDate),
            isCurrent: item.isCurrent,
          }];
        });
        if (additions.length > 0) {
          const created = await tx.workExperience.createMany({ data: additions });
          experiencesAdded = created.count;
        }
      }

      let educationAdded = 0;
      if (sections.education && analysis.education.length > 0) {
        const existing = await tx.education.findMany({
          where: { userId: me.id },
          select: { institution: true, program: true, startDate: true, sortIndex: true },
        });
        const fingerprints = new Set(
          existing.map((item) =>
            educationFingerprint({
              institution: item.institution,
              program: item.program,
              startDate: yearMonthFromDate(item.startDate),
            })
          )
        );
        const nextSortIndex = existing.reduce(
          (max, item) => Math.max(max, item.sortIndex + 1),
          0
        );
        const additions = analysis.education.flatMap((item, index) => {
          if (!item.institution) return [];
          const fingerprint = educationFingerprint(item);
          if (fingerprints.has(fingerprint)) return [];
          fingerprints.add(fingerprint);
          const endDate = parseYearMonth(item.endDate);
          return [{
            userId: me.id,
            level: item.level,
            status: endDate ? ("COMPLETED" as const) : ("ONGOING" as const),
            institution: item.institution,
            program: item.program || null,
            startDate: parseYearMonth(item.startDate),
            endDate,
            sortIndex: nextSortIndex + index,
          }];
        });
        if (additions.length > 0) {
          const created = await tx.education.createMany({ data: additions });
          educationAdded = created.count;
        }
      }

      let skillsAdded = 0;
      if (sections.skills && analysis.skillsMatched.length > 0) {
        const requestedIds = [...new Set(analysis.skillsMatched.map((skill) => skill.termId))];
        const [validTerms, existing] = await Promise.all([
          tx.taxonomyTerm.findMany({
            where: { id: { in: requestedIds }, kind: "SKILL" },
            select: { id: true },
          }),
          tx.candidateSkill.findMany({
            where: { userId: me.id, termId: { in: requestedIds } },
            select: { termId: true },
          }),
        ]);
        const existingIds = new Set(existing.map((skill) => skill.termId));
        const additions = validTerms
          .filter((term) => !existingIds.has(term.id))
          .map((term) => ({ userId: me.id, termId: term.id, level: 1 }));
        if (additions.length > 0) {
          const created = await tx.candidateSkill.createMany({
            data: additions,
            skipDuplicates: true,
          });
          skillsAdded = created.count;
        }
      }

      let languagesAdded = 0;
      if (sections.languages && analysis.languages.length > 0) {
        const terms = await tx.taxonomyTerm.findMany({
          where: { kind: "LANGUAGE" },
          select: { id: true, label: true, aliases: true },
        });
        const termByName = new Map<string, string>();
        for (const term of terms) {
          termByName.set(normalizeComparison(term.label), term.id);
          for (const alias of term.aliases) {
            termByName.set(normalizeComparison(alias), term.id);
          }
        }
        const matched = new Map<string, (typeof analysis.languages)[number]["level"]>();
        for (const language of analysis.languages) {
          const termId = termByName.get(normalizeComparison(language.label));
          if (termId && !matched.has(termId)) matched.set(termId, language.level);
        }
        const matchedIds = [...matched.keys()];
        const existing = await tx.candidateLanguage.findMany({
          where: { userId: me.id, termId: { in: matchedIds } },
          select: { termId: true },
        });
        const existingIds = new Set(existing.map((language) => language.termId));
        const additions = matchedIds
          .filter((termId) => !existingIds.has(termId))
          .map((termId) => ({
            userId: me.id,
            termId,
            level: matched.get(termId) ?? ("CONVERSATIONAL" as const),
          }));
        if (additions.length > 0) {
          const created = await tx.candidateLanguage.createMany({
            data: additions,
            skipDuplicates: true,
          });
          languagesAdded = created.count;
        }
      }

      return {
        personalUpdated,
        experiencesAdded,
        educationAdded,
        skillsAdded,
        languagesAdded,
      };
    });

    return jsonNoStore({ ok: true, added: result });
  } catch (error) {
    console.error("CV apply error:", error);
    return jsonNoStore({ error: "No se pudo actualizar el perfil desde el CV" }, 500);
  }
}
