// app/auth/signup/candidate/actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import {
  CandidateSignupSchema,
  type CandidateSignupInput,
} from "@/lib/validation";
import { hash } from "bcryptjs";
import type { Role } from "@prisma/client";

/* ========= Tipos del borrador que viene del CV Builder ========= */
type CvDraftIdentity = {
  location?: string;
  phone?: string;
  birthdate?: string; // "YYYY-MM-DD"
  linkedin?: string;
  github?: string;
};

type CvDraftExperience = {
  role?: string;
  company?: string;
  startDate?: string | null; // "YYYY-MM"
  endDate?: string | null; // "YYYY-MM"
  isCurrent?: boolean;
  bulletsText?: string;
  descriptionHtml?: string;
};

type CvDraftEducation = {
  institution?: string;
  program?: string | null;
  startDate?: string | null; // "YYYY-MM"
  endDate?: string | null; // "YYYY-MM"
};

type CvDraft = {
  identity?: CvDraftIdentity;
  experiences?: CvDraftExperience[];
  education?: CvDraftEducation[];
};

/* ========= Helpers ========= */

function parseMonthToDate(ym?: string | null): Date | null {
  if (!ym) return null;
  const [y, m] = ym.split("-");
  const yy = Number(y);
  const mm = Number(m);
  if (!yy || !mm) return null;
  return new Date(yy, mm - 1, 1);
}

async function importDraftToUser(userId: string, draft: CvDraft) {
  const tx: any[] = [];

  // ---- Identidad básica al User ----
  if (draft.identity) {
    const { location, phone, birthdate, linkedin, github } = draft.identity;
    let birth: Date | null = null;
    if (birthdate) {
      const d = new Date(birthdate);
      if (!Number.isNaN(d.getTime())) birth = d;
    }

    tx.push(
      prisma.user.update({
        where: { id: userId },
        data: {
          location: location || undefined,
          phone: phone || undefined,
          linkedin: linkedin || undefined,
          github: github || undefined,
          birthdate: birth || undefined,
        },
      })
    );
  }

  // ---- Experiencia laboral ----
  if (Array.isArray(draft.experiences) && draft.experiences.length) {
    const data = draft.experiences
      .filter(
        (e) =>
          e.role ||
          e.company ||
          e.bulletsText ||
          e.descriptionHtml ||
          e.startDate ||
          e.endDate
      )
      .map((e) => {
        const start = parseMonthToDate(e.startDate);
        const end = e.isCurrent ? null : parseMonthToDate(e.endDate);
        return {
          userId,
          role: e.role || "",
          company: e.company || "",
          startDate: start,
          endDate: end,
          isCurrent: !!e.isCurrent,
          bulletsText: e.bulletsText || "",
          descriptionHtml: e.descriptionHtml || "",
        };
      });

    if (data.length) {
      // 👇 Cast a any para no pelear con los tipos de startDate/endDate
      tx.push(prisma.workExperience.createMany({ data: data as any }));
    }
  }

  // ---- Educación ----
  if (Array.isArray(draft.education) && draft.education.length) {
    const data = draft.education
      .filter((e) => e.institution)
      .map((e, index) => {
        const start = parseMonthToDate(e.startDate);
        const end = parseMonthToDate(e.endDate);

        // Heurística simple para status
        const status =
          !end && start ? "ONGOING" : end ? "COMPLETED" : "COMPLETED";

        return {
          userId,
          institution: e.institution || "",
          program: e.program || "",
          startDate: start,
          endDate: end,
          level: "BACHELOR" as any, // default razonable
          status: status as any,
          sortIndex: index,
        };
      });

    if (data.length) {
      tx.push(prisma.education.createMany({ data }));
    }
  }

  if (tx.length) {
    await prisma.$transaction(tx);
  }
}

/* ========= Acción principal ========= */

export async function createCandidateAction(
  input: CandidateSignupInput,
  rawDraft?: unknown
) {
  try {
    const data = CandidateSignupSchema.parse(input);

    const email = data.email.toLowerCase().trim();

    // ¿Ya existe?
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return { ok: false, error: "Ya existe una cuenta con este correo." };
    }

    const passwordHash = await hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name: data.name,
        passwordHash,
        role: "CANDIDATE" as Role,
      },
      select: { id: true },
    });

    // Intentar importar el borrador del CV (si vino algo)
    let cvDraft: CvDraft | null = null;
    if (rawDraft && typeof rawDraft === "object") {
      cvDraft = rawDraft as CvDraft;
    }

    if (cvDraft) {
      await importDraftToUser(user.id, cvDraft);
    }

    return { ok: true };
  } catch (err) {
    console.error("Error createCandidateAction", err);
    return { ok: false, error: "No se pudo crear la cuenta" };
  }
}
