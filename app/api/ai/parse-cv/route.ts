// app/api/ai/parse-cv/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    if (!cvText || cvText.trim().length < 50) {
      return NextResponse.json(
        { error: "No se pudo extraer texto del CV" },
        { status: 400 }
      );
    }

    const analysis = await analyzeCv(cvText);

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