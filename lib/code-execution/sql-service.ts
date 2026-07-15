const MAX_SQL_LENGTH = 20_000;

const FORBIDDEN_SQL_KEYWORDS = [
  "ALTER",
  "ANALYZE",
  "ATTACH",
  "CREATE",
  "DELETE",
  "DETACH",
  "DROP",
  "INSERT",
  "PRAGMA",
  "REINDEX",
  "REPLACE",
  "TRIGGER",
  "TRUNCATE",
  "UPDATE",
  "VACUUM",
] as const;

export type SqlValidationResult =
  | { ok: true }
  | { ok: false; error: string };

function stripSqlLiteralsAndComments(sql: string) {
  return sql
    .replace(/--[^\r\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/"(?:""|[^"])*"/g, '""')
    .replace(/`(?:``|[^`])*`/g, "``")
    .replace(/\[(?:\]\]|[^\]])*\]/g, "[]");
}

export function validateReadOnlySqlQuery(sql: string): SqlValidationResult {
  const trimmed = sql.trim();

  if (!trimmed) {
    return { ok: false, error: "Escribe una consulta SQL antes de ejecutarla." };
  }

  if (trimmed.length > MAX_SQL_LENGTH) {
    return { ok: false, error: "La consulta SQL excede el limite permitido." };
  }

  const normalized = stripSqlLiteralsAndComments(trimmed);
  if (!/^\s*(SELECT|WITH)\b/i.test(normalized)) {
    return { ok: false, error: "Solo se permiten consultas SELECT o WITH." };
  }

  const withoutTrailingSemicolon = normalized.replace(/;\s*$/, "");
  if (withoutTrailingSemicolon.includes(";")) {
    return { ok: false, error: "Ejecuta una sola consulta SQL a la vez." };
  }

  const forbiddenPattern = new RegExp(`\\b(${FORBIDDEN_SQL_KEYWORDS.join("|")})\\b`, "i");
  if (forbiddenPattern.test(normalized)) {
    return { ok: false, error: "La practica SQL es de solo lectura." };
  }

  return { ok: true };
}

export function validateSqlDatasetSetup(sql: string): SqlValidationResult {
  const trimmed = sql.trim();
  if (!trimmed) return { ok: true };

  if (trimmed.length > 10_000) {
    return { ok: false, error: "El dataset SQL excede el limite permitido." };
  }

  const normalized = stripSqlLiteralsAndComments(trimmed);
  if (/^\s*\./m.test(normalized)) {
    return { ok: false, error: "No se permiten comandos del cliente SQLite." };
  }

  const forbidden = /\b(ALTER|ANALYZE|ATTACH|DELETE|DETACH|DROP|PRAGMA|REINDEX|REPLACE|TRIGGER|UPDATE|VACUUM|VIRTUAL)\b/i;
  if (forbidden.test(normalized)) {
    return { ok: false, error: "El dataset solo permite CREATE TABLE e INSERT INTO." };
  }

  const statements = normalized
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  if (!statements.every((statement) => /^(CREATE\s+TABLE|INSERT\s+INTO)\b/i.test(statement))) {
    return { ok: false, error: "El dataset solo permite CREATE TABLE e INSERT INTO." };
  }

  return { ok: true };
}
export function buildSqliteSubmission(setupSql: string, candidateQuery: string) {
  return [
    ".bail on",
    ".headers off",
    ".mode list",
    ".separator |",
    ".nullvalue NULL",
    setupSql.trim(),
    candidateQuery.trim(),
    "",
  ].join("\n");
}
