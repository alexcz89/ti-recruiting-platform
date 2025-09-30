// lib/skills.ts
// Fuente de catálogos (skills, certificaciones, idiomas) y helpers para UI.
// Lee de DB (TaxonomyTerm) con fallback a listas estáticas. ¡Server-only en las
// funciones que golpean Prisma (usamos dynamic import)!

// ──────────────────────────────────────────────────────────────────────────────
// FALLBACKS ESTÁTICOS
// ──────────────────────────────────────────────────────────────────────────────
export const ALL_SKILLS = [
  // Lenguajes
  "Python","Java","C","C++","C#","Go","Rust","Ruby","PHP","Kotlin","Swift","Dart",
  "Julia","Scala","R","Perl","Visual Basic .NET","Objective-C","Assembly","Zig",

  // Web / marcado
  "HTML","CSS","XML","Markdown","LaTeX","Javascript",

  // Runtimes / frameworks backend
  "Node.js","Django","Flask","FastAPI","Spring Boot","ASP.NET","Ruby on Rails",
  "Laravel","Symfony","Express.js",".NET",

  // Mobile
  "React Native","Flutter","Xamarin","Ionic",
  "Native Android (Java/Kotlin)","Native iOS (Swift/Objective-C)",

  // Data / AI / ML
  "TensorFlow","PyTorch","Keras","Scikit-Learn","OpenCV","Apache Spark (MLlib)",
  "Pandas","NumPy","Matplotlib","Seaborn","SciPy","Plotly","D3.js","MATLAB",
  "Simulink","Simulink Test",

  // Cloud / DevOps
  "AWS","Microsoft Azure","Google Cloud Platform","Docker","Kubernetes","Terraform",
  "Ansible","Chef","Puppet","Jenkins","GitLab CI/CD","GitHub Actions","Bash","PowerShell",

  // DB / ORMs / Query
  "SQL","MySQL","PostgreSQL","Oracle","SQL Server","MongoDB","Cassandra",
  "Couchbase","Redis","DynamoDB","Prisma","Hibernate","SQLAlchemy","Entity Framework","GraphQL",

  // Testing / QA
  "Selenium","Cypress","Puppeteer","JUnit","NUnit","PyTest","TestNG","Postman","Newman",

  // Hardware / HIL
  "LabVIEW","TestStand","VeriStand","dSPACE HIL","Vector CANoe","Arduino IDE","Raspberry Pi GPIO",
] as const;
export type Skill = (typeof ALL_SKILLS)[number];

export const CERTIFICATIONS = [
  // Cloud
  "AWS Certified Cloud Practitioner (CLF-C02)",
  "AWS Certified Solutions Architect – Associate (SAA-C03)",
  "AWS Certified Solutions Architect – Professional (SAP-C02)",
  "AWS Certified Developer – Associate (DVA-C02)",
  "AWS Certified SysOps Administrator – Associate (SOA-C02)",
  "Microsoft Azure Fundamentals (AZ-900)",
  "Microsoft Azure Administrator (AZ-104)",
  "Microsoft Azure Developer (AZ-204)",
  "Microsoft Azure Solutions Architect Expert (AZ-305)",
  "Google Associate Cloud Engineer (ACE)",
  "Google Professional Cloud Architect",

  // DevOps
  "CKA (Certified Kubernetes Administrator)",
  "CKAD (Certified Kubernetes Application Developer)",
  "Terraform Associate",
  "GitHub Actions Certification (Foundations/Intermediate)",

  // Redes / Seguridad / ITSM
  "CCNA","CCNP","CompTIA A+","CompTIA Network+","CompTIA Security+",
  "CEH (Certified Ethical Hacker)","OSCP","ITIL Foundation",

  // QA / Agile / Gestión
  "ISTQB Foundation","PMP","Scrum Master (CSM/PSM)",

  // Salesforce
  "Salesforce Administrator",
] as const;
export type Certification = (typeof CERTIFICATIONS)[number];

export const LANGUAGES_FALLBACK = [
  "Inglés","Mandarín (Chino estándar)","Hindi","Español","Francés","Árabe (variedades)",
  "Bengalí","Ruso","Portugués","Urdu","Indonesio/Malayo","Alemán","Japonés","Nigerian Pidgin",
  "Maratí","Telugu","Turco","Tamil","Yue (Cantonés)","Italiano",
  "Persa (Farsi/Dari/Tayiko)","Vietnamita","Hausa","Egipcio árabe","Javanés",
  "Coreano","Punjabi occidental (Lahnda)","Wu (Shanghainés)","Gujarati","Bhojpuri",
] as const;

// ──────────────────────────────────────────────────────────────────────────────
// NIVELES
// ──────────────────────────────────────────────────────────────────────────────
export const SKILL_LEVELS = [
  { value: 1, label: "Básico" },
  { value: 2, label: "Junior" },
  { value: 3, label: "Intermedio" },
  { value: 4, label: "Avanzado" },
  { value: 5, label: "Experto" },
] as const;
export type SkillLevelValue = (typeof SKILL_LEVELS)[number]["value"];

export const LANGUAGE_LEVELS = [
  { value: "NATIVE", label: "Nativo" },
  { value: "PROFESSIONAL", label: "Profesional (C1–C2)" },
  { value: "CONVERSATIONAL", label: "Conversacional (B1–B2)" },
  { value: "BASIC", label: "Básico (A1–A2)" },
] as const;
export type LanguageLevelValue = (typeof LANGUAGE_LEVELS)[number]["value"];

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS DB
// ──────────────────────────────────────────────────────────────────────────────
export async function getSkillsFromDB(): Promise<string[]> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.taxonomyTerm.findMany({
      where: { kind: "SKILL" },
      select: { label: true },
      orderBy: { label: "asc" },
    });
    return rows.map((r) => r.label).length ? rows.map((r) => r.label) : [...ALL_SKILLS];
  } catch {
    return [...ALL_SKILLS];
  }
}

export async function getCertificationsFromDB(): Promise<string[]> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.taxonomyTerm.findMany({
      where: { kind: "CERTIFICATION" },
      select: { label: true },
      orderBy: { label: "asc" },
    });
    return rows.map((r) => r.label).length ? rows.map((r) => r.label) : [...CERTIFICATIONS];
  } catch {
    return [...CERTIFICATIONS];
  }
}

export async function getLanguagesFromDB(): Promise<string[]> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.taxonomyTerm.findMany({
      where: { kind: "LANGUAGE" },
      select: { label: true },
      orderBy: { label: "asc" },
    });
    return rows.map((r) => r.label).length ? rows.map((r) => r.label) : [...LANGUAGES_FALLBACK];
  } catch {
    return [...LANGUAGES_FALLBACK];
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// CLIENT HELPERS
// ──────────────────────────────────────────────────────────────────────────────
export function searchSkills(query: string, limit = 30): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...ALL_SKILLS].slice(0, limit);
  return (ALL_SKILLS as readonly string[]).filter((s) => s.toLowerCase().includes(q)).slice(0, limit);
}

export function normalizeSkills(values: string[]): string[] {
  const set = new Set<string>();
  const catalogLC = new Map((ALL_SKILLS as readonly string[]).map((s) => [s.toLowerCase(), s]));
  for (const raw of values) {
    const t = (raw || "").trim();
    if (!t) continue;
    const matched = catalogLC.get(t.toLowerCase());
    set.add(matched ?? t);
  }
  return Array.from(set);
}

// ──────────────────────────────────────────────────────────────────────────────
// EMPLEO
// ──────────────────────────────────────────────────────────────────────────────
export const EMPLOYMENT_TYPES = [
  { value: "FULL_TIME", label: "Tiempo completo" },
  { value: "PART_TIME", label: "Medio tiempo" },
  { value: "CONTRACT", label: "Por periodo / Contrato" },
  { value: "INTERNSHIP", label: "Prácticas profesionales" },
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]["value"];

export const SENIORITY_OPTIONS = [
  { value: "JUNIOR", label: "Junior" },
  { value: "MID", label: "Mid" },
  { value: "SENIOR", label: "Senior" },
  { value: "LEAD", label: "Lead" },
] as const;
export type Seniority = (typeof SENIORITY_OPTIONS)[number]["value"];

export const LOCATION_TYPES = [
  { value: "REMOTE", label: "Remoto" },
  { value: "HYBRID", label: "Híbrido" },
  { value: "ONSITE", label: "Presencial" },
] as const;
export type LocationType = (typeof LOCATION_TYPES)[number]["value"];

export const CURRENCIES = [
  { value: "MXN", label: "MXN" },
  { value: "USD", label: "USD" },
] as const;
export type CurrencyCode = (typeof CURRENCIES)[number]["value"];

export const labelForEmploymentType = (v?: string) =>
  EMPLOYMENT_TYPES.find((x) => x.value === v)?.label ?? v ?? "";
export const labelForSeniority = (v?: string) =>
  SENIORITY_OPTIONS.find((x) => x.value === v)?.label ?? v ?? "";
export const labelForLocationType = (v?: string) =>
  LOCATION_TYPES.find((x) => x.value === v)?.label ?? v ?? "";

// ──────────────────────────────────────────────────────────────────────────────
// BUCKETS LEGACY
// ──────────────────────────────────────────────────────────────────────────────
export type Bucket = "frontend" | "backend" | "mobile" | "cloud" | "database" | "cybersecurity" | "testing" | "ai";

export const SKILL_TO_BUCKET: Record<string, Bucket> = {
  HTML: "frontend",
  CSS: "frontend",
  "D3.js": "frontend",
  Javascript: "frontend",
  Python: "backend",
  Java: "backend",
  C: "backend",
  "C++": "backend",
  "C#": "backend",
  Go: "backend",
  Rust: "backend",
  Ruby: "backend",
  PHP: "backend",
  Kotlin: "backend",
  Swift: "backend",
  Dart: "backend",
  Julia: "backend",
  Scala: "backend",
  R: "backend",
  Perl: "backend",
  "Visual Basic .NET": "backend",
  "Objective-C": "backend",
  Assembly: "backend",
  Zig: "backend",
  ".NET": "backend",
  "Node.js": "backend",
  Django: "backend",
  Flask: "backend",
  FastAPI: "backend",
  "Spring Boot": "backend",
  "ASP.NET": "backend",
  "Ruby on Rails": "backend",
  Laravel: "backend",
  Symfony: "backend",
  "Express.js": "backend",
  "React Native": "mobile",
  Flutter: "mobile",
  Xamarin: "mobile",
  Ionic: "mobile",
  "Native Android (Java/Kotlin)": "mobile",
  "Native iOS (Swift/Objective-C)": "mobile",
  TensorFlow: "ai",
  PyTorch: "ai",
  Keras: "ai",
  "Scikit-Learn": "ai",
  OpenCV: "ai",
  "Apache Spark (MLlib)": "ai",
  Pandas: "ai",
  NumPy: "ai",
  Matplotlib: "ai",
  Seaborn: "ai",
  SciPy: "ai",
  Plotly: "ai",
  MATLAB: "ai",
  Simulink: "ai",
  "Simulink Test": "ai",
  AWS: "cloud",
  "Microsoft Azure": "cloud",
  "Google Cloud Platform": "cloud",
  Docker: "cloud",
  Kubernetes: "cloud",
  Terraform: "cloud",
  Ansible: "cloud",
  Chef: "cloud",
  Puppet: "cloud",
  Jenkins: "cloud",
  "GitLab CI/CD": "cloud",
  "GitHub Actions": "cloud",
  Bash: "cloud",
  PowerShell: "cloud",
  SQL: "database",
  MySQL: "database",
  PostgreSQL: "database",
  Oracle: "database",
  "SQL Server": "database",
  MongoDB: "database",
  Cassandra: "database",
  Couchbase: "database",
  Redis: "database",
  DynamoDB: "database",
  Prisma: "database",
  Hibernate: "database",
  SQLAlchemy: "database",
  "Entity Framework": "database",
  GraphQL: "database",
  Selenium: "testing",
  Cypress: "testing",
  Puppeteer: "testing",
  JUnit: "testing",
  NUnit: "testing",
  PyTest: "testing",
  TestNG: "testing",
  Postman: "testing",
  Newman: "testing",
  LabVIEW: "backend",
  TestStand: "backend",
  VeriStand: "backend",
  "dSPACE HIL": "backend",
  "Vector CANoe": "backend",
  "Arduino IDE": "backend",
  "Raspberry Pi GPIO": "backend",
  XML: "backend",
  Markdown: "backend",
  LaTeX: "backend",
};
