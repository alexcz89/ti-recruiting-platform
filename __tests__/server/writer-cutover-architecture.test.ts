import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sources(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}

describe("writer creation-only flag boundary", () => {
  it("allows the writer flag only in its definition and creation selector", () => {
    const consumers = ["app", "lib", "components"].flatMap((dir) => sources(join(root, dir)))
      .filter((file) => /\b(?:isCanonicalHiringProcessEnabled|CANONICAL_HIRING_PROCESS_ENABLED)\b/.test(readFileSync(file, "utf8")))
      .map((file) => relative(root, file).replaceAll("\\", "/")).sort();
    expect(consumers).toEqual([
      "lib/hiring-process/create-application.ts",
      "lib/hiring-process/feature-flags.ts",
    ]);
  });

  it.each([
    "lib/hiring-process/application-intents.ts",
    "app/dashboard/overview/actions.ts",
  ])("routes persisted applications through compatibility in %s", (file) => {
    expect(read(file)).toContain("getApplicationWriterCompatibility(");
    expect(read(file)).not.toContain('from "./feature-flags"');
  });
});
