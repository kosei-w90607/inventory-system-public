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

// file 粒度の明示除外は、file 全体が describeError 対象外という契約を持つ場合にのみ正当化される。
// 該当するのは RouteErrorFallback.tsx（render 例外の最終防衛層。UI-EB-D3 により対象外。
// 折り畳み「技術詳細」節の error.message は契約どおり）のみ。
// BackupRestorePage / IntegrityCheckPage / ThresholdSettingsPage は現行実装で violation
// pattern に 0 hit のため file 免除は不要（Codex Final Review F1: file 全体免除は
// allowlisted file 内の real regression を隠す — IntegrityCheckPage への raw query error 表示
// 注入が sweep green のまま survive した実証を受けた是正）。
const ALLOWLIST = new Set<string>(["src/components/patterns/RouteErrorFallback.tsx"]);

// 行単位の除外（file 全体免除ではなく、正規化 idiom の行の形のみを除外する）。
// useCsvImportFlow.ts / useDailyReportImportFlow.ts / useProductImportFlow.ts の
// ensureInvokeError() が Error → InvokeError 正規化のため message を抽出する行
// （`message: error instanceof Error ? error.message : String(error),`）は表示コードではない。
//
// path を限定しない pattern 単独除外は、正規化 idiom と同じ行の形を「利用者表示」として
// 他 file（例: DisposalPage.tsx）に置いた場合も隠してしまう（Codex closure round survivor:
// DisposalPage の表示を idiom 形へ書き換えても sweep が green のまま survive した実証）。
// (path, pattern) の組に限定し、対象 3 flow hook 以外では idiom と同形の行も違反として
// 検出させる。
const NORMALIZATION_IDIOM = /error instanceof Error \? error\.message : String\(error\)/;

interface LineExclusion {
  path: string;
  pattern: RegExp;
}

const LINE_EXCLUSIONS: LineExclusion[] = [
  { path: "src/features/csv-import/hooks/useCsvImportFlow.ts", pattern: NORMALIZATION_IDIOM },
  {
    path: "src/features/daily-report-import/hooks/useDailyReportImportFlow.ts",
    pattern: NORMALIZATION_IDIOM,
  },
  { path: "src/features/products/import/useProductImportFlow.ts", pattern: NORMALIZATION_IDIOM },
];

function isExcludedLine(relPath: string, line: string): boolean {
  return LINE_EXCLUSIONS.some(
    (exclusion) => exclusion.path === relPath && exclusion.pattern.test(line),
  );
}

interface ViolationPattern {
  name: string;
  // `=== "validation"` 等の control-flow guard（表示ではない）を誤検出しないよう、
  // 直後に `===` が続く出現は除外する。
  regex: RegExp;
}

const VIOLATION_PATTERNS: ViolationPattern[] = [
  {
    name: "cmdError.message direct display (UI-ERR-D1 bypass)",
    // `?.`（optional chaining）変種（`cmdError?.message` 等）も検出する。
    regex: /\bcmdError\??\.message\b(?!\s*===)/,
  },
  {
    name: "raw error.message direct display (UI-ERR-D2 bypass)",
    // `?.`（optional chaining）変種（`error?.message` / `query.error?.message` 等）も検出する。
    regex: /\berror\??\.message\b(?!\s*===)/,
  },
];

interface Violation {
  pattern: string;
  line: number;
  text: string;
}

// relPath は呼び出し側が必ず明示する（既定値なし）。synthetic case も「どの path を
// 模した content か」を書き手に意識させ、除外がうっかり全 path に効くことを防ぐ。
function findViolations(content: string, relPath: string): Violation[] {
  const lines = content.split("\n");
  const violations: Violation[] = [];
  lines.forEach((line, index) => {
    if (isExcludedLine(relPath, line)) return;
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

describe("describeError adoption sweep (REQ-700 / UI-ERR-D1 / UI-ERR-D2)", () => {
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
        return findViolations(content, relPath).map(
          (violation) =>
            `${relPath}:${String(violation.line)} [${violation.pattern}] ${violation.text}`,
        );
      }),
    );

    expect(offenders).toEqual([]);
  });

  // Codex Final Review F1（P2、2026-08-04）: file 粒度 ALLOWLIST 7 entry は広すぎ、
  // allowlisted file 内の real regression（IntegrityCheckPage.tsx への raw query error
  // 表示注入）を隠す survivor が実証された。ALLOWLIST / LINE_EXCLUSIONS の内容を
  // 固定 assert し、Matrix X6（ALLOWLIST への不正追加）を review 検分依存から自動 red 化へ格上げ。
  it("keeps the file-level ALLOWLIST and (path, pattern) line-exclusions pinned to their justified minimum", () => {
    expect(Array.from(ALLOWLIST)).toEqual(["src/components/patterns/RouteErrorFallback.tsx"]);
    expect(
      LINE_EXCLUSIONS.map((exclusion) => ({ ...exclusion, pattern: exclusion.pattern.source })),
    ).toEqual([
      {
        path: "src/features/csv-import/hooks/useCsvImportFlow.ts",
        pattern: NORMALIZATION_IDIOM.source,
      },
      {
        path: "src/features/daily-report-import/hooks/useDailyReportImportFlow.ts",
        pattern: NORMALIZATION_IDIOM.source,
      },
      {
        path: "src/features/products/import/useProductImportFlow.ts",
        pattern: NORMALIZATION_IDIOM.source,
      },
    ]);
  });

  // Codex Final Review F1（P2、2026-08-04）: file 粒度 ALLOWLIST に IntegrityCheckPage.tsx を
  // 含めていた旧設計では、この path の実 file に raw query error 表示を注入しても sweep が
  // green のまま survive した（cross-vendor Final Review 実証）。当該 path を file 免除から
  // 除去した後も、その path を模した content に raw message 表示があれば検出されることを
  // 恒久 test 化する（実 file は書き換えない、content 検出ロジックの独立検証）。
  it("detects a raw query error display shaped like the removed IntegrityCheckPage.tsx allowlist entry (Codex survivor regression)", () => {
    const syntheticFormerAllowlistedPathBypass = [
      "// synthetic content modeled on the former file-level ALLOWLIST entry",
      "// src/features/integrity-check/IntegrityCheckPage.tsx",
      "function IntegrityCheckPage() {",
      "  const latestCheckQuery = useQuery(queryOptions);",
      "  return latestCheckQuery.isError ? <p>{latestCheckQuery.error.message}</p> : null;",
      "}",
    ].join("\n");

    const violations = findViolations(
      syntheticFormerAllowlistedPathBypass,
      "src/features/integrity-check/IntegrityCheckPage.tsx",
    );

    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.pattern.includes("UI-ERR-D2"))).toBe(true);
  });

  // Codex closure round survivor（2026-08-04）: path を限定しない pattern 単独除外では、
  // DisposalPage.tsx（flow hook ではない = LINE_EXCLUSIONS 対象外）の利用者表示を
  // 正規化 idiom と同じ行の形へ書き換えても sweep が検出できなかった。(path, pattern) 限定後は
  // 対象 3 flow hook 以外の path では idiom と同形の行も違反として検出されることを確認する。
  it("detects the normalization idiom shape as a violation on a non-exempted path (DisposalPage.tsx, Codex closure round survivor)", () => {
    const syntheticDisposalPageIdiomShapedBypass = [
      "// synthetic content modeled on src/features/disposal/DisposalPage.tsx (not a flow hook)",
      "onError: (error) => {",
      "  setSaveError(error instanceof Error ? error.message : String(error));",
      "},",
    ].join("\n");

    const violations = findViolations(
      syntheticDisposalPageIdiomShapedBypass,
      "src/features/disposal/DisposalPage.tsx",
    );

    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.pattern.includes("UI-ERR-D2"))).toBe(true);
  });

  // F1 是正で file 粒度免除から行単位除外へ切替えたため、ensureInvokeError() 正規化 idiom の
  // 行のみが除外され、同じ「file」内の他の real violation は隠されないことを確認する
  // （行単位除外が file 免除へ退化していないことの検証）。
  it("excludes only the ensureInvokeError normalization idiom line, not the whole file", () => {
    const syntheticFlowHookShapedContent = [
      "function ensureInvokeError(error: unknown, cmd: string): InvokeError {",
      "  if (isInvokeError(error)) return error;",
      "  return new InvokeError(",
      "    {",
      '      kind: "internal",',
      "      message: error instanceof Error ? error.message : String(error),",
      "      field: null,",
      "      error_id: null,",
      "    },",
      '    { source: "commands", cmd },',
      "  );",
      "}",
      "function onError(error: unknown) {",
      "  const cmdError = isInvokeError(error) ? error.cmdError : toCmdError(error);",
      "  setSaveError(cmdError.message);",
      "}",
    ].join("\n");

    const violations = findViolations(
      syntheticFlowHookShapedContent,
      "src/features/csv-import/hooks/useCsvImportFlow.ts",
    );

    expect(violations.length).toBe(1);
    expect(violations[0]?.pattern).toContain("cmdError");
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
      "  return <span>{query.error.message}</span>;",
      "}",
    ].join("\n");
    // optional chaining 変種（`?.`）。word boundary が `?.` token で切れて素通しする gap の
    // 独立 verifier 実測（2026-08-04 追加是正）に対する positive case。既存 case の改変ではなく
    // 新規 case として追加する（empty-set-oracle-collision の教訓）。
    const syntheticOptionalChainingBypass = [
      "function Component() {",
      "  return <span>{query.error?.message}</span>;",
      "}",
      "function onError(error: unknown) {",
      "  const cmdError = isInvokeError(error) ? error.cmdError : toCmdError(error);",
      "  setSaveError(cmdError?.message);",
      "}",
    ].join("\n");
    // validation guard（control-flow、表示ではない）は誤検出しないことも併記する。
    const validationGuardOnly = [
      'if (error instanceof Error && error.message === "validation") return;',
    ].join("\n");

    // どの LINE_EXCLUSIONS / ALLOWLIST にも該当しない generic path。除外設定の有無に
    // 依存せず検出ロジック自体の感度を検証する。
    const genericPath = "src/features/synthetic/SyntheticPage.tsx";
    const cmdErrorViolations = findViolations(syntheticCmdErrorBypass, genericPath);
    const rawErrorViolations = findViolations(syntheticRawErrorBypass, genericPath);
    const optionalChainingViolations = findViolations(syntheticOptionalChainingBypass, genericPath);
    const guardViolations = findViolations(validationGuardOnly, genericPath);

    expect(cmdErrorViolations.length).toBeGreaterThan(0);
    expect(cmdErrorViolations.some((v) => v.pattern.includes("cmdError"))).toBe(true);
    expect(rawErrorViolations.length).toBeGreaterThan(0);
    expect(rawErrorViolations.some((v) => v.pattern.includes("UI-ERR-D2"))).toBe(true);
    expect(optionalChainingViolations.some((v) => v.pattern.includes("UI-ERR-D2"))).toBe(true);
    expect(optionalChainingViolations.some((v) => v.pattern.includes("cmdError"))).toBe(true);
    expect(guardViolations).toEqual([]);
  });
});
