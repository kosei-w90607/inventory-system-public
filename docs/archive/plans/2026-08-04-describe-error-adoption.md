# Plan Packet: describeError 全面適用（raw error message 直接表示の是正）

## Workflow State

- Phase: archive
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: 4186798
- Amendments: 6066a3f
- Coordinator: Claude Fable 5（main session）
- Writer: Claude Sonnet 5 subagent（worktree isolation）
- Plan Reviewer: Claude Sonnet 5 subagent（起草非関与の独立 context）
- Final Reviewer: Codex（owner 提案 2026-08-04 により Sonnet から切替。cross-vendor の Final Contract Audit、役割変更のみで packet 契約無変更）
- Reviewed Content HEAD: ba53eed
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: L3 視認（internal kind の エラーID 併記表示 + B群画面の非デバッグ表示。synthetic fixture 手順を Ready 依頼時に添付 — L3 fixture prep の教訓）/ merge / closeout

編成注記: D-062 (c)（**Writer が Codex である packet** の Plan Reviewer は Writer と同一 vendor 禁止、DEV_WORKFLOW `Review Rules` 実文言）は本 packet の Writer が Claude Sonnet 5 subagent（非 Codex）であるため非該当。Codex slot は依存 hygiene PR + owner 重量級作業で占有中（owner 裁定 2026-08-04）のため Writer / Reviewer とも Sonnet 5 だが、相互に独立 context の別 subagent であり writer の自己承認は発生しない。WER 2026-08-04（D-062 (c) 編成 WER）改善 1・3・4 の初適用対象: Reviewer 発注書に「各 finding へ修正案必須添付」、Coordinator 是正時の同 packet 内 full sweep、Writer の STATECAP canonical subject。

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 2（Sonnet 編成のため外部 relay は想定なし。Codex 相談へ切替える場合のみ消費）

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
UI の安定契約（UI_TECH_STACK §6.4 UI-ERR-D1 のエラー表示変換）に対する全画面横断の実装整合であり、22 site + 除外多数の全数分類を伴う。B群 4 site は利用者へ内部デバッグ文字列が露出する実バグの是正で、表示挙動が変わる。DEV_WORKFLOW Risk Tiers の「stable contract / UI behavior に触れる場合は R3」に該当。

## Goal

Goal Invariant:

### 最小完了条件

- CmdError 起源の利用者向けエラー表示が、適用 manifest の全 site（22 site、下記 Scope）で共通 `describeError`（UI-ERR-D1）経由になり、`internal` kind で エラーID + 診断ログ誘導が表示される。
- InvokeError のデバッグ文字列（`[source:cmd] kind: message` 形式）が利用者向け表示へ到達する経路が 0 件になる（B群 4 site の実バグ解消）。
- 再導入を sweep test が機械的に防止する。

### 失敗定義

- manifest 外の見落とし site が残る、または sweep が違反を検出できない（感度未実証）。
- restore_* の表示所有権（68 §68.7）、Error Boundary 境界（UI-EB-D3）、§6.4 の kind 別素通し戦略（validation 等は message そのまま）のいずれかを壊す。
- 既存 test の削除・無効化・skip。

### 非目的

- エラー文言の再設計（describeError の既存出力文言を変えない）。
- CmdError wire 契約・error kind 集合・error_id 形式（CMD-ERR-D1/D2）の変更。
- Error Boundary（§6.10）・restore_* 表示（68 §68.7）・診断ログ機構（70）の変更。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

全数分類 manifest（実査 2026-08-04、Coordinator 委譲 Explore の再 enumerate。行番号は実査時点の参考値であり、Writer は着手時に全行を rg で再確認する）:

**B群 = InvokeError デバッグ文字列露出の実バグ 4 site（cmdError 抽出なしで `.error.message` を直接表示）**

| # | site | 表示先 |
|---|---|---|
| B1 | `src/features/daily-sales/DailySalesPage.tsx`（実査時 95 行） | query error の span |
| B2 | `src/features/monthly-sales/MonthlySalesPage.tsx`（88 行） | query error の span |
| B3 | `src/features/operation-logs/OperationLogsPage.tsx`（401 行） | query error の p |
| B4 | `src/lib/hooks/useExportFile.ts`（57 行） | mutation onError の toast |

注: PR #61 closeout の実査記録は「実バグ 3 箇所」。B4 は本 packet 起草時の再 enumerate で追加検出した完全同型（`onError` で `error.message` 直 toast）であり、除外する理由がないため適用に含める（記録との差分として明示）。

**A群 = cmdError 抽出済みだが describeError 非経由 18 site（internal kind の エラーID・診断ログ誘導が欠落する契約非準拠）**

| # | site | パターン |
|---|---|---|
| A1-A2 | `src/features/disposal/DisposalPage.tsx`（175 / 246 行） | setSaveError / setSearchMessage |
| A3-A4 | `src/features/receiving/ReceivingPage.tsx`（174 / 243 行） | 同上 |
| A5-A6 | `src/features/manual-sale/ManualSalePage.tsx`（194 / 265 行） | 同上 |
| A7-A8 | `src/features/return-exchange/ReturnExchangePage.tsx`（245 / 339 行） | 同上 |
| A9-A11 | `src/features/products/ProductFormPage.tsx`（117 / 154 / 175 行） | setSaveError |
| A12 | `src/features/inventory-records/ManualSaleRecordDetailPage.tsx`（81 行） | AlertTitle |
| A13 | `src/features/inventory-records/ReceivingRecordDetailPage.tsx`（73 行） | AlertTitle |
| A14 | `src/features/inventory-records/DisposalRecordDetailPage.tsx`（79 行） | AlertTitle |
| A15 | `src/features/inventory-records/ReturnRecordDetailPage.tsx`（96 行） | AlertTitle |
| A16 | `src/features/products/ProductImportPage.tsx`（105 行） | p 要素 |
| A17 | `src/features/daily-report-import/DailyReportImportPage.tsx`（66 行） | p 要素 |
| A18 | `src/features/csv-import/components/ErrorState.tsx`（40 行） | AlertDescription |

**明示除外（適用しない。理由付き個別列挙、自動除外型実装の禁止）**

| site | 除外理由 |
|---|---|
| `src/components/patterns/RouteErrorFallback.tsx` | render 例外の最終防衛層。UI-EB-D3 により describeError 対象外（折り畳み「技術詳細」節の `error.message` は契約どおり） |
| `src/features/backup-restore/BackupRestorePage.tsx` | restore_* 表示所有権は 68 §68.7。describeError 不使用が契約（§6.4 restore_* 行）。加えて既に describeError を適切箇所で使用済み |
| `src/features/integrity-check/IntegrityCheckPage.tsx` | 既対応（describeError 経由で message 生成済み） |
| 各 Page の `error.message === "validation"` guard 行 | 表示ではなく制御分岐 |
| `src/features/threshold-settings/ThresholdSettingsPage.tsx` の issue.message | Zod validation issue で CmdError と無関係 |
| `useCsvImportFlow.ts` / `useDailyReportImportFlow.ts` / `useProductImportFlow.ts` の `ensureInvokeError()` | 表示コードではなく InvokeError 正規化 infra |

**その他の Scope 項目**

- `docs/UI_TECH_STACK.md` §6.4 へ **UI-ERR-D2（新設）** を追記: 「useQuery / useMutation の error（InvokeError）を利用者向けに表示する場合も describeError 経由 MUST。InvokeError の `.message` はデバッグ用フォーマット（`[source:cmd] kind: message`）であり利用者向け表示に使わない」
- **sweep test 新設**（`src/lib/describe-error-adoption-sweep.test.ts`）: `src/features` / `src/components` / `src/lib/hooks` の production file を対象に、`cmdError.message` の表示文脈利用と query/mutation error の `.message` 直接表示パターンを検出して 0 件を assert。file 粒度の allowlist は UI-EB-D3 契約を持つ `RouteErrorFallback.tsx` のみとし、flow hook 3 file は ensureInvokeError 正規化 idiom の行単位除外に限定、allowlist と行除外 pattern は内容固定 assertion で pin する（Amendment 1 = Codex FR F1 の除外粒度是正。当初の「明示除外 file の個別列挙」は file 全体免除が広すぎ survivor を許した）。**空集合 oracle 対策として、synthetic 違反 fixture 文字列に対する positive 検出 case を同 test file 内に必ず含める**（empty-set-oracle-collision の教訓）
- 型ごとの代表 regression test 追加（Matrix 参照）: internal kind → エラーID 表示（A群代表）、B群 3 画面の非デバッグ表示 negative assert、useExportFile の test 新設

## Non-scope

- restore_* 系表示・68 §68.7 の変更
- RouteErrorFallback / Error Boundary（§6.10）の変更
- describe-error.ts 本体の挙動変更（変換 semantics は現状維持。呼出し側の適用のみ）
- backend / CmdError wire / bindings / DB
- エラー文言の新規設計（describeError の既存出力をそのまま使う）

## Acceptance Criteria

- AC1: 新 sweep test `src/lib/describe-error-adoption-sweep.test.ts` が green（production 違反 0 の assert + synthetic 違反 fixture の positive 検出 case を含む）
- AC2: B群 3 画面（DailySales / MonthlySales / OperationLogs）の page test に「query error 時、DOM に `[commands:` を含む文字列が現れない」negative assert と describeError 出力の表示 assert が存在し green
- AC3: `useExportFile` の test（新設）で onError toast 引数が describeError 出力であることを assert し green
- AC4: A群代表（DisposalPage）の test に internal kind fixture → `エラーID:` を含む表示の assert が存在し green
- AC5: `rg -n "cmdError\.message" src/features src/components src/lib/hooks -g '!*.test.*'` の hit が 0 件（PR body へ出力添付。走査 3 dir に `cmdError.message` を含む明示除外 file はなく、`src/lib` 直下の定義側 token〈describe-error.ts / invoke.ts〉は走査対象外）
- AC6: `docs/UI_TECH_STACK.md` §6.4 に UI-ERR-D2 行が存在（`rg -n "UI-ERR-D2" docs/UI_TECH_STACK.md` で 1+ hit）
- AC7: 既存 `describe-error.test.ts` / `describe-error-no-local-duplicates.test.ts` は無変更のまま green
- AC8: `scripts/local-ci.sh full` green（L1）、exact-HEAD hosted final 三点一致
- AC9: mutation Matrix（`docs/plans/test-matrices/2026-08-04-describe-error-adoption.md`）X1-X7 の全 red を、X ごとに互いに独立な 2 系統以上の実測（Writer 自己実測 / Coordinator 側の記録非参照再実測 / cross-vendor Final Review 再実測のいずれか）で確認し、red になった test 名の一覧を本 packet `Review Response` へ記録（Amendment 1: X6 は当初「review 検分依存」だったが `c4730e5` の内容固定 assertion で自動 red 化し、X1-X7 全 red が成立可能になった）

## Design Sources

- Requirements / spec: `docs/UI_TECH_STACK.md` §6.4（UI-ERR-D1、kind 別表示戦略）
- Architecture: `docs/UI_TECH_STACK.md` §6.10（UI-EB-D3 責務境界）
- Function / command / DTO: `docs/function-design/40-cmd-product.md` §5.3（CMD-ERR-D1/D2）
- DB: 該当なし
- Screen / UI: `docs/function-design/68-ui-backup-restore.md` §68.7（restore_* 所有権 = 除外根拠）、`docs/function-design/55-ui-csv-import.md` §55.5（import_error 画面固有分岐 = A18 の周辺契約）
- Decision log / ADR: D-053（error_id × 診断ログ相関、順8）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 変更なし（CmdError wire 不変） | existing sufficient |
| Command / DTO / generated binding / wire shape | 変更なし | existing sufficient |
| DB / transaction / audit / rollback / migration | 該当なし | — |
| Screen / UI / route state / Japanese wording | `docs/UI_TECH_STACK.md` §6.4 / `docs/function-design/55-ui-csv-import.md` §55.5 | updated in this PR（UI-ERR-D2 追記 + §55.5 の ErrorState 記述同期〈Codex FR F6〉。表示文言は describeError 既存出力で新規文言なし） |
| CSV / TSV / report / import / export format | 該当なし | — |
| Durable decision / ADR | UI-ERR-D2 は §6.4 内の decision ID として完結 | updated in this PR |

## Registration / Generation Obligations

該当なし（新規 command / route / 画面 / function-design doc なし。新規 test file は登録義務対象外）。ただし design doc（UI_TECH_STACK）を触るため、Writer は `cargo run --bin generate_traceability` を実行して diff 0 を確認し、diff が出た場合は再生成を同 PR に含める（PR #61 gated Amendment 1 の failure class 対策）。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| UI-ERR（D-053 系） | UI_TECH_STACK §6.4 | UI-ERR-D1（既存） | エラー表示変換の一元化。画面ローカル変換の重複定義禁止 | A群 18 site の describeError 経由化 | AC4 / AC5 / 既存 no-local-duplicates |
| UI-ERR（D-053 系） | UI_TECH_STACK §6.4 | UI-ERR-D2（新設） | InvokeError `.message` はデバッグ用フォーマットで利用者向け表示禁止。代替案「InvokeError.message 自体を人間向け文言へ変更」は診断ログ・開発時の相関情報が失われるため不採用 | B群 4 site + sweep test | AC1 / AC2 / AC3 |
| CMD-ERR-D1 | 40-cmd-product §5.3 | —（消費のみ） | internal kind の error_id を UI で利用者へ提示し診断相関を成立させる | describeError 既設（変更なし） | AC4 + 既存 describe-error.test.ts |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: §6.4 の変換表 + UI-ERR-D2 追記で完結する。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: UI-ERR-D2 を §6.4 へ昇格（本 PR 内）。
- Assumptions and constraints: describeError は CmdError object / InvokeError / unknown のいずれを渡しても extractCmdError で正規化できる（`src/lib/describe-error.ts` 実装済み。Writer は A16-A18 の `state.error.cmdError` 形にも適用可能なことを test で確認）。
- Deferred design gaps, risk, and follow-up target: なし（restore_* / Error Boundary は既存契約の維持）。
- Test Design Matrix can cite design decision IDs or source doc sections: UI-ERR-D1/D2、CMD-ERR-D1、UI-EB-D3、68 §68.7。
- Absolute guarantee / escape hatch self-check completed: 「InvokeError 文字列が利用者向け表示へ到達する経路 0」の例外は RouteErrorFallback の技術詳細節（UI-EB-D3 の設計上の例外、折り畳み内）のみ。sweep allowlist に明記し、Ledger 行で整合を宣言する。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable（UI 層内の適用是正のみ） | — |
| Fact check / design decision split | B群「実バグ 3 箇所」の記録に対し再実査で 4 件目（B4）を検出。事実確定は manifest、B4 を適用に含めるのは Coordinator 裁定（同型バグの除外理由なし） | 本 packet Scope |
| Lifecycle / retry | error 表示の lifecycle は既存 query/mutation の error state に従属、変更なし | Matrix State Lifecycle |
| Operator workflow | internal エラー時に operator が エラーID を口頭・メモで伝達できるようになる（診断相関の実利） | L3 視認項目 |
| Replacement path | not applicable（置換ではなく既設 describeError の適用拡大） | — |
| Data safety / evidence | synthetic fixture のみ使用、実データ不使用 | Data Safety 節 |
| Reporting / accounting semantics | not applicable | — |
| Manual verification | L3 で internal 表示 + B群非デバッグ表示を視認 | Human Gate |
| 環境・再現性 | 新設の環境依存なし（既存 vitest 環境のみ） | — |

## Design Readiness

- Existing design docs are sufficient because: §6.4 の kind 別変換表と describeError 実装が既設で、本 change は適用漏れの是正 + 契約 1 行の追記のみ。
- Source docs updated in this PR: `docs/UI_TECH_STACK.md` §6.4（UI-ERR-D2 追記）。
- Design gaps intentionally deferred: なし。
- Durable decisions discovered in this plan and promoted to source docs: UI-ERR-D2。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI 層のみ。CMD 以下不変。
- Backend function design: 変更なし。
- Command / DTO / data contract: CmdError wire 不変（消費側の適用是正）。
- Persistence / transaction / audit impact: なし。
- Operator workflow / Japanese UI wording: describeError の既存日本語出力を使用。internal のみ エラーID 併記が加わる（§6.4 既定文言）。
- Error, empty, retry, and recovery behavior: エラー表示経路のみ変更。retry / recovery 分岐（55 §55.5 等）は不変。
- Testability and traceability IDs: UI-ERR-D1/D2 を Matrix / Ledger の契約 ID に使用。

## Contract Probe

N/A — 未検証の外部前提なし。InvokeError の `.message` フォーマットは `src/lib/invoke.ts`（実査時 44-45 行）実読で確認済み、describeError の変換挙動は既存 unit test（`src/lib/describe-error.test.ts`）が担保。いずれも repo 内契約で外部 library / OS 挙動に依存しない。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| UI-ERR-D1（変換一元化、画面ローカル定義禁止） | A群 18 site の describeError 経由化 | AC5 rg evidence + 既存 no-local-duplicates + 新 sweep | — |
| UI-ERR-D2（新設: InvokeError.message 利用者表示禁止） | B群 4 site + sweep test | AC1 / AC2 / AC3 | L3: B群代表画面の非デバッグ表示視認 |
| §6.4 internal 戦略（message + エラーID + 診断誘導） | describeError 既設の適用（A群） | AC4 + 既存 describe-error.test.ts | L3: internal 表示視認 |
| §6.4 素通し戦略（validation / duplicate / not_found / import_error は message そのまま） | describeError の既存 semantics 維持（本 change で変換挙動を変えない） | 既存 describe-error.test.ts（AC7 無変更 green） | — |
| UI-EB-D3（render 例外は describeError 対象外） | RouteErrorFallback 無変更 + file 免除は同 file のみ | AC1 sweep の内容固定 assertion（Amendment 1） | non-scope（無変更） |
| 68 §68.7（restore_* 表示所有権） | BackupRestorePage 無変更（sweep は 0 hit 実測、allowlist 記載なし） | AC1 sweep production scan + 既存 test 維持 + diff 0 | non-scope（無変更） |
| CMD-ERR-D1（error_id wire） | 消費のみ（不変） | AC4（表示側で `エラーID:` assert） | — |

Ledger 確定前の adjacent-contract sweep 実施記録: §6.4 全行（kind 別 6 分類）、§6.10 UI-EB-D1〜D3、68 §68.7、55 §55.5 を確認。§55.5 の import_error recovery 分岐は A18（ErrorState.tsx）の describeError 化で不変（describeError は import_error を message 素通しするため recovery 分岐側に影響しない）ことを Ledger 行 4 で担保。

## Test Plan

Test Design Matrix: `docs/plans/test-matrices/2026-08-04-describe-error-adoption.md`

- targeted tests: AC1-AC4（sweep + 代表 regression + useExportFile 新設）
- negative tests: B群 3 画面の `[commands:` 非出現 assert、sweep の synthetic 違反 positive case
- compatibility checks: 素通し kind（validation 等）の表示文言が describeError 化の前後で不変（DisposalPage 等の既存 test が green のまま）
- data safety checks: synthetic fixture のみ（Matrix 参照）
- main wiring/integration checks: 22 site 全数が manifest どおり置換されたことを AC5 rg evidence で確認

Human Gate に L3 を含むため、Writer 完了条件に `cargo check --release` を含める（backend 無変更でも実行して green を記録）。

## Boundary / Wire Contract

- producer: CMD 層（CmdError JSON、不変）
- consumer: UI `describeError`（適用 site を拡大）
- wire type: `CmdError { kind, message, field?, error_id? }`（不変）
- internal type: `InvokeError`（`.message` はデバッグ用、利用者向け表示禁止 = UI-ERR-D2）
- precision/range: 該当なし
- round-trip path: 該当なし
- invalid input: 非 CmdError / unknown は describeError の fallback 経路（既存挙動）
- compatibility: wire 不変のため互換性影響なし

## Review Focus

- 全数分類 manifest の網羅性: 実査パターン（`cmdError.message` / `.error.message` / toast 直渡し）の取りこぼしがないか、Reviewer は独立に rg で再 enumerate して manifest と突合する
- sweep test の regex 設計: false positive（guard 分岐・test file・allowlist）と false negative（表記揺れ）の両面。空集合 oracle 対策の positive case が synthetic fixture に隔離されているか
- 表示変化の把握: A群は internal kind のときのみ表示が変わる（エラーID 追記）。素通し kind の文言不変を既存 test の green 維持で確認
- B4（useExportFile）は実査記録「3 箇所」外の追加検出。同型性の判定が妥当か
- WER 2026-08-04 改善の初適用: 各 finding へ修正案必須添付（DEV_WORKFLOW Review Rules）。天井目安 3 round、到達時は Coordinator disposition 裁定へ切替

## Spec Contract

Contract ID: SPEC-UI-ERR-ADOPTION-1

- CmdError 起源の利用者向けエラー表示は、restore_*（68 §68.7 所有）と render 例外（UI-EB-D3）を除き、describeError（UI-ERR-D1）経由 MUST。InvokeError の `.message` は利用者向け表示に使わない（UI-ERR-D2）。再導入は sweep test（AC1）が機械的に検出する。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-UI-ERR-ADOPTION-1 | B群 4 site 是正 | AC2 / AC3 | 非デバッグ表示 | page test + sweep |
| SPEC-UI-ERR-ADOPTION-1 | A群 18 site 是正 | AC4 / AC5 | internal の エラーID 併記 | 代表 regression + rg evidence |
| SPEC-UI-ERR-ADOPTION-1 | sweep 新設 | AC1 | 感度実証（mutation X-S 行） | sweep test + 独立再実測 |
| SPEC-UI-ERR-ADOPTION-1 | §6.4 UI-ERR-D2 追記 | AC6 | 契約文言と実装の一致 | doc diff |

## Data Safety

- 実店舗データ・実 DB・実エラーログを test fixture に使わない（synthetic CmdError fixture のみ。error_id は `E-20260101-000000-0000` 等の合成値）
- local-only paths: なし
- synthetic-only paths: test fixture 内の CmdError / InvokeError オブジェクト

## Implementation Results

PR #63（squash merge、2026-08-04）で完了。22 site（A群 18 + B群 4）を describeError 経由へ統一し、UI-ERR-D2 を §6.4 へ新設、再導入防止 sweep test（file 免除 = RouteErrorFallback のみ / (path, pattern) 行単位除外 / 内容固定 assertion / synthetic positive case）と型別代表 regression・useExportFile test を追加した。既存 internal fixture assertion 10 件は fixture 無変更・期待文字列のみ実出力へ更新（IntegrityCheckPage 方式）。§55.5 の実装同期と 90-traceability 再生成（REQ-700 参照）を含む。exact-HEAD evidence / hosted final 三点一致 / owner L3 の詳細は PR #63 body を正とする。merge → archive の遷移は本 closeout content commit に同乗。

## Review Response

- Round 1（Plan Review、独立 Sonnet 5、2026-08-04）: Verdict PASS、P1=0 / P2=2 / P3=1。manifest 22 site は reviewer の独立再 enumerate で過不足なし確認。
  - F1（P2、AC5 走査範囲）: **前提棄却** — reviewer は AC5 の command を `src/lib` 走査と引用したが、実文言は `src/lib/hooks`（packet AC5 / Matrix evidence 行の双方）。棄却 evidence = 実文言 rg + `src/lib/hooks` 走査では describe-error.ts / invoke.ts が対象外であることの実測。ただし隣接残差（test file 除外の欠落、allowlist 表現の曖昧さ）は採用し、AC5 を `-g '!*.test.*'` 付き 0 件 oracle へ明確化。
  - F2（P2、B1-B3 retry 一律主張）: **accept** — B3 OperationLogsPage は `retry: 0` 明示（261・279 行、Coordinator 実読で再現）。Matrix State Lifecycle 行を per-page 実測値へ是正。
  - F3（P3、D-062 (c) 条件の誤 paraphrase）: **accept** — DEV_WORKFLOW Review Rules 実文言は「Writer が Codex である packet」基準（Coordinator 実読で確認）。編成注記を Writer 基準の文言へ是正。結論（非該当）は不変。
  - 是正は同 packet 内 full sweep（`cmdError\.message` / `src/lib` / `retry` / `D-062` の全出現）を実施のうえ適用（WER 2026-08-04 改善 3 の初適用）。
- Round 2（closure、同 reviewer、2026-08-04）: Verdict **CLOSED、P1/P2=0**。F1 棄却は reviewer が round 1 HEAD（`4186798`）の実文言を独立再読して誤引用を確認・追認。F2/F3 是正と同 packet 内 sweep の残存 drift なしを独立検証。新規 finding なし。
- 遷移 evidence（compression 記録）: plan-gate → plan-approved = Plan Review round 2 CLOSED（P1/P2=0）+ owner plan 承認 2026-08-04（介入 1 回目/予算 3 回）。plan-approved → implementing = Plan Commit `4186798` 記入 + Writer 発注（Sonnet subagent、本 worktree）。
- 実装時裁定（2026-08-04、Writer fail-closed 起点、gated amendment 非該当）: A群 4 画面（Disposal / Receiving / ManualSale / ReturnExchange）の既存 test に internal kind fixture の生 message 完全一致 assertion が 10 件あり、describeError 化（= internal の表示が意図どおり変わる）と両立しない衝突を Writer が実装前実査で検出（Coordinator が DisposalPage.test.tsx 該当行を実読で再現確認）。裁定 = **assertion 更新を許可**（fixture は無変更、期待文字列のみ describeError の実出力へ完全一致で更新 — IntegrityCheckPage.test.tsx の確立方式）。これは「意図した表示変更への追随」であり Goal 失敗定義の「test 削除・無効化・skip」に非該当。packet 契約は無変更（AC7 の無変更対象は lib 2 test のみ、Matrix F4 行の無改変対象は素通し kind fixture のみ、Review Focus は internal 表示変化を明示許容）— 衝突の実体は Writer 発注書の「既存 test ほか全部無改変」という Coordinator の過剰一般化であり、packet を正とする。（是正後実測: `rg -c "詳細は診断ログに記録されています。" src/features/{disposal,receiving,manual-sale,return-exchange}/*Page.test.tsx` = 3/2/1/5 の計 11 hit — 更新 10 件 + AC4 新設 regression 1 件の内訳と一致）
- Coordinator 独立再実測（2026-08-04、記録非参照の fresh Sonnet verifier へ委譲、注入形は Matrix から独立導出）: **X1-X7 全件で防御成立を再現**。baseline 全 suite green + AC5 0 hit、X5 = sweep 盲点を AC3 unit test が独立補足（設計どおり）、X6 = 自動 test 無反応・review 検分依存（Matrix 明記どおり）、各 cycle 後 clean tree 復元確認。
- 追加検出と是正（独立再実測起点）: sweep regex が `?.` optional chaining 変種（`query.error?.message` 等）を素通しする真の gap を verifier が検出 → Writer 是正 `ada5233`（regex を `\??` 許容へ強化 + synthetic positive case 追加〈既存 case 非改変〉+ 実 file 一時注入で red を実証、production scan 0 件維持）。
- X7 実測 divergence（Writer・独立 verifier の実測一致）: Matrix の想定「negative assert 弱体化で page test が素通り」は再現せず、positive assert（describeError 出力の完全一致 findByText）が単独で red 化 — 防御は想定より強い方向の差異。Matrix 本文は非改変とし、本欄の実測記録を正とする。
- Final Reviewer 変更（2026-08-04）: owner 提案（Codex slot 空き）を受け Sonnet → Codex の cross-vendor Final Contract Audit へ切替。same-vendor（Writer=Sonnet / Final Reviewer=Sonnet）構成の独立性補強。役割変更のみで Scope / AC / 契約は無変更（gated amendment 非該当）。
- Codex Final Review（cross-vendor、2026-08-04）: round 1 = 旧 HEAD `540add9` 対象、FAIL P1=0/P2=4/P3=2。うち F2（traceability T4 / REQ-700）と F4（Prettier）は報告受領前に `06ee49d` / `8569b9a` で是正済み（F2 の修正案 REQ-700 は Writer の独立選定と一致）。round 2 = `8569b9a` 対象、FAIL P1=0/P2=2/P3=2 — round 1 の残件と同一・新規 finding なし（単調収束）、`?.` 変種是正（`ada5233`）の red を第三系統で追認。
- Codex FR 裁定と是正: F1（ALLOWLIST file 粒度が広すぎ、allowlisted file への raw 表示注入 survivor を実証）= accept → `c4730e5`（file 免除を RouteErrorFallback のみへ縮小 / flow hook は正規化 idiom の行単位除外 / 内容固定 assertion / 旧 allowlist path の恒久 synthetic regression / Writer が実 file 注入 red を live 実証）。F2'=AC9 と Matrix X6 の内部矛盾 = accept → 本 Amendment 1 で AC9・X6 を実 oracle へ一括改訂（X6 自動 red 化を採用）。F3'（B1 test は retry:false の test QueryClient）= accept → Matrix lifecycle 行を訂正。F6/F4'（§55.5 記述陳腐化）= accept → `6edde66`。
- AC9 red test 一覧（実測系統: W=Writer 自己実測 / S=Sonnet 独立 verifier / C=Codex FR / F=Coordinator 実注入）:
  - X1: sweep production scan + DisposalPage.test.tsx「REQ-204 keeps the idempotency key…」「REQ-204 unlocks product search after command failure」「REQ-204 shows the diagnostic error ID…」（W/S/C）
  - X2: describe-error.test.ts「shows the internal message, independently transcribed error ID, and diagnostic guidance」+ DisposalPage AC4（W/S/C）
  - X3: sweep + MonthlySalesPage.test.tsx の B2 UI-ERR-D2 test（W/S/C）。`?.` 変種は `ada5233` 後に sweep red（S 検出 → W 実証 → C 追認）
  - X4: sweep + useExportFile.test.ts「shows describeError output in the error toast, not the raw InvokeError debug message」「passes through the message unchanged for a non-internal kind (compatibility, describeError 素通し戦略)」（W/S/C）
  - X5: sweep green（設計どおりの盲点実証）+ useExportFile.test.ts の上記 2 test が独立 red = 二重防御（W/S）
  - X6: 旧設計では自動無反応（W/S/C 一致、Matrix 旧記載どおり）→ `c4730e5` の内容固定 assertion「keeps the file-level ALLOWLIST and line-exclusion patterns pinned to their justified minimum」で自動 red 化、F が実注入 red を確認（初回試行は sd pattern 不一致の no-op を diff --stat 確認で検出し再実測 — 実注入の diff 実確認は必須手順）。closure round で C 検証予定
  - X7: sweep red + MonthlySalesPage positive assert が単独で red（negative assert 削除併用でも素通りせず。Matrix 想定より強い方向の divergence、W/S 実測一致）
- relay 予算超過の記録: cross-vendor Final Review の rally 往復により relay 3/予算 2。超過理由を事前明示し owner 承認済み（2026-08-04）。
- 遷移 evidence（closure round P2 是正後の記録）: local-verified の evidence は `scripts/local-ci.sh full` の RESULT=PASS で、正本は `.local/ci-evidence/` の該当 log と PR body — tracked packet へは exact HEAD SHA・PASS 回数を転記しない（D-035/D-038 Evidence Ownership。当初記録はこれに違反し `392f1a2` の state-backtrack で処理）。independent-review = cross-vendor Final Review round 1 / round 2 / closure round 実施済み。Ready 段階の exact-HEAD L1 は従来どおり別途実施する。
- Codex FR closure round（Amendment 1 込み HEAD 対象）: NOT CLOSED、P1=0/P2=3/P3=0。旧 survivor（IntegrityCheckPage 注入）と X6 自動 red は CLOSED 判定。(1) F1 残差 = 行除外が path 非限定で、flow hook 以外の file に置いた正規化 idiom 形の利用者表示が素通り（survivor 実証）→ `442b789` で行除外を (path, pattern) 組へ限定 + 内容固定 assertion を組の pin へ更新 + cross-path synthetic regression 追加。survivor 再現実験は Writer と Coordinator が独立に「注入 → sweep red → 復元」を実測。(2) AC9 一覧の X4/X5 が件数表記で test 名一覧を満たさず → 本 commit で正式名へ置換。(3) 遷移記録の Workflow State 契約違反（state-only 相当 commit の非 canonical subject + L1 exact HEAD/PASS 回数の packet 転記 = D-035/D-038 違反）→ canonical `state-backtrack independent-review->implementing`（`392f1a2`、履歴書き換えなし）で最早影響 phase へ復帰し、本 commit で volatile evidence を除去。再前進は L1 後の canonical 遷移で行う。
- Codex FR closure round 2（再前進 HEAD 対象）: **CLOSED、P1=0/P2=0/P3=0**。F1 残差 = `442b789` の (path, pattern) 限定・内容固定 assertion の組 pin・cross-path regression を適合確認し、survivor 再実験（DisposalPage への idiom 形表示注入）が red になることを Reviewer 自身が実測（Writer・Coordinator に続く 3 系統目）。F2' = AC9 の test 正式名化を確認、件数のみ表記の消滅を確認。F3'' = canonical backtrack（`392f1a2`）・volatile evidence 除去（`bde27df`）・canonical 再前進（`ba53eed`）を検分し、`check-workflow-git.sh` exit 0・当該遷移 WARN 0。是正 diff は範囲外変更なし、新規 finding なし。
- owner L3（2026-08-04、介入 2/3）: L3-1（日次売上の internal 表示 = message + エラーID + 診断ログ誘導）PASS / L3-2（廃棄・破損 商品検索での非デバッグ表示、`[commands:` 露出なし）PASS。synthetic fixture（unwrapResult への一時 throw）使用・視認後復元・clean tree・実データ / 実ログ不使用・所見なし。L3 対象 HEAD と exact-HEAD evidence は PR body に記録（D-035）。
- 遷移（human-confirm → ready-hosted-final、本 content commit 同乗）: evidence = owner L3 全項目 PASS。Ready の exact-HEAD L1 / hosted final 三点一致は PR body を正とする。
- Findings Freeze: frozen after closure round 2（2026-08-04）; post-freeze exceptions: none.
