import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const TARGET_WRAPPERS = [
  "src/components/ui/dropdown-menu.tsx",
  "src/components/ui/form.tsx",
  "src/components/ui/radio-group.tsx",
] as const;
const RETIRED_DIRECT_DEPENDENCIES = ["@hookform/resolvers", "react-hook-form"] as const;
const ACTIVE_DIRECT_DEPENDENCIES = ["radix-ui", "zod"] as const;

const EXPECTED_ADOPTION_ROW =
  "| フォーム | feature-local controlled state + Zod | 19 + 4 | 小さな業務フォームの状態を局所化し、必要な箇所だけschema検証 | §2.7 |";
const EXPECTED_COMPONENT_EXAMPLES =
  "**主要な共通コンポーネント例**（実体正本 = `src/components/ui/`）:\n" +
  "`Button` `Input` `Label` `Dialog` `AlertDialog` `Select` `Checkbox` `Tabs` `Card` `Table`（TanStack Table ラップ）`Toast`（Sonner）`Badge` `Skeleton` `Separator` `ScrollArea`";
const EXPECTED_UI_FORM_DECISION =
  "**UI-FORM-D1（現行採用境界）**:\n\n" +
  "- 業務フォームは各feature内の `useState` と field error record で状態・表示を局所管理する。\n" +
  "- 複数fieldの相関、数値範囲、設定値などschema検証が有効な箇所では Zod 4 を併用する。schemaは利用するfeature配下に置き、CMD DTOとの概念整合を保つ。\n" +
  "- React Hook Form と shadcn/ui `Form` wrapper は現行repoでは採用しない。DropdownMenu / RadioGroup wrapperもproduction consumerがないため標準部品として残さない。\n" +
  "- 複雑な動的反復fieldや再レンダ問題が実測された場合だけ、対象画面のDesign Phaseでフォームlibrary導入を再評価する。将来候補を先にdependency/wrapperとして常設しない。";

interface PackageManifest {
  dependencies?: Record<string, string>;
}

interface PackageLock {
  packages?: Record<string, PackageManifest>;
}

function readManifest(): PackageManifest {
  return JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as PackageManifest;
}

function readLockfile(): PackageLock {
  return JSON.parse(readFileSync(join(REPO_ROOT, "package-lock.json"), "utf8")) as PackageLock;
}

describe("UI-11a UI-FORM-D1 dependency contract", () => {
  it("keeps each unused UI wrapper retired", () => {
    for (const repoPath of TARGET_WRAPPERS) {
      expect(existsSync(join(REPO_ROOT, repoPath)), repoPath).toBe(false);
    }
  });

  it("keeps retired dependencies out of the manifest root", () => {
    const manifest = readManifest();

    for (const dependency of RETIRED_DIRECT_DEPENDENCIES) {
      expect(manifest.dependencies, dependency).not.toHaveProperty(dependency);
    }
  });

  it("keeps retired dependencies out of the lockfile root", () => {
    const lockfile = readLockfile();
    const rootDependencies = lockfile.packages?.[""]?.dependencies;

    for (const dependency of RETIRED_DIRECT_DEPENDENCIES) {
      expect(rootDependencies, dependency).not.toHaveProperty(dependency);
    }
  });

  it("preserves active Zod and radix-ui direct dependencies", () => {
    const manifest = readManifest();

    for (const dependency of ACTIVE_DIRECT_DEPENDENCIES) {
      expect(manifest.dependencies, dependency).toHaveProperty(dependency);
    }
  });

  it("keeps every UI-FORM-D1 source-document surface synchronized", () => {
    const source = readFileSync(join(REPO_ROOT, "docs/UI_TECH_STACK.md"), "utf8");

    expect(source).toContain(EXPECTED_ADOPTION_ROW);
    expect(source).toContain(EXPECTED_COMPONENT_EXAMPLES);
    expect(source).toContain(EXPECTED_UI_FORM_DECISION);
  });
});
