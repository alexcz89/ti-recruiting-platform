// components/resume/ResumePDF.tsx
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Link,
  StyleSheet,
} from "@react-pdf/renderer";
import type { ResumeDoc } from "@/lib/mappers/profileToResume";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 11,
    lineHeight: 1.5,
    fontFamily: "Helvetica",
    color: "#111",
  },
  headerName: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  muted: { color: "#555" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  item: { marginBottom: 8 },
  itemTitle: { fontSize: 11.5, fontWeight: 700 },
  itemSub: { fontSize: 10.5, color: "#444" },
  bullet: { marginTop: 2, fontSize: 10.5, marginLeft: 6, color: "#333" },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  tag: {
    borderWidth: 1,
    borderColor: "#aaa",
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontSize: 10,
  },
});

function safeURL(url?: string | null): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export default function ResumePDF({ data }: { data: ResumeDoc }) {
  const has = {
    summary: !!data.summary?.trim(),
    exp: (data.experience || []).length > 0,
    edu: (data.education || []).length > 0,
    skills: (data.skills || []).length > 0,
    langs: (data.languages || []).length > 0,
    certs: (data.certifications || []).length > 0,
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <Text style={styles.headerName}>{data.header.name}</Text>
        <View style={styles.row}>
          {data.header.location && (
            <Text style={styles.muted}>{data.header.location}</Text>
          )}
          {data.header.email && (
            <Text style={styles.muted}>· {data.header.email}</Text>
          )}
          {data.header.phone && (
            <Text style={styles.muted}>· {data.header.phone}</Text>
          )}
          {data.header.linkedin && (
            <Link src={safeURL(data.header.linkedin)} style={styles.muted}>
              · LinkedIn
            </Link>
          )}
          {data.header.github && (
            <Link src={safeURL(data.header.github)} style={styles.muted}>
              · GitHub
            </Link>
          )}
        </View>

        {/* SUMMARY */}
        {has.summary && (
          <>
            <Text style={styles.sectionTitle}>Resumen</Text>
            <Text>{data.summary}</Text>
          </>
        )}

        {/* EXPERIENCE */}
        {has.exp && (
          <>
            <Text style={styles.sectionTitle}>Experiencia</Text>
            {data.experience.map((w, i) => (
              <View key={i} style={styles.item}>
                <Text style={styles.itemTitle}>{w.title}</Text>
                <Text style={styles.itemSub}>
                  {w.company} {w.period ? `· ${w.period}` : ""}
                </Text>
                {w.description ? (
                  <Text style={styles.bullet}>{w.description}</Text>
                ) : null}
              </View>
            ))}
          </>
        )}

        {/* EDUCATION */}
        {has.edu && (
          <>
            <Text style={styles.sectionTitle}>Educación</Text>
            {data.education.map((e, i) => (
              <View key={i} style={styles.item}>
                <Text style={styles.itemTitle}>{e.title}</Text>
                <Text style={styles.itemSub}>
                  {e.institution} {e.period ? `· ${e.period}` : ""}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* SKILLS */}
        {has.skills && (
          <>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.tagWrap}>
              {data.skills.map((s, i) => (
                <Text key={i} style={styles.tag}>
                  {s}
                </Text>
              ))}
            </View>
          </>
        )}

        {/* LANGUAGES */}
        {has.langs && (
          <>
            <Text style={styles.sectionTitle}>Idiomas</Text>
            <View style={styles.tagWrap}>
              {data.languages.map((s, i) => (
                <Text key={i} style={styles.tag}>
                  {s}
                </Text>
              ))}
            </View>
          </>
        )}

        {/* CERTIFICATIONS */}
        {has.certs && (
          <>
            <Text style={styles.sectionTitle}>Certificaciones</Text>
            <View style={styles.tagWrap}>
              {data.certifications.map((c, i) => (
                <Text key={i} style={styles.tag}>
                  {c}
                </Text>
              ))}
            </View>
          </>
        )}
      </Page>
    </Document>
  );
}
