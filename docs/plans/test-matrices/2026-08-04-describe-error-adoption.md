# Test Design Matrix: describeError 全面適用

## Risk

Risk: R3

## Contracts Under Test

- UI-ERR-D1（UI_TECH_STACK §6.4）: CmdError 表示変換の describeError 一元化
- UI-ERR-D2（本 change で §6.4 へ新設）: InvokeError `.message` の利用者向け表示禁止
- §6.4 kind 別戦略: internal = message + エラーID + 診断誘導 / validation・duplicate・not_found・import_error 等 = message 素通し
- UI-EB-D3 / 68 §68.7: describeError 適用の明示除外境界（RouteErrorFallback / restore_*）の不変
- CMD-ERR-D1（40-cmd-product §5.3）: error_id の表示到達（消費のみ）

## Failure Modes

- F1: 適用漏れ（manifest 外 or manifest 内の置換漏れで raw message が残る）
- F2: InvokeError デバッグ文字列（`[source:cmd] kind: message`）が利用者向け表示に出る
- F3: internal kind で エラーID・診断誘導が表示されない
- F4: 素通し kind の表示文言が describeError 化で意図せず変わる（regression）
- F5: sweep test の感度不足（違反を検出できない regex / 空集合 oracle の素通し）
- F6: sweep test の過剰検出（guard 分岐・test file・allowlist を違反扱いし CI を恒常 red 化）
- F7: 除外境界の侵食（RouteErrorFallback / BackupRestorePage を誤って書き換える）

## Test Matrix

- cite する既存 test は rg で実在確認済み: `src/lib/describe-error.test.ts` / `src/lib/describe-error-no-local-duplicates.test.ts` / `DisposalPage.test.tsx` / `DailySalesPage.test.tsx` / `MonthlySalesPage.test.tsx` / `OperationLogsPage.test.tsx`（2026-08-04、Coordinator fd/rg）。`useExportFile` は test 不在のため新設。その他の cite は Writer が着手時に再確認する。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-ERR-D1/D2 | F1 | unit（静的 sweep） | `describe-error-adoption-sweep.test.ts` production scan case | 22 site のいずれかが raw message 表示へ戻る / 新規 site が違反パターンを再導入する |
| UI-ERR-D2 | F5 | unit（自己感度） | 同 test file 内の synthetic 違反 fixture positive case（**非空期待。既存 case の改変ではなく新規 case として隔離** — empty-set-oracle-collision 対策） | sweep regex が骨抜きになり違反文字列を検出できない |
| UI-ERR-D2 | F2 | integration | `DailySalesPage.test.tsx` / `MonthlySalesPage.test.tsx` / `OperationLogsPage.test.tsx` へ追加: query error 時に DOM へ `[commands:` 非出現 + describeError 出力表示 | B1-B3 が `.error.message` 直接表示へ戻る |
| UI-ERR-D2 | F2 | unit | `useExportFile.test.ts`（新設）: onError の toast.error 引数が describeError 出力 | B4 が `error.message` 直 toast へ戻る |
| §6.4 internal 戦略 | F3 | integration | `DisposalPage.test.tsx` へ追加: internal kind fixture（error_id 付き synthetic CmdError）で保存失敗 → `エラーID:` を含む表示 | A群で describeError 非経由のまま internal の error_id が落ちる |
| §6.4 internal 戦略 | F3 | unit（既存） | `describe-error.test.ts`（無変更 green 維持） | describeError 本体の internal 分岐が壊れる |
| §6.4 素通し戦略 | F4 | regression（既存） | A群各画面の既存 error 表示 test（validation/duplicate 系 fixture）が無改変で green | describeError 化で素通し kind の文言が変わる |
| UI-ERR-D1 | F1 | evidence | AC5: `rg -n "cmdError\.message" src/features src/components src/lib/hooks -g '!*.test.*'` の hit = 0 件（PR body 添付） | 置換漏れが残る |
| UI-EB-D3 / 68 §68.7 | F7 | evidence + 既存 test | RouteErrorFallback / BackupRestorePage の diff 0（PR diff 検分）+ 両者の既存 test green | 除外境界を誤って書き換える |
| UI-ERR-D1（既存防御） | F1 | unit（既存） | `describe-error-no-local-duplicates.test.ts`（無変更 green 維持） | 画面ローカル describeError の重複定義が再導入される |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| query error 表示（B1-B3） | 非表示 | loading 表示（不変） | データ表示（不変） | 既存 invalidation（不変） | error 消去→再表示（既存挙動） | 既存挙動 | 既存挙動 | **describeError 出力を表示（本 change）** | 既存 retry 設定（不変。**per-page 実測値**: B1 DailySalesPage = global default `retry: 1`〈main.tsx〉/ B2 MonthlySalesPage = 明示 `retry: 1`〈useMonthlySalesReport.ts〉/ B3 OperationLogsPage = 明示 `retry: 0`〈OperationLogsPage.tsx、261・279 行の両 query〉。test の mock reject 回数設計は各値に従う。ただし B1 の page test 自体は表示 assertion 分離のため test QueryClient で `retry: false` を用いており、production の retry:1 は設定実読で確認する〈Codex FR F3 訂正〉） | page test |
| mutation error 表示（A群 saveError / B4 toast） | 非表示 | 送信中（不変） | 成功表示（不変） | — | — | — | — | **describeError 出力を表示（本 change）** | 手動再操作（不変） | page test + useExportFile test |

状態機械そのものは変更せず、Failure 列の表示内容のみが変わる。restore_* の state machine（68 §68.7）は non-scope。

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| error-kind mapping（describeError 適用） | src/features・src/components・src/lib/hooks 全 production file を rg 全数実査（packet Scope の manifest） | A1-A18 / B1-B4 の 22 site | packet Scope の明示除外表 6 分類（RouteErrorFallback / BackupRestorePage / IntegrityCheckPage / validation guard / Zod issue / ensureInvokeError infra） | sweep test + AC5 rg evidence |
| toast への error 直渡し | `toast.error` 全 site を Writer が着手時に再 enumerate | B4 | describeError 済み site は不変 | useExportFile test + sweep |

## Negative Paths

- missing input: describeError(undefined) → fallback 経路（既存 unit test）
- invalid input: 非 CmdError object → fallback → String(error)（既存 unit test）
- duplicate/ambiguous input: 該当なし
- unknown reference: unknown kind の CmdError → message 素通し（既存挙動維持）
- dependency missing: 該当なし
- permission/write failure: export 失敗（B4）が describeError 経由で表示される
- dry-run side effect: 該当なし

## Boundary Checks

- threshold: 該当なし
- null/default: describeError の fallback 引数（A群で画面既定文言を fallback に渡す site の挙動維持）
- empty/non-empty: sweep の production scan は空集合期待、synthetic fixture case は非空期待（対で持つ）
- min/max: 該当なし
- status/policy enum: kind 6 分類（§6.4 表）の分岐は describeError 既設、無変更
- wire type: CmdError JSON 不変
- internal type: InvokeError（表示禁止 = UI-ERR-D2）
- producer/consumer: CMD 層 → describeError → 画面
- round-trip token: 該当なし
- precision/range: 該当なし
- cross-language parse: 該当なし

## Compatibility Checks

- old schema/input: CmdError wire 不変のため互換性影響なし
- new schema/input: なし
- output order: 該当なし
- optional field behavior: `error_id?` 欠落時（非 internal kind）は従来どおり message のみ表示

## Data Safety Checks

- source-derived data: 実店舗データ・実エラーログ不使用
- generated outputs: なし（bindings / routes / traceability は diff 0 確認、diff が出れば再生成を含める）
- secrets: 該当なし
- local-only files: なし
- synthetic sample boundaries: fixture の error_id は合成値（`E-20260101-000000-0000` 形式）のみ

## Main Wiring / Integration Checks

- helper connected to main path: 22 site すべてが実画面の表示経路（JSX / setState / toast）で describeError を呼ぶ（AC5 rg evidence で全数確認）
- output reaches manifest/report: 該当なし
- effective config reaches runtime: 該当なし
- CLI arg reaches implementation: 該当なし

## Mutation-style Adequacy Questions

計画 mutation（実装後、Writer 自己実測 + Coordinator 記録非参照独立再実測の双方で全 red を確認。clean tree でのみ実測 — mutation-test-on-clean-tree の教訓）:

- X1: `DisposalPage` の describeError 呼びを `cmdError.message` へ revert → sweep test red + internal regression（AC4）red
- X2: `describe-error.ts` の internal 分岐から `（エラーID: ...）` 併記を除去 → `describe-error.test.ts` red
- X3: `MonthlySalesPage` を `query.error.message` 直接表示へ revert → AC2 negative assert red + sweep red
- X4: `useExportFile` の onError を `error.message` 直 toast へ revert → AC3 red + sweep red
- X5: sweep test の scan 対象から `src/lib/hooks` を除外する mutation → synthetic fixture case は green のままだが、X4 revert との組合せで検出漏れ（sweep green）になることを確認し、X4 側の unit test（AC3）が独立に red になることで防御の二重性を実証
- X6: sweep ALLOWLIST へ file を不正追加 → 内容固定 assertion「keeps the file-level ALLOWLIST and line-exclusion patterns pinned to their justified minimum」が red（Amendment 1 = `c4730e5` で review 検分依存から自動 red 化へ格上げ。AC5 rg evidence との突合は二次防御として継続）
- X7: B群 test の negative assert（`[commands:` 非出現）を弱体化（assert 削除）→ X3 revert が素通りすることを確認し、sweep が独立に red になることで二重防御を実証

template 標準問への回答:

- mock 値が design 期待値と異なる場合: internal fixture の error_id は合成値で、AC4 は `エラーID:` label の存在を assert（値の SSOT 転記をしない — test-oracle-must-not-share-SSOT の教訓）
- key branch 反転: describeError の kind 分岐反転は既存 unit red（X2 系）
- guard 除去: sweep の allowlist 突破は X6
- output field 省略: error_id 省略は X2
- 空集合 oracle: sweep の synthetic positive case（F5 行）が防御

## Residual Test Gaps

- sweep は静的 regex 検査であり、意味的な言い換え（変数へ代入してから表示等）は完全検出できない。二重防御として代表 regression（AC2-AC4）と Reviewer の独立 re-enumerate を置く。全 site への画面 test 追加は費用対効果で不採用（型ごと代表 + sweep 全数の組合せ）
- `ReceivingPage` / `ReturnExchangePage` / 記録詳細 4 画面の internal 表示は代表（DisposalPage）と同型のため個別 test を追加しない。同型性が崩れる実装になった場合は Writer が fail-closed で報告する
