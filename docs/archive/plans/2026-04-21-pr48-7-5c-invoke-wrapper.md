> **Archived**: 2026-04-21 / PR #48 マージ完了（merge commit `c5f3786`、squash）
>
> 元プラン置き場: `~/.claude/plans/7-5c-dynamic-walrus.md`
>
> 実装時の差分（末尾に追記）:
>
> - `src/lib/invoke.ts`: `InvokeError` Error 派生クラスを導入（eslint `only-throw-error` が plain object throw を禁止するため）+ `unwrapResult` helper の InvokeError throw ロジック
> - `src/lib/invoke.ts`: `toCmdError(err, ctx)` の第 2 引数 `ctx` を削除（未使用で `noUnusedParameters` に抵触）
> - `.github/workflows/ci.yml`: frontend job に `ripgrep` install step を追加（count script 用、ubuntu-latest に rg なし）
> - `.github/workflows/ci.yml` + `.gitignore` + `src/lib/bindings.ts`: **CI fix (commit `126e6fb`)** 初回 CI で frontend job が bindings.ts 未存在で fail → ADR-002 運用更新で vendor-in 化（`.gitignore` 除外 + commit + rust job に `cargo run --bin generate_bindings && git diff --exit-code` drift check 追加）
> - **Codex Round 1 対応**:
>   - `017ea1f` P2-1: `isCmdError` から `instanceof InvokeError` 分岐を削除、`!(err instanceof Error)` ガードで全 Error サブクラスを弾く純粋形状判定に変更。routes/index.tsx は `toCmdError` 一律正規化パターンに整理
>   - `51585dc` P2-2: eslint 境界ルールを deny-by-default (`src/**/*.{ts,tsx}`) + `src/features/**`/`src/routes/**` のみ allow 化。コメント文面も実装に一致させた
>   - `73044da` P3: `check-typedinvoke-count.sh` に baseline 非負整数バリデーション追加
> - **Codex Round 2**: P1/P2/P3/P4 全 0、マージ可能判定
>
> ---

# Plan: 7-5c 実装（invoke ラッパ C 案 + QueryClient + 件数監視 CI + eslint 境界ルール）

## Context

Phase B-1（フロント CI 品質基盤）が PR #44/#45/#46/#47 の 4 本で 2026-04-20 にクローズ済（origin/main HEAD = `e29668b`）。次は第7段階 Phase 1 Task 7-5c で、Phase 2 UI-00 着手の前提となる **invoke ラッパ + QueryClient + 撤去期限付き fallback 運用基盤** を組む。

- 設計根拠: [ADR-004](../../research/2026-04-20-invoke-wrapper-adr.md) — C 案（薄ラッパ `src/lib/invoke.ts` + 期限付き fallback `src/lib/invoke-fallback.ts`）
- 親プラン: `/home/kosei/.claude/plans/1-plans-md-swirling-avalanche.md` Step B（16 項目セルフレビュー反映済）
- 撤去期限: `v0.8.0-ui-daily` タグ gate（`FallbackCommand` union 空化 + fallback ファイル削除 + count script/baseline/eslint 境界ルール撤去）
- Plans.md L81 の着手前チェック `bash scripts/check-phase1-probe-removed.sh` は現状 **exit 1**（greet 残存）

### 前提検証結果（本プラン作成時に確認）

| 項目 | 状態 |
|------|------|
| origin/main HEAD | `e29668b` (PR #47 merged) ✅ 同期済 |
| branch 状態 | `main`, clean working tree — 新ブランチ `feat/ui-7-5c-invoke-query` を切る |
| probe script | exit 1 — greet 残存箇所 3 ファイル確認済 |
| greet 実体 | `src-tauri/src/lib.rs` のみ（Rust tests なし）, `src/routes/index.tsx`, `src/App.css` |
| path alias `@/*` | `tsconfig.json` L23-27 + `vite.config.ts` L13-17 両方設定済 ✅ |
| `src/lib/bindings.ts` | 実在（113行）、`.gitignore` 対象だが debug build で生成される |
| `src/lib/index.ts` | **存在しない**（barrel なし）→ 境界ルールは予防的保険 |
| `@tanstack/react-query` | `^5.99.2` 導入済 → devtools 同メジャーで追加 |
| `eslint.config.js` | flat config、`prettier` の手前に block 追加 |
| `.github/workflows/ci.yml` | frontend job: typecheck → lint → format:check → build → audit。lint 直後に count step 挿入 |
| `scripts/pre-push.sh` | 現状 Rust + docs のみ。frontend 系 hook なし → typedInvoke count は新規独立 section で追加 |
| `.claude/state/skills-decision.json` | 存在 ✅ LSP/Skills Policy 適用可 |

### ⚠️ 親プランから修正が必要な 2 点（bindings.ts 実体確認で判明）

1. **`commands.searchProducts(query)` は Result 型を返す（throw しない）**
   - 実シグネチャ: `(query: ProductSearchQuery) => Promise<{ status: "ok"; data: PaginatedResult<ProductWithRelations> } | { status: "error"; error: CmdError }>`
   - bindings.ts L105-112 の `typedError` wrapper で `catch (e)` 内の非 Error 値は `{ status: "error", error: e }` に変換、Error 値は再 throw
   - 親プラン B-3-1 の `toCmdError` + try/catch だけでは `{ status: "error" }` 経路を拾えない → **`unwrapResult` helper 追加**が必要
2. **`ProductSearchQuery` shape**
   - 正: `{ keyword, department_id, is_discontinued, sort_key, sort_order, page, per_page }`
   - 親プラン B-6 仮コードの `query / include_discontinued / limit / offset` は **誤り** → B-6 差し替え時に正確な shape で書く

---

## 実行制約

- **マージ / force push / main 直 push は実施しない**（PR 作成までで停止、マージは user 判断）
- **hook を `--no-verify` で bypass しない**（lefthook pre-commit / pre-push 失敗は原因修正）
- **destructive 操作は user 確認**（本プランでは該当なし）
- **LSP/Skills Policy 遵守**: `src-tauri/**/*.rs`, `src/**/*.{ts,tsx}` 編集前に LSP diagnostics / references 確認 + `.claude/state/skills-decision.json` 更新

---

## Step 1. ブランチ作成 + 着手前チェック

```bash
git switch -c feat/ui-7-5c-invoke-query
bash scripts/check-phase1-probe-removed.sh   # 現状 exit 1
rg -n '\bgreet\b' src-tauri/src src          # 削除対象の全量確認
rg -n 'greet' src-tauri/tests 2>/dev/null || true  # テスト存在確認
```

---

## Step 2. greet toy command 削除（B-2）

### 編集対象

| ファイル | 削除内容 |
|---------|---------|
| `src-tauri/src/lib.rs` | L55-63（`fn greet` 関数 + doc comment）/ L136（`invoke_handler` 列の `greet,`）/ L133-135 コメント「Phase 1 IPC 疎通確認（Phase 2 UI-00 実装時に削除）」も削除 |
| `src/routes/index.tsx` | 全体を Step 7（β案差し替え）で置換するので Step 2 では触らない |
| `src/App.css` | L94-96 `#greet-input` block 削除（`rg '#greet' src` で他参照なきこと確認） |

### specta `collect_commands!` への影響

`src-tauri/src/lib.rs` L34-37 の `collect_commands!` は `search_products` / `get_product` のみ。greet は登録されていないので bindings.ts 再生成への影響なし。

### テスト件数への影響

greet 関連テストは `src-tauri/src` / `src-tauri/tests` いずれにも存在しない（Grep 確認済）→ Plans.md L185 Test Count テーブル更新不要。

### 検証

```bash
bash scripts/check-phase1-probe-removed.sh   # exit 0 ✅
cd src-tauri && cargo check                   # greet 削除でコンパイル影響なし確認
```

コミット: `feat(ui): remove Phase 1 toy greet command`

---

## Step 3. `src/lib/invoke.ts` 新設（B-3-1、bindings.ts Result 対応版）

### ファイル内容

```ts
// src/lib/invoke.ts
//
// tauri-specta 経路（src/lib/bindings.ts の commands.*）向けエラー helper。
// ADR-004 §2.1。fallback 経路は src/lib/invoke-fallback.ts を参照。

import type { CmdError } from "./bindings";

export const CMD_ERROR_KIND = {
  VALIDATION: "validation",
  NOT_FOUND: "not_found",
  DUPLICATE: "duplicate",
  INTERNAL: "internal",
  IMPORT_ERROR: "import_error",
  IDEMPOTENCY_CONFLICT: "idempotency_conflict",
  STOCKTAKE_IN_PROGRESS: "stocktake_in_progress",
  STOCKTAKE_NOT_IN_PROGRESS: "stocktake_not_in_progress",
} as const;

export type CmdErrorKind = (typeof CMD_ERROR_KIND)[keyof typeof CMD_ERROR_KIND];

export type InvokeSource = "commands" | "fallback";

export interface InvokeErrorContext {
  source: InvokeSource;
  cmd: string;
}

export function isCmdError(err: unknown): err is CmdError {
  return (
    typeof err === "object" &&
    err !== null &&
    "kind" in err &&
    typeof (err as { kind: unknown }).kind === "string" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  );
}

export function toCmdError(err: unknown, ctx: InvokeErrorContext): CmdError {
  if (isCmdError(err)) return err;
  return {
    kind: CMD_ERROR_KIND.INTERNAL,
    message: err instanceof Error ? err.message : String(err),
    field: null,
  };
}

/**
 * tauri-specta の typedError wrapper が返す Result 型を unwrap する。
 *
 * bindings.ts の commands.xxx(...) は `{ status: "ok", data: T } | { status: "error", error: E }`
 * 形式（tauri-specta v2 の typedError ランタイム）。このヘルパで ok 時は data を返し、
 * error 時は CmdError として throw する。
 *
 * 併せて wrapper 経由で再 throw された Error（Rust panic 等）は catch で CmdError に正規化する。
 */
export async function unwrapResult<T>(
  resultPromise: Promise<{ status: "ok"; data: T } | { status: "error"; error: CmdError }>,
  ctx: InvokeErrorContext,
): Promise<T> {
  let result: { status: "ok"; data: T } | { status: "error"; error: CmdError };
  try {
    result = await resultPromise;
  } catch (e) {
    throw toCmdError(e, ctx);
  }
  if (result.status === "error") {
    throw toCmdError(result.error, ctx);
  }
  return result.data;
}
```

### 呼び出し側パターン（Step 7 で使う）

```ts
import { commands } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";

const data = await unwrapResult(commands.searchProducts(query), {
  source: "commands",
  cmd: "search_products",
});
```

コミット: `feat(ui): add invoke error helpers (src/lib/invoke.ts)`

---

## Step 4. `src/lib/invoke-fallback.ts` 新設（B-3-2）

### ファイル内容

```ts
// src/lib/invoke-fallback.ts
//
// DEPRECATED: Phase 2 完了（v0.8.0-ui-daily タグ）までに撤去する。
// このファイルは specta 未対応 commands の一時経路であり、
// FallbackCommand union が空になった時点でファイル毎削除する。
//
// 新 command 呼び出し時の判断:
// 1. src/lib/bindings.ts の commands.* に存在するか？
//    → YES: 直接 commands.xxx(...) を使う（fallback 禁止）
//    → NO: 2 へ
// 2. そもそも specta 対応すべきか？（新規 command は原則 YES）
//    → YES: Rust 側で #[specta::specta] + collect_commands! 追加 → bindings 再生成
//    → NO（外部 API 等、例外的ケース）: 下の FallbackCommand union に追加
//
// 参照: Plans.md Backlog「typedInvoke 段階撤去」「specta 化対象 commands 段階化リスト」
// ADR-004 §2.2 §2.3

import { invoke } from "@tauri-apps/api/core";
import { toCmdError } from "./invoke";

/**
 * specta 未対応 commands の literal union。
 * Phase 2 で typedInvoke を実際に呼ぶタイミングで必要な command を追加する。
 * この union が空 `never` に戻った時点で typedInvoke + 本ファイル撤去。
 *
 * 初期値は `never` — 7-5c 時点では routes/index.tsx が commands.* のみ使うため
 * typedInvoke 呼び出しゼロ、union も空。Phase 2 UI-00 着手時に初めて該当 command を追加。
 */
export type FallbackCommand = never;
// 例: Phase 2 UI-00 着手時に以下の形で拡張する
//   export type FallbackCommand =
//     | "get_daily_sales"
//     | "list_plu_dirty";

export async function typedInvoke<T>(
  cmd: FallbackCommand,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    throw toCmdError(err, { source: "fallback", cmd });
  }
}
```

### 初期 union = `never` の意図

- 7-5c 時点で `typedInvoke(...)` を呼ぶコードはコンパイル不可 → Step 5 の count baseline=0 と整合
- Phase 2 で実際に呼ぶ command を union に追加する PR で baseline も同 PR 内で bump up
- union 自体が撤去リスト → typo 検知 + 撤去進捗可視化を 1 機構で両取り（ADR-004 §2.3 ガード 3）

コミット: `feat(ui): add typedInvoke fallback with FallbackCommand union`

---

## Step 5. 件数監視 CI（B-4、ADR-004 §2.3 ガード 2）

### Step 5-1. `scripts/check-typedinvoke-count.sh` 新設

```bash
#!/bin/bash
# typedInvoke 呼び出し件数を baseline と比較し、増減で exit 1
# 出典: 7-5c 実装（ADR-004 §2.3 ガード 2）の撤去期限担保
#
# 監視対象: src/ 配下の *.ts / *.tsx（invoke-fallback.ts 自体 / test / stories 除外）
# baseline: scripts/typedinvoke-baseline.txt（初期 0）
# 増減両方で fail: silent 乖離防止（減少時は baseline bump down commit を同 PR に含める）
#
# set -e を使わない: rg が 0 件で exit 1 を返すため、明示的条件分岐で exit code 制御
# （既存 check-phase1-probe-removed.sh と同方針）

if ! command -v rg >/dev/null 2>&1; then
  echo "❌ rg (ripgrep) が見つかりません" >&2
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
  echo "❌ git 管理下で実行してください" >&2
  exit 2
fi

BASELINE_FILE="$REPO_ROOT/scripts/typedinvoke-baseline.txt"
if [ ! -f "$BASELINE_FILE" ]; then
  echo "❌ $BASELINE_FILE が存在しません" >&2
  exit 2
fi

RG_OUTPUT=$(rg --count-matches 'typedInvoke\(' "$REPO_ROOT/src" \
  --glob '!src/lib/invoke-fallback.ts' \
  --glob '!**/*.test.ts' \
  --glob '!**/*.test.tsx' \
  --glob '!**/*.stories.ts' \
  --glob '!**/*.stories.tsx' \
  --type ts || true)

COUNT=$(printf '%s\n' "$RG_OUTPUT" | awk -F: '{sum+=$2} END {print sum+0}')
BASELINE=$(tr -d '[:space:]' < "$BASELINE_FILE")

echo "typedInvoke 呼び出し件数: $COUNT (baseline: $BASELINE)"

if [ "$COUNT" -gt "$BASELINE" ]; then
  echo "❌ typedInvoke 件数が baseline を超過。specta 化するか baseline bump と理由を PR に記載" >&2
  exit 1
fi

if [ "$COUNT" -lt "$BASELINE" ]; then
  echo "⚠️  typedInvoke 件数が baseline 未満（${BASELINE} → ${COUNT}）。baseline を更新してください" >&2
  exit 1
fi

echo "✅ typedInvoke 件数 baseline と一致"
exit 0
```

```bash
chmod +x scripts/check-typedinvoke-count.sh
printf '0\n' > scripts/typedinvoke-baseline.txt   # 末尾改行あり
```

### Step 5-2. CI 組込み（`.github/workflows/ci.yml`）

frontend job の `npm lint` step（L101-102）直後に挿入:

```yaml
      - name: Check typedInvoke count against baseline
        run: bash scripts/check-typedinvoke-count.sh
```

### Step 5-3. pre-push 組込み（`scripts/pre-push.sh`）

現状 pre-push は frontend 系 hook なし。既存「設計書変更チェック」block（L80-92）の後に新規独立 section として挿入:

```bash
# ③ typedInvoke 件数監視（TS/TSX 変更時のみ）
if echo "$CHANGED_FILES" | grep -q '^src/.*\.\(ts\|tsx\)$\|^scripts/typedinvoke-baseline\.txt$'; then
    echo "🔍 [pre-push] typedInvoke 件数監視チェック実行中..."
    CHECKS_RUN="${CHECKS_RUN:+$CHECKS_RUN+}typedinvoke-count"

    if ! bash "$REPO_ROOT/scripts/check-typedinvoke-count.sh" 2>&1; then
        echo "❌ typedInvoke 件数 baseline 乖離。"
        echo "$TIMESTAMP $COMMIT_HASH FAIL typedinvoke-count" >> "$LOG_FILE"
        exit 1
    fi
fi
```

コミット: `chore(ci): add typedInvoke count monitor script and baseline`

---

## Step 6. eslint 境界ルール（B-5、ADR-004 §2.3 ガード 4）

### Step 6-1. `eslint.config.js` に 2 block 追加

挿入位置: L57 `prettier,` の**直前**（`files: ["vite.config.ts"]` block の後）。

```js
  // 7-5c 境界ルール: invoke-fallback.ts の import 経路制限（ADR-004 §2.3 ガード 4）
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/invoke-fallback", "**/lib/invoke-fallback.ts"],
              message:
                "invoke-fallback.ts は features/** と routes/** からのみ import 可。components/** からは commands.* (bindings.ts) を使うこと。",
            },
          ],
        },
      ],
    },
  },
  // barrel 経由再 export 禁止（src/lib/index.ts を作らない方針の保険）
  {
    files: ["src/lib/index.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportNamedDeclaration[source.value=/invoke-fallback/]",
          message: "invoke-fallback.ts からの再 export は禁止。直接 import すること。",
        },
        {
          selector: "ExportAllDeclaration[source.value=/invoke-fallback/]",
          message: "invoke-fallback.ts からの再 export は禁止。",
        },
      ],
    },
  },
```

### 動作確認（commit 前に手動）

```bash
# 境界ルールが発火することを確認（実ファイル作らず /tmp で lint 試行）
cat > /tmp/fake-component.tsx <<'EOF'
import { typedInvoke } from "@/lib/invoke-fallback";
export const X = () => typedInvoke;
EOF
# 確認後は /tmp から削除（実ファイルには残さない）
```

※ 実際の発火確認は `npm run lint` の正常 exit 0 と「仮に配置したら赤くなる」の hypothesis 確認。本ステップでは実行不要。

コミット: `chore(lint): add eslint boundary rules for invoke-fallback`

---

## Step 7. `src/routes/index.tsx` 差し替え（B-6、β 案 + 型修正版）

### ファイル内容（bindings.ts 実シグネチャに合わせた修正版）

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { commands } from "@/lib/bindings";
import { unwrapResult, isCmdError } from "@/lib/invoke";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function IndexPage() {
  const [keyword, setKeyword] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["products", "search", submitted],
    queryFn: () =>
      unwrapResult(
        commands.searchProducts({
          keyword: submitted || null,
          department_id: null,
          is_discontinued: null,
          sort_key: "Name",
          sort_order: "Asc",
          page: 1,
          per_page: 20,
        }),
        { source: "commands", cmd: "search_products" },
      ),
    enabled: submitted.length > 0,
  });

  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">商品検索（7-5c smoke）</h1>
          <p className="text-sm text-muted-foreground">
            QueryClient + tauri-specta commands.searchProducts 疎通確認
          </p>
        </header>

        <section className="space-y-4 rounded-md border bg-card p-6">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(keyword);
            }}
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="search-keyword">キーワード</Label>
              <Input
                id="search-keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.currentTarget.value)}
                placeholder="商品名 / product_code / jan_code の部分一致"
              />
            </div>
            <Button type="submit">検索</Button>
          </form>

          {isLoading && <p className="text-sm text-muted-foreground">読み込み中...</p>}
          {error && (
            <p className="text-sm text-destructive">
              エラー:{" "}
              {isCmdError(error) ? `${error.kind} - ${error.message}` : String(error)}
            </p>
          )}
          {data && (
            <ul className="space-y-1 text-sm">
              {data.items.map((p) => (
                <li key={p.product_code}>
                  {p.product_code} - {p.name}（在庫 {p.stock_quantity}）
                </li>
              ))}
              {data.items.length === 0 && (
                <li className="text-muted-foreground">該当なし</li>
              )}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/")({
  component: IndexPage,
});
```

### 型修正のポイント

- 引数: `ProductSearchQuery = { keyword, department_id, is_discontinued, sort_key, sort_order, page, per_page }`
- 戻り値: `PaginatedResult<ProductWithRelations>` → `data.items` でイテレート（`data` 直イテレートは誤り）
- `sort_key: "Name"`, `sort_order: "Asc"`（bindings.ts L99-102 literal union）
- `keyword: null` で全件検索、`is_discontinued: null` で現行+廃番両方

---

## Step 8. `main.tsx` に QueryClient + devtools 統合（B-7）

### Step 8-1. devtools 追加

```bash
npm install -D @tanstack/react-query-devtools@^5
```

lockfile 差分が出る → commit に含める。

### Step 8-2. `src/main.tsx` 書き換え

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import "./styles/globals.css";
import { routeTree } from "./routeTree.gen";

/// TanStack Router + Query 初期化（ADR-001 / ADR-003 / 2026-04-20 採用）
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,              // 1 min
      gcTime: 5 * 60_000,             // 5 min
      retry: 1,
      refetchOnWindowFocus: false,    // desktop app
    },
  },
});

// 注: router context は使わない（loader で queryClient を使う Phase 2 以降で
// __root.tsx を createRootRouteWithContext に拡張する段階で導入）。
// 7-5c 時点は useQuery が QueryClientProvider から取るので router context 不要。
const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {import.meta.env.DEV && <ReactQueryDevtools buttonPosition="bottom-left" />}
    </QueryClientProvider>
  </React.StrictMode>,
);
```

コミット: `feat(ui): integrate QueryClient + devtools in main.tsx`

コミット: `feat(ui): replace index route with search_products demo` (Step 7)

**Step 7 と Step 8 のコミット順**: Step 8（main.tsx）が先、Step 7（routes/index.tsx）が後。理由: Step 7 の `useQuery` が QueryClientProvider なしでは実行時エラーになる。ただし typecheck 単位では逆順でも通る（provider の有無は型には出ない）→ 歴史上は 8→7 の順で commit する。

---

## Step 9. 最終検証

```bash
bash scripts/check-phase1-probe-removed.sh      # exit 0 ✅
bash scripts/check-typedinvoke-count.sh         # exit 0 (baseline=0 と一致)
./scripts/doc-consistency-check.sh              # exit 0

cd src-tauri \
  && cargo fmt --check \
  && cargo clippy --all-targets --all-features -- -D warnings \
  && cargo test

cd .. \
  && npm run typecheck \
  && npm run lint \
  && npm run format:check \
  && npm run build

# GUI 起動確認（WSL2 直接のみ、Docker 内不可）
cd src-tauri && cargo tauri dev
# → 新 index route で商品検索フォームが表示される
# → 検索実行で結果表示（商品マスタに test データが入っていれば件数 >0）
# → 右下に React Query Devtools ボタンが表示される（dev only）
```

---

## Step 10. コミット分割 + PR

### コミット順（合計 8 commit）

1. `feat(ui): remove Phase 1 toy greet command` (Step 2)
2. `feat(ui): add invoke error helpers (src/lib/invoke.ts)` (Step 3)
3. `feat(ui): add typedInvoke fallback with FallbackCommand union` (Step 4)
4. `chore(ci): add typedInvoke count monitor script and baseline` (Step 5)
5. `chore(lint): add eslint boundary rules for invoke-fallback` (Step 6)
6. `feat(ui): integrate QueryClient + devtools in main.tsx` (Step 8)
7. `feat(ui): replace index route with search_products demo` (Step 7)
8. `docs(plans): mark 7-5c as complete` (Plans.md L19 `[ ]`→`[x]` + Current Phase 更新 + 着手完了記録)

単一論点コミットで Codex レビュー速度維持（PR #45/#46 実績準拠）。

### PR 作成

```bash
git push -u origin feat/ui-7-5c-invoke-query
gh pr create --title "feat(ui): 7-5c invoke ラッパ C 案 + QueryClient + 件数監視 CI + eslint 境界ルール" --body "..."
```

PR body 要点:
- Summary: ADR-004 C 案の実装（薄ラッパ + 期限付き fallback + 4 ガード全実装）
- 撤去期限: `v0.8.0-ui-daily` タグ gate（Plans.md Backlog 追跡）
- Codex レビュー依頼テキストを別途生成

PR 作成後は Codex app レビュー → 指摘全件対応 → user マージ判断。

---

## Critical Files

### 新規作成
- `src/lib/invoke.ts`（薄ラッパ + `unwrapResult` helper）
- `src/lib/invoke-fallback.ts`（期限付き、`FallbackCommand = never` 初期値）
- `scripts/check-typedinvoke-count.sh`（件数監視）
- `scripts/typedinvoke-baseline.txt`（初期値 `0\n`）

### 変更
- `src-tauri/src/lib.rs`（greet 削除、L55-63 + L133-136）
- `src/routes/index.tsx`（全面差し替え、β 案 + bindings.ts 型準拠）
- `src/App.css`（#greet-input block L94-96 削除）
- `src/main.tsx`（QueryClient + devtools 追加）
- `package.json` + `package-lock.json`（@tanstack/react-query-devtools 追加）
- `eslint.config.js`（境界ルール 2 block 追加、`prettier` の前）
- `.github/workflows/ci.yml`（frontend job に count step 追加、lint 直後）
- `scripts/pre-push.sh`（typedInvoke count 新規 section、docs block の後）
- `Plans.md`（L19 着手中→完了、Current Phase 更新）

### 再利用する既存資産
- `src/lib/bindings.ts`（tauri-specta 自動生成、`CmdError` / `PaginatedResult<T>` / `ProductSearchQuery` / `ProductWithRelations` / `SortKey` / `SortOrder` + `commands.searchProducts` / `commands.getProduct` + `typedError` ランタイム）
- `src-tauri/src/cmd/mod.rs`（CmdError struct + From<BizError>）
- `docs/research/2026-04-20-invoke-wrapper-adr.md`（ADR-004 設計根拠）
- `docs/research/2026-04-20-query-cache-adr.md`（ADR-003 キャッシュ戦略）
- `docs/research/2026-04-20-invoke-type-adr.md`（ADR-002 tauri-specta 採用）
- 既存 shadcn/ui コンポーネント: `src/components/ui/input.tsx`, `label.tsx`, `button.tsx`

---

## Verification（PR マージ前の必達条件）

### Step B 完了条件
- [ ] `bash scripts/check-phase1-probe-removed.sh` exit 0
- [ ] `bash scripts/check-typedinvoke-count.sh` exit 0（baseline=0 と一致）
- [ ] `cargo fmt --check` + `cargo clippy -- -D warnings` + `cargo test` 全通
- [ ] `npm run typecheck` + `npm run lint` + `npm run format:check` + `npm run build` 全通
- [ ] `./scripts/doc-consistency-check.sh` exit 0
- [ ] `cargo tauri dev` 起動、新 index route で `search_products` が commands.* 経由で呼ばれ、React Query Devtools が DEV 時のみ右下表示
- [ ] GitHub Actions CI: rust / docs / frontend 3 ジョブ全 green、新 count step も通過
- [ ] Codex app レビュー: P1/P2 ブロッカー 0

### Phase 2 完了タグ gate (`v0.8.0-ui-daily`) ※本 PR の射程外、将来の撤去条件メモ
- [ ] `src/lib/invoke-fallback.ts` 削除（union 空化 → ファイル毎）
- [ ] `scripts/check-typedinvoke-count.sh` + baseline ファイル削除
- [ ] `eslint.config.js` の境界ルール 2 block 撤去
- [ ] `scripts/pre-push.sh` の typedInvoke count section 撤去
- [ ] `.github/workflows/ci.yml` の count step 撤去
- [ ] Plans.md Backlog「typedInvoke 段階撤去」`[x]`

---

## 後処理（PR マージ後）

- `git fetch origin main && git pull --ff-only origin main && git branch -d feat/ui-7-5c-invoke-query`
- memory 監査: 本セッションで形成された新規判断軸（bindings.ts typedError wrapper 対応で `unwrapResult` helper 追加が必要だった気付き等）を必要に応じて追記、`.last_audit` sentinel 更新
