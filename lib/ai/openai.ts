// lib/ai/openai.ts
import "server-only";
import OpenAI from "openai";

let openAIClient: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (openAIClient) return openAIClient;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no esta definida");
  }

  openAIClient = new OpenAI({ apiKey });
  return openAIClient;
}
