// app/api/ai/cv/upload-and-parse/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import { extractCvText } from "@/lib/ai/extractCvText";
import { analyzeCv } from "@/lib/ai/analyzeCv";
import { normalizeSkillsFromAI } from "@/lib/ai/normalizeSkills";

const utapi = new UTApi();

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Archivo requerido en el campo 'file'" },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const allowed =
      fileName.endsWith(".pdf") ||
      fileName.endsWith(".doc") ||
      fileName.endsWith(".docx");

    if (!allowed) {
      return NextResponse.json(
        { error: "Formato no soportado. Solo PDF, DOC o DOCX." },
        { status: 400 }
      );
    }

    const cvText = await extractCvText(file);

    if (!cvText || cvText.trim().length < 50) {
      return NextResponse.json(
        { error: "No se pudo extraer texto del CV" },
        { status: 400 }
      );
    }

    const analysis = await analyzeCv(cvText);

    const rawSkills = Array.isArray(analysis.skills) ? analysis.skills : [];
    const normalizedSkills = await normalizeSkillsFromAI(rawSkills);

    const enrichedAnalysis = {
      ...analysis,
      skills: normalizedSkills.map((s) => s.label),
      skillsMatched: normalizedSkills,
      skillsRaw: rawSkills,
      skillsUnmatched: rawSkills.filter(
        (r) =>
          !normalizedSkills.some(
            (n) => n.label.toLowerCase() === r.toLowerCase()
          )
      ),
    };

    const uploadResult = await utapi.uploadFiles(file);

    if (!uploadResult || uploadResult.error || !uploadResult.data) {
      console.error("UploadThing upload error:", uploadResult?.error);
      return NextResponse.json(
        { error: "No se pudo subir el archivo" },
        { status: 500 }
      );
    }

    const uploadedUrl = uploadResult.data.ufsUrl ?? uploadResult.data.url;

    if (!uploadedUrl) {
      return NextResponse.json(
        { error: "No se recibió la URL del archivo subido" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: uploadedUrl,
      fileName: file.name,
      analysis: enrichedAnalysis,
      textLength: cvText.length,
    });
  } catch (error) {
    console.error("CV upload-and-parse error:", error);
    return NextResponse.json(
      { error: "Error procesando CV" },
      { status: 500 }
    );
  }
}