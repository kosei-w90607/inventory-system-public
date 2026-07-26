import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DECIMAL_LIMIT_LITERAL_FIXTURE,
  LOCAL_LIMIT_LITERAL_FIXTURE,
  PLAIN_FILE_INPUT_FIXTURE,
} from "@/test/file-contract-static-fixtures";

const SOURCE_ROOT = join(process.cwd(), "src");
const ALLOWED_LITERAL_FILES = new Set([
  "components/FilePicker.tsx",
  "test/file-contract-static-fixtures.ts",
]);
const LOCAL_LIMIT_PATTERN = new RegExp(
  [`${String(20)}\\s*\\*\\s*${String(1024)}\\s*\\*\\s*${String(1024)}`, String(20_971_520)].join(
    "|",
  ),
);
const PLAIN_FILE_INPUT_PATTERN = /type\s*=\s*["']file["']/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

function offenders(pattern: RegExp): string[] {
  return sourceFiles(SOURCE_ROOT)
    .map((path) => ({
      repoPath: relative(SOURCE_ROOT, path).split("\\").join("/"),
      source: readFileSync(path, "utf8"),
    }))
    .filter(({ repoPath, source }) => {
      if (ALLOWED_LITERAL_FILES.has(repoPath)) return false;
      const sourceWithoutGeneratedConstant =
        repoPath === "lib/bindings.ts"
          ? source.replace(/^export const CSV_IMPORT_FILE_SIZE_LIMIT: number = [0-9_]+;\n?$/m, "")
          : source;
      return pattern.test(sourceWithoutGeneratedConstant);
    })
    .map(({ repoPath }) => repoPath);
}

describe("file contract static boundary (D-054)", () => {
  it("REQ-104/REQ-401: frontend local 20MB literal の再導入を拒否する", () => {
    expect(LOCAL_LIMIT_PATTERN.test(LOCAL_LIMIT_LITERAL_FIXTURE)).toBe(true);
    expect(LOCAL_LIMIT_PATTERN.test(DECIMAL_LIMIT_LITERAL_FIXTURE)).toBe(true);
    expect(
      readFileSync(join(SOURCE_ROOT, "lib/bindings.ts"), "utf8").match(
        /^export const CSV_IMPORT_FILE_SIZE_LIMIT: number = [0-9_]+;$/gm,
      ),
    ).toHaveLength(1);
    expect(offenders(LOCAL_LIMIT_PATTERN)).toEqual([]);
  });

  it("REQ-104/REQ-401/REQ-202: 共通 FilePicker 外の plain file input を拒否する", () => {
    expect(PLAIN_FILE_INPUT_PATTERN.test(PLAIN_FILE_INPUT_FIXTURE)).toBe(true);
    expect(offenders(PLAIN_FILE_INPUT_PATTERN)).toEqual([]);
  });
});
