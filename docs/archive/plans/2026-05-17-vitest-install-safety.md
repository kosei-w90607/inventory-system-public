# Phase 1 7-7 Vitest 初期化 plan (Mini Shai-Hulud worm 警戒下、地雷原徒歩) — Round 3 反映済

## Context

Phase 1 残タスク 7-7 (Vitest 初期化、Plans.md L94) を実施する。前提として **Mini Shai-Hulud npm supply chain worm** (GHSA-g7cv-rxg3-hmpx、2026-05-11 publish、TanStack Router 系全 42 packages compromise、CVSS 9.6/10) で npm install 系凍結中 (CLAUDE.md「重要セキュリティルール」、memory `feedback-npm-install-blocked-mini-shai-hulud-2026-05.md`)。

### 凍結下で install 可能と判断する根拠 (4 重防御)

1. **本 repo 内 TanStack 系 11 packages 全部 advisory affected range より古い (BELOW)** — `@tanstack/react-router@1.168.23` < affected `1.169.5–1.169.8`、他 10 packages も同様
2. **install 候補 5 packages すべて worm 発生 (2026-05-11 19:20 UTC) 前 publish** + @tanstack transitive 0 件
3. **`.npmrc ignore-scripts=true` 維持** で post-install RAT 実行を完全 block (CISA 推奨)
4. **lock backup + lock diff verify + install log 監視 (best-effort)** で install 後の TanStack 系 version drift + post-install script 試行を機械検出 → 即 rollback

advisory state は `state: null` / `withdrawn_at: null` 継続中 (gh api `/advisories/GHSA-g7cv-rxg3-hmpx` で 2026-05-17 verify 済) だが、全 42 packages に patched version 公開済 = 解除条件 (1) は実質達成。残る (2) audit clean 7 日連続 / (3) user 手動承認 のうち、本 plan は **「限定例外条項」** として (3) user 明示承認下で 1 回限定実行を行う。完全解除は別途 Backlog (npm advisory monitoring 自動化 PR)。

### Q1「後からアップデートできるか?」への回答

- `--save-exact` で pin したのは worm 警戒下の防御 (lockfile drift 防止)。worm 完全過去 (例: GHSA-g7cv-rxg3-hmpx が withdrawn / fixed に変わる、または audit clean 30 日継続 + user 承認) 後に caret range (`^4.1.5`) に緩和可能
- update 経路: 通常の `npm update vitest --save-exact` (1 package 単位 + lock diff verify 必須)、または定期的な dependabot 系自動化 (本プロジェクトでは未導入、Backlog)
- 本 PR マージ後すぐに update 計画を立てる必要はない、Phase 2 残実装が落ち着いてから検討

## 確定事項 (user 承認済 + Round 1+2+3 反映)

| 項目 | 確定 |
|---|---|
| vitest version | **4.1.5** (worm 3 週間前 publish、2026-04-22) |
| DOM env | **happy-dom 20.9.0** (Vitest default、軽量、Radix UI 実績多) |
| 最初の test 範囲 | **option A**: 純関数のみ (count-stock-status / extractFilename / formatErrorRow / reducer 54 組合せ)、約 60 ケース |
| CI 同期 | **同期**: single PR で setup + test + CI 統合、TDD 基盤 PR として CI green で証明 |
| commit 分割 | **4 commit** (Round 2 I-2 反映): commit 0 = plan / commit 1 = deps+config+setup+scripts / commit 2 = test files / commit 3 = CI wire |
| push 戦略 | **逐次 push** (Round 3 K-4): commit 1 push → CI green 確認 → commit 2 push → CI green 確認 → commit 3 push → CI green 確認 (一括 push しない、各段で問題切り分け可能) |
| CI test step 位置 | `Generate route tree` 後 + `typecheck` 後 + `lint` 前 |
| `.npmrc ignore-scripts` | 恒久維持 (本 plan 後も削除しない) |
| install 実行主体 | **Claude が Bash tool で実行** (Round 3 L-1 反映、CLAUDE.md「重要セキュリティルール §npm install 系コマンド禁止」の 1 回限定例外条項適用、適用条件 = advisory state guard pass + lock backup 完了 + user 明示承認 = Q5 で install command 全文提示 → 承認回答取得) |
| @axe-core/react | **本 plan scope 外** (7-7b に分離、Plans.md L94 を 7-7a / 7-7b に split) |
| memory update | **本 PR scope 外** (post-merge sync で対応) |
| merge 戦略 | **squash merge** (4 commit → 1 squashed commit、Plans.md L94 への hash 記録 = squashed hash) |

## 採用パッケージ (全 5 packages、`--save-exact` pin)

| Package | Version | Publish | Worm 前か | TanStack transitive | 互換性 |
|---|---|---|---|---|---|
| vitest | 4.1.5 | 2026-04-22 | ✅ 3 週間前 | なし | TS >= 5.0 + Node >= 18 (既存 TS 5.8.3 + Node 20 satisfy) |
| @testing-library/react | 16.3.2 | 2026-01-19 | ✅ 4 ヶ月前 | なし | React 18/19 peerDep |
| @testing-library/user-event | 14.6.1 | 2025-12-13 | ✅ 5 ヶ月前 | なし | framework agnostic |
| @testing-library/jest-dom | 6.9.1 | 2025-12-13 | ✅ 5 ヶ月前 | なし | jest matchers |
| happy-dom | 20.9.0 | 2026-04-13 | ✅ 1 ヶ月前 | なし | Node >= 16 + ESM only |

注: `@vitejs/plugin-react` は既存 devDep `^4.6.0` を再利用、本 plan で追加 install しない。

## install 戦略 (1 回限定、user 明示承認 = Q5 直前確認後のみ、Claude が Bash tool で実行)

### Safety net 6 段

```bash
# (a) advisory status 再 verify (Plan rally 通過後、install 実行直前)
ADV_JSON=$(gh api /advisories/GHSA-g7cv-rxg3-hmpx --jq '{state, withdrawn_at, published_at}')
echo "$ADV_JSON"
ADV_STATE=$(echo "$ADV_JSON" | jq -r '.state // "null"')
ADV_WITHDRAWN=$(echo "$ADV_JSON" | jq -r '.withdrawn_at // "null"')
# state が "null" (jq // で fallback、GitHub Advisory Database 内で reviewed のみ) または "published" 継続中、かつ withdrawn_at が "null"
# いずれかが満たされない場合は本 plan の限定例外条項適用範囲外 = install 中止
[[ ("$ADV_STATE" == "null" || "$ADV_STATE" == "published") && "$ADV_WITHDRAWN" == "null" ]] \
  || { echo "FAIL: advisory state changed, abort install"; exit 1; }
echo "OK: advisory state guard passed (state=$ADV_STATE, withdrawn=$ADV_WITHDRAWN)"

# (b) lock backup
cp package.json package.json.bak
cp package-lock.json package-lock.json.bak

# (c) ignore-scripts 維持確認 (最重要 blocking 防御)
grep -q '^ignore-scripts=true' .npmrc || { echo "FAIL: .npmrc ignore-scripts missing"; exit 1; }

# (d) install 実行 (1 回限定、Q5 user 明示承認後のみ、Claude が Bash tool で実行)
npm install --save-exact --save-dev --ignore-scripts \
  vitest@4.1.5 \
  @testing-library/react@16.3.2 \
  @testing-library/user-event@14.6.1 \
  @testing-library/jest-dom@6.9.1 \
  happy-dom@20.9.0 \
  2>&1 | tee /tmp/vitest-install.log
INSTALL_EXIT=${PIPESTATUS[0]}
[ "$INSTALL_EXIT" -eq 0 ] || { echo "FAIL: install exit $INSTALL_EXIT"; exit 1; }

# (d-2) install log の lifecycle script 試行検出 (best-effort)
# 注: npm v10 では --ignore-scripts 指定時に lifecycle script 自体が log に出力されないケースが多く、
#     検出は補助目的 (audit trail の hint)。真の blocking 防御は (c) ignore-scripts と (e) lock diff。
SCRIPT_HITS=$(grep -E "(postinstall|preinstall|prebuild-install|prepublish)" /tmp/vitest-install.log || true)
echo "lifecycle script grep result: ${SCRIPT_HITS:-(none)}"

# (d-3) 機密情報含有 verify (Round 3 L-5 反映、PR description / commit message paste 前に必須)
SECRETS_HITS=$(grep -E "(authToken|_auth|password|token=|npm_)" /tmp/vitest-install.log || true)
if [ -n "$SECRETS_HITS" ]; then
  echo "DANGER: potential secrets in install log:"
  echo "$SECRETS_HITS"
  echo "→ redact before paste to commit message / PR description"
  exit 3
fi
echo "OK: no secrets in install log (authToken / _auth / password / token= / npm_ all 0 hit)"

# (d-4) install log の sha256sum 取得 (Round 3 K-2 反映、verifiability のため commit message に併記)
INSTALL_LOG_SHA=$(sha256sum /tmp/vitest-install.log | awk '{print $1}')
echo "install log sha256: $INSTALL_LOG_SHA"

# (e) lock diff verify (TanStack 系不動の機械検証、最重要 blocking 防御)
diff <(jq -r '.packages | to_entries[] | select(.key | startswith("node_modules/@tanstack/")) | "\(.key)@\(.value.version)"' package-lock.json.bak | sort) \
     <(jq -r '.packages | to_entries[] | select(.key | startswith("node_modules/@tanstack/")) | "\(.key)@\(.value.version)"' package-lock.json | sort)
# 期待: diff 出力 0 行 (TanStack 系 version 完全不動)

# 新規追加 packages を既知 compromised prefix と grep
diff <(jq -r '.packages | keys[]' package-lock.json.bak | sort) \
     <(jq -r '.packages | keys[]' package-lock.json | sort) \
  | grep '^>' | sed 's/^> //' > /tmp/new-packages.txt
grep -E '^(node_modules/@tanstack/)' /tmp/new-packages.txt \
  && { echo "DANGER: TanStack package newly added"; exit 2; } \
  || echo "OK: no TanStack newly added"

# (f) audit 比較
npm audit --audit-level=high 2>&1 | tail -10
# 期待: 既存 4 件 (3 moderate + 1 high via vite/postcss/smol-toml/markdownlint) のみ、新規 critical 0 件
```

### Install audit trail policy (Round 2 I-1 + Round 3 K-2 + L-5 反映、policy 矛盾解消明文化 + 機密情報 verify + 永続性)

- **install log の保存先**: `/tmp/vitest-install.log` (local working tree 外、git tracked 不要、session 終了で消える前提)
- **`.gitignore` への追加**: `docs/audit/` は **追加しない** (audit ディレクトリ自体を作らない方針)
- **install 実行直後の必須 step** (Claude が install 完了 + (d-2)〜(d-4) + (e) + (f) verify pass 後に即時実行):
  1. **機密情報 verify**: (d-3) で 0 hit 確認、hit ありなら exit 3 で abort + user 報告
  2. **commit message ドラフト作成**: 以下を含める:
     - `(c)` `.npmrc ignore-scripts=true` verified
     - `(d-2)` lifecycle script grep summary (`SCRIPT_HITS` 値、none ならその旨)
     - `(d-4)` install log sha256 (`INSTALL_LOG_SHA`)
     - `(e)` lock diff TanStack 系 0 行 verified
     - `(f)` `npm audit --audit-level=high` 既存 4 件のみ、新規 critical 0 件
  3. **PR description Audit trail section に同情報を即時 paste** (`/tmp/vitest-install.log` が session で消える前、commit 0 push 直後の draft PR にすぐ反映)
- 本格的検出が将来必要なら `npm install --loglevel=verbose` の出力保存に変更 (本 plan では best-effort で十分、`.npmrc ignore-scripts=true` の存在検証が真の blocking 防御)

### Rollback path (異常検知時)

```bash
mv package.json.bak package.json
mv package-lock.json.bak package-lock.json
rm -rf node_modules
npm ci --ignore-scripts        # lockfile 通り再構成
git reset HEAD package.json package-lock.json  # staged 状態 clean
git status                     # working tree clean 確認
```

## vitest config + setup

### `vitest.config.ts` (新規、vite.config.ts と独立)

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/routeTree.gen.ts", "node_modules", "dist", "src-tauri"],
    clearMocks: true,
    restoreMocks: true,
  },
});
```

### `src/test/setup.ts` (新規)

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
```

### `tsconfig.json` types 拡張

```jsonc
{
  "compilerOptions": {
    // ... 既存設定 ...
    "types": ["vitest/globals", "@testing-library/jest-dom", "vite/client", "node", "react", "react-dom"]
  },
  "include": ["src", "src/test", "vitest.config.ts"]
}
```

`types` 明示で `@types/*` auto-include が無効化されるため、既存利用中の types を併記。`vite/client` は既存 `src/vite-env.d.ts` の triple-slash directive で src 配下は解決済 (verify 済)、tsconfig.json `types` への追加は src 外の `vitest.config.ts` 等で `import.meta.env` 参照する可能性に対する保険 = 現状コードでは冗長だが害なし。

### `eslint.config.js` 更新 (commit 1 に同梱)

既存 `eslint.config.js` は `tseslint.config(...)` で複数 config object をスプレッドする flat config。test file 用に追加 block を `tseslint.config(...)` 内の **prettier config の直前** に挿入:

```js
// 既存 tseslint.config(...) 内に挿入 (擬似 import は不要、globals package のみで完結)
{
  files: ["src/**/*.test.{ts,tsx}", "vitest.config.ts", "src/test/**/*.ts"],
  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.vitest,  // describe / it / expect / vi 等を no-undef から除外 (globals v15.15.0+ で利用可、verify 済)
    },
  },
},
```

`eslint-plugin-vitest` / `eslint-plugin-testing-library` は **本 plan scope 外**。理由: 純関数 only test では rule 適用範囲が狭い + install package 追加で worm 警戒下の attack surface 拡大。

### `.gitignore` 追加 (rollback backup file 除外)

```
# Vitest install 時の package*.json backup
package.json.bak
package-lock.json.bak
```

(`docs/audit/` は追加しない、install log は `/tmp/` のみ、grep 結果サマリを commit message / PR description で永続化)

### `package.json` scripts 追加

```jsonc
{
  "scripts": {
    // ... 既存 ...
    "pretest": "npm run generate:routes",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`pretest` で `generate:routes` 自動 = `pretypecheck`/`prelint` と同 pattern (ローカル開発者向け safety net、CI では `.npmrc ignore-scripts=true` で auto-run しないが既存 `Generate route tree` step が npm test の前に走るため routeTree.gen.ts は確実生成済)。`test:ui` (`@vitest/ui` 必要) と `test:coverage` (`@vitest/coverage-v8` 必要) は本 plan 未導入、後続 plan で検討。

## 最初の test 適用範囲 (option A、4 test file、約 60 ケース)

| test file | 対象 | ケース数 | 設計参照 |
|---|---|---|---|
| `src/features/home/lib/count-stock-status.test.ts` | `countStockStatus` | 6 | `docs/function-design/53-ui-home.md` §53.2 D-1 |
| `src/features/csv-import/lib/extractFilename.test.ts` | `extractFilename` | 5 | `docs/function-design/55-ui-csv-import.md` §55.1 |
| `src/features/csv-import/lib/formatErrorRow.test.ts` | `formatErrorRow` | 5 | `docs/function-design/55-ui-csv-import.md` §55.5 |
| `src/features/csv-import/reducer.test.ts` | `csvImportReducer` | 54 (13 valid + 41 invalid 組合せ、§55.2 reducer 遷移表完全カバー、`describe.each` 推奨) | `docs/function-design/55-ui-csv-import.md` §55.2 + §55.8 |

`reducer.ts` L3-5 のコメントが既に意図表明 (「Phase 1 7-7 Vitest 着手後に 54 組合せ retroactive 追加」) で、本 plan で retroactive 追加完了。

## CI Frontend job 更新

`.github/workflows/ci.yml` Frontend job に test step を追加。現状 step 順序:

```
npm ci → Generate route tree → typecheck → lint → typedInvoke count → env safety → format:check → build → audit
```

追加位置 (`Generate route tree` の後、`typecheck` の後 + `lint` の前):

```yaml
- name: npm typecheck
  run: npm run typecheck

- name: Vitest (unit tests)   # ← 新規追加 (本 plan、説明的 step name)
  run: npm test

- name: npm lint
  run: npm run lint
```

**重要**: 既存 `Generate route tree` step (CI L120-122、PR #62 で追加) が `npm typecheck` の前に走るため、`npm test` 直前で routeTree.gen.ts は確実に生成済 = `pretest` script の auto-run 失敗 (`.npmrc ignore-scripts=true` で lifecycle hook block) を CI 既存 step がカバー。本 plan で CI workflow に generate:routes step を追加重複する必要なし。理由: type 破綻 → test 失敗 → lint 警告 の意味的順序、build 前に品質ゲート集約。

test file 検出は `vitest.config.ts` の `include` patterns で自動、CI 側に追加 step 不要。

pre-push hook 更新は **本 plan 段階では行わない** (CI のみで担保)。ローカル run は開発者が `npm run test:watch` で頻繁に叩く想定、pre-push 改修は別 plan に分離。

## commit 分割 (4 commit、Round 2 I-2 反映で集約)

```
commit 0: docs(plans): add vitest install safety plan (Round 3 反映済)
  - docs/plans/2026-05-17-vitest-install-safety.md (本 plan file、Round 3 plan rally 収束後の最終版)

commit 1: test(frontend): add vitest config + test infra setup + npm scripts (集約)
  - package.json (devDependencies 5 packages 追加 + scripts 3 つ追加、1 commit に集約)
  - package-lock.json (--save-exact pin)
  - vitest.config.ts (新規)
  - src/test/setup.ts (新規)
  - tsconfig.json (types 拡張 + vite/client)
  - eslint.config.js (vitest globals block 追加、擬似 import なし、globals package のみ)
  - .gitignore (package*.json.bak 追加、docs/audit/ は不要)

commit 2: test(frontend): add pure function tests (option A、4 files)
  - src/features/home/lib/count-stock-status.test.ts
  - src/features/csv-import/lib/extractFilename.test.ts
  - src/features/csv-import/lib/formatErrorRow.test.ts
  - src/features/csv-import/reducer.test.ts

commit 3: ci(frontend): wire Vitest into Frontend job
  - .github/workflows/ci.yml (npm typecheck の後に Vitest step)
```

**PR workflow (Round 3 K-4 反映、逐次 push 必須)**:
1. **commit 0 push** 後すぐに **draft PR open** (Audit trail を install 直後 paste 済の前提で commit 1 用意)
2. **commit 1 push** → **CI green 確認** (vitest config 自体が既存 typecheck/lint/build/audit を壊さないかの早期検証、test step 未追加なので test 走らない)
3. **commit 2 push** → **CI green 確認** (test files 追加で typecheck/lint 通るか、test step 未追加なので CI 自体は commit 1 と同じ)
4. **commit 3 push** → **CI green 確認** (Vitest step 含めた全項目 green、TDD 基盤動作の真の証明)
5. **一括 push しない理由**: 段階的に CI 切り分け、Codex review 用 push 単位 bisect を維持、各段で問題発生時の責任 commit を明確化

各 commit reversible (HEAD revert で前段に戻れる)、Codex P1 指摘発生時の差し戻し範囲も最小化。

**Merge 戦略**: squash merge を採用 (4 commit → 1 squashed commit、Plans.md L94 への hash 記録 = squashed hash)。bisect は本 PR 内 (push 前 + 各 commit) で完結する設計、merge 後の bisect 単位は「TDD 基盤投入 1 件」。

## 完了基準 (KPI)

| 項目 | 目標 |
|---|---|
| test file 数 | 4 |
| test case 数 | 約 70 (純関数 16 + reducer 54) |
| `npm test` 終了コード | 0 (ローカル + CI 両方) |
| `npm run typecheck` / `lint` / `format:check` / `build` | 0 |
| `npm audit --audit-level=high` | install 前 baseline と同件数 (vitest transitive で新規 high 0 件) |
| CI Frontend job | green |
| lock diff verify | TanStack 系 0 行 (drift なし) |
| install log lifecycle script hit | grep 結果を commit message / PR description に記録 (hit 0 件 or hit あり時は全文記載) |
| install log 機密情報 verify | 0 hit (authToken / _auth / password / token= / npm_) |

## Risks + Mitigation

| ID | リスク | Mitigation |
|---|---|---|
| R1 | npm install で transitive に compromised package 混入 | lock diff verify + audit 比較、ignore-scripts で RAT 実行 block、install log grep で試行検出 (best-effort) |
| R2 | 既存 TanStack version drift | `--save-exact` + lock diff verify |
| R3 | React 19 + RTL 16 + happy-dom 互換性問題 | 最初の test を純関数 only にして DOM 依存回避 (option A)、component test は 7-7b 以降 |
| R4 | CI で test 失敗 (ローカル green / CI red) | 逐次 push (一括しない)、commit 1-2 で typecheck/lint/build/audit green → commit 3 で test 含む全 green の段階確認 |
| R5 | tsconfig types 拡張で既存 @types / vite types 解決失敗 | `types` に `node` / `react` / `react-dom` / `vite/client` 明示併記 |
| R6 | format:check / lint fail | lefthook pre-commit (eslint --fix + prettier --write) で staged file に自動 fix。eslint config に vitest globals block 追加 |
| R7 | GHSA state 変化 (reopen 等) | install 直前再 verify with state guard、jq // "null" で null を文字列 fallback |
| R8 | package*.json.bak の commit 漏れ | .gitignore に commit 1 で追加 |
| R9 | eslint-plugin-vitest / testing-library 採用議論再燃 | 本 plan で「scope 外 (純関数 only では rule 範囲狭い + install package 追加で attack surface 拡大)」明記 |
| R10 | install audit trail の policy 矛盾 (docs/audit gitignore) | `docs/audit/` は作らず、install log は `/tmp/` 保存、grep 結果サマリを commit message / PR description に即時 paste、sha256sum 併記で verifiability 確保 |
| R11 | install log に機密情報 (npm token / auth header) 混入 | (d-3) `grep -E "(authToken|_auth|password|token=|npm_)"` で 0 hit 確認、hit ありなら exit 3 + redact 必須、本 repo は public registry only で `.npmrc` に authToken 設定なし (事実) |
| R12 | install 実行主体の曖昧性 | Claude が Bash tool で実行、CLAUDE.md「重要セキュリティルール §npm install 系コマンド禁止」の 1 回限定例外条項適用 (advisory state guard pass + lock backup + user 明示承認の 3 条件全達成時のみ) |
| R13 | plan rally Round 4 で新規指摘発生 | Round 4 で機械訂正のみ反映 → ExitPlanMode、新規重大指摘あれば Round 5 (memory `feedback-plan-mode-recursive-refinement.md` で 4 段ラリー実績あり、本 plan は中規模 = 4 段以内収束想定) |

## Verification

各 commit 完了時 + PR open 時 + Codex review 前に実行:

```bash
# 1. ローカル動作確認 (commit 2 完了後 = test 走らせ可能、commit 3 完了後 = CI green 想定)
npm run typecheck && echo "OK: typecheck"
npm test && echo "OK: test"
npm run lint && echo "OK: lint"
npm run format:check && echo "OK: format"
npm run build && echo "OK: build"

# 2. lock 整合性 (commit 1 直後 + 最終 PR 前)
diff <(jq -r '.packages | to_entries[] | select(.key | startswith("node_modules/@tanstack/")) | "\(.key)@\(.value.version)"' package-lock.json.bak | sort) \
     <(jq -r '.packages | to_entries[] | select(.key | startswith("node_modules/@tanstack/")) | "\(.key)@\(.value.version)"' package-lock.json | sort)
# 期待: 0 行 (TanStack 系 drift なし)

# 3. doc-consistency (本 plan 自体の R3 link check、Round 3 M-1 反映で exit code 明示)
bash scripts/doc-consistency-check.sh --target plan docs/plans/2026-05-17-vitest-install-safety.md && echo "OK: doc-consistency"

# 4. CI Run (各 commit push 後)
gh pr checks <PR#> --watch --interval 30
# 期待 (commit 0-2 push 後): Rust / Design doc / Frontend (typecheck + lint + format + build + audit) 全 green、ただし test step まだ未追加
# 期待 (commit 3 push 後): 上記 + Frontend Vitest (unit tests) step も green = TDD 基盤動作の真の証明
# 重要: commit 0-2 の CI green は test 動作の証明にならない、commit 3 後のみ。ローカル `npm test` 緑 (commit 2 後) + CI Vitest 緑 (commit 3 後) の 2 段で TDD 基盤動作を担保
```

## PR description sketch (Audit trail 含む、Round 3 K-2 + L-5 反映)

```markdown
## Summary
Phase 1 7-7a Vitest 初期化。Mini Shai-Hulud worm 警戒下で限定例外条項適用、`--save-exact` + `--ignore-scripts` + lock diff verify で 5 packages を 1 回限定 install。option A (純関数 only、約 70 ケース) で TDD 基盤を立ち上げ、CI Frontend job に Vitest step を統合。

## Background
- Plan: `docs/plans/2026-05-17-vitest-install-safety.md` (commit 0 で追加)
- 関連 advisory: GHSA-g7cv-rxg3-hmpx (TanStack 42 packages compromise、CVSS 9.6/10)
- 本 repo 内 TanStack 11 packages 全部 affected range より古い (BELOW、安全)
- install 候補 5 packages すべて worm 前 publish + TanStack transitive 0

## Audit trail (install 直後に Claude が以下を即時記載)
- `.npmrc ignore-scripts=true` verified prior to install (Safety net (c) pass)
- advisory state guard: state=null, withdrawn_at=null at install time (Safety net (a) pass)
- install log lifecycle script grep result: [hit 0 件 / hit あり時は grep 結果全文をここに paste]
- install log secrets grep (`authToken|_auth|password|token=|npm_`): **0 hit** (Safety net (d-3) pass、必須)
- install log sha256sum: `<INSTALL_LOG_SHA 値>` (Safety net (d-4)、verifiability)
- lock diff verify: TanStack 系 0 行 drift (実 diff 結果サマリ)
- `npm audit --audit-level=high`: 既存 4 件のみ (3 moderate + 1 high via vite/postcss/smol-toml/markdownlint)、新規 critical 0 件

## Test plan
- [ ] commit 0 (plan add) push → CI green (Rust + Design doc + Frontend = typecheck/lint/build/audit のみ、test step 未追加)、draft PR open
- [ ] commit 1 (config + setup + scripts) push → **CI green 確認** (vitest config 自体が既存 step を壊さない検証)、lock diff で TanStack 系 0 行 verify、ローカル `npm test` で 0 件 pass (test file ない)
- [ ] commit 2 (test files) push → **CI green 確認** (test step 未追加なので CI 自体は commit 1 と同じ)、ローカル `npm test` で 約 70 ケース pass
- [ ] commit 3 (CI Vitest step) push → **CI green 確認** (Vitest step 含めた全項目 green、TDD 基盤の真の動作証明)

## Risks
詳細は plan §Risks + Mitigation 参照、主要 R1-R13。

## Codex review 依頼テキスト
PR open 後に別途生成、`.claude/rules/review-workflow.md` §Codex app との連携 準拠。
```

## Post-merge sync (本 PR マージ後、別 commit、本 plan scope 外)

1. memory `feedback-npm-install-blocked-mini-shai-hulud-2026-05.md` 限定例外条項追記:
   > 限定的 install 許容条件 (新規 devDep 追加、user 明示承認下のみ):
   > - 追加対象が GHSA-g7cv-rxg3-hmpx affected range 外 (transitive 含む)
   > - 各候補が worm 発生前 publish (npm view time 確認)
   > - `.npmrc ignore-scripts=true` 維持下で `npm install --save-exact --save-dev --ignore-scripts` 単発実行
   > - lock backup → install → install log lifecycle script grep (best-effort) + 機密情報 grep (必須) + sha256sum 取得 → lock diff verify (TanStack 系 0 行 + 既知 compromised 名 grep) → rollback path 確保
   > - user 明示承認 (commit / plan 番号 + install package list 提示)
   > - install 実行は Claude が Bash tool で実行、CLAUDE.md「重要セキュリティルール §npm install 系コマンド禁止」の 1 回限定例外条項適用
   > - audit trail: install log は `/tmp/` 保存、grep 結果サマリ + sha256sum を commit message / PR description に即時 paste (`docs/audit/` ディレクトリは作らない)
2. 新規 memory `feedback-vitest-react19-setup-pattern.md` 作成 (実装過程で発見した罠を記録: happy-dom Radix 互換性 / React 19 act() / tsconfig types 拡張時の auto-include 落ち / TanStack Query Provider mock pattern 等、7-7b で hooks test 着手時に追記)
3. UI_TECH_STACK.md §2 補 に「Vitest setup 実装済 (2026-05-17、本 PR)」コメント追記
4. Plans.md L94 を `7-7a (本 PR 完了) + 7-7b (axe + hooks test、後続)` に split + 7-7a `[x]` チェック + squash merge hash 記録 (self-trace、memory `feedback-self-trace-expression-breaks-sync-loop.md` 適用)
5. active plan archive 移送 + relative path 変換:
   - `git mv docs/plans/2026-05-17-vitest-install-safety.md docs/archive/plans/2026-05-17-vitest-install-safety.md`
   - archive 後の relative path 変換対象 (本 plan 内、inline code 表記中心なので R3 検査対象外、機械訂正レベル)
   - 確認 step: `bash scripts/doc-consistency-check.sh --target plan docs/archive/plans/2026-05-17-vitest-install-safety.md && echo "OK: archive consistency"` で R3 link 全 pass を verify
6. memory 軽量監査 sentinel touch: `touch /home/kosei/.claude/projects/-home-kosei-Projects-inventory-system/memory/.last_audit`

## Plan rally + ExitPlanMode

memory `feedback-plan-rally-required-before-exit.md` + `feedback-plan-mode-recursive-refinement.md` 適用:

1. **Round 1 完了**: 新規指摘 16 件 (P1: 2 / P2: 6 / P3: 8)、P1 + P2 全反映 + 主要 P3 反映
2. **Round 2 完了**: 新規指摘 10 件 (P1: 1 / P2: 4 / P3: 5)、全反映
3. **Round 3 完了 (本 plan で反映済)**: 新規指摘 5 件 (P1: 0 / P2: 4 / P3: 1)、全反映
4. **Round 4 起動予定**: plan agent で本 plan を再 critique、新規重大指摘 0 件で収束 → ExitPlanMode
5. **ExitPlanMode 後**: AskUserQuestion で Q5「下記 1 回限定 install を実行してよいか?」(install command 全文提示) で最終承認
6. **承認後**: commit 0-3 を順次実行、Verification 通過、PR 作成、Codex app に review 依頼 (`.claude/rules/review-workflow.md` §連携手順)

## Self-Review (plan-self-review-before-implementation.md 7 観点、memory `feedback-self-review-mechanical-addition-anti-pattern.md` 準拠で各観点に blockquote + 行番号 + memory 参照 + 100 字以上本文)

### 1. 技術的前提

> 本 plan §Context (L7-12) で「凍結下で install 可能と判断する根拠 (4 重防御)」を 4 項目明示、§採用パッケージ (L43-49) で全 5 packages の互換性 (TS 5.0 / Node 18+ / React 19 peerDep / TanStack transitive 0 件) を表形式で網羅、§install 戦略 (L60) で install 実行主体 = Claude Bash tool を明示 (Round 3 L-1 反映)。

技術的前提の核心は (a) Mini Shai-Hulud worm の affected range 確定と本 repo lock の安全位置 (BELOW)、(b) install 候補 5 packages の worm 前 publish + TanStack transitive 0 件、(c) `.npmrc ignore-scripts=true` の post-install RAT block 機能、(d) `--save-exact` + `--ignore-scripts` の npm 10.x 挙動、(e) vitest 4 系の peerDep vite 7 互換性 (Round 4 O-2 で install 直前 `npm view vitest@4.1.5 peerDependencies.vite` verify 推奨、plan 修正なし install 段で確認可能)、(f) happy-dom 20.x の Node 18+ 要件 (既存 Node 20 LTS satisfy)、(g) `npm ci` vs `npm install` の正確な使い分け (npm ci は lock 厳密遵守で新規 dep 追加不可、本 plan は npm install を 1 回限定で使う = Round 2 で Explore agent の技術誤解を明示訂正)、(h) `tsconfig.json types` 明示で `@types/*` auto-include が無効化される副作用 (`node` / `react` / `react-dom` / `vite/client` 併記で対応、L188-198)。関連 memory: `feedback-npm-install-blocked-mini-shai-hulud-2026-05.md` (凍結ルールと本 plan 限定例外条項の根拠)、`feedback-codex-p1-empirical-defense.md` (技術的前提の実証反論パターン、Plan rally で適用)。

### 2. スクリプト詳細

> 本 plan §Safety net 6 段 (L62-152) で `cp` rollback / `jq` lock diff / install log lifecycle script grep (best-effort) / 機密情報 grep (必須、Round 3 L-5) / sha256sum (Round 3 K-2) / audit 比較を具体的 bash で逐次明示、`${PIPESTATUS[0]}` で exit code 制御 (L78)、rollback path に `git reset HEAD` (L156)。

スクリプト詳細の核心は Safety net 6 段の bash 構文と exit code handling。(a) advisory state guard で `jq // "null"` で null を文字列 fallback (Round 1 B-1)、`[[ ... ]]` で論理結合、(b) `cp` で package.json + lock backup、(c) `.npmrc ignore-scripts=true` の grep 検出 (fail 時 exit 1)、(d) `npm install --save-exact --save-dev --ignore-scripts` + `tee /tmp/vitest-install.log` で log 保存、`${PIPESTATUS[0]}` で pipe 後の install 真の exit code 取得、(d-2) install log lifecycle script grep (best-effort、`|| true` で hit 0 でも exit 0 維持、Round 3 H-3 で false negative 明記)、(d-3) 機密情報 grep で `authToken|_auth|password|token=|npm_` regex + hit 時 exit 3 で abort (Round 4 N-1 で false positive risk あるが security-first で OK)、(d-4) sha256sum 取得で verifiability (`/tmp/` 永続性なしの限界を §Install audit trail policy で明示、Round 4 N-2)、(e) jq lock diff で TanStack 系 startswith filter (Round 4 O-1 で nested transitive 検出外、本 repo は dedup で root hoist なので実害 0)、(f) `npm audit --audit-level=high` で baseline 比較。関連 memory: `feedback-archive-relative-path-conversion.md` (jq command の堅牢性、PR #62 で R3 link 切れ 8 件被弾の教訓)、`feedback-codex-drift-fix-grep-all-locations.md` (grep 系の全箇所一括検証パターン)。

### 3. ドキュメント修正

> 本 plan §post-merge sync (L406-428) で 6 項目 (memory 限定例外条項追記 / 新規 memory `feedback-vitest-react19-setup-pattern.md` 作成 / UI_TECH_STACK.md §2 補 コメント追記 / Plans.md L94 split + [x] + squash hash / active plan archive 移送 + relative path 変換 / sentinel touch) を本 PR scope **外** として明記、scope discipline 厳守 (memory `feedback-pr-merge-gate-scope-discipline.md`)。

ドキュメント修正の核心は (a) 本 PR scope 内 = vitest install + config + test files + CI step + plan 自体の追加 (commit 0)、(b) 本 PR scope 外 = memory update + UI_TECH_STACK update + Plans.md split + active plan archive (これは PR #62 と同じ post-merge sync pattern で別 commit)。Plans.md L94 を `7-7a (本 PR 完了)` + `7-7b (axe + hooks test 後続)` に split、self-trace 原則 (memory `feedback-self-trace-expression-breaks-sync-loop.md`) で本 commit SHA は L94 に書かず squashed hash のみ記録。relative path 変換は本 plan 内 inline code 表記中心で R3 検査対象外 = 機械訂正レベル、ただし確認 step として `bash scripts/doc-consistency-check.sh --target plan docs/archive/plans/...` を post-merge sync §5 に明記 (Round 1 E-2 + PR #62 R3 link 切れ 8 件被弾の教訓反映)。memory 新規追加候補 `feedback-vitest-react19-setup-pattern.md` は実装段階で発見した罠 (happy-dom Radix 互換 / React 19 act() / TanStack Query Provider mock pattern) を記録予定、7-7b で hooks test 着手時に追記。

### 4. 検証計画

> 本 plan §Verification (L370-388) で 4 段 (ローカル / lock 整合 / doc-consistency with `&& echo OK` Round 3 M-1 / CI with `--interval 30`) を bash command で具体化、§完了基準 KPI (L325-335) で 9 項目を明示、CI green の意味を I-3 反映で commit 別に区別 (L382-385)。

検証計画の核心は 4 段検証 (ローカル → lock 整合 → doc-consistency → CI) で TDD 基盤の動作証明を多重化。KPI 9 項目 (test file 数 4 / test case 約 70 / npm test 0 / typecheck 0 / lint 0 / format:check 0 / build 0 / audit 既存 4 件のみ / lock diff TanStack 0 行 / install log 機密情報 0 hit) で完了基準を機械検証可能に。逐次 push (Round 3 K-4 反映) で各段問題切り分け、commit 1 push 後 = vitest config 自体が既存 typecheck/lint/build/audit を壊さないか、commit 2 push 後 = test files 追加で typecheck/lint 通るか、commit 3 push 後 = Vitest step 含む全 green = TDD 基盤の真の動作証明。CI 1 回 ~3-5 分 × 3 回 = user 待機 ~15 分超を許容して切り分け容易性を取る (Round 4 N-4)。ローカル `npm test` 緑 (commit 2 後) + CI Vitest 緑 (commit 3 後) の 2 段で動作担保 (Round 2 I-3)。`gh pr checks <PR#> --watch --interval 30` で default 10s → 30s に変更 (Round 1 D-2、cache 切れ回避)。関連 memory: `feedback-ci-polling-use-gh-watch.md` (CI 完了待ち、stall 事故回避)、`review-convergence-pattern.md` (機械チェックで潰せる問題は PR レビュー前に潰す)。

### 5. 後処理

> 本 plan §post-merge sync (L406-428) で 6 項目を本 PR scope 外として明記、memory 軽量監査 sentinel touch (`touch /home/kosei/.claude/projects/-home-kosei-Projects-inventory-system/memory/.last_audit`) を §6 に追加、新規 memory 作成と既存 memory update を分離 (限定例外条項追記 vs `feedback-vitest-react19-setup-pattern.md` 新規)。

後処理の核心は post-merge sync を本 PR scope 外に分離 (Round 1 G-1 + Round 2 H-2)、squash merge 後の main で別 commit。これは PR #62 と同じ pattern で、`docs/archive/plans/2026-05-15-pr62-round5.md` の post-merge sync で同様の 6 項目を 1 commit に集約した実績あり (squash merge `b8db619` + 後続 `88c6608` / `a5bd0a2` / `6faa104` の 3 commit 後処理 chain)。memory 軽量監査 sentinel touch は本セッションで hook reminder「次の自然な区切りで memory/ 軽量監査を検討」を計 4 回受領済 (Write 後の PostToolUse hook)、本 PR マージ後の post-merge sync が「自然な区切り」として最適。新規 memory `feedback-vitest-react19-setup-pattern.md` は実装過程で発見した罠を後続 PR (7-7b hooks test) に活かす目的、本 plan で template 構造を予告。Plans.md L94 の `[ ] 7-7. Vitest 初期化、@axe-core/react 組込み` を `[x] 7-7a (本 PR)` + `[ ] 7-7b (axe + hooks test)` に split、self-trace 原則で本 PR squashed hash のみ記録。関連 memory: `plan-archive-discipline.md` (完了プランは docs/archive/plans/ に即アーカイブ)、`feedback-archive-relative-path-conversion.md` (archive 時の link 変換、PR #62 で R3 link 切れ 8 件被弾の教訓)。

### 6. 実行制約

> 本 plan §確定事項 (L31-34) で「install 実行主体 = Claude が Bash tool で実行 (CLAUDE.md L82 user 明示承認による許可、advisory state guard pass + lock backup + user 明示承認の 3 条件全達成時のみ)」を明示、Plan rally + ExitPlanMode (L430-441) で Q5 install command 全文提示 → 承認回答取得後実行のプロセスを明記、R12 で実行制約を再強調。

実行制約の核心は CLAUDE.md「重要セキュリティルール §npm install 系コマンド禁止」(CLAUDE.md L82) を **user 明示承認下で例外的に許可**する条件設計。Round 4 N-3 で「1 回限定例外条項」造語をやめ CLAUDE.md L82 直接 ground 表現が望ましいと指摘あり、ただし plan 動作には影響なし、実害 0 で ExitPlanMode を妨げない。具体実行制約: (a) Q1-Q4 user 承認済 (vitest 4.1.5 / happy-dom / option A / 同期 CI、本セッション中で 1 turn の AskUserQuestion 経由取得済)、(b) Q5 = install command 全文提示後の user 最終承認取得が install 実行の必須条件 (ExitPlanMode 後の AskUserQuestion で実施予定)、(c) rollback path = `mv .bak 戻す + rm -rf node_modules + npm ci --ignore-scripts + git reset HEAD` で working tree clean に復元、(d) advisory state 変化 (reopen 等) 時は exit 1 で install 中止、(e) `.npmrc ignore-scripts=true` 検証 fail なら exit 1、(f) 機密情報 grep hit ありなら exit 3 + redact 必須。これらの全 fail-safe で Claude が install を勝手に走らせるリスクを多重 block。Subagent 不適合 (対話判断含むため subagent 経由 install 不可) は本 plan の install を Claude main で実行する判断と整合 (本セッションの hook reminder で確認済)。関連 memory: `feedback-npm-install-blocked-mini-shai-hulud-2026-05.md` (本 plan の限定例外条項適用根拠)、`feedback-codex-p1-empirical-defense.md` (実証反論パターン、Plan rally 各 round で適用)、`feedback-pr-merge-gate-scope-discipline.md` (post-merge sync 分離による scope discipline)。

### 7. コミット分割

> 本 plan §commit 分割 (L274-310) で 4 commit (commit 0 = plan / commit 1 = deps+config+setup+scripts / commit 2 = test files / commit 3 = CI wire) を明示、Round 2 I-2 反映で commit 1+2 を集約、Round 3 K-4 反映で逐次 push (一括しない) + 各段 CI green 確認の意図明示、squash merge 戦略 (J-2 反映) で main bisect 単位を「TDD 基盤投入 1 件」に固定。

コミット分割の核心は各 commit reversible (HEAD revert で前段に戻れる) + bisect 性確保 + scope discipline。commit 0 = plan file 独立 commit で plan 自体の commit lifecycle を切り離す (Round 1 G-1)、commit 1 = test infra setup 一括 (deps + config + setup + scripts + eslint + .gitignore = 7 file、Round 1 C-2 で「肥大化」P3 指摘あったが logical group「test infra 立ち上げ」1 関心に集約で許容、Round 4 K-1 で「集約による drift は許容範囲」確認済)、commit 2 = test files 4 件 (純関数 only、option A)、commit 3 = CI wire (workflow 1 file)。逐次 push (Round 3 K-4) で commit 1 push → CI green 確認 → commit 2 push → CI green 確認 → commit 3 push → CI green 確認の 3 段、CI run 3 回 × 各 ~3-5 分 = 総待機 ~15 分は切り分け容易性のための trade-off (Round 4 N-4 で明示)。squash merge 後の main は 1 commit 集約、Plans.md L94 への hash 記録は squashed hash (self-trace 原則、memory `feedback-self-trace-expression-breaks-sync-loop.md`)。本 PR は Codex review 3 round 以内 close 想定 (memory `codex-non-blocker-incorporation.md` + `codex-review-workflow.md`)、P1 残時は Round 4 P-2 で「user 判断で merge or follow-up PR 切り出し」明記。関連 memory: `feedback-pr-merge-gate-scope-discipline.md` (post-merge sync を本 PR scope 外に分離する scope 膨張防止)、`feedback-codex-drift-fix-grep-all-locations.md` (commit 分割時の drift 一括修正パターン)。

## Related

- 親 task: Plans.md L94 `7-7. Vitest 初期化、@axe-core/react 組込み` (本 plan で 7-7a として実施、7-7b は axe + hooks test に分離)
- 関連 memory (memory file は git 管理外 `~/.claude/projects/-home-kosei-Projects-inventory-system/memory/` 配下、本 plan からは plain text 参照):
  - `feedback-npm-install-blocked-mini-shai-hulud-2026-05.md` (npm install 系凍結ルール、本 plan 限定例外条項適用)
  - `feedback-codex-p1-empirical-defense.md` (PR review 対応の実証パターン、Plan rally で適用)
  - `feedback-archive-relative-path-conversion.md` (archive 時の link 変換、post-merge sync で適用)
  - `feedback-self-trace-expression-breaks-sync-loop.md` (Plans.md sync の self-trace 原則)
  - `feedback-plan-rally-required-before-exit.md` (Plan rally 強制)
  - `feedback-plan-mode-recursive-refinement.md` (Plan agent ラリーで本 plan を 3 round critique 反映済)
  - `plan-self-review-before-implementation.md` (本 plan 7 観点準拠)
  - `feedback-pr-merge-gate-scope-discipline.md` (post-merge sync を本 PR scope 外に分離、scope 膨張防止)
- 関連 docs:
  - `docs/UI_TECH_STACK.md` §2 補 (Vitest + RTL + axe の test 戦略方針)
  - `docs/function-design/53-ui-home.md` (count-stock-status 関数設計)
  - `docs/function-design/55-ui-csv-import.md` (extractFilename / formatErrorRow / reducer 関数設計)
  - `.claude/rules/review-workflow.md` (Codex app PR review フロー)
- 前回参考: PR #62 post-merge sync で `feedback-github-contents-api-utf8-transcoding.md` 新規追加、本 plan も同パターンで memory 補強
