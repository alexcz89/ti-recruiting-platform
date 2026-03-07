export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { analyzeCv } from "@/lib/ai/analyzeCv";

export async function POST(req: Request) {

  const body = await req.json();
  const { cvText } = body;

  if (!cvText) {
    return NextResponse.json(
      { error: "CV text requerido" },
      { status: 400 }
    );
  }

  const analysis = await analyzeCv(cvText);

  return NextResponse.json({
    analysis
  });
}