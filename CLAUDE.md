# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **TI Recruiting Platform** (IT job board) built for the Mexican market. It's a multi-tenant recruiting system where companies can post jobs, candidates can apply, and recruiters manage applications through an ATS (Applicant Tracking System).

**Tech Stack:**
- Next.js 14 (App Router) + TypeScript
- Prisma ORM + PostgreSQL
- NextAuth.js (Credentials-based authentication)
- TailwindCSS for styling
- UploadThing for file uploads
- Resend for email delivery
- React Hook Form + Zod for form validation

## Development Commands

### Setup and Installation
```bash
npm install                    # Install dependencies
docker compose up -d          # Start PostgreSQL in Docker
cp .env.example .env          # Copy environment variables
npm run db:push               # Push schema to database (no migrations)
npm run seed                  # Seed demo data and taxonomies
```

### Development
```bash
npm run dev                   # Start dev server (http://localhost:3000)
npm run build                 # Production build
npm start                     # Start production server
npm run lint                  # Run ESLint
```

### Database Operations
```bash
npm run db:push               # Push Prisma schema changes (no migration files)
npm run seed                  # Seed taxonomies (skills, certs, languages) and demo data
```

### Taxonomy Management Scripts
```bash
npm run refresh:skills        # Refresh skills taxonomy from lib/skills.ts
npm run refresh:languages     # Refresh languages taxonomy
npm run refresh:certs         # Refresh certifications taxonomy
npm run refresh:taxonomies    # Refresh all taxonomies at once
npm run backfill:company      # Backfill companyId for existing users
```

**Note:** This project uses `prisma db push` workflow (no migration files). Schema changes are applied directly to the database.

## Architecture

### Authentication & Authorization

**Three user roles:**
- `CANDIDATE` - Job seekers who browse jobs and apply
- `RECRUITER` - Company employees who post jobs and manage applications
- `ADMIN` - Platform administrators

**Auth Flow:**
- NextAuth.js with Credentials provider (email/password + bcrypt)
- JWT-based sessions stored in client cookies
- Role passed in credentials during login to ensure role-specific authentication
- Middleware in `middleware.ts` protects routes:
  - `/dashboard/*` - Requires RECRUITER or ADMIN role
  - `/profile/*` - Requires authentication (any role)
  - `/jobs/*` - Public, but recruiters redirected to `/dashboard/jobs`

**Multi-tenancy:**
- Each `Company` is identified by email domain (e.g., `@task.com.mx`)
- Recruiters are auto-linked to companies by email domain via `ensureUserCompanyByEmail()`
- Company isolation enforced in API routes (e.g., recruiters only see jobs from their company)

### Database Schema Structure

**Core Models:**
- `User` - Unified model for candidates, recruiters, and admins
  - Has `role` enum (CANDIDATE, RECRUITER, ADMIN)
  - `companyId` for recruiters (nullable for candidates)
  - Location stored as `location` (string) + `locationLat/Lng` (geo)
  - Structured location: `country`, `admin1`, `city`, `cityNorm`, `admin1Norm`
  - Legacy arrays: `skills[]`, `certifications[]` (simple strings)
  - Relations: `candidateSkills`, `candidateCredentials`, `candidateLanguages` (taxonomy-based)

- `Company` - Multi-tenant companies
  - `domain` unique constraint (e.g., "task.com.mx")
  - `billingPlan` enum (FREE, PRO, BUSINESS, AGENCY) used for job limit enforcement
  - Tax data fields for CFDI (Mexican invoicing): `taxRfc`, `taxRegime`, `taxZip`, etc.

- `Job` - Job postings
  - Must have `companyId` (multi-tenant)
  - `status` enum (OPEN, CLOSED, PAUSED)
  - `employmentType` (FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP)
  - `seniority` (JUNIOR, MID, SENIOR, LEAD)
  - `locationType` (REMOTE, HYBRID, ONSITE)
  - Location: same structure as User (lat/lng + country/admin1/city/normalized)
  - Legacy `skills[]` array + relational `requiredSkills` (JobRequiredSkill)
  - JSON fields for wizard data: `benefitsJson`, `educationJson`, `skillsJson`, `certsJson`
  - `slug` for SEO-friendly URLs (optional)

- `Application` - Job applications
  - Links `candidate` (User) to `job`
  - `status` (SUBMITTED, REVIEWING, INTERVIEW, OFFER, HIRED, REJECTED)
  - `recruiterInterest` (REVIEW, MAYBE, ACCEPTED, REJECTED) - separate from status
  - Deferred rejection logic: `rejectedAt`, `rejectionEmailSent`
  - Unique constraint: `@@unique([candidateId, jobId])`

- `TaxonomyTerm` - Centralized catalog for skills, certifications, languages
  - `kind` enum (SKILL, CERTIFICATION, LANGUAGE)
  - `slug` + `label` + `aliases[]`
  - @@unique([kind, slug])
  - Relations: `JobRequiredSkill`, `CandidateSkill`, `CandidateCredential`, `CandidateLanguage`

- `WorkExperience` - Candidate work history
- `Education` - Candidate education with `level` (BACHELOR, MASTER, etc.) and `status` (ONGOING, COMPLETED, INCOMPLETE)
- `Resume` - Saved resume versions with JSON data + HTML snapshot
- `JobTemplate` - Saved job templates for "reuse previous job"
- `Invoice` - CFDI invoicing for Mexican billing (PAC integration)
- `RecruiterProfile` - Additional recruiter metadata with approval status

### Billing & Plan Limits

Plans configured in `config/plans.ts` with limits:
- `maxActiveJobs` - Enforced in POST /api/jobs (checks OPEN jobs count)
- `maxCandidatesPerMonth`, `maxRecruiters`, `maxClients` - Defined but not fully enforced yet

**FREE plan:** 1 job, 20 candidates/month
**PRO plan:** 5 jobs, unlimited candidates
**BUSINESS:** 15 jobs, 5 recruiters
**AGENCY:** Unlimited jobs, 50 clients

### File Upload Strategy

- UploadThing configured in `app/api/uploadthing/`
- Uploads return `key` and `url`
- Store both in database (e.g., `Company.logoKey` + `Company.logoUrl`)
- Common pattern: `resumeUrl`, `logoUrl` fields

### Form Validation

- Zod schemas in `lib/validation/` and `lib/schemas/`
- React Hook Form with `@hookform/resolvers/zod`
- Separate validation for candidate vs recruiter flows:
  - `lib/validation/candidate/signup.ts`
  - `lib/validation/recruiter/signup.ts`
  - `lib/validation/recruiter/onboarding.ts`

### Search & Filtering

**Job search:**
- `lib/search/jobs.ts` - Prisma-based filtering (location, employment type, salary, skills)
- `lib/search/fuse.ts` - Fuse.js for fuzzy search on title/description
- Location filtering uses normalized fields (`cityNorm`, `admin1Norm`) for case-insensitive matching

**Candidate search:**
- `lib/db/candidate.ts` - Recruiters search candidates by skills, location, etc.

### Geocoding

- Mapbox SDK for geocoding in `lib/geo.ts`
- Forward geocoding: address → lat/lng + structured data (country, admin1, city)
- Reverse geocoding: lat/lng → address
- API routes: `/api/geo/search`, `/api/geo/reverse`, `/api/geo/cities`

### Email & Verification

- Resend for transactional emails (configured in `lib/mailer.ts`)
- Email verification tokens in `lib/tokens.ts`
- Verification flow: `/api/auth/verify` → `/auth/verify/check-email`
- JWT syncs `emailVerified` from database on every token refresh

## Key Patterns & Conventions

### API Routes

**Pattern:** Server-side validation → database operation → JSON response
```typescript
// Example: POST /api/jobs
const session = await getServerSession(authOptions);
// Check role, company, plan limits
const body = await req.json();
const validated = JobSchema.parse(body);
const job = await prisma.job.create({ data: validated });
return NextResponse.json(job);
```

**Authentication in API routes:**
```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const session = await getServerSession(authOptions);
if (!session?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### Server Components (Default in App Router)

- Fetch data directly in page.tsx (no useEffect, no loading states)
- Use Prisma client directly in server components
- Pass data to client components via props

### Client Components

- Mark with `"use client"` directive
- Use for interactivity: forms, buttons, modals, state management
- Common pattern: `page.tsx` (server) → `*Client.tsx` (client wrapper)

### Prisma Singleton

Import from `lib/prisma.ts` (handles global singleton in development):
```typescript
import { prisma } from "@/lib/prisma";
```

### Path Aliases

TypeScript configured with `@/*` pointing to project root:
```typescript
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/prisma";
```

### Taxonomy Updates

**Source of truth:** `lib/skills.ts` exports `ALL_SKILLS`, `CERTIFICATIONS`, `LANGUAGES_FALLBACK`

To update taxonomies:
1. Edit `lib/skills.ts`
2. Run `npm run seed` or `npm run refresh:taxonomies`
3. Scripts upsert terms and optionally delete unlisted ones (controlled by `CLEAN_UNLISTED` flag)

### Job Wizard

Multi-step job creation wizard saves partial data in JSON fields:
- `Job.benefitsJson` - Benefits and perks
- `Job.educationJson` - Education requirements
- `Job.skillsJson` - Detailed skills with weights
- `Job.certsJson` - Required certifications

Also creates relational records in `JobRequiredSkill` for matching.

### Resume Builder

- Candidates build resumes in `/resume/builder` or `/cv/builder`
- Data saved to `Resume` model with JSON snapshot + HTML
- Preview in `components/resume/ResumePreview.tsx`
- PDF generation via `@react-pdf/renderer` or `puppeteer`

### Application Pipeline

Recruiters manage candidates in `/dashboard/jobs/[id]/applications`:
- Kanban-style board (uses `@hello-pangea/dnd`)
- Update `Application.recruiterInterest` to move candidates between columns
- Separate from `Application.status` which tracks official hiring stages

## Demo Credentials

After running `npm run seed`:

**Recruiter Login:**
- Email: `alejandro@task.com.mx`
- Password: (Set during signup, or check seed.ts - not hashed in seed by default)

**Candidate Login:**
- Email: `carolina@example.com`
- Password: (Set during signup)

**Note:** Seed creates users without passwords by default. Use the signup flow to create test accounts with passwords.

## Environment Variables

Required in `.env`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ti_recruiting?schema=public"
AUTH_SECRET="random-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

Optional (for production features):
- `UPLOADTHING_SECRET`, `UPLOADTHING_APP_ID` - File uploads
- `RESEND_API_KEY` - Email sending
- `MAPBOX_TOKEN` - Geocoding
- `NEXT_PUBLIC_MAPBOX_TOKEN` - Client-side maps

## Important Files

- `lib/auth.ts` - NextAuth configuration
- `middleware.ts` - Route protection and role-based redirects
- `prisma/schema.prisma` - Database schema (single source of truth)
- `config/plans.ts` - Billing plan definitions
- `lib/skills.ts` - Taxonomy catalog (skills, certs, languages)
- `app/api/jobs/route.ts` - Main jobs CRUD with plan limit enforcement
- `app/api/applications/route.ts` - Application submission
- `components/jobs/JobsFeed.tsx` - Public job listings
- `components/dashboard/Nav.tsx` - Recruiter dashboard navigation

## Common Tasks

### Adding a New Skill/Certification
1. Add to `lib/skills.ts` (ALL_SKILLS or CERTIFICATIONS array)
2. Run `npm run refresh:taxonomies`
3. Term becomes available in job wizard and profile editor

### Changing Plan Limits
1. Edit `config/plans.ts`
2. Update `Company.billingPlan` in database
3. Limits enforced in `/api/jobs` route

### Adding a New Job Field
1. Add column to `Job` model in `prisma/schema.prisma`
2. Run `npm run db:push`
3. Update `lib/schemas/job.ts` Zod schema
4. Update job wizard steps in `app/dashboard/jobs/new/page.tsx`

### Modifying Application Statuses
1. Edit `ApplicationStatus` or `ApplicationInterest` enum in schema
2. Run `npm run db:push`
3. Update UI in `app/dashboard/jobs/[id]/applications/page.tsx`

## Testing & Debugging

- Check session data: Visit `/api/debug-session` when logged in
- View Prisma queries: Set `DEBUG=prisma:query` in environment
- Auth issues: Check middleware.ts and lib/auth.ts
- Test email verification: Use Resend dashboard or check console logs in dev mode

## Security Notes

- Never commit `.env` file (already in .gitignore)
- Passwords hashed with bcrypt (10 rounds)
- CSRF protection via NextAuth
- Input validation on all API routes with Zod
- Company isolation: Always filter by `companyId` in recruiter queries
- Role checks in middleware and API routes

## Mexican Market Specifics

- Default currency: MXN (Mexican Peso)
- CFDI invoicing fields in `Company` and `Invoice` models
- Tax regime codes (e.g., "601", "612") in `Company.taxRegime`
- Phone validation uses `libphonenumber-js` for Mexican format
- Location data includes Mexican states (`admin1`) and cities
