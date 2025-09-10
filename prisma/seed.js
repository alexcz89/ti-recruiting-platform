// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.codexEntry.upsert({
    where: { slug: 'next-auth-troubleshooting' },
    update: {},
    create: {
      title: 'NextAuth: troubleshooting 500 en /api/auth/providers',
      slug: 'next-auth-troubleshooting',
      excerpt: 'Errores comunes, diagnóstico y checklist de variables.',
      tech: 'Next.js',
      tags: ['next-auth','debug','auth'],
      published: true,
      content: `
# Diagnóstico rápido

1. **Variables** en \`.env\`
   - \`NEXTAUTH_URL\`
   - \`NEXTAUTH_SECRET\`
   - Credenciales del provider (Google/GitHub)

2. **Rutas** en App Router
   - \`app/api/auth/[...nextauth]/route.ts\` configurada con \`authOptions\`

3. **Versión**
   - v4 → \`getServerSession\`
   - v5 → \`auth()\` desde \`@/auth\`

## Tabla de checks

| Ítem               | OK | Comentario                     |
|--------------------|----|--------------------------------|
| NEXTAUTH_URL       | ✅ | http://localhost:3000          |
| NEXTAUTH_SECRET    | ✅ | usa un valor aleatorio seguro  |
| Providers OAuth    | ⚠️ | define clientId/secret         |
| Callback URL OAuth | ✅ | coincide con tu dominio        |

> Tip: revisa logs del server al autenticar para errores detallados.
      `.trim(),
    },
  });

  await prisma.codexEntry.upsert({
    where: { slug: 'prisma-migrate-checklist' },
    update: {},
    create: {
      title: 'Prisma Migrate: checklist local',
      slug: 'prisma-migrate-checklist',
      excerpt: 'Comandos útiles y buenas prácticas con Docker.',
      tech: 'PostgreSQL',
      tags: ['prisma','db','migrations'],
      published: true,
      content: `
# Checklist de migraciones

- \`docker ps\` (DB arriba)
- \`npx prisma validate\`
- \`npx prisma migrate dev -n "mensaje"\`
- \`npx prisma studio\` para verificar

## Snippets

\`\`\`bash
# levantar Postgres con Docker (Windows/PowerShell una sola línea)
docker run --name pg-ti -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ti_recruiting -p 5432:5432 -v pgdata:/var/lib/postgresql/data -d postgres:15
\`\`\`

> Usa \`SHADOW_DATABASE_URL\` si tu host limita creación de DBs sombra.
      `.trim(),
    },
  });

  console.log('Seed Codex con Markdown listo ✅');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
