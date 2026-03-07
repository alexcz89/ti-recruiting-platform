// lib/ai/openai.ts

import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY no está definida en las variables de entorno");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});