# Test Design Matrix — 監査是正 順9: file 契約一元化

## Risk

Risk: R3

## Contracts Under Test

- D-054①: `CSV_IMPORT_FILE_SIZE_LIMIT` は constants.rs SSOT → bindings 生成定数 → 3 hook。frontend local 複製 0。
- UI-01c-D15: 商品 import CMD は上限超過を validation 拒否（売上/日報 CMD の既存挙動は不変）。
- D-054②: FilePicker 出力 `{ bytes, filename, size }`、dialog + drop 2 経路、cancel null 据え置き、accept / disabled / 上限表示 / a11y label。
- P8b-1: useCsvImportFlow の公開挙動（guard / parse / commit / rollback / kind 別 recovery / blocker / invalidation）を実配線で検査。
- 55-ui §224-258 / §344-365 の画面契約（3 mutation・error recovery・navigation block）。

## Failure Modes

- 上限値の local 複製が残る / 復活し、SSOT 変更が frontend に効かない。
- 商品 import CMD が巨大 file を受理する（直接 IPC bypass）。
- FilePicker の cancel が選択済み state を消す / drop 経路が消える / 置換画面で UX 属性が落ちる。
- 実 hook の guard・recovery・blocker・invalidation の削除/反転が test green で生存する（P8b-1 の現状）。
- 日報取込みの既存挙動が共通化 refactor で変わる。

## Test Matrix

- 既存 test 引用前に rg で実在確認（対象: 売上/日報 CMD の上限 test、return-exchange 画面 test、D-052 invalidation 契約 test、daily-report hook test）。結果を PR body に 1 行記録。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-01c-D15 | 商品 import が上限超過を受理 | unit (Rust) | `test_import_products_req104_rejects_oversize_file`（境界値: 上限ちょうど受理 / +1 拒否） | CMD guard 削除・境界反転 |
| UI-01c-D15 | BIZ 安全網の欠落（CMD bypass 時） | unit (Rust, BIZ) | `test_preview_import_req104_rejects_oversize_file` | BIZ 安全網削除（X9） |
| UI-01c-D15 隣接 | 売上/日報 CMD の上限挙動変化 | regression (既存) | 既存上限 test（実在確認の上引用） | 共通化で既存 guard が変わる |
| D-054① | local 複製残存・復活 | static regression test | `file-contract-no-local-duplicates.test.ts`（`20 \* 1024 \* 1024` / `20971520` リテラルと `type="file"` の sweep。許容 list は FilePicker 実装 + fixture の明示列挙のみ） | 複製・plain input 再導入 |
| D-054① | 生成定数の欠落 | 生成系 (L1) | bindings clean diff + hook の実 import（rg、AC） | 定数 export 削除（FE compile も red） |
| D-054② | cancel が state を消す | unit (vitest) | `FilePicker.test.tsx` cancel case（X7） | null 時に onSelect 発火 / state clear |
| D-054② | drop 経路欠落 | unit (vitest) | `FilePicker.test.tsx` drop case（X8） | drop handler 削除 |
| D-054② | drop 経路の filename が絶対パスのまま流出（Windows WebView2 quirk、旧 `extractFilename` の防御対象） | unit (vitest) | `FilePicker.test.tsx` drop filename 正規化 case（X10。`/`・`\` 入り File.name fixture で basename を期待） | drop 経路の basename 正規化削除 |
| D-054② | 出力契約・属性欠落 | unit (vitest) | `FilePicker.test.tsx`（bytes/filename/size、accept、disabled、a11y label） | 出力欠落・属性 prop 無視 |
| P8b-1 | 20MB guard 削除 | 実配線 hook test | `useCsvImportFlow.test.tsx` guard case（X3。境界 +1 で reject、command 不呼出し） | guard 削除・境界反転 |
| P8b-1 | recovery 反転 | 実配線 hook test | 同 import_error recovery case（X4） | `decideRecoverTo` 配線切断・kind 判定反転 |
| P8b-1 | blocker 削除 | 実配線 hook test | 同 blocker case（X5） | importing 中の `useBlocker` 削除 |
| P8b-1 | invalidation 削除 | 実配線 hook test | 同 invalidation case（X6。D-052 C8/C9 と整合） | 成功後 invalidate 欠落 |
| P8b-1 | parse/commit/rollback 配線 | 実配線 hook test | 同 3 mutation 成功/失敗 case | command 引数誤配線・state 遷移破壊 |

oracle 独立性: 期待文言・state 遷移は 55-ui 契約から独立転記。guard 境界値のみ bindings 生成定数の import を許容する（SSOT 変更に test が追随すべき境界値であり、sweep が複製を禁じるため。この許容判断を本行に明記 — `feedback-test-oracle-must-not-share-ssot` の例外適用）。

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| FilePicker 選択 | 未選択 | dialog open 中 | `{bytes,filename,size}` 通知 | — | — | 同一 file 再選択可 | — | cancel null = 据え置き | 再選択可 | vitest |
| csv-import flow | idle | parsing/committing（blocker 有効） | 完了 + invalidation | D-052 C8/C9 | query 再取得 | reset で idle | — | kind 別 recovery（import_error→idle） | rollback 後 retry | 実配線 hook test |
| 商品 import file | 未選択 | — | 受理（上限以下） | — | — | — | — | 上限超過 = validation 拒否 | 別 file 選択 | cargo test |

workflow-state 行: 順8 と同一運用（content candidate → L1 → 独立 review → state-only human-confirm / Ready、state-only violation は file allowlist + unified=0 hunks 検査、hosted required）。

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| file 選択実装 | FileDropzone / ProductImportDropzone / ReturnExchange input / PreviewStep・ProductImportPreview 再選択 / 日報 path-based（PR #125） | 共通 FilePicker + 5 置換 | 日報画面は移行済み pattern の原型 — 等価 refactor のみ（工数超過時 defer 可、Non-scope） | sweep + 各画面 test |
| 20MB 定数 | constants.rs / 3 hook / 3 CMD / BIZ 側二重防御 2 site（csv_import_service/parse.rs・daily_report_import_service/parse.rs） | 生成定数 + 商品の CMD 早期拒否 + BIZ `preview_import` 安全網（既存二重防御と同型） | `CSV_IMPORT_LINE_LIMIT` は Rust 内完結のため対象外 | sweep + cargo test |
| 実配線 hook test | useDailyReportImportFlow.test.tsx（原型） | useCsvImportFlow.test.tsx | useProductImportFlow の実配線化は P8b 系 follow-up（本 unit は Z004 が対象） | vitest |

## Negative Paths

- missing input: 未選択のまま操作 → 既存 disabled 挙動維持。
- invalid input: 上限超過（UI reject + CMD 拒否の二重）、拡張子外は accept で抑止。
- duplicate/ambiguous input: 同一 file 再選択が機能する（既存 dropzone 契約維持）。
- dependency missing: なし（plugin 導入済み）。
- permission/write failure: readFile 失敗は選択エラーとして表示し state 据え置き。
- dry-run side effect: 該当なし。

## Boundary Checks

- threshold: 上限ちょうど / +1 の境界 test（Rust・hook 両方）。
- null/default: cancel null 据え置き。
- wire type / internal type / producer/consumer / round-trip / precision: packet Boundary / Wire Contract のとおり（20MB は safe integer 内）。
- cross-language parse: bindings 生成 diff（L1）。

## Compatibility Checks

- old schema/input: 既存受理範囲（上限以下の file）は全 CMD で不変。
- new schema/input: 商品 import の上限超過のみ新規拒否。
- optional field behavior: FilePicker props の既定値で既存画面表示を再現。

## Data Safety Checks

- source-derived data: 実店舗 CSV / 画像不使用、synthetic fixture のみ。
- generated outputs: bindings.ts / 90-traceability.md は再生成 commit。
- secrets / local-only: 該当なし / 実 file path はログ・test に残さない。

## Main Wiring / Integration Checks

- FilePicker が 5 箇所から実 import（rg）。
- 生成定数が 3 hook から実 import（rg）。
- 商品 import guard が実 command 経路で発火（実 CMD test）。

## Mutation-style Adequacy Questions

主要 mutation（Final Review で clean committed tree に実注入・kill 実測）:

- X1: 商品 import CMD の上限 guard 削除 → `test_import_products_req104_rejects_oversize_file` red。
- X9: 商品 import BIZ の安全網削除 → `test_preview_import_req104_rejects_oversize_file` red。
- X2: 3 hook のどれかを local リテラルへ戻す → `file-contract-no-local-duplicates.test.ts` red。
- X3: useCsvImportFlow の guard 削除 → 実配線 hook test red。
- X4: import_error recovery 配線切断 → 同 red。
- X5: blocker 削除 → 同 red。
- X6: 成功後 invalidation 削除 → 同 red（+ 既存 D-052 契約 test）。
- X7: FilePicker cancel で state clear → `FilePicker.test.tsx` red。
- X8: drop 経路削除 → 同 red。
- X10: drop 経路の basename 正規化削除 → 同 red（Final Review 一次 P1 是正で追加。旧
  `extractFilename` が担っていた Windows WebView2 絶対パス防御の等価維持を検査）。

- guard 境界反転 → X1/X3 の境界 case red。key branch 反転 → X4。guard 除去 → X1/X3/X5。
  出力 field 欠落 → FilePicker 出力 case red。mock 定数と設計値の区別 → oracle 独立転記
  （許容例外は上記 1 件のみ明記）。

## Residual Test Gaps

- Windows native での dialog 起動挙動は自動化不能 → L3 1 項目（代表 csv-import）。
- useProductImportFlow / useDailyReportImportFlow の実配線深化は本 scope 外
  （前者は P8b 系 follow-up、後者は既存 test あり）。
