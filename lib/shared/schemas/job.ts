// lib/shared/schemas/job.ts
import { z } from "zod";
import { isoCountry2 } from "./common";

export const JobFiltersSchema = z.object({
  q: z.string().optional(),
  countryCode: isoCountry2.optional(),
  city: z.string().optional(),
  seniority: z.enum(["JUNIOR", "MID", "SENIOR", "LEAD"]).optional(),
  remote: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});
export type JobFilters = z.infer<typeof JobFiltersSchema>;
