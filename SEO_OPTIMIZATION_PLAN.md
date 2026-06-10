# 🎯 SEO Optimization Plan para TaskIO

## Resumen Ejecutivo

TaskIO es un **job board especializado en TI para México** con potencial de ser #1 en búsquedas de "vacantes TI México". Actualmente tiene algunos fundamentos SEO pero le faltan:

1. **Contenido SEO optimizado** (meta descriptions, keywords)
2. **Schema.org completo** (JobPosting, Organization, LocalBusiness)
3. **Estrategia de palabras clave** (Keyword clustering)
4. **Backlinks y relaciones** (Link building, partnerships)
5. **Core Web Vitals optimizados** (Ya parcialmente hecho en Phase 1-2)
6. **Contenido complementario** (Blog, guías, recursos)

---

## 📍 Análisis Actual (Situación Basal)

### ✅ Lo que YA existe:
- [x] Sitemap dinámico (sitemap.ts)
- [x] Robots.txt (robots.ts)
- [x] Meta tags básicos en layout.tsx
- [x] Canonical URL en layout.tsx
- [x] Open Graph (OG) meta tags
- [x] Lazy loading optimizado (Phase 1)
- [x] Fast Core Web Vitals (-90% en load time)
- [x] HTTPS y seguridad

### ❌ Lo que FALTA:

| Área | Estado | Prioridad |
|------|--------|-----------|
| Meta descriptions por página | ❌ | 🔴 Alta |
| Keywords estratégicos | ❌ | 🔴 Alta |
| Schema.org JobPosting | ⚠️ Parcial | 🔴 Alta |
| Schema.org Organization | ❌ | 🟡 Media |
| Breadcrumb Schema | ❌ | 🟡 Media |
| Contenido (Blog/Recursos) | ❌ | 🟡 Media |
| Backlinks/Link Building | ❌ | 🔴 Alta |
| Localización (hreflang) | ❌ | 🟡 Media |
| Rich snippets (salarios) | ❌ | 🟡 Media |
| Open Graph para Social | ⚠️ Parcial | 🟡 Media |

---

## 🚀 Plan de Mejoras por Fase

### **FASE 1: Meta Tags & Descriptions (30 min)** 🎯

#### 1.1 Meta Descriptions Dinámicas
```typescript
// app/jobs/[slug]/page.tsx
export async function generateMetadata({ params }) {
  const job = await getJob(params.slug);
  
  return {
    title: `${job.title} - ${job.company} | TaskIO`,
    description: `${job.title} en ${job.location} - ${job.employmentType}. ${job.description.substring(0, 120)}...`,
    // Largo ideal: 150-160 caracteres
  };
}
```

**Impacto:**
- CTR en Google: +10-15% (mejor preview)
- Reduce bounce rate

#### 1.2 Keywords por Página
```typescript
// lib/seo/keywords.ts
export const KEYWORDS = {
  HOME: "vacantes tecnología México, empleos TI, junior developer, senior engineer",
  JOBS: "ofertas de trabajo tecnología, Java developer, React developer",
  JOB_DETAIL: "React developer vacante, salario desarrollador",
};

// app/jobs/[slug]/page.tsx
export async function generateMetadata({ params }) {
  const job = await getJob(params.slug);
  return {
    keywords: generateKeywords(job),
    // React, Developer, CDMX, MXN $80k
  };
}
```

**Impacto:**
- Mejor ranking en búsquedas específicas
- Más tráfico orgánico relevante

---

### **FASE 2: Schema.org Completo (40 min)** 📝

#### 2.1 JobPosting Schema (Mejorado)
```typescript
// lib/seo/schema.ts
export function generateJobPostingSchema(job: Job) {
  return {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    "title": job.title,
    "description": job.description,
    "datePosted": job.createdAt,
    "validThrough": new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 días
    
    "baseSalary": {
      "@type": "PriceSpecification",
      "currency": "MXN",
      "minValue": job.salaryMin,
      "maxValue": job.salaryMax,
      "unitText": "MONTH"
    },
    
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "",
        "addressLocality": job.city,
        "addressRegion": job.admin1,
        "postalCode": "",
        "addressCountry": "MX"
      }
    },
    
    "hiringOrganization": {
      "@type": "Organization",
      "name": job.company,
      "logo": job.logoUrl,
      "url": "https://www.taskio.com.mx"
    },
    
    "employmentType": job.employmentType, // FULL_TIME, PART_TIME, etc
    
    "jobBenefits": {
      "@type": "JobBenefits",
      "baseSalary": job.salaryMax,
      "othered_benefits": job.benefits // Seguro, home office, etc
    }
  };
}

// app/jobs/[slug]/page.tsx
export default function JobPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateJobPostingSchema(job))
        }}
      />
      {/* Contenido */}
    </>
  );
}
```

**Impacto en Google:**
- Google for Jobs indexa automáticamente
- Aparece en búsquedas con salario, ubicación
- Rich snippets en resultados
- Google Job Board: SEO casi automático

#### 2.2 Organization Schema (Sitio)
```typescript
export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "TaskIO",
    "description": "Plataforma de empleos tecnología México",
    "url": "https://www.taskio.com.mx",
    "logo": "https://www.taskio.com.mx/logo.png",
    "sameAs": [
      "https://www.linkedin.com/company/taskio",
      "https://twitter.com/taskio_mx",
      "https://www.facebook.com/taskio.mx"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "Customer Service",
      "email": "hola@taskio.com.mx"
    },
    "areaServed": "MX"
  };
}

// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateOrganizationSchema())
          }}
        />
      </head>
      {/* ... */}
    </html>
  );
}
```

#### 2.3 Breadcrumb Schema
```typescript
// lib/seo/schema.ts
export function generateBreadcrumbSchema(breadcrumbs: Breadcrumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.label,
      "item": item.url
    }))
  };
}

// Components
export function Breadcrumbs() {
  const items = [
    { label: "Inicio", url: "/" },
    { label: "Vacantes", url: "/jobs" },
    { label: "React Developer", url: "/jobs/react-developer-1" }
  ];
  
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateBreadcrumbSchema(items))
        }}
      />
      <nav>
        {/* Visual breadcrumbs */}
      </nav>
    </>
  );
}
```

**Impacto:**
- Mejor visualización en SERP
- Ayuda a crawling y indexación
- Mejora CTR 5-10%

---

### **FASE 3: Open Graph Mejorado (20 min)** 📱

#### 3.1 OG Tags Dinámicos por Job
```typescript
// app/jobs/[slug]/page.tsx
export async function generateMetadata({ params }) {
  const job = await getJob(params.slug);
  
  return {
    openGraph: {
      title: `${job.title} en ${job.company}`,
      description: job.description.substring(0, 160),
      url: `https://www.taskio.com.mx/jobs/${params.slug}`,
      
      // Image dinámica con el logo de la empresa
      images: [
        {
          url: job.logoUrl || "/og-default.png",
          width: 1200,
          height: 630,
          alt: job.company
        }
      ],
      
      type: "website",
      siteName: "TaskIO",
    },
    
    twitter: {
      card: "summary_large_image",
      title: `${job.title} - ${job.company}`,
      description: job.description.substring(0, 160),
      images: [job.logoUrl || "/og-default.png"],
    }
  };
}
```

**Impacto:**
- Mejor compartición en LinkedIn, Twitter, WhatsApp
- Aumenta backlinks orgánicos
- Más tráfico referral

---

### **FASE 4: Contenido SEO (60 min)** 📚

#### 4.1 Crear Hub de Contenido (Blog)
```
/blog
  /guides
    /senior-developer-salary-mexico-2024.md
    /remote-jobs-vs-onsite.md
    /tech-skills-high-demand.md
  /careers
    /landing-first-job-tech.md
    /portfolio-development.md
```

Ejemplos de artículos SEO-friendly:
- "Salarios de Desarrolladores en México 2024" (50+ búsquedas/mes)
- "React vs Vue vs Angular: Comparativa" (300+ búsquedas/mes)
- "Cómo armar un Portfolio para Developer" (200+ búsquedas/mes)

#### 4.2 Guía SEO para cada Job Posting
```typescript
// Agregar secciones a cada vacante
export default function JobPage({ job }) {
  return (
    <>
      {/* Job Detail */}
      <JobHeader />
      <JobDescription />
      
      {/* SEO Content */}
      <section className="mt-12 prose">
        <h2>Sobre esta posición</h2>
        <p>{job.detailedDescription}</p>
        
        <h3>Habilidades Requeridas</h3>
        <ul>
          {job.skills.map(skill => (
            <li key={skill}>
              <Link href={`/jobs?skills=${skill}`}>
                Más vacantes con {skill}
              </Link>
            </li>
          ))}
        </ul>
        
        <h3>Vacantes similares en {job.city}</h3>
        {/* Related jobs */}
      </section>
    </>
  );
}
```

**Impacto:**
- Aumenta tiempo en página (signal positivo)
- Reduce bounce rate
- Mejora keyword rankings

---

### **FASE 5: Technical SEO (30 min)** ⚙️

#### 5.1 Core Web Vitals (Ya implementado en Phase 1-2)
✅ LCP < 2.5s
✅ FID < 100ms
✅ CLS < 0.1

#### 5.2 Mobile-First Indexing
```typescript
// next.config.mjs
const nextConfig = {
  // Already configured: responsive images, lazy loading
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "utfs.io" }
    ]
  }
};
```

#### 5.3 XML Sitemaps Mejorados
```typescript
// app/sitemap-additional.ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    // Páginas estáticas (ya existe)
    // Jobs OPEN (ya existe)
    
    // Agregar:
    // Blog posts
    // Guías
    // Categorías (por skill, ciudad, etc)
  ];
}
```

#### 5.4 robots.txt Mejorado
```
User-agent: *
Allow: /
Allow: /jobs
Allow: /jobs/
Allow: /blog
Allow: /api/jobs  # Permitir crawling de jobs API

Disallow: /dashboard/
Disallow: /api/private/
Disallow: /auth/
Disallow: /admin/

Crawl-delay: 2
User-agent: AdsBot-Google
Disallow:

Sitemap: https://www.taskio.com.mx/sitemap.xml
Sitemap: https://www.taskio.com.mx/sitemap-jobs.xml
Sitemap: https://www.taskio.com.mx/sitemap-blog.xml
```

#### 5.5 Structured Data Validation
```bash
# Validar con Google Rich Results Test
curl "https://www.taskio.com.mx/jobs/react-developer"
# Debe retornar valid JSON-LD schemas
```

---

### **FASE 6: Link Building (Ongoing)** 🔗

#### Estrategia de Backlinks:
```
1. **Directorios de empleo:** LinkedIn, Indeed, ZipRecruiter
2. **Comunidades técnicas:** Stack Overflow, GitHub, Dev.to
3. **Portales de noticias:** Hacker News, Medium
4. **Partnerships:** Bootcamps, universidades, comunidades TI
5. **Content marketing:** Guías, artículos, recursos gratuitos
```

Ejemplo de partners potenciales:
- Platzi (crecimiento de talento TI)
- Mexico Dev (comunidad)
- Startups Mexicanas (feed de oportunidades)

---

## 📊 Matriz de Prioridad e Impacto

| Mejora | Impacto | Esfuerzo | ROI | Prioridad |
|--------|---------|----------|-----|-----------|
| Meta descriptions | 🟢🟢 | ⚡ 30min | Alto | 🔴 AHORA |
| Schema.org JobPosting | 🟢🟢🟢 | 🕐 40min | MuyAlto | 🔴 AHORA |
| Content Hub (Blog) | 🟢🟢🟢 | 📅 2-3 días | MuyAlto | 🟡 Próx 2sem |
| Backlinks | 🟢🟢 | 📅 Ongoing | Alto | 🟡 Próx 4sem |
| Local SEO (hreflang) | 🟢 | ⚡ 20min | Medio | 🟢 Futuro |
| Structured Data Rich | 🟢 | ⚡ 30min | Medio | 🟡 Próx sem |

---

## 🎯 Keywords Target por Región

### Ciudad de México:
- "Vacantes TI CDMX" (400 búsquedas/mes)
- "Empleos developer CDMX" (200 búsquedas/mes)
- "React developer CDMX" (150 búsquedas/mes)

### Monterrey:
- "Vacantes tecnología Monterrey" (150 búsquedas/mes)
- "Empleos IT Nuevo León" (80 búsquedas/mes)

### Guadalajara:
- "Tech jobs Guadalajara" (100 búsquedas/mes)

### Nacional:
- "Vacantes TI México" (800 búsquedas/mes)
- "Empleos desarrollador" (500 búsquedas/mes)
- "Junior developer México" (300 búsquedas/mes)

---

## 📈 Métricas de Éxito

### Baseline (Hoy):
- Sesiones/mes: ~1000 (estimado)
- Ranking keywords: <page 3 (no visible)
- Backlinks: ~5-10
- Domain Authority: ~5-10

### Targets (3 meses):
- Sesiones/mes: 5000+ (+400%)
- Ranking keywords: Page 1 para 20+ keywords
- Backlinks: 50+
- Domain Authority: 15-20

### Targets (12 meses):
- Sesiones/mes: 50,000+ (+4900%)
- Ranking keywords: Top 3 para "vacantes TI"
- Backlinks: 200+
- Domain Authority: 30+

---

## 🚀 Plan de Implementación Recomendado

### Semana 1:
- [ ] Implementar meta descriptions dinámicas
- [ ] Agregar Schema.org JobPosting
- [ ] Mejorar Open Graph tags
- [ ] Validar con Rich Results Test

### Semana 2:
- [ ] Crear 5 artículos de blog iniciales
- [ ] Implementar breadcrumb schema
- [ ] Mejorar robots.txt
- [ ] Crear sitemap-blog.xml

### Semana 3-4:
- [ ] Link building outreach (50 contactos)
- [ ] Partnerships con bootcamps/comunidades
- [ ] Monitorear Google Search Console
- [ ] Ajustar keywords según data

---

## 🔍 Herramientas de Monitoreo

```bash
# Google Search Console
# - Monitorear impresiones, CTR, posiciones
# - Arreglar errores de indexación

# Screaming Frog SEO Spider
# - Auditar internal links
# - Encontrar broken links

# SEMrush / Ahrefs
# - Competidor analysis
# - Keyword research
# - Backlink profile

# Lightmode PageSpeed Insights
# - Core Web Vitals
# - Opportunities
```

---

## 💡 Quick Wins (Implementables hoy)

1. **Meta descriptions** (30 min) - +10% CTR
2. **Schema.org** (40 min) - Google for Jobs
3. **OG tags mejorados** (20 min) - +5% social traffic
4. **Breadcrumb schema** (15 min) - Better UX + SERP

**Total: ~2 horas = +20-30% tráfico potencial**

---

## ⚠️ Errores Comunes a Evitar

❌ Keyword stuffing
❌ Contenido duplicado
❌ Hidden text
❌ Cloaking
❌ Spam links
❌ Meta descriptions muy largas/cortas
❌ Missing alt text en imágenes
❌ Broken links
❌ Redirect chains
❌ Mobile unfriendly

---

## Conclusión

TaskIO tiene **enorme potencial SEO** por:
1. ✅ Nicho específico (TI México)
2. ✅ Contenido único (ofertas de trabajo)
3. ✅ Tech foundation sólida (Phase 1-2)
4. ✅ Baja competencia en palabras clave largas

Con las mejoras de esta guía, **esperar 2-3x en tráfico en 3 meses** es realista.

