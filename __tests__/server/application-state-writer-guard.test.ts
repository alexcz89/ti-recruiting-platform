import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const stateFields = new Set(["status", "recruiterInterest", "stage", "disposition"]);
const mutationMethods = new Set(["create", "update", "updateMany", "upsert"]);
const canonicalInfrastructure = new Set([
  "lib/hiring-process/create-application.ts",
  "lib/hiring-process/prisma-transition-store.ts",
  "lib/hiring-process/reconcile-legacy-applications.ts",
  "lib/hiring-process/application-intents.ts",
]);
const requiredDynamicRejectionGuards = new Map<string, RegExp>([
  ["app/api/applications/[id]/route.ts", /if \(body\.status === "REJECTED"\)/],
  ["app/api/applications/[id]/status/route.ts", /if \(newStatus === "REJECTED"\)/],
  ["app/api/applications/[id]/interest/route.ts", /if \(next === "REJECTED"\)/],
]);

// Canonical infrastructure is expected to write the snapshot. Every other entry is
// temporary legacy debt and must be removed as its writer moves in Slice 3B2/readers.
const allowedProductionWriters = new Map<string, string>([
  ["lib/hiring-process/create-application.ts", "canonical atomic creation"],
  ["lib/hiring-process/prisma-transition-store.ts", "canonical transition CAS"],
  ["lib/hiring-process/reconcile-legacy-applications.ts", "approved one-time reconciliation"],
  ["lib/hiring-process/application-intents.ts", "feature-flag OFF legacy fallback"],
  ["app/dashboard/overview/actions.ts", "temporary flag-OFF review pilot"],
  ["app/dashboard/jobs/[id]/page.tsx", "temporary MAYBE/REVIEW Kanban writers"],
  ["app/api/applications/[id]/route.ts", "temporary generic legacy endpoint"],
  ["app/api/applications/[id]/status/route.ts", "temporary legacy status endpoint"],
  ["app/api/applications/[id]/interest/route.ts", "temporary MAYBE/REVIEW endpoint"],
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(cjs|js|jsx|mjs|ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function propertyName(node: ts.Node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return null;
}

function containsStateField(node: ts.Node): boolean {
  if (ts.isSpreadAssignment(node)) return true;
  if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
    const name = propertyName(node.name);
    if (name && stateFields.has(name)) return true;
  }
  return node.getChildren().some(containsStateField);
}

function dataInitializer(
  object: ts.ObjectLiteralExpression,
  source: ts.SourceFile,
): ts.Node | null {
  const data = object.properties.find(
    (property) =>
      (ts.isPropertyAssignment(property) ||
        ts.isShorthandPropertyAssignment(property)) &&
      propertyName(property.name) === "data",
  );
  if (!data) return null;
  const initializer = ts.isPropertyAssignment(data)
    ? data.initializer
    : ts.isShorthandPropertyAssignment(data)
      ? data.name
      : null;
  if (!initializer) return null;
  if (!ts.isIdentifier(initializer)) return initializer;

  let resolved: ts.Node | null = null;
  const findDeclaration = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === initializer.getText(source) &&
      node.initializer
    ) {
      resolved = node.initializer;
    }
    node.forEachChild(findDeclaration);
  };
  source.forEachChild(findDeclaration);
  return resolved ?? initializer;
}

function directApplicationStateWrites(path: string) {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const writes: number[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      const model = node.expression.expression;
      if (
        mutationMethods.has(method) &&
        ts.isPropertyAccessExpression(model) &&
        model.name.text === "application"
      ) {
        const argument = node.arguments[0];
        if (argument && ts.isObjectLiteralExpression(argument)) {
          const data = dataInitializer(argument, source);
          // An unresolved data identifier is conservatively treated as a state write.
          // This prevents hiding a mutation behind a helper object.
          if (data && (ts.isIdentifier(data) || containsStateField(data))) {
            writes.push(source.getLineAndCharacterOfPosition(node.getStart()).line + 1);
          }
        }
      }
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return writes;
}

function directApplicationRejectionWriteLines(path: string) {
  const contents = readFileSync(path, "utf8");
  const source = ts.createSourceFile(
    path,
    contents,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const writes: number[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      const model = node.expression.expression;
      if (
        mutationMethods.has(method) &&
        ts.isPropertyAccessExpression(model) &&
        model.name.text === "application"
      ) {
        const argument = node.arguments[0];
        if (argument && ts.isObjectLiteralExpression(argument)) {
          const data = dataInitializer(argument, source);
          if (data?.getText(source).includes("REJECTED")) {
            writes.push(source.getLineAndCharacterOfPosition(node.getStart()).line + 1);
          }
        }
      }
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return writes;
}

describe("Application state writer architecture", () => {
  it("allows direct production writers only through the documented allowlist", () => {
    const files = ["app", "components", "lib"].flatMap((directory) =>
      sourceFiles(join(root, directory)),
    );
    const discovered = new Map<string, number[]>();
    for (const file of files) {
      const lines = directApplicationStateWrites(file);
      if (lines.length) {
        discovered.set(relative(root, file).replaceAll("\\", "/"), lines);
      }
    }

    expect(
      [...discovered.keys()].filter((file) => !allowedProductionWriters.has(file)),
      `Undocumented direct Application state writer(s): ${JSON.stringify(Object.fromEntries(discovered))}`,
    ).toEqual([]);
    expect(
      [...allowedProductionWriters.keys()].filter((file) => !discovered.has(file)),
      "Remove stale exceptions when their legacy writer disappears",
    ).toEqual([]);
  });

  it("keeps seeds and manual fixtures outside the production scan", () => {
    expect([...allowedProductionWriters.keys()]).not.toContain("prisma/seed.ts");
    expect([...allowedProductionWriters.keys()]).not.toContain("scripts/create-test-invite.ts");
  });

  it("blocks direct rejection writes outside canonical infrastructure", () => {
    const files = ["app", "components", "lib"].flatMap((directory) =>
      sourceFiles(join(root, directory)),
    );
    const violations: Record<string, number[]> = {};

    for (const file of files) {
      const relativePath = relative(root, file).replaceAll("\\", "/");
      if (canonicalInfrastructure.has(relativePath)) continue;
      const lines = directApplicationRejectionWriteLines(file);
      if (lines.length) violations[relativePath] = lines;
    }
    expect(violations, "Direct REJECTED Application writer(s) must use REJECT_CANDIDATE").toEqual({});

    for (const [path, guard] of requiredDynamicRejectionGuards) {
      const source = readFileSync(join(root, path), "utf8");
      expect(source, `${path} must fail closed for dynamic REJECTED input`).toMatch(guard);
      expect(source).toContain("REJECT_CANDIDATE");
    }
  });

  it("does not leave the unused W4 server action available", () => {
    expect(() => readFileSync(join(root, "app", "dashboard", "applications", "actions.ts"))).toThrow();
  });
});
