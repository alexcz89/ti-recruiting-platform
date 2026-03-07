// lib/ai/analyzeCv.ts

import { openai } from "./openai";
import { AI_MODEL } from "./config";

export async function analyzeCv(cvText: string) {
  const MAX_CHARS = 12000;
  const trimmedCvText = cvText.slice(0, MAX_CHARS);

  const prompt = `
Eres un reclutador técnico senior especializado en perfiles de tecnología.

Analiza este CV y devuelve ÚNICAMENTE JSON válido con esta estructura exacta:

{
  "summary": "breve resumen profesional del candidato",
  "seniority": "junior | mid | senior",
  "skills": ["tecnologías detectadas"],
  "yearsExperience": number,
  "recommendedRoles": ["roles sugeridos"],
  "redFlags": ["posibles alertas"],
  "linkedin": "url o cadena vacía",
  "github": "url o cadena vacía",
  "languages": [
    {
      "label": "idioma",
      "level": "NATIVE | PROFESSIONAL | CONVERSATIONAL | BASIC"
    }
  ],
  "experiences": [
    {
      "role": "puesto",
      "company": "empresa",
      "startDate": "YYYY-MM o cadena vacía",
      "endDate": "YYYY-MM o cadena vacía",
      "isCurrent": true
    }
  ],
  "education": [
    {
      "institution": "institución",
      "program": "programa o carrera",
      "startDate": "YYYY-MM o cadena vacía",
      "endDate": "YYYY-MM o cadena vacía",
      "level": "NONE | PRIMARY | SECONDARY | HIGH_SCHOOL | TECHNICAL | BACHELOR | MASTER | DOCTORATE | OTHER | null"
    }
  ]
}

Reglas:
- No escribas nada fuera del JSON.
- "skills" debe incluir lenguajes, frameworks, cloud, bases de datos o herramientas detectadas.
- "yearsExperience" debe ser un número entero estimado.
- Si no hay red flags devuelve [].
- El resumen debe ser máximo 3 líneas.
- Si no encuentras linkedin o github, devuelve cadena vacía.
- Si no encuentras languages, experiences o education, devuelve [].
- Usa fechas en formato YYYY-MM cuando sea posible; si no es claro, devuelve cadena vacía.

CV:
${trimmedCvText}
`;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    return response.choices[0]?.message?.content ?? "{}";
  } catch (error) {
    console.error("Error analyzing CV:", error);
    throw new Error("AI CV analysis failed");
  }
}