// JobWizard/constants.ts
import { EmploymentType } from "./types";

export const EDUCATION_SUGGESTIONS = [
  "Ingeniería en Sistemas",
  "Ingeniería en Tecnologías Computacionales",
  "Ingeniería en Robótica",
  "Licenciatura en Informática",
  "Licenciatura en Ciencias de la Computación",
  "Maestría en Tecnologías de Información",
  "Maestría en Ciencia de Datos",
  "MBA con enfoque en TI",
  "Técnico en Programación",
  "Técnico en Redes",
];

export const BENEFITS = [
  { key: "aguinaldo", label: "Aguinaldo", def: true },
  { key: "vacaciones", label: "Vacaciones", def: true },
  { key: "primaVac", label: "Prima vacacional", def: true },
  { key: "utilidades", label: "Utilidades", def: true },
  { key: "bonos", label: "Bonos", def: false },
  { key: "vales", label: "Vales de despensa", def: false },
  { key: "fondoAhorro", label: "Fondo de ahorro", def: false },
  { key: "combustible", label: "Combustible", def: false },
  { key: "comedor", label: "Comedor subsidiado", def: false },
  { key: "celular", label: "Celular", def: false },
  { key: "sgmm", label: "SGMM", def: false },
  { key: "vida", label: "Seguro de vida", def: false },
  { key: "auto", label: "Automóvil", def: false },
  { key: "otros", label: "Otros", def: false },
];

export const EMPLOYMENT_OPTIONS: {
  value: EmploymentType;
  label: string;
  subtitle: string;
}[] = [
  {
    value: "FULL_TIME",
    label: "Tiempo completo",
    subtitle: "Jornada laboral estándar, puesto base.",
  },
  {
    value: "PART_TIME",
    label: "Medio tiempo",
    subtitle: "Ideal para estudiantes o segundo empleo.",
  },
  {
    value: "CONTRACT",
    label: "Por periodo",
    subtitle: "Proyecto con fecha de inicio y fin.",
  },
  {
    value: "INTERNSHIP",
    label: "Prácticas profesionales",
    subtitle: "Perfil junior / trainee.",
  },
];

export const SCHEDULE_PRESETS = [
  { label: "Oficina clásica", value: "L-V 9:00–18:00" },
  { label: "Oficina temprana", value: "L-V 8:00–17:00" },
  { label: "Banco / retail", value: "L-S 9:00–18:00" },
  { label: "Turno vespertino", value: "L-V 13:00–22:00" },
];

// Categorías de skills para mejor organización
export const SKILL_CATEGORIES = {
  frontend: {
    label: "Frontend",
    icon: "🎨",
    skills: ["React", "Vue", "Angular", "Next.js", "TypeScript", "JavaScript", "HTML", "CSS", "Tailwind"],
  },
  backend: {
    label: "Backend",
    icon: "⚙️",
    skills: ["Node.js", "Python", "Java", "C#", "Go", "Ruby", "PHP", "Express", "Django", "Spring"],
  },
  database: {
    label: "Bases de datos",
    icon: "🗄️",
    skills: ["PostgreSQL", "MySQL", "MongoDB", "Redis", "DynamoDB", "SQL Server", "Oracle"],
  },
  devops: {
    label: "DevOps",
    icon: "🚀",
    skills: ["Docker", "Kubernetes", "AWS", "Azure", "GCP", "CI/CD", "Jenkins", "GitHub Actions"],
  },
  mobile: {
    label: "Mobile",
    icon: "📱",
    skills: ["React Native", "Flutter", "iOS", "Android", "Swift", "Kotlin"],
  },
  other: {
    label: "Otros",
    icon: "💡",
    skills: [],
  },
};

// Quality score thresholds
export const QUALITY_THRESHOLDS = {
  description: { min: 100, good: 300, excellent: 500 },
  skills: { min: 2, good: 5, excellent: 8 },
  benefits: { min: 3, good: 6, excellent: 10 },
};
