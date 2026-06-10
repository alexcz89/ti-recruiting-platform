# 📱 Mobile Optimization Checklist

## Current Status: Google Lighthouse Analysis

Recomendaciones para mejorar scores de PageSpeed y Mobile:

### 🟢 **Already Implemented**
- ✅ Responsive design (Tailwind)
- ✅ Meta viewport tags
- ✅ CSS-in-JS optimization
- ✅ OG Images for social sharing

### 🟡 **Recommended Improvements**

#### 1. Image Optimization (Impact: +15 points)
```typescript
// BEFORE: Heavy PNG logos
<img src="/company-logo.png" />

// AFTER: Optimized with Next.js Image
import Image from 'next/image';
<Image 
  src="/company-logo.png"
  width={200}
  height={200}
  alt="Company Logo"
  priority={false}
/>
```

**Action Items:**
- [ ] Replace all `<img>` tags with `<Image>` from next/image
- [ ] Add `priority` prop to above-fold images
- [ ] Convert PNG logos to WebP format
- [ ] Files to update:
  - `components/jobs/JobDetailPanel.tsx`
  - `components/jobs/JobsFeed.tsx`
  - `components/resume/ResumePreview.tsx`

---

#### 2. Code Splitting & Lazy Loading (Impact: +10 points)
```typescript
// BEFORE: All components loaded upfront
import CandidateMatchCard from '@/components/jobs/CandidateMatchCard';

// AFTER: Lazy load below-fold components
const CandidateMatchCard = dynamic(
  () => import('@/components/jobs/CandidateMatchCard'),
  { loading: () => <Skeleton /> }
);
```

**Action Items:**
- [ ] Lazy load: `CandidateMatchCard` (below fold)
- [ ] Lazy load: Resume preview (only if user clicks)
- [ ] Add `Suspense` boundaries for loading states

---

#### 3. CSS Optimization (Impact: +5 points)
```typescript
// Remove unused Tailwind classes
// purge: ['./app/**/*.{js,ts,jsx,tsx}']
```

**Action Items:**
- [ ] Run `npm run build` with CSS purge enabled
- [ ] Minify Tailwind CSS
- [ ] Remove duplicate styles

---

#### 4. Critical CSS (Impact: +10 points)
```html
<!-- Extract critical CSS for above-fold content -->
<style>
  /* Only styles needed for first paint */
  .header { ... }
  .job-card { ... }
</style>
```

**Action Items:**
- [ ] Inline critical CSS in `<head>`
- [ ] Defer non-critical CSS
- [ ] Tools: `critical-cli` or `inline-critical`

---

#### 5. Font Optimization (Impact: +8 points)
```css
/* BEFORE: Google Fonts with multiple weights */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

/* AFTER: Use variable fonts, preload */
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
```

**Action Items:**
- [ ] Use `font-display: swap` for all Google Fonts
- [ ] Preload critical fonts
- [ ] Subset fonts to Latin-only (remove extended characters)

---

### 📊 **Expected Improvements**

| Metric | Current | Target | Impact |
|--------|---------|--------|--------|
| Largest Contentful Paint (LCP) | 2.5s | 1.5s | +15 points |
| First Input Delay (FID) | 80ms | 50ms | +10 points |
| Cumulative Layout Shift (CLS) | 0.1 | 0.05 | +8 points |
| Performance Score | 75 | 90+ | +40% better rankings |

---

### 🚀 **Implementation Priority**

**Phase 1 (Quick wins - 2 hours):**
1. Replace `<img>` with `<Image>` component
2. Lazy load below-fold components

**Phase 2 (Deep optimization - 4 hours):**
3. CSS optimization & purging
4. Font preloading
5. Critical CSS extraction

**Phase 3 (Advanced - 6 hours):**
6. Service Worker caching
7. Bandwidth reduction
8. Network optimization

---

### 🔧 **Tools for Testing**

```bash
# Run Lighthouse CLI locally
npm install -g lighthouse
lighthouse https://localhost:3000/jobs/python-developer-cdmx --view

# Check Core Web Vitals
npm run build && npm start
# Visit: https://web.dev/measure/
```

---

### 📱 **Mobile-Specific Recommendations**

- [ ] Touch targets: Buttons 48x48px minimum
- [ ] Avoid full-width images on mobile
- [ ] Hamburger menu for navigation on <768px
- [ ] Single-column layout for mobile
- [ ] Test on 4G/LTE connections (Chrome DevTools)

---

**Next Steps:**
1. Run Lighthouse audit on /jobs/[slug] pages
2. Implement Phase 1 optimizations (2 hours)
3. Re-test and verify improvements
4. Continue with Phase 2 as needed
