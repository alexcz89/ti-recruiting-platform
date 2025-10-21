// app/api/job-templates/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId, getSessionOrThrow } from "@/lib/session";

/** GET /api/job-templates
 *  Lista plantillas de la empresa actual (paginado simple opcional).
 */
export async function GET(req: NextRequest) {
  try {
    const companyId = await getSessionCompanyId();
    if (!companyId) return NextResponse.json({ items: [] });

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    const items = await prisma.jobTemplate.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        payload: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Adaptar a lo que espera JobWizard.templates (id + trozos útiles)
    const templates = items.map((t) => {
      const p = (t.payload ?? {}) as any;
      return {
        id: t.id,
        title: t.title,
        locationType: p.locationType ?? undefined,
        city: p.city ?? undefined,
        currency: p.currency ?? undefined,
        salaryMin: p.salaryMin ?? undefined,
        salaryMax: p.salaryMax ?? undefined,
        showSalary: p.showSalary ?? undefined,
        employmentType: p.employmentType ?? undefined,
        schedule: p.schedule ?? undefined,
        benefitsJson: p.benefitsJson ?? undefined,
        description: p.description ?? undefined,
        education: p.educationJson ?? undefined,
        minDegree: p.minDegree ?? undefined,
        skills: p.skillsJson ?? undefined,
        certs: p.certsJson ?? undefined,
      };
    });

    return NextResponse.json({ items: templates });
  } catch (err) {
    console.error("[GET /api/job-templates]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** POST /api/job-templates
 *  Crea una plantilla a partir de un payload del wizard (o de un Job).
 *  Body: JSON { title: string, payload: JsonCompatible }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionOrThrow();
    const companyId = await getSessionCompanyId();
    if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // @ts-ignore
    const userId = session.user?.id as string | undefined;

    const body = await req.json().catch(() => null);
    const title = body?.title?.toString()?.trim();
    const payload = body?.payload;

    if (!title || !payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
    }

    const tpl = await prisma.jobTemplate.create({
      data: {
        title,
        payload,
        companyId,
        creatorId: userId,
      },
      select: { id: true, title: true },
    });

    return NextResponse.json({ ok: true, id: tpl.id, title: tpl.title });
  } catch (err) {
    console.error("[POST /api/job-templates]", err);
    return NextResponse.json({ error: "Error al crear plantilla" }, { status: 500 });
  }
}
