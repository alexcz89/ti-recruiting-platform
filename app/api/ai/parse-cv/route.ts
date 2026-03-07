// app/api/ai/parse-cv/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { extractCvText } from "@/lib/ai/extractCvText";
import { analyzeCv } from "@/lib/ai/analyzeCv";

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

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    const hasValidExtension =
      file.name.toLowerCase().endsWith(".pdf") ||
      file.name.toLowerCase().endsWith(".docx");

    if (!allowedTypes.includes(file.type) && !hasValidExtension) {
      return NextResponse.json(
        { error: "Formato no soportado. Solo PDF o DOCX." },
        { status: 400 }
      );
    }

    const cvText = await extractCvText(file);

    if (!cvText) {
      return NextResponse.json(
        { error: "No se pudo extraer texto del CV" },
        { status: 400 }
      );
    }

    const analysisText = await analyzeCv(cvText);

    let analysis: unknown;
    try {
      analysis = JSON.parse(analysisText);
    } catch {
      return NextResponse.json(
        {
          error: "La IA devolvió un formato inválido",
          raw: analysisText,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      fileName: file.name,
      cvText,
      analysis,
    });
  } catch (error) {
    console.error("CV Parse Error:", error);

    return NextResponse.json(
      { error: "Error procesando CV" },
      { status: 500 }
    );
  }
}