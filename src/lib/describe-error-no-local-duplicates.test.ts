import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(path)) ? [path] : [];
  });
}

describe("describeError static boundary (REQ-700 / UI-ERR-D1)", () => {
  it("rejects page-local describeError definitions", () => {
    const repoRoot = resolve(import.meta.dirname, "../..");
    const roots = [resolve(repoRoot, "src/features"), resolve(repoRoot, "src/components")];
    const definition = /\b(?:function|const)\s+describeError\b/;
    const offenders = roots.flatMap((root) =>
      sourceFiles(root)
        .filter((path) => definition.test(readFileSync(path, "utf8")))
        .map((path) => relative(repoRoot, path)),
    );

    expect(offenders).toEqual([]);
  });
});
