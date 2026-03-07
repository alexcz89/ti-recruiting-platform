// lib/ai/extractCvText.ts

import mammoth from "mammoth";

const MAX_FILE_SIZE_MB = 8;

export async function extractCvText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return extractCvTextFromBuffer(buffer, file.name, file.size);
}

export async function extractCvTextFromBuffer(
  buffer: Buffer,
  fileName: string,
  fileSize?: number
): Promise<string> {
  if (!buffer || buffer.length === 0) {
    throw new Error("Archivo vacío");
  }

  if (fileSize && fileSize > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`El archivo es demasiado grande (máx ${MAX_FILE_SIZE_MB}MB)`);
  }

  const lowerName = (fileName || "").toLowerCase();

  try {
    if (lowerName.endsWith(".pdf")) {
      const { extractText } = await import("unpdf");
      const uint8 = new Uint8Array(buffer);
      const { text } = await extractText(uint8, { mergePages: true });
      return cleanCvText(text);
    }

    if (lowerName.endsWith(".docx")) {
      const data = await mammoth.extractRawText({ buffer });
      return cleanCvText(data.value);
    }

    throw new Error("Formato no soportado. Solo PDF o DOCX.");
  } catch (error) {
    console.error("Error extrayendo texto del CV:", error);
    throw new Error("No se pudo procesar el archivo");
  }
}

function cleanCvText(text: string): string {
  if (!text) return "";

  return text
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ ]{2,}/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7EÀ-ÿ]/g, "")
    .trim();
}