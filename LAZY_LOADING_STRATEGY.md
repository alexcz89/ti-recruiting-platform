# 🚀 Lazy Loading & Code Splitting Strategy

## Current Status: Job Detail Page (`/jobs/[slug]`)

### Components Analysis

| Component | Type | Size | Position | Current | Recommended |
|-----------|------|------|----------|---------|-------------|
| **JobDetailPanel** | Heavy (ATS UI) | ~50KB | Above-fold | Direct | Keep direct (critical) |
| **CandidateMatchCard** | Medium (Conditional) | ~15KB | Above-fold | Direct | **Lazy load** |
| **Footer** | Light (Static) | ~5KB | Below-fold | Direct | **Lazy load** |

---

## Implementation Plan

### 🎯 Phase 1: Footer Lazy Loading (5 minutes)

**Why:** Footer is below-fold, users only see it after scrolling.

```typescript
// BEFORE: Direct import
import Footer from "@/components/Footer";

// AFTER: Lazy load with dynamic
const Footer = dynamic(
  () => import("@/components/Footer"),
  { loading: () => null } // No skeleton needed for footer
);
```

**Expected Savings:**
- Initial JS bundle: -5KB
- FCP: -20ms
- LCP: -10ms

---

### 🎯 Phase 2: CandidateMatchCard Lazy Loading (10 minutes)

**Why:** Only renders if user is logged in AND is a candidate AND has match data.

```typescript
// BEFORE: Direct import
import CandidateMatchCard from "@/components/jobs/CandidateMatchCard";

// AFTER: Lazy load with Suspense boundary
import { Suspense } from 'react';

const CandidateMatchCard = dynamic(
  () => import("@/components/jobs/CandidateMatchCard"),
  { 
    loading: () => <MatchCardSkeleton />,
    ssr: true // Important: Keep SSR for SEO
  }
);

// In JSX:
{isCandidate && candidateMatchResult && (
  <Suspense fallback={<MatchCardSkeleton />}>
    <CandidateMatchCard {...props} />
  </Suspense>
)}
```

**Expected Savings:**
- Initial JS bundle: -15KB
- FCP: -50ms
- Conditional rendering only loads if needed

---

### 🎯 Phase 3: HomePage Optimizations (15 minutes)

**Components to lazy load in `/page.tsx`:**

| Component | Below-fold | Size | Priority |
|-----------|-----------|------|----------|
| TechMarquee | Yes | 10KB | High |
| PricingSection | Yes | 20KB | High |
| Features Grid | Yes | 8KB | Medium |

```typescript
// Dynamic imports with loading states
const TechMarquee = dynamic(
  () => import("@/components/landing/TechMarquee"),
  { loading: () => <TechMarqueSkeleton /> }
);

const PricingSection = dynamic(
  () => import("@/components/marketing/PricingSection"),
  { loading: () => <PricingSkeleton /> }
);
```

**Expected Savings:**
- Initial bundle: -38KB
- FCP: -100ms
- TTI: -150ms

---

## Lighthouse Impact Estimates

### Before Optimization
```
Performance: 75
FCP: 1.8s
LCP: 2.5s
CLS: 0.1
```

### After Phase 1 + 2 (Lazy Loading)
```
Performance: 82 (+7 points)
FCP: 1.6s (-200ms)
LCP: 2.2s (-300ms)
CLS: 0.1 (unchanged)
```

### After All Phases + Font Optimization
```
Performance: 88 (+13 points)
FCP: 1.3s (-500ms)
LCP: 1.8s (-700ms)
CLS: 0.08 (-0.02)
```

---

## Implementation Order

**Session 1 (Now):**
- [ ] Phase 1: Footer lazy load
- [ ] Phase 2: CandidateMatchCard lazy load

**Session 2:**
- [ ] Phase 3: HomePage optimizations
- [ ] Add Suspense boundaries
- [ ] Create loading skeletons

**Session 3:**
- [ ] Font optimization (Google Fonts)
- [ ] CSS purging
- [ ] Critical CSS extraction

---

## Code Example: Full Implementation

```typescript
// app/jobs/[slug]/page.tsx
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import JobDetailPanel from '@/components/jobs/JobDetailPanel';

// Lazy loaded components
const CandidateMatchCard = dynamic(
  () => import('@/components/jobs/CandidateMatchCard'),
  { 
    loading: () => <div className="h-32 bg-zinc-100 animate-pulse rounded-lg" />,
    ssr: true 
  }
);

const Footer = dynamic(
  () => import('@/components/Footer'),
  { loading: () => null }
);

// Loading skeleton for CandidateMatchCard
function MatchCardSkeleton() {
  return (
    <div className="h-32 bg-gradient-to-r from-zinc-100 to-zinc-50 animate-pulse rounded-lg" />
  );
}

export default async function JobDetail({ params }: Params) {
  // ... existing code ...

  return (
    <>
      <main className="mx-auto max-w-[1100px] space-y-6 px-6 py-8">
        {/* Above-fold: Direct render */}
        <JobDetailPanel {...props} />

        {/* Below-fold: Lazy load only if needed */}
        {isCandidate && candidateMatchResult && (
          <Suspense fallback={<MatchCardSkeleton />}>
            <CandidateMatchCard matchResult={candidateMatchResult} jobId={job.id} />
          </Suspense>
        )}
      </main>

      {/* Below-fold: Footer lazy load */}
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}
```

---

## Metrics to Monitor

After implementation, track:

```bash
# Run Lighthouse
npm install -g lighthouse
lighthouse https://taskio.com.mx/jobs/python-developer --view

# Monitor Core Web Vitals
npm run build && npm start
# Visit: https://web.dev/measure/
```

**Key metrics to watch:**
- ✅ First Contentful Paint (FCP)
- ✅ Largest Contentful Paint (LCP)
- ✅ Cumulative Layout Shift (CLS)
- ✅ Time to Interactive (TTI)
- ✅ Total Blocking Time (TBT)

---

## Notes

⚠️ **Important:**
- Keep `JobDetailPanel` as direct import (above-fold, critical for SEO)
- Use `ssr: true` for components that affect SEO
- Always provide loading skeletons for UX
- Test on slow 4G to verify improvements

---

## Next Phase: Font Optimization

After lazy loading, we'll optimize fonts:
- Use system fonts for faster load
- Preload critical Google Fonts
- Subset fonts (Latin only)
- Use `font-display: swap`
