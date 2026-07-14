export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import { analyzeCv } from "@/lib/ai/analyzeCv";
import { extractCvText } from "@/lib/ai/extractCvText";
import { normalizeSkillsFromAI } from "@/lib/ai/normalizeSkills";
import { CvImportAnalysisSchema } from "@/lib/profile/cv-import";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { checkActionRateLimit } from "@/lib/server/rate-limit";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx"];
const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
]);

function jsonNoStore(body: unknown, status = 200, extraHeaders?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function isAcceptedFile(file: File) {
  const name = file.name.toLowerCase();
  return (
    ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension)) &&
    (!file.type || ACCEPTED_MIME_TYPES.has(file.type))
  );
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return jsonNoStore({ error: "No autenticado" }, 401);
    }

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });
    if (!me || me.role !== "CANDIDATE") {
      return jsonNoStore({ error: "No autorizado" }, 403);
    }

    const rateLimit = checkActionRateLimit("cv-parse", me.id, {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return jsonNoStore(
        { error: "Demasiados intentos. Espera antes de analizar otro CV." },
        429,
        { "Retry-After": String(rateLimit.retryAfter ?? 60) }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const previewOnly = formData.get("mode") === "preview";

    if (!(file instanceof File)) {
      return jsonNoStore(
        { error: "Archivo requerido en el campo 'file'" },
        400
      );
    }
    if (!isAcceptedFile(file)) {
      return jsonNoStore(
        { error: "Formato no soportado. Solo PDF, DOC o DOCX." },
        400
      );
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return jsonNoStore({ error: "El archivo debe pesar menos de 8 MB." }, 400);
    }

    const cvText = await extractCvText(file);
    if (!cvText || cvText.trim().length < 50) {
      return jsonNoStore({ error: "No se pudo extraer texto del CV" }, 400);
    }

    const aiResponse = await analyzeCv(cvText, previewOnly ? undefined : me.id);
    const { _meta: _internalMeta, ...analysis } = aiResponse;
    const rawSkills = Array.isArray(analysis.skills) ? analysis.skills : [];
    const normalizedSkills = await normalizeSkillsFromAI(rawSkills);

    const safeAnalysis = CvImportAnalysisSchema.parse({
      ...analysis,
      skillsMatched: normalizedSkills,
      phonePrimary: analysis.phonePrimary ?? null,
      location: analysis.location ?? "",
    });

    // Mantener los campos consumidos por onboarding, ProfileForm y CV Builder.
    const enrichedAnalysis = {
      ...analysis,
      ...safeAnalysis,
      skills: normalizedSkills.map((skill) => skill.label),
      skillsMatched: normalizedSkills,
      skillsRaw: rawSkills,
      skillsUnmatched: rawSkills.filter(
        (raw) =>
          !normalizedSkills.some(
            (skill) => skill.label.toLowerCase() === raw.toLowerCase()
          )
      ),
      phoneRaw: analysis.phoneRaw ?? [],
      phoneWarning:
        (analysis.phoneRaw?.length ?? 0) > 1
          ? "Detectamos más de un teléfono en tu CV. Verifica cuál deseas guardar."
          : null,
    };

    if (previewOnly) {
      return jsonNoStore({
        success: true,
        url: null,
        fileName: file.name,
        analysis: enrichedAnalysis,
        textLength: cvText.length,
      });
    }

    const uploadResult = await new UTApi().uploadFiles(file);
    if (!uploadResult?.data || uploadResult.error) {
      console.error("UploadThing CV upload error:", uploadResult?.error);
      return jsonNoStore({ error: "No se pudo subir el archivo" }, 500);
    }

    const uploadedUrl = uploadResult.data.ufsUrl ?? uploadResult.data.url;
    if (!uploadedUrl) {
      return jsonNoStore(
        { error: "No se recibió la URL del archivo subido" },
        500
      );
    }

    return jsonNoStore({
      success: true,
      url: uploadedUrl,
      fileName: file.name,
      analysis: enrichedAnalysis,
      textLength: cvText.length,
    });
  } catch (error) {
    console.error("CV upload-and-parse error:", error);
    return jsonNoStore({ error: "Error procesando CV" }, 500);
  }
}
