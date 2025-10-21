// lib/skills.ts
// Fuente de catálogos (skills, certificaciones, idiomas) y helpers para UI.
// Lee de DB (TaxonomyTerm) con fallback a listas estáticas. ¡Server-only en las
// funciones que golpean Prisma (usamos dynamic import)!

// ──────────────────────────────────────────────────────────────────────────────
// FALLBACKS ESTÁTICOS (AMPLIADOS)
// ──────────────────────────────────────────────────────────────────────────────
export const ALL_SKILLS = [
  // ── Lenguajes
  "Python","Java","C","C++","C#","Go","Rust","Ruby","PHP","Kotlin","Swift","Dart",
  "Julia","Scala","R","Perl","Visual Basic .NET","Objective-C","Assembly","Zig","TypeScript","Shell Script",

  // ── Web / Frontend
  "HTML","CSS","XML","Markdown","LaTeX","Javascript","TypeScript","React","Next.js","Vue.js","Nuxt","Angular",
  "Svelte","SvelteKit","Redux","RTK Query","Tailwind CSS","Bootstrap","Material UI","Vite","Webpack","Babel","Storybook",
  "Jest","Vitest","Playwright","Cypress","Puppeteer","ESLint","Prettier","D3.js",

  // ── Backend / runtimes / frameworks
  "Node.js","Express.js","NestJS","Django","Flask","FastAPI","Spring","Spring Boot","ASP.NET Core",".NET","Ruby on Rails",
  "Laravel","Symfony","Phoenix (Elixir)","Gin (Go)","Fiber (Go)","GraphQL","tRPC","gRPC","WebSockets","REST APIs",
  
  // ── Mobile
  "React Native","Flutter","SwiftUI","Kotlin Multiplatform Mobile","Xamarin","Ionic",
  "Native Android (Java/Kotlin)","Native iOS (Swift/Objective-C)",

  // ── Data / AI / ML / Analytics
  "TensorFlow","PyTorch","Keras","Scikit-Learn","XGBoost","LightGBM","OpenCV","Apache Spark (MLlib)","Ray",
  "Pandas","NumPy","Polars","Matplotlib","Seaborn","SciPy","Plotly","D3.js","Airflow","dbt","Great Expectations",
  "Jupyter","MLflow","Hugging Face","LangChain","Vector DB (FAISS/PGVector)","Feature Stores",

  // ── Cloud / DevOps / SRE
  "AWS","Microsoft Azure","Google Cloud Platform","Docker","Kubernetes","Helm","Kustomize","Istio","Linkerd",
  "Argo CD","Flux CD","Terraform","Pulumi","Ansible","Chef","Puppet","Packer",
  "Jenkins","GitLab CI/CD","GitHub Actions","TeamCity","CircleCI",
  "Prometheus","Grafana","Loki","Tempo","OpenTelemetry","ELK (Elasticsearch/Logstash/Kibana)","EFK (Elasticsearch/Fluentd/Kibana)",
  "HashiCorp Vault","Consul","NGINX","HAProxy","Traefik","Bash","PowerShell",

  // ── Cloud vendors specifics (GCP/AWS/Azure)
  // GCP
  "GKE","Cloud Run","Cloud Functions","App Engine","Compute Engine","BigQuery","Cloud SQL","Cloud Spanner","Pub/Sub",
  "Dataflow","Dataproc","Cloud Storage","Vertex AI","IAM (GCP)","VPC (GCP)","Cloud Build",
  // AWS
  "EKS","ECS","Fargate","Lambda","EC2","S3","RDS","DynamoDB","Aurora","Athena","Glue","EMR","Kinesis","Redshift",
  "API Gateway","Step Functions","CloudWatch","CloudFormation","IAM (AWS)","VPC (AWS)","Route 53","ElastiCache",
  // Azure
  "AKS","App Service","Functions (Azure)","VM Scale Sets","Azure SQL","Cosmos DB","Event Hubs","Service Bus","Synapse",
  "Data Factory","Blob Storage","Azure Monitor","Azure DevOps","ARM/Bicep","Azure AD (Entra ID)",

  // ── Bases de datos / ORMs / Query
  "SQL","MySQL","PostgreSQL","Oracle","SQL Server","MongoDB","Cassandra","Couchbase",
  "Redis","DynamoDB","Elasticsearch","Neo4j","Snowflake","BigQuery SQL",
  "Prisma","Hibernate","SQLAlchemy","Entity Framework","Sequelize","Mongoose",

  // ── QA / Testing / Performance
  "Selenium","Cypress","Puppeteer","Playwright","JUnit","NUnit","PyTest","TestNG","Postman","Newman",
  "K6","Gatling","JMeter",

  // ── Observabilidad / Seguridad
  "SIEM","SOC","WAF","OWASP","SAST","DAST","Secret Scanning","Snyk","Trivy","Anchore","Grype","Burp Suite","Nessus",
  "OIDC/OAuth2/SAML","JWT","mTLS","Zero Trust",

  // ── Integración / Mensajería
  "Kafka","RabbitMQ","ActiveMQ","NATS","MQTT",

  // ── IoT / Hardware / HIL
  "LabVIEW","TestStand","VeriStand","dSPACE HIL","Vector CANoe","Arduino IDE","Raspberry Pi GPIO",

  // ── SAP (apps / módulos)
  "SAP ABAP","SAP HANA","SAP BW/BI","SAP Basis","SAP Fiori/UI5",
  "SAP S/4HANA Finance (FI)","SAP S/4HANA Controlling (CO)","SAP MM (Sourcing & Procurement)","SAP SD (Sales)","SAP PP (Production Planning)",
  "SAP QM (Quality Management)","SAP PM (Plant Maintenance)","SAP EWM (Extended Warehouse)","SAP TM (Transportation Management)",
  "SAP SuccessFactors (Core)","SAP SuccessFactors Employee Central","SAP SuccessFactors Recruiting","SAP SuccessFactors Performance & Goals",
  "SAP Ariba","SAP IBP (Integrated Business Planning)","SAP Solution Manager",

  // ── Oracle (apps / DB / cloud)
  "PL/SQL","Oracle Database Administration","Oracle RAC","Oracle GoldenGate","Oracle APEX",
  "Oracle E-Business Suite (EBS)","Oracle Fusion Cloud ERP","Oracle Fusion Cloud HCM","Oracle Fusion Cloud SCM","Oracle NetSuite",
  "OCI (Oracle Cloud Infrastructure)",

  // ── Salesforce / MuleSoft
  "Salesforce Administration","Salesforce Apex","Salesforce Visualforce","Salesforce Lightning (Aura/LWC)","SOQL/SOSL",
  "Sales Cloud","Service Cloud","Marketing Cloud","Commerce Cloud","Experience Cloud","CPQ (Salesforce)",
  "MuleSoft Anypoint Platform","Mule 4","DataWeave",

  // ── Atlassian / Gestión / Agile
  "Jira","Confluence","Bitbucket","Trello","Scrum","Kanban","OKRs","Lean","PMBOK","PMP",

  // ── Otros útiles
  "Makefile","Nix","Linux","macOS","Windows Server",
] as const;
export type Skill = (typeof ALL_SKILLS)[number];

export const CERTIFICATIONS = [
  // ── AWS
  "AWS Certified Cloud Practitioner (CLF-C02)",
  "AWS Certified Solutions Architect – Associate (SAA-C03)",
  "AWS Certified Solutions Architect – Professional (SAP-C02)",
  "AWS Certified Developer – Associate (DVA-C02)",
  "AWS Certified SysOps Administrator – Associate (SOA-C02)",
  "AWS Certified DevOps Engineer – Professional (DOP-C02)",
  "AWS Certified Security – Specialty",
  "AWS Certified Advanced Networking – Specialty",
  "AWS Certified Data Engineer – Associate",
  "AWS Certified Machine Learning – Specialty",

  // ── Microsoft Azure
  "Microsoft Azure Fundamentals (AZ-900)",
  "Microsoft Azure Administrator (AZ-104)",
  "Microsoft Azure Developer (AZ-204)",
  "Microsoft Azure Solutions Architect Expert (AZ-305)",
  "Microsoft Azure Security Engineer (SC-200)",
  "Microsoft Azure AI Fundamentals (AI-900)",
  "Microsoft Azure Data Fundamentals (DP-900)",
  "Microsoft Azure Data Engineer (DP-203)",
  "Microsoft Azure DevOps Engineer Expert (AZ-400)",

  // ── Google Cloud
  "Google Associate Cloud Engineer (ACE)",
  "Google Professional Cloud Architect",
  "Google Professional Data Engineer",
  "Google Professional Cloud Developer",
  "Google Professional Cloud DevOps Engineer",
  "Google Professional Cloud Security Engineer",
  "Google Professional Cloud Network Engineer",
  "Google Professional Machine Learning Engineer",

  // ── Kubernetes / IaC / DevOps
  "CKA (Certified Kubernetes Administrator)",
  "CKAD (Certified Kubernetes Application Developer)",
  "CKS (Certified Kubernetes Security Specialist)",
  "Terraform Associate",
  "GitHub Actions Certification (Foundations/Intermediate)",

  // ── Cisco / CompTIA / ITIL / Seguridad
  "CCNA","CCNP","CCIE",
  "CompTIA A+","CompTIA Network+","CompTIA Security+","CompTIA Cloud+",
  "CEH (Certified Ethical Hacker)","OSCP","ITIL 4 Foundation",

  // ── Scrum / Gestión
  "PMP","PMI-ACP","Scrum Master (CSM)","Professional Scrum Master (PSM I)","Prince2 Foundation",

  // ── Salesforce
  "Salesforce Administrator",
  "Salesforce Advanced Administrator",
  "Salesforce Platform App Builder",
  "Salesforce Platform Developer I",
  "Salesforce Platform Developer II",
  "Salesforce Sales Cloud Consultant",
  "Salesforce Service Cloud Consultant",
  "Salesforce Marketing Cloud Administrator",
  "Salesforce Marketing Cloud Consultant",
  "Salesforce CPQ Specialist",

  // ── SAP
  "SAP Certified Development Associate – ABAP",
  "SAP Certified Technology Associate – System Administration (SAP HANA)",
  "SAP Certified Application Associate – SAP S/4HANA Finance",
  "SAP Certified Application Associate – S/4HANA Sourcing & Procurement (MM)",
  "SAP Certified Application Associate – SAP S/4HANA Sales (SD)",
  "SAP Certified Application Associate – SAP SuccessFactors Employee Central",
  "SAP Certified Application Associate – SAP HCM",

  // ── Oracle
  "OCI Foundations Associate",
  "OCI Architect Associate",
  "OCI Architect Professional",
  "Oracle Database SQL Certified Associate",
  "Oracle Database Administrator Professional",
  "Oracle Autonomous Database Cloud Specialist",
  "Oracle E-Business Suite R12 Certification",
  "NetSuite SuiteFoundation",
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
// BUCKETS (ampliados con SAP/Oracle/GCP/Salesforce/K8s)
// ──────────────────────────────────────────────────────────────────────────────
export type Bucket =
  | "frontend" | "backend" | "mobile" | "cloud" | "database" | "cybersecurity"
  | "testing" | "ai" | "sap" | "oracle" | "salesforce" | "devops";

export const SKILL_TO_BUCKET: Record<string, Bucket> = {
  // Frontend
  HTML: "frontend", CSS: "frontend", "D3.js": "frontend", Javascript: "frontend", React: "frontend",
  "Next.js": "frontend", Vue: "frontend", "Vue.js": "frontend", Nuxt: "frontend", Angular: "frontend",
  Svelte: "frontend", SvelteKit: "frontend", "Tailwind CSS": "frontend", Bootstrap: "frontend", "Material UI": "frontend",

  // Backend
  Python: "backend", Java: "backend", C: "backend", "C++": "backend", "C#": "backend", Go: "backend", Rust: "backend",
  Ruby: "backend", PHP: "backend", Kotlin: "backend", Swift: "backend", Dart: "backend", Julia: "backend",
  Scala: "backend", R: "backend", Perl: "backend", ".NET": "backend", "Node.js": "backend", Django: "backend",
  Flask: "backend", FastAPI: "backend", Spring: "backend", "Spring Boot": "backend", "ASP.NET Core": "backend",
  "Ruby on Rails": "backend", Laravel: "backend", Symfony: "backend", "Express.js": "backend", "NestJS": "backend",
  GraphQL: "backend", "gRPC": "backend",

  // Mobile
  "React Native": "mobile", Flutter: "mobile", "Native Android (Java/Kotlin)": "mobile",
  "Native iOS (Swift/Objective-C)": "mobile", SwiftUI: "mobile", Xamarin: "mobile", Ionic: "mobile",

  // AI / Data
  TensorFlow: "ai", PyTorch: "ai", Keras: "ai", "Scikit-Learn": "ai", OpenCV: "ai",
  "Apache Spark (MLlib)": "ai", Pandas: "ai", NumPy: "ai", Matplotlib: "ai", Seaborn: "ai",
  SciPy: "ai", Plotly: "ai", Airflow: "ai", dbt: "ai", "Great Expectations": "ai", "Hugging Face": "ai",

  // Cloud / DevOps
  AWS: "cloud", "Microsoft Azure": "cloud", "Google Cloud Platform": "cloud",
  Docker: "cloud", Kubernetes: "cloud", Helm: "cloud", Kustomize: "cloud",
  "Istio": "cloud", "Linkerd": "cloud", "Argo CD": "cloud", "Flux CD": "cloud",
  Terraform: "cloud", Pulumi: "cloud", Ansible: "cloud", Jenkins: "cloud", "GitLab CI/CD": "cloud", "GitHub Actions": "cloud",
  Prometheus: "cloud", Grafana: "cloud", "OpenTelemetry": "cloud", ELK: "cloud", "EFK (Elasticsearch/Fluentd/Kibana)": "cloud",
  NGINX: "cloud", "HAProxy": "cloud", Traefik: "cloud", "Bash": "cloud", PowerShell: "cloud",

  // Vendor-specific (cloud)
  GKE: "cloud", "Cloud Run": "cloud", "Cloud Functions": "cloud", "BigQuery": "cloud", "Dataflow": "cloud",
  EKS: "cloud", ECS: "cloud", Lambda: "cloud", EC2: "cloud", S3: "cloud", RDS: "cloud", DynamoDB: "cloud",
  AKS: "cloud", "Azure DevOps": "cloud", "ARM/Bicep": "cloud",

  // Databases
  SQL: "database", MySQL: "database", PostgreSQL: "database", Oracle: "database", "SQL Server": "database", MongoDB: "database",
  Cassandra: "database", Couchbase: "database", Redis: "database", DynamoDB: "database", Elasticsearch: "database",
  Snowflake: "database", "BigQuery SQL": "database",
  Prisma: "database", Hibernate: "database", SQLAlchemy: "database", "Entity Framework": "database", Sequelize: "database",

  // Testing
  Selenium: "testing", Cypress: "testing", Puppeteer: "testing", Playwright: "testing", JUnit: "testing", NUnit: "testing",
  PyTest: "testing", TestNG: "testing", Postman: "testing", Newman: "testing", K6: "testing", Gatling: "testing", JMeter: "testing",

  // Seguridad / SecOps (usa bucket cybersecurity)
  SIEM: "cybersecurity", SOC: "cybersecurity", WAF: "cybersecurity", OWASP: "cybersecurity", SAST: "cybersecurity", DAST: "cybersecurity",

  // Integración / Mensajería
  Kafka: "backend", RabbitMQ: "backend", ActiveMQ: "backend", NATS: "backend", MQTT: "backend",

  // SAP
  "SAP ABAP": "sap","SAP HANA": "sap","SAP BW/BI": "sap","SAP Basis": "sap","SAP Fiori/UI5": "sap",
  "SAP S/4HANA Finance (FI)": "sap","SAP S/4HANA Controlling (CO)": "sap","SAP MM (Sourcing & Procurement)": "sap",
  "SAP SD (Sales)": "sap","SAP PP (Production Planning)": "sap","SAP QM (Quality Management)": "sap",
  "SAP PM (Plant Maintenance)": "sap","SAP EWM (Extended Warehouse)": "sap","SAP TM (Transportation Management)": "sap",
  "SAP SuccessFactors (Core)": "sap","SAP SuccessFactors Employee Central": "sap","SAP Ariba": "sap","SAP IBP (Integrated Business Planning)": "sap",

  // Oracle
  "PL/SQL": "oracle","Oracle Database Administration": "oracle","Oracle RAC": "oracle","Oracle GoldenGate": "oracle",
  "Oracle APEX": "oracle","Oracle E-Business Suite (EBS)": "oracle","Oracle Fusion Cloud ERP": "oracle",
  "Oracle Fusion Cloud HCM": "oracle","Oracle Fusion Cloud SCM": "oracle","OCI (Oracle Cloud Infrastructure)": "oracle","Oracle NetSuite": "oracle",

  // Salesforce / MuleSoft
  "Salesforce Administration": "salesforce","Salesforce Apex": "salesforce","Salesforce Visualforce": "salesforce",
  "Salesforce Lightning (Aura/LWC)": "salesforce","Sales Cloud": "salesforce","Service Cloud": "salesforce",
  "Marketing Cloud": "salesforce","Commerce Cloud": "salesforce","Experience Cloud": "salesforce","CPQ (Salesforce)": "salesforce",
  "MuleSoft Anypoint Platform": "salesforce","Mule 4": "salesforce","DataWeave": "salesforce",

  // Otros legacy (de tu lista original)
  LabVIEW: "backend", TestStand: "backend", VeriStand: "backend", "dSPACE HIL": "backend", "Vector CANoe": "backend",
  "Arduino IDE": "backend", "Raspberry Pi GPIO": "backend", XML: "backend", Markdown: "backend", LaTeX: "backend",
};

// ──────────────────────────────────────────────────────────────────────────────
// Nota de uso:
// - Para evitar la “doble fuente”, usa este archivo como catálogo único en código.
// - En el seed, importa estos arrays y créalos en DB con skipDuplicates.
// ──────────────────────────────────────────────────────────────────────────────
