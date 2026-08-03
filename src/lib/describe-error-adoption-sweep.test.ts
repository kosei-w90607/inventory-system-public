// src/lib/describe-error-adoption-sweep.test.ts
//
// UI-ERR-D1 / UI-ERR-D2（UI_TECH_STACK §6.4）の再導入防止 sweep。
// 設計: docs/plans/2026-08-04-describe-error-adoption.md Scope / AC1
//
// production file（src/features・src/components・src/lib/hooks、*.test.* 除外）を静的走査し、
// CmdError / InvokeError の raw message を describeError 非経由で利用者向けに表示する
// パターンが再導入されていないことを 0 件 assert する。
//
// 空集合 oracle 対策（empty-set-oracle-collision の教訓）: production scan は 0 件期待だが、
// 同じ検出関数に対する synthetic 違反 fixture の positive case を必ず併記し、
// 検出ロジックそのものの感度を独立に保証する。

import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

// 明示除外（packet Scope の理由付き個別列挙。pattern 単位の自動除外は行わない）:
// - RouteErrorFallback.tsx: render 例外の最終防衛層。UI-EB-D3 により対象外
//   （折り畳み「技術詳細」節の error.message は契約どおり）
// - BackupRestorePage.tsx: restore_* 表示所有権は 68 §68.7。describeError 不使用が契約
// - IntegrityCheckPage.tsx: 既に describeError 経由で message 生成済み（対応済み）
// - ThresholdSettingsPage.tsx: issue.message は Zod validation issue で CmdError と無関係
// - useCsvImportFlow.ts / useDailyReportImportFlow.ts / useProductImportFlow.ts:
//   ensureInvokeError() は表示コードではなく InvokeError 正規化 infra
const ALLOWLIST = new Set<string>([
  "src/components/patterns/RouteErrorFallback.tsx",
  "src/features/backup-restore/BackupRestorePage.tsx",
  "src/features/integrity-check/IntegrityCheckPage.tsx",
  "src/features/threshold-settings/ThresholdSettingsPage.tsx",
  "src/features/csv-import/hooks/useCsvImportFlow.ts",
  "src/features/daily-report-import/hooks/useDailyReportImportFlow.ts",
  "src/features/products/import/useProductImportFlow.ts",
]);

interface ViolationPattern {
  name: string;
  // `=== "validation"` 等の control-flow guard（表示ではない）を誤検出しないよう、
  // 直後に `===` が続く出現は除外する。
  regex: RegExp;
}

const VIOLATION_PATTERNS: ViolationPattern[] = [
  {
    name: "cmdError.message direct display (UI-ERR-D1 bypass)",
    regex: /\bcmdError\.message\b(?!\s*===)/,
  },
  {
    name: "raw error.message direct display (UI-ERR-D2 bypass)",
    regex: /\berror\.message\b(?!\s*===)/,
  },
];

interface Violation {
  pattern: string;
  line: number;
  text: string;
}

function findViolations(content: string): Violation[] {
  const lines = content.split("\n");
  const violations: Violation[] = [];
  lines.forEach((line, index) => {
    for (const pattern of VIOLATION_PATTERNS) {
      if (pattern.regex.test(line)) {
        violations.push({ pattern: pattern.name, line: index + 1, text: line.trim() });
      }
    }
  });
  return violations;
}

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (![".ts", ".tsx"].includes(extname(path))) return [];
    if (path.includes(".test.")) return [];
    return [path];
  });
}

function toPosixRelative(repoRoot: string, path: string): string {
  return relative(repoRoot, path).split(sep).join("/");
}

describe("describeError adoption sweep (UI-ERR-D1 / UI-ERR-D2)", () => {
  it("finds zero raw CmdError/InvokeError message display bypasses in production UI code", () => {
    const repoRoot = resolve(import.meta.dirname, "../..");
    const roots = ["src/features", "src/components", "src/lib/hooks"].map((dir) =>
      resolve(repoRoot, dir),
    );

    const offenders = roots.flatMap((root) =>
      sourceFiles(root).flatMap((path) => {
        const relPath = toPosixRelative(repoRoot, path);
        if (ALLOWLIST.has(relPath)) return [];
        const content = readFileSync(path, "utf8");
        return findViolations(content).map(
          (violation) => `${relPath}:${String(violation.line)} [${violation.pattern}] ${violation.text}`,
        );
      }),
    );

    expect(offenders).toEqual([]);
  });

  it("detects a synthetic violation fixture (sweep sensitivity guard, empty-set-oracle-collision)", () => {
    // 実 file には書き込まない synthetic 文字列。production scan が 0 件を返す実装であっても
    // 検出ロジックそのものが常に空を返す退化（sweep の骨抜き）を独立に検知する。
    const syntheticCmdErrorBypass = [
      "function onError(error: unknown) {",
      "  const cmdError = isInvokeError(error) ? error.cmdError : toCmdError(error);",
      "  setSaveError(cmdError.message);",
      "}",
    ].join("\n");
    const syntheticRawErrorBypass = [
      "function Component() {",
      '  return <span>{query.error.message}</span>;',
      "}",
    ].join("\n");
    // validation guard（control-flow、表示ではない）は誤検出しないことも併記する。
    const validationGuardOnly = [
      'if (error instanceof Error && error.message === "validation") return;',
    ].join("\n");

    const cmdErrorViolations = findViolations(syntheticCmdErrorBypass);
    const rawErrorViolations = findViolations(syntheticRawErrorBypass);
    const guardViolations = findViolations(validationGuardOnly);

    expect(cmdErrorViolations.length).toBeGreaterThan(0);
    expect(cmdErrorViolations.some((v) => v.pattern.includes("cmdError"))).toBe(true);
    expect(rawErrorViolations.length).toBeGreaterThan(0);
    expect(rawErrorViolations.some((v) => v.pattern.includes("UI-ERR-D2"))).toBe(true);
    expect(guardViolations).toEqual([]);
  });
});
