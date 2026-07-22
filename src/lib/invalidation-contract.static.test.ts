import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = join(process.cwd(), "src");
const ALLOWED_DIRECT_CALL_FILES = new Set([
  "features/backup-restore/BackupRestorePage.tsx",
  "features/stocktake/stocktake-error-invalidation.ts",
  "lib/invalidation-contract.ts",
]);

function sourceFiles(dir: string, includeTests = false): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path, includeTests);
    if (
      ![".ts", ".tsx"].includes(extname(entry.name)) ||
      (!includeTests && entry.name.includes(".test."))
    )
      return [];
    return [path];
  });
}

function directCallLocations(repoPath: string, source: string): string[] {
  const locations: string[] = [];
  const pattern = /invalidateQueries/g;
  for (let match = pattern.exec(source); match !== null; match = pattern.exec(source)) {
    const line = source.slice(0, match.index).split("\n").length;
    locations.push(`${repoPath}:${String(line)}`);
  }
  return locations;
}

function nonContractHelperCallLocations(repoPath: string, source: string): string[] {
  const calls = [...source.matchAll(/invalidateByContract\s*\(/g)];
  const contractCalls = [
    ...source.matchAll(
      /invalidateByContract\s*\(\s*queryClient\s*,\s*invalidationContract\.[A-Za-z][A-Za-z0-9]*\s*\(/g,
    ),
  ];
  if (calls.length === contractCalls.length) return [];
  return [
    `${repoPath}: helper calls=${String(calls.length)}, contract calls=${String(contractCalls.length)}`,
  ];
}

describe("UI-07 D-052-S1 invalidation SSOT routing", () => {
  it("rejects direct invalidateQueries calls outside explicit exceptions", () => {
    const violations = sourceFiles(SOURCE_ROOT).flatMap((path) => {
      const repoPath = relative(SOURCE_ROOT, path);
      if (ALLOWED_DIRECT_CALL_FILES.has(repoPath)) return [];
      return directCallLocations(repoPath, readFileSync(path, "utf8"));
    });

    expect(violations).toEqual([]);
  });

  it("rejects production helper calls whose key set does not come directly from the SSOT", () => {
    const violations = sourceFiles(SOURCE_ROOT).flatMap((path) => {
      const repoPath = relative(SOURCE_ROOT, path);
      if (repoPath === "lib/invalidation-contract.ts") return [];
      return nonContractHelperCallLocations(repoPath, readFileSync(path, "utf8"));
    });

    expect(violations).toEqual([]);
  });

  it("keeps page-test oracles isolated from the production contract", () => {
    const forbiddenImports = sourceFiles(SOURCE_ROOT, true).flatMap((path) => {
      const repoPath = relative(SOURCE_ROOT, path);
      const isOracleSource = repoPath === "test/invalidation-oracle.ts";
      if (
        (!repoPath.includes(".test.") && !isOracleSource) ||
        repoPath.startsWith("lib/invalidation-contract.")
      )
        return [];
      return /from\s+["'][^"']*invalidation-contract["']/.test(readFileSync(path, "utf8"))
        ? [repoPath]
        : [];
    });

    expect(forbiddenImports).toEqual([]);
  });
});
