// lib/shared/validation/candidate/onboarding.ts
import { z } from "zod";

export const OnboardingCandidateStep1Schema = z.object({
  cvUrl: z.string().optional(),
  cvParsed: z.boolean().default(false),
});

export const OnboardingCandidateStep2Schema = z.object({
  skills: z.array(z.string().min(1)).default([]),
});

export const OnboardingCandidateStep3Schema = z.object({
  phone: z.string().optional(),
  certs: z.array(z.string().min(1)).default([]),
  location: z.string().optional(), 
});

export type OnboardingCandidateStep1Input = z.infer<typeof OnboardingCandidateStep1Schema>;
export type OnboardingCandidateStep2Input = z.infer<typeof OnboardingCandidateStep2Schema>;
export type OnboardingCandidateStep3Input = z.infer<typeof OnboardingCandidateStep3Schema>;

export const POPULAR_SKILLS = [
  "JavaScript", "TypeScript", "React", "Vue", "Angular", "Next.js",
  "Node.js", "Python", "Java", "Go", "Rust", "PHP",
  "AWS", "Azure", "GCP", "Docker", "Kubernetes",
  "PostgreSQL", "MongoDB", "MySQL", "GraphQL", "REST APIs",
  "Git", "CI/CD", "Figma", "Salesforce", "Apex",
];