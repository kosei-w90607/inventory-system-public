# Plan Packet — 監査是正 順8: 利用者向け error と診断相関情報の共通境界化 + PLU書出し error 語彙の分離

## Workflow State

- Phase: implementing
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: cb7050d
- Amendments: 9615b8e, 67cef27
- Coordinator: Fable 5（本 thread。scope 精査・Design Phase・packet 作成・レビュー裁定）
- Writer: Codex（owner relay 発注。Plan 承認後の単独 writer）
- Plan Reviewer: Sonnet 5 fresh context（Fable が subagent として起動し、findings を Fable が裁定）
- Final Reviewer: Sonnet 5 fresh context（Fable が subagent として起動し、findings を Fable が裁定）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: 視認確認 1 件 — internal error 表示（error_id 付き定型文言）の dev 環境スクリーンショットを PR body で owner が目視 PASS/FAIL。Windows native L3 checklist は不要（L3 Eligibility 条件 (1) 不成立: 観察対象は dev 環境で再現可能で Windows/Tauri native 固有ではない）

- State Narrative（2026-07-26）: Fable 5 が本 thread で scope 精査を実施した。監査 finding
  P3-4 / P7b-3 の証拠行を現 HEAD（`c90a54e` 基準）で再確認し、監査時の行番号ズレはあるが
  同型パターン（internal message への raw 詳細透過、describeError 重複 4 箇所、
  `PluCsvOutput` / `import_error` 語彙）が現存することを確認した。owner 裁定
  （2026-07-26）: raw message 直接表示 約15 箇所の共通 describeError 移行は順8 に
  **含めない**（backend sanitize で技術詳細漏れの害は塞がるため。follow-up として
  `Plans.md` に記録）。Design Phase の成果（40-cmd-product §5.3 CMD-ERR-D1/D2、
  41-cmd-pos §17.4 BIZ-04-D2、25-io IO-04-D1、33-biz、UI_TECH_STACK §6.4 UI-ERR-D1、
  ARCHITECTURE.md、decision-log D-053）と本 packet・Test Design Matrix を同一
  plan-first content commit にまとめ、`kickoff -> spec-check -> design -> plan-draft ->
  plan-gate` を materialize する。Plan 承認前に production code は変更しない。

- State Narrative（2026-07-26、Plan Review 一次）: Plan Reviewer（Sonnet 5 fresh
  context）は P1=1 / P2=0 / P3=2、総評「条件付き承認可」。P1 = restore_* 3 kind を
  実際に発生させる唯一の画面（BackupRestorePage restore catch / fatal Alert）が
  error_id を表示しない配線ギャップ — 事実として accept。ただし修正方向は reviewer
  提案（describeError への置換）ではなく、68-ui-backup-restore §68.7 の kind 別
  recovery 文言・state machine 設計を維持した **error_id 併記** へ Coordinator 裁定
  （68 §68.7 / UI_TECH_STACK §6.4 / 本 packet Scope・Ledger・AC・Trace Matrix・
  Matrix X8 に反映）。P3-1（CmdError struct literal 16 箇所 + BizError Display arm の
  機械追随の Scope 明記）と P3-2（41-cmd-pos DatabaseError 行の error_id 不整合）は
  accept・反映済み。是正は plan-gate 内修正（Phase 据え置き）で、再レビューは同
  reviewer context の差分確認で行う。

- State Narrative（2026-07-26、Plan Review 再レビュー）: 同 reviewer context の差分
  再レビューは P1=0 / P2=1 / P3=1。P1（restore_* 配線ギャップ）の是正方向・検出手段は
  妥当と確認された。P2 = 是正で新たに生じた packet 内自己矛盾（Boundary / Wire
  Contract・Spec Contract・Design Intent Trace・Review Focus の 4 セクションが
  「restore_* も describeError を通る」前提のまま）— accept、4 箇所へ restore_* 例外を
  一括反映。P3 = error_id の DOM 配置未規定 — accept、68 §68.7 に「別要素併記で既存
  完全一致 assertion の書換え最小化」を追記。反映後、reviewer の P1/P2=0 確認を経て
  plan-approved 遷移を owner に諮る。

- State Narrative（2026-07-26、owner Plan 承認 / state-only）: 再レビュー第 3 round で
  Plan Reviewer が P1/P2/P3 = 0 と「新たな矛盾なく plan-approved 遷移可」を報告した。
  owner は Plan を承認した（この change での介入 1 回目 / 予算 3 回）。plan-first
  commit `cb7050d` を `Plan Commit` へ固定し、plan-gate 内是正 `9615b8e` / `67cef27` を
  `Amendments` へ記録する。`plan-gate -> plan-approved -> implementing` を隣接 forward
  transition として materialize する。P1/P2=0 の reviewer 報告・plan-first commit が全
  実装 commit に先行する条件は、この state-only commit より前に存在する。実装は Codex
  発注（owner relay）で開始する。

## Owner Effort Budget

- 介入回数上限: 3（Plan 承認 / Ready / merge）
- 実働時間上限: 30分
- relay 往復上限: 2（Codex 実装発注 + 必要時の追発注）

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 3 回` + `承認すると利用者から見て何が完了するか1文`。

## Risk

Risk: R3

Reason:
`CmdError` の wire shape（`error_id: Option<String>` の additive 追加）と kind 語彙
（`export_error` 新設、PLU 書出し失敗経路の kind を `import_error` から変更）を変え、
generated bindings の再生成を伴う。operator 可視のエラー表示文言（internal 系の
error_id 併記 + 診断ログ誘導）も変わるため R2 ではない。一方、restore 系 kind への
error_id 付与は additive で、MNT-01 の restore semantics・rollback・durability 契約、
DB schema、既存 import 系の recovery 分岐挙動は一切変えないため R4 には上げない。
労力は監査時見積りどおり M（internal 呼出し約 70 箇所の機械的移行 + 新規契約 test）。

## Goal

Goal Invariant:

### 最小完了条件

- internal 系エラーで利用者画面に raw 技術詳細（SQLite / OS error / ファイルパス）が
  表示されず、操作文脈の定型文言 + error_id が表示される。
- 同一 error_id と raw 詳細が診断ログに記録され、画面表示と突合できる。
- PLU 書出し失敗が wire 上 `kind="export_error"` で返る（`import_error` ではない）。

### 失敗定義

- internal 生成箇所のいずれかが raw error Display を wire message に残す
  （`format!("...: {}", e)` を message に渡すパターンの残存）。
- error_id が wire と診断ログのどちらかに欠ける、または一致しない。
- PLU formatter 失敗が `import_error` のまま、または `PluCsvOutput` / `csv_output`
  語彙が実装に残存する。
- 画面ローカル describeError の重複（4 箇所）が残る、または再導入を検出できない。
- 既存 import 系（CSV / 日報取込み）の recovery 分岐挙動が変わる。

### 非目的

- CmdError kind 全列挙の enum 化（監査是正 順14 の scope）。
- raw message 直接表示 約15 箇所の共通 describeError への移行
  （owner 裁定 2026-07-26 で除外。follow-up として Plans.md に記録）。
- operation_logs との error 相関設計・診断ログ閲覧画面の新設。
- duplicate / not_found の導線付き表示 UI。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

- CMD: `CmdError` に `error_id: Option<String>` を追加（serde / specta）。
  `CmdError::internal(user_message, detail)` の新契約実装（CMD-ERR-D1/D2）:
  error_id 発行（`E-<YYYYMMDD-HHMMSS>-<4hex>`、chrono + uuid 既存依存のみ）、
  raw detail は error_id とともに `tracing::error!` のみ、message は操作文脈定型文言。
  既存 internal 呼出し（全 CMD module、約 70 箇所）を新契約へ移行し、
  `format!` で raw error を message に混ぜるパターンを根絶する。
- CMD: restore 系 3 kind（`restore_failed_recovered` / `restore_failed_unrecoverable` /
  `restore_durability_unknown`）の constructor にも error_id を付与（additive。
  message / detail の既存内容・restore semantics は不変）。
- BIZ: `BizError::ExportError(String)` 新設、`From<BizError> for CmdError` に
  `export_error` 変換を追加（BIZ-04-D2）。`plu_export_service` の PluFormatError
  変換を `ImportError` から `ExportError` へ変更。
- IO/BIZ/CMD: `PluCsvOutput` → `PluFileOutput`、field `csv_output` → `plu_output` の
  rename（IO-04-D1。内部型のみ、`PluExportPrepareResponse` の wire shape は不変）。
- UI: `src/lib/describe-error.ts` 新設（UI-ERR-D1。kind 別変換、internal は
  message + `（エラーID: {error_id}）` + 診断ログ誘導文言）。画面ローカル
  describeError 4 箇所（`BackupRestorePage.tsx` / `PluExportPage.tsx` /
  `IntegrityCheckPage.tsx` / `StocktakePage.tsx`）を共通関数へ置換。
  BackupRestorePage の置換対象はロード系エラー経路（listBackups / getSettings 等）のみ。
- UI: `BackupRestorePage.tsx` の restore catch 経路（recoverable 定型 message と
  fatal Alert）に error_id を併記する（68-ui-backup-restore §68.7 の改訂契約。
  kind 別 recovery 文言・state machine は不変、describeError は使わない）。
- CMD/BIZ 機械追随: `CmdError` struct literal 直接構築（settings / sales / plu_export /
  daily_report_import / csv_import cmd の計 16 箇所）への `error_id` field 追加と、
  `BizError` の Display exhaustive match への `ExportError` arm 追加
  （いずれもコンパイラが強制検知する機械的変更）。
- 再発防止: 画面ローカル describeError 再導入と internal raw-detail 混入パターンの
  静的 sweep test（Matrix X7 参照。lint 単独ではなく repo sweep を test 化）。
- 生成系: `cargo run --bin generate_bindings` で `bindings.ts` 再生成。
- source design docs（40-cmd-product / 41-cmd-pos / 25-io / 33-biz / UI_TECH_STACK /
  ARCHITECTURE / decision-log D-053）は本 plan-first commit で更新済み。

## Non-scope

- kind 全列挙の enum 化（順14）。`kind: String` のまま。
- raw message 直接表示 約15 箇所（ProductFormPage 等）の移行（follow-up）。
- CSV 取込み専用 `ErrorState.tsx`（55-ui-csv-import §55.5）の変更 — 既存設計どおり維持。
- import 系 recovery 分岐（`decideRecoverTo` 3 箇所）の挙動変更。
- operation_logs テーブル・診断ログ（70-mnt-diagnostic-log）の実装変更。
- DB schema / migration。

## Acceptance Criteria

- `rg -n 'internal\(' src-tauri/src/cmd` の全呼出しが `internal(user_message, detail)`
  の 2 引数契約で、message 引数に `format!` で error 値を埋め込む箇所が 0 件
  （sweep 結果を PR body に記録）。
- `rg -n 'PluCsvOutput|csv_output' src-tauri/src src` が 0 hit。
- `cargo test` green。新規 test（Matrix 記載の
  `test_internal_error_id_req700_wire_log_match` /
  `test_internal_message_req700_excludes_raw_detail` /
  `test_restore_kinds_req700_carry_error_id` /
  `test_plu_format_failure_req402_maps_to_export_error`）を含む。
- `npm test`（vitest）green。`describe-error.test.ts` の internal 表示契約 test
  （期待文言は独立転記 oracle、production 定数 import 禁止）と、
  `BackupRestorePage.test.tsx` の restore_* 3 kind 画面 error_id 表示 test を含む。
- `rg -n 'const describeError|function describeError' src/features src/components` 0 hit
  かつ静的 sweep test が存在する。
- 再生成後の `bindings.ts` に `error_id` field が現れる（diff を PR に含める）。
- dev 環境の internal error 人工発生スクリーンショットで `エラーID: E-` の併記文言が
  読めること（synthetic データのみ）。PR body の視認確認節に添付し、owner の目視
  `PASS` 記録を得る。
- `cargo fmt --check` / `cargo clippy -- -D warnings` / L1 `local-ci.sh full` CLEAN。

## Design Sources

- Requirements / spec: REQ-402（PLU 書出し）、監査 finding P3-4
  （`docs/research/audit-2026-07/findings/p3-error-handling.md`）/ P7b-3
  （同 `p7-readability-idioms-naming.md`）
- Architecture: `docs/ARCHITECTURE.md`（ARCH-VAL-D1 節。本 PR で error_id 付与境界を追記）
- Function / command / DTO: `docs/function-design/40-cmd-product.md` §5.3
  （CMD-ERR-D1/D2）、`41-cmd-pos.md` §17.4（export_error / BIZ-04-D2）、
  `25-io-plu-formatter.md`（IO-04-D1）、`33-biz-plu-export-service.md`、
  `70-mnt-diagnostic-log.md`（参照のみ、変更なし）
- DB: なし（schema 不変）
- Screen / UI: `docs/UI_TECH_STACK.md` §6.4（UI-ERR-D1）、
  `55-ui-csv-import.md` §55.5（参照のみ、変更なし）
- Decision log / ADR: `docs/decision-log.md` D-053

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 40-cmd-product §5.3 / 41-cmd-pos §17.4 / 33-biz / 25-io | updated in this PR |
| Command / DTO / generated binding / wire shape | 40-cmd-product §5.3 + 本 packet Boundary / Wire Contract | updated in this PR |
| DB / transaction / audit / rollback / migration | 変更なし | existing sufficient |
| Screen / UI / route state / Japanese wording | UI_TECH_STACK §6.4 | updated in this PR |
| CSV / TSV / report / import / export format | PLU `.txt` 形式自体は不変（語彙のみ）。25-io | updated in this PR |
| Durable decision / ADR | decision-log D-053 | updated in this PR |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| `CmdError.error_id` field（specta 型変更） | `cargo run --bin generate_bindings` で `bindings.ts` 再生成（L1 full の生成系検査対象） |
| 新規 Tauri command | なし（既存 command の型変更のみ、`collect_commands` 変更なし） |
| function-design doc 新設 | なし（既存 doc 更新のみ、`build_doc_to_modules_map()` 変更なし） |
| route / operator 画面新設 | なし |
| REQ coverage 追加 | 新規 test に REQ 番号を含めるため、`cargo run --bin generate_traceability` で `90-traceability.md` 再生成 |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| P3-4 | 40-cmd-product §5.3 | CMD-ERR-D1 | 相関キーは実在する診断ログ × CMD 発行 error_id。operation_logs 相関は error 時にログ挿入自体が失敗し得る自己矛盾で却下（D-053） | `src-tauri/src/cmd/mod.rs` | `test_internal_error_id_req700_wire_log_match` |
| P3-4 | 40-cmd-product §5.3 | CMD-ERR-D2 | raw 詳細の wire 混入禁止。完全固定一文は操作文脈が消えるため、操作文脈定型 + raw 禁止の中間を採用 | `src-tauri/src/cmd/*.rs` 全 internal 呼出し | `test_internal_message_req700_excludes_raw_detail` + AC sweep |
| P3-4 | UI_TECH_STACK §6.4 | UI-ERR-D1 | 表示変換の一元化。画面ローカル重複は表示分裂の再発源 | `src/lib/describe-error.ts` + 4 画面 | `describe-error.test.ts` + 静的 sweep test |
| P7b-3 / REQ-402 | 41-cmd-pos §17.4 | BIZ-04-D2 | export 失敗を取込み recovery 語彙から分離。import_error 温存は将来の共通 handler 化で誤誘導 | `biz/plu_export_service.rs` / `biz/mod.rs` / `cmd/mod.rs` | `test_plu_format_failure_req402_maps_to_export_error` |
| P7b-3 / REQ-402 | 25-io / 33-biz | IO-04-D1 | 実体（tab 区切り `.txt`）語彙へ改名。「互換維持」注記は IPC contract 制約ではないと監査で確認済み | `io/plu_formatter.rs` ほか rename 全域 | AC rg 0 hit + 既存 PLU test green |
| P3-4 | 68-ui-backup-restore §68.7 | 68 §68.7 error_id 併記（D-053 配下） | describeError への置換案は Codex round で確定した kind 別 recovery 文言・state machine 契約を壊すため却下し、文言維持 + error_id 別要素併記を採用（Plan Review 一次 P1 裁定） | `BackupRestorePage.tsx` restore catch / fatal Alert | `BackupRestorePage.test.tsx` restore_* error_id case |

## Design Intent Audit

- Source docs can answer what/why without chat history: 可。CMD-ERR-D1/D2 / BIZ-04-D2 /
  IO-04-D1 / UI-ERR-D1 は各 source doc に、横断判断と却下代替案は D-053 に記録済み。
- Plan-only durable decisions found and promoted: なし（本 packet 起票前に全て昇格済み）。
- Assumptions and constraints: chrono / uuid は既存依存（`src-tauri/Cargo.toml` 実確認済み）。
  tracing 出力の test 捕捉は既存 harness `src-tauri/src/test_tracing.rs` を使う。
- Deferred design gaps, risk, and follow-up target: 診断ログ閲覧画面なし（誘導文言は
  「診断ログに記録されています」に留める。D-053 revisit）。UI 直接表示 約15 箇所の移行は
  Plans.md follow-up。
- Test Design Matrix can cite design decision IDs: 可（Matrix は CMD-ERR-D1/D2 /
  BIZ-04-D2 / IO-04-D1 / UI-ERR-D1 を引用）。
- Absolute guarantee / escape hatch self-check: 「raw 詳細を message に含めない」の
  escape hatch = BIZ 由来 message の pass-through 経路（validation 等）は BIZ が利用者向け
  日本語文言を所有する既存契約（ARCH-VAL-D1）で担保され、本 change の禁止対象は
  CMD 境界の internal 系 detail 引数のみ。DatabaseError は既存の固定文言変換を維持。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | PLU 語彙は CV17 adapter 実体（`.txt`）に合わせる。CmdError は app-core 契約 | 25-io / 40-cmd-product |
| Fact check / design decision split | 「操作ログID で相関」は事実未成立（operation_logs は error と非連結）と実査で確定 → 契約側を是正 | D-053 |
| Lifecycle / retry | error 表示は終端状態。retry 挙動・import recovery 分岐は不変 | Matrix State Lifecycle |
| Operator workflow | operator は画面の error_id を口頭/メモで伝えるだけで診断突合が可能になる | UI_TECH_STACK §6.4 |
| Replacement path | not applicable（外部システム置換なし） | — |
| Data safety / evidence | raw 詳細はローカル診断ログのみ。スクショは synthetic データ画面のみ | 本 packet Data Safety |
| Reporting / accounting semantics | not applicable（集計意味論に非接触） | — |
| Manual verification | internal error 表示の視認 1 件（dev 再現、native 不要） | Human Gate |

## Design Readiness

- Existing design docs are sufficient because: 本 plan-first commit の更新後、実装に必要な
  契約（型 / 変換 / 文言方針 / 相関形式）は source docs で完結する。
- Source docs updated in this PR: 40-cmd-product / 41-cmd-pos / 25-io / 33-biz /
  UI_TECH_STACK / ARCHITECTURE / decision-log（D-053）。
- Design gaps intentionally deferred: 診断ログ閲覧画面、UI 直接表示 約15 箇所の移行、
  kind enum 化（順14）。
- Durable decisions discovered in this plan and promoted: D-053。

Minimum design checks for business-app work:

- Layer ownership: error_id 発行と sanitize は CMD 境界、業務文言は BIZ、表示変換は UI
  共通 util。`UI -> CMD -> BIZ -> IO/MNT` 不変。
- Backend function design: CMD-ERR-D1/D2（40-cmd-product §5.3）、BIZ-04-D2（41-cmd-pos §17.4）。
- Command / DTO / data contract: 本 packet Boundary / Wire Contract。
- Persistence / transaction / audit impact: なし（診断ログは既存 tracing 経路のみ）。
- Operator workflow / Japanese UI wording: UI_TECH_STACK §6.4 の表示例。
- Error, empty, retry, and recovery behavior: import recovery 分岐不変、export_error は
  message そのまま表示（画面 recovery 分岐なし）。
- Testability and traceability IDs: test 名に req700（診断相関）/ req402（PLU）を含める。

## Contract Probe

- N/A — 未検証の外部前提なし。tracing 出力の test 内捕捉は repo 内の既存 harness
  `src-tauri/src/test_tracing.rs`（`MakeWriter` ベースの thread 別 capture、順7 で実績）を
  使用するため、外部 library 挙動の新規前提を置かない。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| CMD-ERR-D1: internal の error_id 発行 + wire/log 同一値 | `cmd/mod.rs` internal constructor | `test_internal_error_id_req700_wire_log_match` | — |
| CMD-ERR-D1: restore_* 3 kind の error_id 付与 | `cmd/mod.rs` restore constructor 群 | `test_restore_kinds_req700_carry_error_id` | — |
| CMD-ERR-D1: error_id 形式 `E-<YYYYMMDD-HHMMSS>-<4hex>` | `cmd/mod.rs` | 上記 test 内で形式 assert（regex、独立転記） | — |
| CMD-ERR-D2: message に raw detail を含めない | `cmd/*.rs` 全 internal 呼出し | `test_internal_message_req700_excludes_raw_detail` + AC sweep（PR body 記録） | — |
| CMD-ERR-D2: detail + error_id が tracing::error! に載る | `cmd/mod.rs` | `test_internal_error_id_req700_wire_log_match`（log 側 assert） | — |
| BIZ-04-D2: PluFormatError → ExportError → `export_error` | `biz/plu_export_service.rs` / `cmd/mod.rs` From | `test_plu_format_failure_req402_maps_to_export_error` | — |
| BIZ-04-D2 隣接: 既存 import_error 変換・recovery 分岐の不変 | `cmd/mod.rs` From / import 系 UI hook | 既存 import 系 test green（実在確認は Matrix 記載） | — |
| IO-04-D1: PluFileOutput / plu_output rename 完了 | `io/plu_formatter.rs` / `biz/plu_export_service.rs` / `cmd/plu_export_cmd.rs` | AC rg 0 hit（PR body 記録）+ 既存 PLU test green | — |
| IO-04-D1 隣接: `PluExportPrepareResponse` wire shape 不変 | `cmd/plu_export_cmd.rs` | 既存 PLU export cmd test green + bindings diff で response 型に差分なし | — |
| UI-ERR-D1: describeError 一元化（4 画面置換） | `src/lib/describe-error.ts` + 4 画面 | `describe-error.test.ts` + 静的 sweep test（X7） | — |
| UI-ERR-D1: internal 表示 = message + error_id + 診断ログ誘導 | `src/lib/describe-error.ts` | `describe-error.test.ts`（独立転記 oracle） | 視認スクショ（Human Gate） |
| CMD-ERR-D1 / 68 §68.7: restore_* 3 kind の画面表示に error_id 併記（文言・state machine 不変） | `src/features/backup-restore/BackupRestorePage.tsx` restore catch / fatal Alert | `BackupRestorePage.test.tsx` へ restore_* error_id 表示 case 追加 | — |
| 40-cmd §5.3 隣接: DatabaseError 固定文言変換の維持 | `cmd/mod.rs` From | 既存変換 test green（実在確認は Matrix 記載） | — |
| 40-cmd §5.3 隣接: ValidationFailedAt の field 保持 | `cmd/mod.rs` From | 既存変換 test green（同上） | — |

## Test Plan

Test Design Matrix: [test-matrices/2026-07-26-error-boundary-plu-vocabulary.md](test-matrices/2026-07-26-error-boundary-plu-vocabulary.md)

- targeted tests: cmd error 契約（error_id / sanitize / restore_*）、BIZ→CMD 変換
  （export_error）、describe-error unit、静的 sweep test。
- negative tests: Matrix X1〜X7 の mutation 候補を clean committed baseline で実注入・kill。
- compatibility checks: error_id 未設定 kind は wire で null/undefined、describeError が
  ID 節を省略。既存 kind の message pass-through 不変。bindings 再生成 diff は
  `error_id` 追加のみ（response 型に差分なし）。
- data safety checks: 実店舗データ・実診断ログファイルを commit しない。fixture / スクショは
  synthetic のみ。
- main wiring/integration checks: 4 画面が `src/lib/describe-error` を実 import
  （rg で確認）、`generate_bindings` 出力が tracked `bindings.ts` に反映。

## Boundary / Wire Contract

- producer: `src-tauri` `CmdError`（serde serialize、specta 型）
- consumer: `src/lib/invoke.ts`（`toCmdError` 正規化）→ `src/lib/describe-error.ts` → 各画面。
  例外: restore_* 表示は describe-error.ts を通らず 68 §68.7 の画面固有表示（error_id 併記のみ）
- wire type: JSON `{ kind: string, message: string, field?: string | null, error_id?: string | null }`
- internal type: Rust `CmdError` / TS `InvokeError.cmdError`
- precision/range: `error_id` は ASCII `E-` prefix 固定長形式（`E-<8桁日付>-<6桁時刻>-<4hex>`）。数値精度の論点なし
- round-trip path: Rust serde → Tauri IPC JSON → bindings.ts 型 → describeError 表示
- invalid input: `error_id` 欠落（旧 payload / 非 internal kind）は describeError が ID 節を省略して表示。restore_* 側の ID 省略動作は 68 §68.7 が独立に規定。unknown kind は message そのまま表示（既存挙動維持）
- compatibility: additive field のため既存 frontend 型と後方互換。`export_error` は新 kind — 既存 consumer に `export_error` 専用分岐は存在せず（scope 精査で実査済み）、default 分岐で message 表示されるため挙動互換。PLU 画面は kind 非依存実装のため表示文言は BIZ message のまま不変

## Review Focus

- CMD-ERR-D2 sweep の網羅性: 約 70 箇所の internal 呼出し移行で raw detail が message に
  残る箇所がないか（`format!` 埋め込みの見落とし、helper 経由の間接混入を含む）。
- test oracle の独立性: describe-error / error_id 形式の期待値が production 定数・共有
  formatter から導出されていないか（`feedback-test-oracle-must-not-share-ssot`）。
- export_error 変換の片側漏れ: BIZ variant 追加に対し From 変換・既存 import 経路の
  非影響が対で揃っているか。
- rename の取り残し: comment / doc-string / test 名内の旧語彙。
- describeError 置換による 4 画面の文言 regression（非 internal kind で表示が変わらないこと）。
- restore_* error_id 併記が 68 §68.7 の固定文言・state machine・recovery 導線を変えて
  いないか（既存の識別子固定 test の維持、error_id は別要素併記）。

## Spec Contract

Contract ID: SPEC-ERR-BOUNDARY-2026-07-26

- internal 系（internal / restore_* 3 kind）の `CmdError` は `error_id` を持ち、同一値が
  `tracing::error!` 経由で診断ログに記録される（CMD-ERR-D1。Test:
  `test_internal_error_id_req700_wire_log_match` / `test_restore_kinds_req700_carry_error_id`）。
- internal の `message` は操作文脈の日本語定型文言のみで、raw な技術詳細を含まない
  （CMD-ERR-D2。Test: `test_internal_message_req700_excludes_raw_detail` + AC sweep）。
- PLU 書出し失敗は `kind="export_error"` で返り、`import_error` 語彙・型語彙
  （PluCsvOutput / csv_output）は書出し経路から排除される（BIZ-04-D2 / IO-04-D1。Test:
  `test_plu_format_failure_req402_maps_to_export_error` + AC rg 0 hit）。
- UI の kind→文言変換は `src/lib/describe-error.ts` に一元化され、internal は
  message + error_id + 診断ログ誘導で表示される（UI-ERR-D1。Test:
  `describe-error.test.ts` + 静的 sweep test）。
- restore_* 3 kind の画面表示は 68 §68.7 の kind 別 recovery 文言・state machine を
  維持したまま error_id を併記する（describeError 非使用。Test:
  `BackupRestorePage.test.tsx` restore_* error_id case）。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| P3-4 / CMD-ERR-D1 | CmdError error_id 追加 + internal/restore_* 発行 | `test_internal_error_id_req700_wire_log_match` / `test_restore_kinds_req700_carry_error_id` | wire/log 同一値 | cargo test + PR body |
| P3-4 / CMD-ERR-D2 | internal 呼出し約 70 箇所の sanitize 移行 | `test_internal_message_req700_excludes_raw_detail` | sweep 網羅・helper 間接混入 | cargo test + AC sweep 記録 |
| P3-4 / UI-ERR-D1 | describe-error.ts 新設 + 4 画面置換 + 再発 sweep | `describe-error.test.ts` + 静的 sweep test | oracle 独立・文言 regression | vitest + rg 0 hit |
| P3-4 / CMD-ERR-D1 | restore_* 画面表示への error_id 併記（68 §68.7） | `BackupRestorePage.test.tsx` restore_* error_id case | 68 文言・state machine 不変 | vitest |
| P7b-3 / BIZ-04-D2 | ExportError 新設 + PLU 変換切替 | `test_plu_format_failure_req402_maps_to_export_error` | import 経路非影響 | cargo test |
| P7b-3 / IO-04-D1 | PluFileOutput / plu_output rename | 既存 PLU test green + AC rg 0 hit | wire shape 不変 | cargo test + bindings diff |
| REQ-402 | PLU 書出し既存挙動の維持 | 既存 PLU prepare/confirm test 群 green | 挙動互換 | cargo test |

## Data Safety

- 実店舗の商品・売上データ、実環境の診断ログファイル、実 error 内容を commit しない。
- ローカル専用: 診断ログ出力（`log_dir` 配下）、dev 環境の人工 error 再現手順。
- synthetic のみ: test fixture、PR 添付スクリーンショットの画面データ。

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

Fill after review.
If R3 review-only sub-agent is skipped, record an explicit line beginning with `Review-only skipped because:` and the reason.
- Findings Freeze: not yet frozen; post-freeze exceptions: none.
