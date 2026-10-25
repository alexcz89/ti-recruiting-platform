import { afterEach, describe, expect, it, vi } from "vitest";
import { Judge0Service } from "@/lib/code-execution/judge0-service";
import { JUDGE0_LANGUAGE_IDS } from "@/lib/code-execution/languages";

afterEach(() => vi.unstubAllGlobals());

describe("Judge0 language-specific submissions (mocked transport, no generated code execution)", () => {
  it.each(Object.entries(JUDGE0_LANGUAGE_IDS))("preserves the source/stdin contract for %s", async (language, languageId) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "test-token" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: { id: 3 }, stdout: Buffer.from("3").toString("base64") })));
    vi.stubGlobal("fetch", fetchMock);
    const code = language === "sql" ? "SELECT SUM(n) FROM items;" : "candidate-program";
    const input = language === "sql"
      ? "CREATE TABLE items(n); INSERT INTO items VALUES (1),(2);"
      : ["javascript", "typescript"].includes(language)
        ? "console.log(JSON.stringify(solution(...[1,2])));"
        : "1 2\n";

    const result = await new Judge0Service().executeCode({
      code, language, testCases: [{ id: "test-a", input, expectedOutput: "3" }],
    });
    expect(result.success).toBe(true);
    const submission = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(submission.language_id).toBe(languageId);
    expect(submission.expected_output).toBe("3");
    if (language === "sql") {
      expect(submission.stdin).toBe("");
      expect(submission.source_code).toContain(input);
      expect(submission.source_code).toContain(code);
      expect(submission.source_code).toContain(".separator |");
    } else if (["javascript", "typescript"].includes(language)) {
      expect(submission.source_code).toBe(`${code}\n\n${input}`);
      expect(submission.stdin).toBe("");
    } else {
      expect(submission.source_code).toBe(code);
      expect(submission.stdin).toBe(input);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
