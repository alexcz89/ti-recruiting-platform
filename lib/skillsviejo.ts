// lib/skills.ts
// Catálogo unificado para Skills, Certificaciones y taxonomías de empleo.
// Reutilízalo en formularios de candidato y creación/edición de vacantes.

//
// ─────────────── Skills ───────────────
//
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

export type Skill = typeof ALL_SKILLS[number];

// Búsqueda simple (para combobox con búsqueda incremental)
export function searchSkills(query: string, limit = 30): Skill[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...ALL_SKILLS].slice(0, limit);
  return (ALL_SKILLS as readonly string[])
    .filter(s => s.toLowerCase().includes(q))
    .slice(0, limit) as Skill[];
}

// Normaliza una lista libre de strings a Skills del catálogo (case-insensitive, dedupe).
// Mantiene elementos fuera del catálogo como “libres” si no hay match exacto.
export function normalizeSkills(values: string[]): string[] {
  const set = new Set<string>();
  const catalogLC = new Map(ALL_SKILLS.map(s => [s.toLowerCase(), s]));
  for (const raw of values) {
    const t = (raw || "").trim();
    if (!t) continue;
    const matched = catalogLC.get(t.toLowerCase());
    set.add(matched ?? t); // agrega skill del catálogo si matchea; si no, la deja tal cual
  }
  return Array.from(set);
}

//
// ─────────────── Certificaciones ───────────────
//
export const CERTIFICATIONS = [
  // Cloud (AWS / Azure / GCP)
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

  // DevOps / K8s / IaC
  "CKA (Certified Kubernetes Administrator)",
  "CKAD (Certified Kubernetes Application Developer)",
  "Terraform Associate",
  "GitHub Actions Certification (Foundations/Intermediate)",

  // Redes / Seguridad / ITSM
  "CCNA",
  "CCNP",
  "CompTIA A+",
  "CompTIA Network+",
  "CompTIA Security+",
  "CEH (Certified Ethical Hacker)",
  "OSCP",
  "ITIL Foundation",

  // QA / Agile / Gestión
  "ISTQB Foundation",
  "PMP",
  "Scrum Master (CSM/PSM)",

  // Salesforce / Otros (populares)
  "Salesforce Administrator",
] as const;

export type Certification = typeof CERTIFICATIONS[number];

//
// ─────────────── Taxonomías de empleo ───────────────
//
export const EMPLOYMENT_TYPES = [
  { value: "FULL_TIME", label: "Tiempo completo" },
  { value: "PART_TIME", label: "Medio tiempo" },
  { value: "CONTRACT",  label: "Por periodo / Contrato" },
  { value: "INTERNSHIP",label: "Prácticas profesionales" },
] as const;
export type EmploymentType = typeof EMPLOYMENT_TYPES[number]["value"];

export const SENIORITY_OPTIONS = [
  { value: "JUNIOR", label: "Junior" },
  { value: "MID",    label: "Mid" },
  { value: "SENIOR", label: "Senior" },
  { value: "LEAD",   label: "Lead" },
] as const;
export type Seniority = typeof SENIORITY_OPTIONS[number]["value"];

export const LOCATION_TYPES = [
  { value: "REMOTE", label: "Remoto" },
  { value: "HYBRID", label: "Híbrido" },
  { value: "ONSITE", label: "Presencial" },
] as const;
export type LocationType = typeof LOCATION_TYPES[number]["value"];

export const CURRENCIES = [
  { value: "MXN", label: "MXN" },
  { value: "USD", label: "USD" },
] as const;
export type CurrencyCode = typeof CURRENCIES[number]["value"];

// Helpers de labels
export const labelForEmploymentType = (v?: string) =>
  EMPLOYMENT_TYPES.find(x => x.value === v)?.label ?? v ?? "";
export const labelForSeniority = (v?: string) =>
  SENIORITY_OPTIONS.find(x => x.value === v)?.label ?? v ?? "";
export const labelForLocationType = (v?: string) =>
  LOCATION_TYPES.find(x => x.value === v)?.label ?? v ?? "";

//
// ─────────────── Prestaciones (default + tipos) ───────────────
//
export type BenefitKey =
  | "aguinaldoDias"
  | "vacacionesDias"
  | "primaVacacionalPct"
  | "utilidades"
  | "bonos"
  | "valesDespensa"
  | "fondoAhorro"
  | "combustible"
  | "comedor"
  | "celular"
  | "sgmm"
  | "seguroVida"
  | "automovil"
  | "otros";

export type BenefitValue = boolean | number | string;

export type BenefitConfig = {
  key: BenefitKey;
  label: string;
  defaultValue: BenefitValue;
  // Si el reclutador decide “Mostrar prestaciones en publicación”
  // puedes usar este flag como sugerencia para UI (no afecta lógica).
  publicable?: boolean;
};

export const BENEFITS_DEFAULT: BenefitConfig[] = [
  { key: "aguinaldoDias",     label: "Aguinaldo (días)",        defaultValue: 15,  publicable: true },
  { key: "vacacionesDias",    label: "Vacaciones (días)",       defaultValue: 12,  publicable: true },
  { key: "primaVacacionalPct",label: "Prima vacacional (%)",    defaultValue: 25,  publicable: true },
  { key: "utilidades",        label: "Utilidades",               defaultValue: true,  publicable: true },
  { key: "bonos",             label: "Bonos",                    defaultValue: false, publicable: true },
  { key: "valesDespensa",     label: "Vales de despensa",        defaultValue: false, publicable: true },
  { key: "fondoAhorro",       label: "Fondo de Ahorro",          defaultValue: false, publicable: true },
  { key: "combustible",       label: "Combustible",              defaultValue: false, publicable: true },
  { key: "comedor",           label: "Comedor subsidiado",       defaultValue: false, publicable: true },
  { key: "celular",           label: "Celular",                  defaultValue: false, publicable: true },
  { key: "sgmm",              label: "Seguro de Gastos Médicos", defaultValue: false, publicable: true },
  { key: "seguroVida",        label: "Seguro de Vida",           defaultValue: false, publicable: true },
  { key: "automovil",         label: "Automóvil",                defaultValue: false, publicable: true },
  { key: "otros",             label: "Otros",                    defaultValue: "",    publicable: true },
];

// Crea un objeto de prestaciones con valores por omisión para usar como initial state
export function defaultBenefitsRecord(): Record<BenefitKey, BenefitValue> {
  const out = {} as Record<BenefitKey, BenefitValue>;
  for (const b of BENEFITS_DEFAULT) out[b.key] = b.defaultValue;
  return out;
}

//
// ─────────────── Buckets legacy (opcional) ───────────────
//  Si aún mantienes columnas por categoría en User o Job (frontend/backend/etc.),
//  este mapa te ayuda a enrutar skills del catálogo a esos buckets.
//
export type Bucket =
  | "frontend" | "backend" | "mobile" | "cloud" | "database"
  | "cybersecurity" | "testing" | "ai";

export const SKILL_TO_BUCKET: Record<string, Bucket> = {
  // Frontend
  "HTML":"frontend","CSS":"frontend","D3.js":"frontend","Javascript":"frontend",

  // Backend / lenguajes genéricos
  "Python":"backend","Java":"backend","C":"backend","C++":"backend","C#":"backend","Go":"backend","Rust":"backend","Ruby":"backend","PHP":"backend",
  "Kotlin":"backend","Swift":"backend","Dart":"backend","Julia":"backend","Scala":"backend","R":"backend","Perl":"backend",
  "Visual Basic .NET":"backend","Objective-C":"backend","Assembly":"backend","Zig":"backend",".NET":"backend",
  "Node.js":"backend","Django":"backend","Flask":"backend","FastAPI":"backend","Spring Boot":"backend","ASP.NET":"backend","Ruby on Rails":"backend",
  "Laravel":"backend","Symfony":"backend","Express.js":"backend",

  // Mobile
  "React Native":"mobile","Flutter":"mobile","Xamarin":"mobile","Ionic":"mobile",
  "Native Android (Java/Kotlin)":"mobile","Native iOS (Swift/Objective-C)":"mobile",

  // AI / Data
  "TensorFlow":"ai","PyTorch":"ai","Keras":"ai","Scikit-Learn":"ai","OpenCV":"ai","Apache Spark (MLlib)":"ai",
  "Pandas":"ai","NumPy":"ai","Matplotlib":"ai","Seaborn":"ai","SciPy":"ai","Plotly":"ai","MATLAB":"ai","Simulink":"ai","Simulink Test":"ai",

  // Cloud / DevOps
  "AWS":"cloud","Microsoft Azure":"cloud","Google Cloud Platform":"cloud","Docker":"cloud",
  "Kubernetes":"cloud","Terraform":"cloud","Ansible":"cloud","Chef":"cloud","Puppet":"cloud",
  "Jenkins":"cloud","GitLab CI/CD":"cloud","GitHub Actions":"cloud","Bash":"cloud","PowerShell":"cloud",

  // DB
  "SQL":"database","MySQL":"database","PostgreSQL":"database","Oracle":"database","SQL Server":"database",
  "MongoDB":"database","Cassandra":"database","Couchbase":"database","Redis":"database","DynamoDB":"database",
  "Prisma":"database","Hibernate":"database","SQLAlchemy":"database","Entity Framework":"database","GraphQL":"database",

  // Testing
  "Selenium":"testing","Cypress":"testing","Puppeteer":"testing","JUnit":"testing","NUnit":"testing",
  "PyTest":"testing","TestNG":"testing","Postman":"testing","Newman":"testing",

  // Hardware / HIL (si los enrutas a backend por ahora)
  "LabVIEW":"backend","TestStand":"backend","VeriStand":"backend","dSPACE HIL":"backend","Vector CANoe":"backend",
  "Arduino IDE":"backend","Raspberry Pi GPIO":"backend",

  // Markup / miscelánea (si necesitas buckets legacy)
  "XML":"backend","Markdown":"backend","LaTeX":"backend",
};
