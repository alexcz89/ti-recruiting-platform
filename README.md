# TI Recruiting — Next.js + Node.js + PostgreSQL (Starter)

Este proyecto es un punto de partida **minimalista** para tu bolsa de trabajo de TI.
Incluye:

- **Next.js 14 (App Router)** + **TypeScript**
- **API Routes** para CRUD básico de vacantes y postulaciones
- **Prisma ORM** con **PostgreSQL**
- **NextAuth (Credenciales)** para iniciar sesión como *Recruiter* y publicar vacantes
- **TailwindCSS** para estilos
- Datos de ejemplo con `prisma/seed.ts`

> **Ideas de tu PPT** (extracto auto‑leído): guardamos un volcado en `docs/ideas-from-ppt.md` para que quede rastreable en el repo. Puedes editarlo para convertirlo en requerimientos.

---

## Requisitos

- Node.js 18+
- Docker (para PostgreSQL local) o una base externa (Railway, Supabase, etc.)

## Configuración

```bash
# 1) Instala dependencias
npm install

# 2) Levanta Postgres en Docker
docker compose up -d

# 3) Copia variables de entorno
cp .env.example .env

# 4) Crea las tablas
npm run db:push

# 5) Genera datos de ejemplo (usuario Recruiter + 2 vacantes)
npm run seed

# 6) Arranca el sitio
npm run dev
```

Accede a `http://localhost:3000`

- Login de prueba (Credenciales):
  - **Email:** `recruiter@example.com`
  - **Password:** `Recruiter123!`

## Estructura

```
app/
  (public)/
    jobs/
      page.tsx          # Listado y filtros
      [id]/page.tsx     # Detalle + postulación
  (auth)/signin/page.tsx
  layout.tsx
  page.tsx
  api/
    auth/[...nextauth]/route.ts
    jobs/route.ts
    applications/route.ts
components/
  JobCard.tsx
prisma/
  schema.prisma
  seed.ts
docs/
  ideas-from-ppt.md
```

## Qué sigue

- Panel de **Recruiter** con métricas y pipeline de candidatos.
- **Carga de CV** a S3 (o similar) y parseo.
- **Búsqueda avanzada** por skills (p. ej. trigramas / pgvector).
- Multi-tenant (si habrá varias empresas).
- Métodos de auth adicionales (Google, GitHub).

---

Hecho con ❤️ pensando en tu mercado de **México** (MXN por defecto).
