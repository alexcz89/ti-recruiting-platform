// app/profile/pdf/route.ts
import { NextResponse } from "next/server";

// Mock: devuelve un PDF vacío para probar el flujo de descarga
export async function POST() {
  const pdfBytes = new Uint8Array([0x25,0x50,0x44,0x46,0x2D,0x31,0x2E,0x34,0x0A,0x25,0xE2,0xE3,0xCF,0xD3,0x0A,0x0A,0x78]);
  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cv.pdf"`,
    },
  });
}
