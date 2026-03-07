// lib/ai/normalizeSkills.ts
//
// Normaliza skills crudos que devuelve la IA contra el catálogo de TaxonomyTerm en BD.
// Estrategia en orden de prioridad:
//   1. Match exacto (case-insensitive)
//   2. Match por aliases[] del TaxonomyTerm
//   3. Match por diccionario local SKILL_ALIASES
//   4. Si no hay match, se descarta (no inventamos termIds)

import { prisma } from "@/lib/server/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Diccionario de aliases comunes que la IA suele devolver
// key   = variante que devuelve la IA (lowercase)
// value = label canónico en TaxonomyTerm
// ─────────────────────────────────────────────────────────────────────────────
const SKILL_ALIASES: Record<string, string> = {
  // Node.js
  "node":           "Node.js",
  "nodejs":         "Node.js",
  "node js":        "Node.js",
  "node.js":        "Node.js",

  // React
  "reactjs":        "React",
  "react js":       "React",
  "react.js":       "React",

  // Next.js
  "nextjs":         "Next.js",
  "next js":        "Next.js",

  // Vue
  "vue":            "Vue.js",
  "vuejs":          "Vue.js",
  "vue js":         "Vue.js",
  "vue.js":         "Vue.js",

  // TypeScript / JavaScript
  "ts":             "TypeScript",
  "js":             "JavaScript",
  "es6":            "JavaScript",
  "es2015":         "JavaScript",
  "vanilla js":     "JavaScript",
  "vanilla javascript": "JavaScript",

  // Python
  "py":             "Python",
  "python3":        "Python",
  "python 3":       "Python",

  // SQL variants
  "sql server":     "SQL Server",
  "mssql":          "SQL Server",
  "ms sql":         "SQL Server",
  "mysql":          "MySQL",
  "postgresql":     "PostgreSQL",
  "postgres":       "PostgreSQL",
  "pg":             "PostgreSQL",

  // MongoDB
  "mongo":          "MongoDB",
  "mongo db":       "MongoDB",

  // Redis
  "redis db":       "Redis",

  // Cloud
  "amazon web services": "AWS",
  "gcp":            "Google Cloud Platform (GCP)",
  "google cloud":   "Google Cloud Platform (GCP)",
  "azure":          "Microsoft Azure",
  "microsoft azure": "Microsoft Azure",

  // Docker / K8s
  "docker container": "Docker",
  "k8s":            "Kubernetes",
  "kube":           "Kubernetes",

  // Tailwind
  "tailwind":       "Tailwind CSS",
  "tailwindcss":    "Tailwind CSS",

  // .NET
  "dotnet":         ".NET",
  "dot net":        ".NET",
  "asp.net":        "ASP.NET Core",
  "asp net":        "ASP.NET Core",

  // Java
  "java spring":    "Spring Boot",
  "springboot":     "Spring Boot",
  "spring boot":    "Spring Boot",

  // GraphQL
  "gql":            "GraphQL",

  // Git
  "git":            "Git",
  "github":         "GitHub",
  "gitlab":         "GitLab",

  // Misc
  "tf":             "TensorFlow",
  "sklearn":        "Scikit-Learn",
  "scikit learn":   "Scikit-Learn",
  "sci-kit learn":  "Scikit-Learn",
  "huggingface":    "Hugging Face Transformers",
  "hugging face":   "Hugging Face Transformers",
  "langchain":      "LangChain",
  "llamaindex":     "LlamaIndex",
  "openai":         "OpenAI API",
};

// ─────────────────────────────────────────────────────────────────────────────
// Tipo de resultado
// ─────────────────────────────────────────────────────────────────────────────
export type NormalizedSkill = {
  termId: string;
  label:  string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Función principal
// ─────────────────────────────────────────────────────────────────────────────
export async function normalizeSkillsFromAI(
  rawSkills: string[]
): Promise<NormalizedSkill[]> {
  if (!rawSkills?.length) return [];

  // 1. Cargar todos los TaxonomyTerms de tipo SKILL de la BD
  const allTerms = await prisma.taxonomyTerm.findMany({
    where:  { kind: "SKILL" },
    select: { id: true, label: true, aliases: true },
  });

  // 2. Construir índices para búsqueda rápida
  const byLabel   = new Map<string, { id: string; label: string }>();
  const byAlias   = new Map<string, { id: string; label: string }>();

  for (const term of allTerms) {
    byLabel.set(term.label.toLowerCase(), { id: term.id, label: term.label });
    for (const alias of term.aliases ?? []) {
      byAlias.set(alias.toLowerCase(), { id: term.id, label: term.label });
    }
  }

  // 3. Normalizar cada skill crudo
  const seen    = new Set<string>();
  const results: NormalizedSkill[] = [];

  for (const raw of rawSkills) {
    const cleaned = (raw ?? "").trim();
    if (!cleaned) continue;

    const lower = cleaned.toLowerCase();

    // Prioridad 1: match exacto en catálogo BD
    let match = byLabel.get(lower);

    // Prioridad 2: match por aliases[] del TaxonomyTerm en BD
    if (!match) match = byAlias.get(lower);

    // Prioridad 3: match por diccionario local
    if (!match) {
      const canonical = SKILL_ALIASES[lower];
      if (canonical) match = byLabel.get(canonical.toLowerCase());
    }

    // Si no hay match, descartar
    if (!match) continue;

    // Deduplicar por termId
    if (seen.has(match.id)) continue;
    seen.add(match.id);

    results.push({ termId: match.id, label: match.label });
  }

  return results;
}