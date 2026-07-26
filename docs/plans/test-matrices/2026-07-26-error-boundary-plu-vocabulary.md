# Test Design Matrix — 監査是正 順8: error 境界 + PLU 語彙

## Risk

Risk: R3

## Contracts Under Test

- CMD-ERR-D1: internal / restore_* 系 `CmdError` は `error_id`（`E-<YYYYMMDD-HHMMSS>-<4hex>`）を持ち、同一値が `tracing::error!` 経由で診断ログに載る。
- CMD-ERR-D2: internal の `message` は操作文脈定型文言のみ。raw detail は tracing 側のみ。
- BIZ-04-D2: PluFormatError → `BizError::ExportError` → `kind="export_error"`。既存 import_error 変換・recovery 分岐は不変。
- IO-04-D1: `PluFileOutput` / `plu_output` rename 完了、`PluExportPrepareResponse` wire shape 不変。
- UI-ERR-D1: kind→文言変換は `src/lib/describe-error.ts` に一元化。internal 系は message + error_id + 診断ログ誘導。

## Failure Modes

- error_id が wire または log の片側に欠ける / 不一致 / 形式不正。
- internal message に raw error Display（SQLite / OS error / パス）が混入する。
- PLU 書出し失敗が `import_error` に戻る、または旧語彙が残存する。
- describeError の internal 分岐が消えて raw message 素通しに戻る。
- 画面ローカル describeError が再導入され表示が再分裂する。
- restore_* を実際に発生させる唯一の画面（BackupRestorePage restore catch / fatal Alert）が error_id を表示しない（Plan Review 一次 P1）。
- rename が既存 PLU export の wire shape / 挙動を壊す。

## Test Matrix

- Before citing an existing test as regression coverage, use `rg` or an equivalent repository search to verify that the cited test exists.
- 既存 test の実在確認は Writer が実装前に `rg` で行い、PR body に確認結果を 1 行残す（対象: PLU prepare/confirm test 群、BizError→CmdError 変換 test、import recovery hook test）。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| CMD-ERR-D1 | error_id が wire/log で欠落・不一致 | unit (Rust, `test_tracing.rs` harness) | `test_internal_error_id_req700_wire_log_match` | error_id 生成が None 固定、tracing 記録から error_id / detail が欠落、wire と log の値が別生成 |
| CMD-ERR-D1 | error_id 形式逸脱 | unit (Rust) | 同上内 regex assert（`^E-\d{8}-\d{6}-[0-9a-f]{4}$` を独立転記） | 形式変更・prefix 欠落 |
| CMD-ERR-D1 | restore_* が error_id を持たない | unit (Rust) | `test_restore_kinds_req700_carry_error_id` | restore 系 constructor の error_id 付与漏れ |
| CMD-ERR-D2 | message に raw detail 混入 | unit (Rust) | `test_internal_message_req700_excludes_raw_detail` | internal() が detail を message に連結する方向へ復帰 |
| CMD-ERR-D2 | 呼出し site の旧パターン残存 | static sweep（AC） | `rg 'internal\(' src-tauri/src/cmd` sweep（PR body 記録） | `format!("...: {}", e)` を message 引数に渡す site が残る |
| BIZ-04-D2 | export 失敗が import_error に戻る | unit (Rust) | `test_plu_format_failure_req402_maps_to_export_error` | ExportError→"import_error" への逆転、From 変換漏れ |
| BIZ-04-D2 隣接 | import 経路の巻き添え変更 | regression (既存) | 既存 import_error 変換 test + `decideRecoverTo` hook test（実在確認の上引用） | ImportError 変換・recovery 分岐の挙動が変わる |
| IO-04-D1 | 旧語彙残存 | static sweep（AC） | `rg 'PluCsvOutput|csv_output' src-tauri/src src` 0 hit | rename 取り残し |
| IO-04-D1 隣接 | PLU export 挙動破壊 | regression (既存) | 既存 PLU prepare/confirm test 群（実在確認の上引用） | rename が field 対応・wire shape を壊す |
| UI-ERR-D1 | internal 表示契約の欠落 | unit (vitest) | `describe-error.test.ts`（oracle は期待文言の独立転記。production 定数 import 禁止） | internal 分岐削除・error_id 節欠落・誘導文言欠落 |
| UI-ERR-D1 | 非 internal kind の文言 regression | unit (vitest) | `describe-error.test.ts`（validation / export_error / unknown kind の pass-through） | describeError が非 internal message を書き換える |
| UI-ERR-D1 | ローカル describeError 再導入 | static regression test | `describe-error-no-local-duplicates.test.ts`（repo sweep を test 化。X7） | `src/features` / `src/components` にローカル定義が再出現 |
| CMD-ERR-D1 / 68 §68.7 | restore_* 画面が error_id を表示しない | unit (vitest) | `BackupRestorePage.test.tsx` へ restore_* error_id case 追加（recoverable / unrecoverable / durability_unknown の 3 分岐） | restore catch / fatal Alert の error_id 併記欠落、68 文言の意図しない変更 |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| 画面 error 表示（describeError 置換 4 画面） | error なし | 操作中 | 表示なし | — | — | 再訪で消える（既存挙動維持） | — | internal → error_id 付き定型文言 / その他 kind → message | 再操作で新 error_id（毎回発行） | vitest + 視認スクショ |
| PLU export error 経路 | idle | prepare 中 | ファイル生成 | — | — | — | — | `export_error`（message は BIZ 文言のまま） | 再 prepare 可（plu_dirty 不変は既存 test） | cargo test |
| 診断ログ相関 | — | — | — | — | — | — | app 再起動後もログファイルに error_id 残存（日次ローテ内） | log に error_id + raw detail | 新規 error は新 error_id | cargo test（harness 捕捉） |

workflow-state 行:

- content candidate -> L1 / independent review -> state-only human-confirm commit
- owner authorization -> Draft state-only Ready commit -> exact-HEAD L1 -> PR body -> Ready/dispatch -> merge with no later tracked commit
- state-only violation: file allowlist と `git diff --unified=0` hunks の両方を検査。Scope / AC / 契約 / Matrix 変更は implementing へ戻す
- hosted-not-required incidental failure: 本 change は hosted required のため該当なし

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| error-kind→文言変換 | ローカル describeError 4（BackupRestore / PluExport / IntegrityCheck / Stocktake）、CSV 専用 `ErrorState.tsx`、restore_* kind 別固定文言（BackupRestorePage restore catch）、直接 message 表示 約15 箇所 | `src/lib/describe-error.ts` + 4 画面置換（BackupRestore はロード系経路のみ） | `ErrorState.tsx` は 55-ui-csv-import §55.5、restore_* 表示は 68 §68.7 の画面固有設計として維持（error_id 併記のみ追加）。直接表示 約15 箇所は owner 裁定で follow-up（Plans.md 記録） | vitest + 静的 sweep test |
| `import_error` kind 消費分岐 | `useProductImportFlow.ts` / `useCsvImportFlow.ts` / `useDailyReportImportFlow.ts` の `decideRecoverTo`、`ErrorState.tsx` | 変更なし（export_error はどの分岐にも入らない） | import 系 recovery は本 change の非目的 | 既存 hook test green |
| raw detail の log 退避（warn 系） | `.claude/rules/implementation-quality.md` の warn パターン（MNT 系） | internal error でも detail→tracing の同型を採用 | warn 系（継続可能失敗）は順7 で整備済み、本 change は error 系のみ | cargo test |

## Negative Paths

- missing input: error_id なし payload（旧形式）→ describeError が ID 節省略。
- invalid input: unknown kind → message pass-through（既存挙動）。
- duplicate/ambiguous input: 同時多発 error → error_id は発行毎に一意（4hex 乱数部）。厳密一意性は保証対象外（診断突合用途では時刻+乱数で実用十分、D-053）。
- unknown reference: 該当なし。
- dependency missing: 該当なし（新規依存なし）。
- permission/write failure: 診断ログ書込み失敗時も wire response は返る（tracing は fire-and-forget、既存挙動）。
- dry-run side effect: 該当なし。

## Boundary Checks

- threshold: 該当なし。
- null/default: `error_id: None` の serialize（null / undefined）を bindings 型と describeError が処理。
- empty/non-empty: message 空文字は契約違反として test で拒否（定型文言必須）。
- min/max: 該当なし。
- status/policy enum: kind 文字列語彙に `export_error` 追加。enum 化は順14。
- wire type: `{ kind, message, field?, error_id? }`。
- internal type: Rust `CmdError` / TS `InvokeError.cmdError`。
- producer/consumer: serde → invoke.ts → describe-error.ts。
- round-trip token: error_id が Rust 発行 → JSON → 画面表示まで無変換で往復。
- precision/range: ASCII 固定形式、数値精度論点なし。
- cross-language parse: bindings.ts 再生成で型同期（L1 生成系検査）。

## Compatibility Checks

- old schema/input: error_id なし payload の表示互換（ID 節省略）。
- new schema/input: error_id 付き internal の新表示。
- output order: 該当なし。
- optional field behavior: `Option<String>` → `string | null`（bindings 再生成 diff で確認）。

## Data Safety Checks

- source-derived data: 実店舗データ不使用、fixture は synthetic。
- generated outputs: bindings.ts / 90-traceability.md は再生成して commit（AUTO-GENERATED 手動編集なし）。
- secrets: 該当なし。
- local-only files: 実診断ログファイルは commit しない。
- synthetic sample boundaries: スクショは synthetic データ画面のみ。

## Main Wiring / Integration Checks

- helper connected to main path: 4 画面が `src/lib/describe-error` を実 import（rg で確認、AC）。
- output reaches manifest/report: error_id が実際の command 経路（実 CMD 呼出し test）で wire に載る。
- effective config reaches runtime: 該当なし。
- CLI arg reaches implementation: 該当なし。

## Mutation-style Adequacy Questions

主要 mutation 候補（Final Review で clean committed baseline に実注入して kill を確認する。
`feedback-mutation-test-on-clean-tree-only` / `feedback-mutation-kill-claims-need-reproduction` 適用）:

- X1: error_id 生成を `None` 固定に → `test_internal_error_id_req700_wire_log_match` red。
- X2: `tracing::error!` から error_id / detail field を除去 → 同 test の log 側 assert red。
- X3: `internal()` が detail を message に連結する実装へ復帰 → `test_internal_message_req700_excludes_raw_detail` red。
- X4: ExportError→CmdError 変換の kind を `"import_error"` に逆転 → `test_plu_format_failure_req402_maps_to_export_error` red。
- X5: describeError の internal 分岐を削除（default fallthrough）→ `describe-error.test.ts` red。
- X6: restore_* constructor の error_id 付与を除去 → `test_restore_kinds_req700_carry_error_id` red。
- X7: 画面 1 つにローカル describeError を再導入 → `describe-error-no-local-duplicates.test.ts` red。
- X8: BackupRestorePage restore catch / fatal Alert の error_id 併記を除去 → `BackupRestorePage.test.tsx` の restore_* error_id case red。

- If a mock value is changed so it differs from the design-doc expected value, which assertion proves the implementation used the correct source? → describe-error oracle は期待文言を独立転記し完全一致比較（production 定数 import 禁止）。
- If a key branch is inverted, which test fails? → X4 / X5。
- If a guard is removed, which test fails? → X3（sanitize）/ X7（重複 sweep）。
- If an output field is omitted, which test fails? → X1 / X6（error_id）、bindings 生成系検査（型）。
- If output order changes / dry-run side effect / JS safe integer / state token round-trip → 該当なし（本 change に該当構造なし）。
- If tracked Workflow State stores the current PR HEAD → 保存しない（PR body が正本、D-035）。

## Residual Test Gaps

- error_id の厳密一意性（同一ミリ秒・同一 4hex 衝突）は test 対象外 — 診断突合用途では
  時刻 + 乱数で実用十分と D-053 で判断済み。
- 診断ログの日次ローテーション跨ぎでの error_id 検索性は手動運用（閲覧画面なし）。
- raw message 直接表示 約15 箇所は本 change の防御対象外（backend sanitize で技術詳細
  漏れ自体は塞がる。表示一元化は follow-up）。
