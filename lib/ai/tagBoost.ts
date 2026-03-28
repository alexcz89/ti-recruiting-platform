// lib/ai/tagBoost.ts

export type TagBoostInput = {
  candidateTags: string[];
  jobTitle: string;
  jobSkills: string[];
};

const KEYWORD_MAP: Record<string, string[]> = {
  // Core engineering
  backend: [
    "backend",
    "api",
    "rest",
    "graphql",
    "microservices",
    "node",
    "nestjs",
    "express",
    "java",
    "spring",
    "spring boot",
    ".net",
    "c#",
    "golang",
    "go",
    "python",
    "django",
    "flask",
    "php",
    "laravel",
    "ruby",
    "rails",
    "kotlin",
  ],
  frontend: [
    "frontend",
    "front-end",
    "ui",
    "web",
    "javascript",
    "typescript",
    "react",
    "next",
    "next.js",
    "angular",
    "vue",
    "nuxt",
    "html",
    "css",
    "tailwind",
    "redux",
    "vite",
  ],
  fullstack: [
    "fullstack",
    "full-stack",
    "full stack",
    "react",
    "next",
    "node",
    "nestjs",
    "java",
    "spring",
    ".net",
    "c#",
    "angular",
    "vue",
    "typescript",
  ],
  mobile: [
    "mobile",
    "android",
    "ios",
    "swift",
    "swiftui",
    "kotlin",
    "react native",
    "flutter",
    "xamarin",
    "ionic",
    "objective-c",
  ],

  // Data
  data: [
    "data",
    "analytics",
    "bi",
    "business intelligence",
    "etl",
    "elt",
    "data warehouse",
    "data lake",
    "bigquery",
    "snowflake",
    "redshift",
    "databricks",
    "hadoop",
    "spark",
    "sql",
    "power bi",
    "tableau",
    "looker",
  ],
  data_engineering: [
    "data engineer",
    "data engineering",
    "etl",
    "elt",
    "airflow",
    "dbt",
    "spark",
    "hadoop",
    "kafka",
    "databricks",
    "bigquery",
    "snowflake",
    "redshift",
  ],
  data_science: [
    "data science",
    "data scientist",
    "machine learning",
    "ml",
    "modeling",
    "forecasting",
    "python",
    "pandas",
    "numpy",
    "scikit",
    "tensorflow",
    "pytorch",
    "feature engineering",
  ],
  ai_ml: [
    "ai",
    "artificial intelligence",
    "machine learning",
    "deep learning",
    "llm",
    "nlp",
    "computer vision",
    "rag",
    "openai",
    "langchain",
    "prompt engineering",
    "vector database",
    "embedding",
  ],
  mlops: [
    "mlops",
    "model deployment",
    "model serving",
    "feature store",
    "ml pipeline",
    "airflow",
    "kubeflow",
    "sagemaker",
    "vertex ai",
    "mlflow",
    "docker",
    "kubernetes",
  ],

  // Infra / platform
  devops: [
    "devops",
    "ci/cd",
    "cicd",
    "pipeline",
    "jenkins",
    "github actions",
    "gitlab ci",
    "azure devops",
    "docker",
    "kubernetes",
    "helm",
    "terraform",
    "ansible",
    "linux",
    "nginx",
  ],
  sre: [
    "sre",
    "site reliability",
    "observability",
    "monitoring",
    "alerting",
    "incident",
    "prometheus",
    "grafana",
    "datadog",
    "new relic",
    "splunk",
    "availability",
    "reliability",
  ],
  cloud: [
    "cloud",
    "aws",
    "azure",
    "gcp",
    "google cloud",
    "lambda",
    "ec2",
    "ecs",
    "eks",
    "rds",
    "cloud run",
    "cloud functions",
    "serverless",
    "iam",
    "vpc",
  ],
  platform_engineering: [
    "platform",
    "platform engineering",
    "internal developer platform",
    "developer experience",
    "idp",
    "terraform",
    "kubernetes",
    "backstage",
    "golden path",
  ],

  // Security
  cybersecurity: [
    "security",
    "cybersecurity",
    "infosec",
    "iam",
    "siem",
    "soc",
    "vulnerability",
    "pentest",
    "pentesting",
    "application security",
    "appsec",
    "network security",
    "endpoint security",
    "zero trust",
    "incident response",
  ],
  appsec: [
    "appsec",
    "application security",
    "sast",
    "dast",
    "threat modeling",
    "owasp",
    "secure code",
    "dependency scanning",
    "code scanning",
  ],
  governance_risk_compliance: [
    "grc",
    "governance",
    "risk",
    "compliance",
    "iso 27001",
    "soc 2",
    "pci",
    "audit",
    "controls",
    "regulatory",
  ],

  // QA / delivery
  qa: [
    "qa",
    "quality assurance",
    "testing",
    "test automation",
    "selenium",
    "cypress",
    "playwright",
    "postman",
    "api testing",
    "performance testing",
    "jmeter",
    "manual testing",
  ],
  automation_testing: [
    "automation",
    "test automation",
    "selenium",
    "cypress",
    "playwright",
    "webdriver",
    "bdd",
    "cucumber",
  ],
  scrum_agile: [
    "scrum",
    "agile",
    "kanban",
    "product owner",
    "scrum master",
    "jira",
    "confluence",
    "ceremonies",
    "sprint",
  ],
  project_management: [
    "project manager",
    "project management",
    "pmo",
    "delivery",
    "roadmap",
    "stakeholder",
    "budget",
    "timeline",
    "governance",
  ],
  product_management: [
    "product",
    "product manager",
    "product owner",
    "roadmap",
    "discovery",
    "prioritization",
    "backlog",
    "go to market",
    "user research",
    "growth",
  ],
  ux_ui: [
    "ux",
    "ui",
    "figma",
    "wireframe",
    "prototype",
    "journey",
    "service blueprint",
    "design system",
    "usability",
    "research",
  ],

  // Enterprise apps / integration
  erp_crm: [
    "sap",
    "oracle",
    "dynamics",
    "salesforce",
    "crm",
    "erp",
    "netsuite",
    "servicenow",
    "workday",
  ],
  integration: [
    "integration",
    "esb",
    "mulesoft",
    "boomi",
    "wso2",
    "api gateway",
    "web services",
    "soap",
    "rest",
    "event-driven",
    "messaging",
    "kafka",
    "rabbitmq",
  ],
  rpa: [
    "rpa",
    "uipath",
    "automation anywhere",
    "blue prism",
    "power automate",
    "robotic process automation",
  ],
  low_code: [
    "low code",
    "low-code",
    "power apps",
    "power automate",
    "outsystems",
    "mendix",
    "appsheet",
  ],

  // Databases
  dba: [
    "dba",
    "database administrator",
    "sql server",
    "oracle",
    "postgresql",
    "mysql",
    "mongodb",
    "performance tuning",
    "replication",
    "backup",
    "restore",
  ],
  sql: [
    "sql",
    "sql server",
    "postgresql",
    "mysql",
    "oracle",
    "stored procedures",
    "views",
    "triggers",
    "etl",
  ],

  // Architecture / leadership
  architecture: [
    "architect",
    "architecture",
    "solution architect",
    "software architect",
    "enterprise architect",
    "microservices",
    "distributed systems",
    "integration architecture",
  ],
  leadership: [
    "lead",
    "leader",
    "manager",
    "head",
    "director",
    "staff",
    "principal",
    "tech lead",
    "team lead",
    "mentoring",
    "people management",
    "stakeholder management",
  ],

  // Banca / fintech / seguros / pagos
  fintech: [
    "fintech",
    "payments",
    "payment gateway",
    "wallet",
    "banking",
    "core banking",
    "open banking",
    "financial services",
    "risk",
    "fraud",
    "kyc",
    "aml",
    "cards",
    "issuer",
    "acquirer",
    "merchant",
  ],
  banking: [
    "banking",
    "banco",
    "core banking",
    "treasury",
    "capital markets",
    "trading",
    "derivatives",
    "settlement",
    "custody",
    "loan",
    "credit",
    "mortgage",
    "ifrs9",
    "basel",
    "xva",
  ],
  payments: [
    "payments",
    "payment",
    "spei",
    "coelsa",
    "openpay",
    "stripe",
    "adyen",
    "checkout",
    "cards",
    "visa",
    "mastercard",
    "tokenization",
    "pci",
  ],
  fraud_risk: [
    "fraud",
    "risk",
    "risk modeling",
    "credit risk",
    "market risk",
    "operational risk",
    "aml",
    "kyc",
    "monitoring",
    "transaction monitoring",
    "ifrs9",
    "basel",
    "scorecard",
    "collections",
  ],
  regulatory_reporting: [
    "regulatory",
    "regulatory reporting",
    "cnbv",
    "banxico",
    "xbrl",
    "ifrs",
    "ifrs9",
    "basel",
    "capital",
    "liquidity",
    "reporting",
    "compliance",
  ],
  insurance: [
    "insurance",
    "insurtech",
    "policy",
    "claims",
    "underwriting",
    "actuarial",
    "actuary",
    "solvency",
  ],

  // Commerce / industry verticals
  ecommerce: [
    "ecommerce",
    "e-commerce",
    "shopify",
    "magento",
    "commercetools",
    "frontastic",
    "merchant center",
    "checkout",
    "catalog",
    "oms",
  ],
  retail: [
    "retail",
    "pos",
    "inventory",
    "pricing",
    "supply chain",
    "store",
    "category management",
  ],
  manufacturing: [
    "manufacturing",
    "plant",
    "mes",
    "scada",
    "industrial",
    "supply chain",
    "quality",
    "lean",
    "six sigma",
  ],
};

function normalize(value: string): string {
  return String(value ?? "").toLowerCase().trim();
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(normalize(keyword)));
}

function tagMatchesCategory(tag: string, category: string): boolean {
  const normalizedTag = normalize(tag);
  const normalizedCategory = normalize(category);

  if (normalizedTag.includes(normalizedCategory)) return true;

  const categoryKeywords = KEYWORD_MAP[category] ?? [];
  return containsAny(normalizedTag, [normalizedCategory, ...categoryKeywords]);
}

export function computeTagBoost(input: TagBoostInput): number {
  const tags = (input.candidateTags ?? []).map(normalize).filter(Boolean);
  const jobText = normalize([input.jobTitle, ...(input.jobSkills ?? [])].join(" "));

  let boost = 0;

  for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
    const candidateHasCategory = tags.some((tag) => tagMatchesCategory(tag, category));
    if (!candidateHasCategory) continue;

    const jobMatchesCategory = containsAny(jobText, [category, ...keywords]);
    if (!jobMatchesCategory) continue;

    // Peso por categoría
    if (
      category === "fintech" ||
      category === "banking" ||
      category === "payments" ||
      category === "fraud_risk" ||
      category === "regulatory_reporting"
    ) {
      boost += 6;
      continue;
    }

    if (
      category === "backend" ||
      category === "frontend" ||
      category === "fullstack" ||
      category === "data" ||
      category === "data_engineering" ||
      category === "ai_ml" ||
      category === "cloud" ||
      category === "devops" ||
      category === "cybersecurity" ||
      category === "architecture"
    ) {
      boost += 4;
      continue;
    }

    if (
      category === "leadership" ||
      category === "project_management" ||
      category === "product_management" ||
      category === "scrum_agile" ||
      category === "ux_ui"
    ) {
      boost += 3;
      continue;
    }

    boost += 2;
  }

  return Math.min(boost, 15);
}