import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { queryKeys } from "./query-keys";

const SOURCE_ROOT = join(process.cwd(), "src");
const ALLOWED_LITERAL_FILES = new Set([
  "lib/query-keys.ts",
  "lib/query-keys-operation-logs.test.ts",
]);
const OPERATION_LOG_KEY_PATTERNS = [
  /\[\s*["']settings["']\s*,\s*["']logOperationTypes["']\s*\]/,
  /\[\s*["']settings["']\s*,\s*["']logs["']\s*,/,
  /\[\s*["']settings["']\s*,\s*["']integrity["']\s*,\s*["']latest-check["']\s*\]/,
];
const EXPECTED_FACTORY_CALLS = new Map([
  [
    "features/operation-logs/OperationLogsPage.tsx",
    ["queryKeys.operationLogs.types()", "queryKeys.operationLogs.list(effectiveSearch)"],
  ],
  [
    "features/integrity-check/IntegrityCheckPage.tsx",
    ["queryKeys.operationLogs.latestIntegrityCheck()"],
  ],
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

function literalOffenders(): string[] {
  return sourceFiles(SOURCE_ROOT)
    .map((path) => ({
      repoPath: relative(SOURCE_ROOT, path).split("\\").join("/"),
      source: readFileSync(path, "utf8"),
    }))
    .filter(({ repoPath, source }) => {
      if (ALLOWED_LITERAL_FILES.has(repoPath)) return false;
      return OPERATION_LOG_KEY_PATTERNS.some((pattern) => pattern.test(source));
    })
    .map(({ repoPath }) => repoPath);
}

function occurrenceCount(source: string, expected: string): number {
  return source.split(expected).length - 1;
}

describe("UI-11c/UI-13 operation log query key contract", () => {
  it("keeps the three operation log keys byte-for-byte compatible", () => {
    const search = {
      start_date: "2026-07-01",
      end_date: "2026-07-28",
      operation_type: "integrity_check",
      page: 3,
    };
    const expectedSearch = {
      start_date: "2026-07-01",
      end_date: "2026-07-28",
      operation_type: "integrity_check",
      page: 3,
    };
    const listKey = queryKeys.operationLogs.list(search);

    expect(queryKeys.operationLogs.types()).toEqual(["settings", "logOperationTypes"]);
    expect(listKey).toEqual(["settings", "logs", expectedSearch]);
    expect(listKey[2]).toBe(search);
    expect(search).toEqual(expectedSearch);
    expect(queryKeys.operationLogs.latestIntegrityCheck()).toEqual([
      "settings",
      "integrity",
      "latest-check",
    ]);
  });

  it("passes every list search argument through unchanged", () => {
    expect(queryKeys.operationLogs.list("")).toEqual(["settings", "logs", ""]);
    expect(queryKeys.operationLogs.list(undefined)).toEqual(["settings", "logs", undefined]);
  });

  it("rejects operation log key literals outside the explicit allowlist", () => {
    expect(literalOffenders()).toEqual([]);
  });

  it("keeps each page wired to its operation log factory", () => {
    for (const [repoPath, expectedCalls] of EXPECTED_FACTORY_CALLS) {
      const source = readFileSync(join(SOURCE_ROOT, repoPath), "utf8");
      for (const expectedCall of expectedCalls) {
        expect(
          occurrenceCount(source, expectedCall),
          `${repoPath} must contain exactly one ${expectedCall}`,
        ).toBe(1);
      }
    }
  });
});
