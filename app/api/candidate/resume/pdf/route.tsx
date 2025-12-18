// /app/api/candidate/resume/pdf/route.tsx
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { EducationLevel, LanguageProficiency } from "@prisma/client";

// Forzamos ruta dinámica (no prerender)
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ========== Estilos ==========

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 36,
    paddingVertical: 32,
    fontSize: 11,
    lineHeight: 1.45,
    fontFamily: "Helvetica", // fuente integrada, sin Font.register
    color: "#0f172a",
  },
  name: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 8,
    textAlign: "center",
  },
  contactLine: {
    fontSize: 10,
    marginTop: 4,
    marginBottom: 14,
    textAlign: "center",
  },
  divider: {
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
    marginVertical: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 8,
  },

  // Layout general
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  left: {
    width: "70%",
  },
  right: {
    width: "28%",
    textAlign: "right",
  },

  // Experiencia: empresa arriba, rol + fecha en la misma fila
  company: {
    fontWeight: 700,
    marginBottom: 2,
  },
  role: {
    fontStyle: "italic",
    fontWeight: 700,
  },

  // Educación: fecha alineada con el programa
  program: {
    fontStyle: "italic",
    fontWeight: 700,
  },
  institution: {
    marginTop: 2,
  },

  // Bullets de descripción
  bulletList: {
    marginTop: 4,
    paddingLeft: 10,
  },
  bulletContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  bulletSymbol: {
    width: 10,
    fontSize: 11,
    textAlign: "center",
  },
  bulletContent: {
    flex: 1,
    fontSize: 11,
  },

  // Listas simples
  listLine: {
    fontSize: 11,
    marginTop: 2,
  },
  listLabel: {
    fontWeight: 700,
  },
  bulletSymbolInline: {
    fontSize: 11,
  },
});

// ========== Helpers ==========

const monthYearES = (d?: Date | null) => {
  if (!d) return "";
  const mm = d.toLocaleString("es-MX", { month: "short" });
  return `${mm.replace(".", "")}. ${d.getFullYear()}`;
};

const langLabelES = (lvl?: LanguageProficiency | null) =>
  lvl === "NATIVE"
    ? "Nativo"
    : lvl === "PROFESSIONAL"
    ? "Profesional"
    : lvl === "BASIC"
    ? "Básico"
    : "Conversacional";

const eduLevelLabelES: Record<EducationLevel, string> = {
  NONE: "-",
  PRIMARY: "Primaria",
  SECONDARY: "Secundaria",
  HIGH_SCHOOL: "Preparatoria",
  TECHNICAL: "Técnico / TSU",
  BACHELOR: "Licenciatura",
  MASTER: "Maestría",
  DOCTORATE: "Doctorado",
  OTHER: "Otro",
};

const skillLevelLabelES = (lvl?: number | null) => {
  if (!lvl) return "";
  if (lvl >= 5) return "Experto";
  if (lvl >= 4) return "Avanzado";
  if (lvl >= 3) return "Intermedio";
  return "Básico";
};

function joinNonEmpty(...vals: (string | null | undefined)[]) {
  return vals
    .map((v) => (typeof v === "string" ? v.trim() : v))
    .filter(Boolean)
    .join("  ");
}

// Componente reutilizable para bullets (descripción)
function BulletLine({ children }: { children: string }) {
  return (
    <View style={styles.bulletContainer}>
      <Text style={styles.bulletSymbol}>•</Text>
      <Text style={styles.bulletContent}>{children}</Text>
    </View>
  );
}

// ========== PDF Component ==========

function ResumeDoc({
  name,
  email,
  phone,
  location,
  portfolio,
  github,
  summary,
  experience,
  education,
  skills,
  languages,
  certs,
}: {
  name: string;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  portfolio?: string | null;
  github?: string | null;
  summary?: string | null;
  experience: Array<{
    company: string;
    role: string;
    startDate: Date | null;
    endDate?: Date | null;
    isCurrent?: boolean;
    description?: string | null;
  }>;
  education: Array<{
    institution: string;
    program?: string | null;
    level?: EducationLevel | null;
    startDate?: Date | null;
    endDate?: Date | null;
  }>;
  skills: Array<{ label: string; level?: number | null }>;
  languages: Array<{ label: string; level: LanguageProficiency | null }>;
  certs: Array<{ label: string; issuer?: string | null; issuedAt?: Date | null }>;
}) {
  const contactLine = joinNonEmpty(
    email || "",
    phone || "",
    location || "",
    portfolio || "",
    github || ""
  );

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Nombre centrado */}
        <Text style={styles.name}>{name || "Nombre Apellido"}</Text>
        {contactLine && <Text style={styles.contactLine}>{contactLine}</Text>}

        {summary ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>RESUMEN</Text>
            <Text>{summary}</Text>
          </>
        ) : null}

        {experience.length ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>EXPERIENCIA LABORAL</Text>
            {experience.map((w, i) => (
              <View key={`${w.company}-${i}`} style={{ marginBottom: 10 }}>
                {/* Línea 1: Empresa */}
                <Text style={styles.company}>{w.company}</Text>

                {/* Línea 2: Rol + fecha (la fecha se alinea con el rol) */}
                <View style={styles.row}>
                  <View style={styles.left}>
                    <Text style={styles.role}>{w.role}</Text>
                  </View>
                  <View style={styles.right}>
                    <Text>
                      {w.startDate ? monthYearES(w.startDate) : ""}{" "}
                      {w.isCurrent
                        ? "– Actual"
                        : w.endDate
                        ? `– ${monthYearES(w.endDate)}`
                        : ""}
                    </Text>
                  </View>
                </View>

                {/* Descripción en bullets (cuando exista en BD) */}
                {w.description ? (
                  <View style={styles.bulletList}>
                    {w.description
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line, idx) => (
                        <BulletLine key={idx}>{line}</BulletLine>
                      ))}
                  </View>
                ) : null}
              </View>
            ))}
          </>
        ) : null}

        {education.length ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>EDUCACIÓN</Text>
            {education.map((e, i) => (
              <View key={`${e.institution}-${i}`} style={{ marginBottom: 8 }}>
                {/* Línea 1: institución */}
                <Text style={styles.institution}>{e.institution}</Text>

                {/* Línea 2: programa + nivel + fecha (alineada con el programa) */}
                <View style={styles.row}>
                  <View style={styles.left}>
                    <Text style={styles.program}>
                      {joinNonEmpty(
                        e.program || "",
                        e.level ? eduLevelLabelES[e.level] : ""
                      )}
                    </Text>
                  </View>
                  <View style={styles.right}>
                    <Text>
                      {e.startDate ? monthYearES(e.startDate) : ""}
                      {e.endDate ? ` – ${monthYearES(e.endDate)}` : ""}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {certs.length ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>CERTIFICACIONES</Text>
            {certs.map((c, i) => (
              <Text key={`${c.label}-${i}`} style={styles.listLine}>
                <Text style={styles.bulletSymbolInline}>• </Text>
                {joinNonEmpty(
                  c.label,
                  c.issuer || "",
                  c.issuedAt ? monthYearES(c.issuedAt) : ""
                )}
              </Text>
            ))}
          </>
        ) : null}

        {(skills.length || languages.length) && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>HABILIDADES E IDIOMAS</Text>

            {skills.length ? (
              <>
                <Text style={[styles.listLine, styles.listLabel]}>
                  Habilidades
                </Text>
                <Text style={styles.listLine}>
                  {skills
                    .map((s) => {
                      const lvl = skillLevelLabelES(s.level);
                      return lvl ? `${s.label} – ${lvl}` : s.label;
                    })
                    .join(", ")}
                </Text>
              </>
            ) : null}

            {languages.length ? (
              <>
                <Text style={[styles.listLine, styles.listLabel]}>Idiomas</Text>
                {languages.map((l, i) => (
                  <Text key={`${l.label}-${i}`} style={styles.listLine}>
                    {l.label} – {langLabelES(l.level)}
                  </Text>
                ))}
              </>
            ) : null}
          </>
        )}
      </Page>
    </Document>
  );
}

// ========== Handler ==========

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        phone: true,
        location: true,
        github: true,
        linkedin: true,
        experiences: {
          orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
          select: {
            company: true,
            role: true,
            startDate: true,
            endDate: true,
            isCurrent: true,
            description: true,
          },
        },
        education: {
          orderBy: [{ sortIndex: "asc" }, { endDate: "desc" }],
          select: {
            institution: true,
            program: true,
            level: true,
            startDate: true,
            endDate: true,
          },
        },
        candidateSkills: {
          include: { term: { select: { label: true } } },
          orderBy: { level: "desc" },
        },
        candidateLanguages: {
          include: { term: { select: { label: true } } },
          orderBy: { level: "desc" },
        },
        candidateCredentials: {
          include: { term: { select: { label: true } } },
          orderBy: { issuedAt: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const doc = (
      <ResumeDoc
        name={user.name || ""}
        email={user.email}
        phone={user.phone}
        location={user.location}
        portfolio={user.linkedin}
        github={user.github}
        summary={undefined}
        experience={user.experiences.map((w: any) => ({
          company: w.company || "",
          role: w.role || "",
          startDate: w.startDate,
          endDate: w.endDate,
          isCurrent: w.isCurrent || false,
          description: w.description ?? null,
        }))}
        education={user.education.map((e) => ({
          institution: e.institution || "",
          program: e.program || "",
          level: e.level,
          startDate: e.startDate,
          endDate: e.endDate,
        }))}
        skills={user.candidateSkills.map((s) => ({
          label: s.term.label,
          level: s.level,
        }))}
        languages={user.candidateLanguages.map((l) => ({
          label: l.term.label,
          level: l.level,
        }))}
        certs={user.candidateCredentials.map((c) => ({
          label: c.term.label,
          issuer: c.issuer,
          issuedAt: c.issuedAt,
        }))}
      />
    );

    const file = await pdf(doc).toBuffer();

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", `inline; filename="resume.pdf"`);

    return new NextResponse(file as any, { status: 200, headers });
  } catch (e) {
    console.error("[GET /api/candidate/resume/pdf] error", e);
    return NextResponse.json(
      { error: "No se pudo generar el PDF" },
      { status: 500 }
    );
  }
}
