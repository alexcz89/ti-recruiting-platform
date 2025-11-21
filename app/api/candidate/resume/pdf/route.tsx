// /app/api/candidate/resume/pdf/route.tsx
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Font, Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { EducationLevel, LanguageProficiency } from "@prisma/client";

// ========== Fuentes (usa Core fonts si prefieres) ==========
try {
  Font.register({
    family: "Inter",
    fonts: [
      { src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtU.ttf" }, // Regular
      { src: "https://fonts.gstatic.com/s/inter/v13/UcCM3FwrK3iLTeHuS_fvQtul.ttf", fontWeight: 600 }, // SemiBold
    ],
  });
} catch {
  /* no-op en dev si ya está registrada */
}

// ========== Helpers ==========
const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 11, lineHeight: 1.35, fontFamily: "Inter" },
  name: { fontSize: 20, fontWeight: 600, marginBottom: 3 },
  contacts: { color: "#2563eb", textDecoration: "none" },
  divider: { borderTopWidth: 1, borderColor: "#e5e7eb", marginVertical: 10 },
  sectionTitle: { fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: 0.3 },
  row: { display: "flex", flexDirection: "row", justifyContent: "space-between" },
  left: { width: "74%" },
  right: { width: "24%", textAlign: "right", color: "#111827" },
  company: { fontWeight: 600 },
  role: { fontStyle: "italic", color: "#374151", marginTop: 2 },
  bullet: { marginLeft: 10 },
  pillWrap: { marginTop: 4, display: "flex", flexWrap: "wrap", flexDirection: "row" },
  pill: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 4,
    fontSize: 9,
  },
});

const monthYear = (d?: Date | null) => {
  if (!d) return "";
  const mm = d.toLocaleString("en", { month: "short" });
  return `${mm}. ${d.getFullYear()}`;
};

const langLabel = (lvl?: LanguageProficiency | null) =>
  lvl === "NATIVE"
    ? "Native"
    : lvl === "PROFESSIONAL"
    ? "Professional"
    : lvl === "BASIC"
    ? "Basic"
    : "Conversational";

const eduLevelLabel: Record<EducationLevel, string> = {
  NONE: "—",
  PRIMARY: "Primary",
  SECONDARY: "Secondary",
  HIGH_SCHOOL: "High School",
  TECHNICAL: "Technical / TSU",
  BACHELOR: "Bachelor",
  MASTER: "Master",
  DOCTORATE: "Doctorate",
  OTHER: "Other",
};

function joinNonEmpty(...vals: (string | null | undefined)[]) {
  return vals.filter(Boolean).join(" · ");
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
    startDate: Date;
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
        {/* Header */}
        <Text style={styles.name}>{name || "Nombre Apellido"}</Text>
        {contactLine && <Text style={styles.contacts}>{contactLine}</Text>}

        {/* Summary */}
        {summary ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>SUMMARY</Text>
            <Text>{summary}</Text>
          </>
        ) : null}

        {/* Experience */}
        {experience.length ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>WORK EXPERIENCE</Text>
            {experience.map((w, i) => (
              <View key={`${w.company}-${i}`} style={{ marginBottom: 8 }}>
                <View style={styles.row}>
                  <View style={styles.left}>
                    <Text style={styles.company}>{w.company}</Text>
                    <Text style={styles.role}>{w.role}</Text>
                  </View>
                  <View style={styles.right}>
                    <Text>
                      {w.startDate ? monthYear(w.startDate) : ""}{" "}
                      {w.isCurrent
                        ? "– Present"
                        : w.endDate
                        ? `– ${monthYear(w.endDate)}`
                        : ""}
                    </Text>
                  </View>
                </View>
                {w.description ? (
                  <View style={{ marginTop: 2 }}>
                    {w.description.split("\n").map((line, idx) => (
                      <Text key={idx} style={styles.bullet}>
                        • {line.trim()}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </>
        ) : null}

        {/* Education */}
        {education.length ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>EDUCATION</Text>
            {education.map((e, i) => (
              <View key={`${e.institution}-${i}`} style={{ marginBottom: 6 }}>
                <View style={styles.row}>
                  <View style={styles.left}>
                    <Text style={{ fontWeight: 600 }}>{e.institution}</Text>
                    <Text>
                      {joinNonEmpty(
                        e.program || "",
                        e.level ? eduLevelLabel[e.level] : ""
                      )}
                    </Text>
                  </View>
                  <View style={styles.right}>
                    <Text>
                      {e.startDate ? monthYear(e.startDate) : ""}
                      {e.endDate ? ` – ${monthYear(e.endDate)}` : ""}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {/* Certifications */}
        {certs.length ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>CERTIFICATIONS</Text>
            {certs.map((c, i) => (
              <Text key={`${c.label}-${i}`} style={styles.bullet}>
                •{" "}
                {joinNonEmpty(
                  c.label,
                  c.issuer || "",
                  c.issuedAt ? monthYear(c.issuedAt) : ""
                )}
              </Text>
            ))}
          </>
        ) : null}

        {/* Skills & Languages */}
        {skills.length || languages.length ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>SKILLS & LANGUAGES</Text>
            {skills.length ? (
              <>
                <Text style={{ fontWeight: 600, marginTop: 2 }}>Skills</Text>
                <View style={styles.pillWrap}>
                  {skills.map((s, i) => (
                    <Text key={`${s.label}-${i}`} style={styles.pill}>
                      {s.label}
                      {typeof s.level === "number" ? ` · ${s.level}/5` : ""}
                    </Text>
                  ))}
                </View>
              </>
            ) : null}
            {languages.length ? (
              <>
                <Text style={{ fontWeight: 600, marginTop: 6 }}>Languages</Text>
                <View style={styles.pillWrap}>
                  {languages.map((l, i) => (
                    <Text key={`${l.label}-${i}`} style={styles.pill}>
                      {l.label} · {langLabel(l.level)}
                    </Text>
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}
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
        // Por ahora sin summary porque no existe en BD
        summary={undefined}
        experience={user.experiences.map((w) => ({
          company: w.company || "",
          role: w.role || "",
          startDate: w.startDate,
          endDate: w.endDate,
          isCurrent: w.isCurrent || false,
          // descripción vacía: los bullets vendrían de un flujo futuro donde mandes el CV completo desde el front
          description: "",
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

    // Buffer aceptado como BodyInit en runtime; casteo para contentar a TS
    const file = (await pdf(doc).toBuffer()) as any;

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", `inline; filename="resume.pdf"`);
    return new NextResponse(file, { status: 200, headers });
  } catch (e) {
    console.error("[GET /api/candidate/resume/pdf] error", e);
    return NextResponse.json(
      { error: "No se pudo generar el PDF" },
      { status: 500 }
    );
  }
}
