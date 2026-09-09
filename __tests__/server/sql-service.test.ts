import { describe, expect, it } from "vitest";

import {
  buildSqliteSubmission,
  validateReadOnlySqlQuery,
  validateSqlDatasetSetup,
} from "@/lib/code-execution/sql-service";

describe("SQL assessment service", () => {
  it("accepts SELECT and WITH queries", () => {
    expect(validateReadOnlySqlQuery("SELECT id FROM users;")).toEqual({ ok: true });
    expect(
      validateReadOnlySqlQuery("WITH active AS (SELECT id FROM users) SELECT * FROM active;"),
    ).toEqual({ ok: true });
  });

  it("rejects writes and multiple statements", () => {
    expect(validateReadOnlySqlQuery("DELETE FROM users;").ok).toBe(false);
    expect(validateReadOnlySqlQuery("SELECT 1; SELECT 2;").ok).toBe(false);
    expect(validateReadOnlySqlQuery("WITH x AS (DELETE FROM users RETURNING *) SELECT * FROM x;").ok).toBe(false);
  });

  it("ignores forbidden words inside literals and comments", () => {
    expect(validateReadOnlySqlQuery("SELECT 'delete', name FROM users -- update later\n;")).toEqual({ ok: true });
  });

  it("allows only CREATE TABLE and INSERT in custom datasets", () => {
    expect(
      validateSqlDatasetSetup("CREATE TABLE users (id INTEGER); INSERT INTO users VALUES (1);"),
    ).toEqual({ ok: true });
    expect(validateSqlDatasetSetup("ATTACH DATABASE 'x' AS external").ok).toBe(false);
    expect(validateSqlDatasetSetup(".shell whoami").ok).toBe(false);
  });
  it("builds a deterministic SQLite CLI script", () => {
    const result = buildSqliteSubmission(
      "CREATE TABLE users (name TEXT); INSERT INTO users VALUES ('Ana');",
      "SELECT name FROM users;",
    );

    expect(result).toContain(".headers off\n.mode list\n.separator |");
    expect(result).toContain("CREATE TABLE users");
    expect(result).toContain("SELECT name FROM users;");
  });
});
