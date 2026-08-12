# Plan Packet — 業務シナリオ受入テスト台本化（roadmap 項4 第1版）

## Workflow State

Use the field definitions, enums, transition evidence, packet-selection rule, and fail-closed behavior from `docs/DEV_WORKFLOW.md` `Workflow State`. Keep exactly one `- Key: value` line per field.

If a state-only commit materializes multiple phases, list the complete adjacent forward sequence and the pre-existing evidence for every intermediate transition in an append-only review/evidence record. Recording compression never permits a gate skip.

- Phase: ready-hosted-final
- Risk: R2
- Execution Mode: fable-window
- Plan Commit: 19daa33
- Amendments: cfa0506
- Coordinator: Fable (main thread)
- Writer: Codex（発注書は Coordinator 起草、owner relay）
- Plan Reviewer: Sonnet subagent（独立 context）
- Final Reviewer: Sonnet subagent（独立 context）
- Reviewed Content HEAD: cfa0506
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: none

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 90分（うち台本 1 周の実走 60 分想定）
- relay 往復上限: 3
- Plan Review round 天井: 3（既定 3）

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

§5.5を使わないchangeは両方`none`のままにする。

- Review Order Artifact: none
- Review Order Ref: none

（経路確定の Codex 諮問は packet 起草前に owner relay の対話形式で完了済み。成果は本 packet の Design Intent Trace / decision-log D-069 に転記した。）

## Risk

Risk: R2

Reason:
docs 新設（受入台本）+ synthetic fixture ファイル追加 + fixture 受理を保証する parser test 1 本のみで、runtime 契約・DTO・route・DB を変更しない。operator workflow の正本 docs は参照するだけで改変しない。fixture parser test の追加は既存テスト意味論を変えない追加のみ。

## Goal

Goal Invariant:

### 最小完了条件

- owner が Windows native で `docs/ACCEPTANCE_SCENARIO.md` の記述だけに従い、6 step（日報取込み→在庫反映→在庫少検知→棚卸し→整合性検証→バックアップ/復元）を 1 周でき、各 step が PASS/FAIL 判定可能な確認観点を持つ。
- Z001/Z002/Z005 の匿名化 synthetic bundle（同一日付 3 file）が repo に存在し、アプリのファイル選択から取込み成功する。

### 失敗定義

- 台本どおり操作しても step が再現できない、または確認観点が判定不能。
- fixture bundle が取込み reject される。
- 台本自身が指示する準備手順（商品登録・seed）が step 5 整合性検証で偽不整合を発生させる。

### 非目的

- Z004 経路（pos_stock_sync 自動在庫連動）の受入 — layout A/B 再検証 R3 完了後の台本第2版で扱う（D-069）。
- 自動 E2E 化（roadmap 項4 の定義どおり、穴が出た箇所のみ後付け評価）。
- 店舗マニュアル完成版の作成（台本第1層はその種に留める）。
- アプリ実装・seed_demo の変更。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

- `docs/ACCEPTANCE_SCENARIO.md` 新設 — 2 層構成: 第1層 = 操作手順（将来の店舗マニュアルの種、owner 裁定 2026-08-12）、第2層 = 受入確認観点（合格基準、期待値つき）。
- 6 step 構成は Codex 諮問（2026-08-12）の最小 step 列素案を基礎とする:
  1. 日報取込み: 同一日付の Z001/Z002/Z005 bundle を取込み、集計・支払・部門値を確認し、**対象商品の在庫が変わらないこと**も確認観点に含める。
  2. 在庫反映: アプリから登録した専用 pcs 商品へ入庫 → 手動販売出庫し、販売記録・入出庫 movement・最終在庫が期待値どおり閾値以下（pcs 既定 3「以下」）になることを確認。既定数列は **開始在庫 0 → 入庫 5 → 手動販売 3 → 残 2（閾値 3 以下）** を台本の固定値とする（Plan Review round 1 P3 採用）。
  3. 在庫少検知: `/stock?status=low_stock`（D-047 deep-link）に対象商品が表示され、数量・閾値条件が一致することを確認。
  4. 棚卸し: 対象商品を実数差異ありでカウント確定し、在庫と stocktake movement の補正を確認。
  5. 整合性検証: 明示実行し mismatch_count=0、在庫と movement 合計の一致を確認。
  6. バックアップ/復元: step 5 時点を backup → 識別可能な一時入庫 1 件 → restore で step 5 状態へ戻ることを確認。
- 事前準備節: 専用受入 DB（非本番）の用意、**baseline backup（切り戻し用、開始前に 1 回）と機能受入 backup（step 6 直前に 1 回）の作成タイミング分離** — backup ファイル名は `{prefix}{YYYYMMDD_HHMMSS}` の自動生成でカスタム命名機能は存在しない（`mnt/backup.rs`、68 UI-11b-D7/D8）ため、台本は各作成直後に一覧の作成日時を記録欄へメモさせて 2 つを対応付ける（Plan Review round 1 P2 是正）。台本用商品はアプリから登録する（初期在庫 movement が生成される経路。SQL 直 INSERT の seed は偽不整合を作るため禁止と明記）、失敗時は baseline へ復元して step 1 から再実行。
- `tests/fixtures/daily-report/` 新設: Z001/Z002/Z005 の匿名化 synthetic bundle（同一日付、`daily_report_parser.rs` テスト内リテラルからの抽出・整形）+ README（生成根拠・実データでないことの明記）。**fixture 3 file は UTF-8 テキストのまま書き出してはならない**: parser は CP932 strict decode（29-io §29.3 step 3、`daily_report_parser.rs` の decode 失敗 = parse error）のため、テスト内リテラル（UTF-8）を `encoding_rs::SHIFT_JIS.encode`（test helper `encode_cp932` と同ロジック）でバイト列化した結果を `.CSV` として書き出す（Plan Review round 1 P1 是正）。
- fixture 受理の regression 保証: fixture 3 file を読み parse 成功を assert する Rust test 1 本（io 層）。REQ token を含むため `cargo run --bin generate_traceability` で 90-traceability.md を再生成し同 PR に含める。
- decision-log D-069 新設: 台本第1版の経路確定（案1 = 手動入出庫中心）と、Z004 前提条件（v1.0 初日から Z004 実運用するなら Z004 R3 + 台本第2版 PASS を MSI 配布判定 gate に含める判断を項5 で行う）の記録。
- `docs/Plans.md` roadmap 項4 の状態更新、`docs/PROJECT_HANDOFF.md` の手順書参照先の追記（新 doc への link）。

## Non-scope

- Z004 取込み step の台本化（第2版、Z004 layout A/B R3 完了後）。
- 店舗マニュアルの完成版・印刷様式。
- smoke E2E / 自動化（項4 実走で穴が出た箇所の後付け評価は別判断）。
- アプリコード・seed_demo・既存 fixture（tests/fixtures/z004/）の変更。
- 日報取込み運用設計 R3（保持期間・命名・同日複数精算等、Plans.md 既存 backlog）。

## Acceptance Criteria

- `docs/ACCEPTANCE_SCENARIO.md` が存在し、6 step それぞれに「操作手順（第1層）」と「確認観点 + 期待値（第2層）」が分離記述されている。
- 事前準備節に専用受入 DB / baseline backup と受入 backup の作成タイミング分離 + 作成日時メモによる対応付け（カスタム命名機能は存在しない前提の記述）/ アプリ登録経路の商品準備（SQL 直 INSERT 禁止の明記）/ 失敗時切り戻し手順が含まれる。
- `tests/fixtures/daily-report/` に同一日付の Z001/Z002/Z005 の 3 file + README が存在し、台本 step 1 から相対 path で参照されている。3 file は CP932 エンコード済みバイト列である（README に生成方法を明記）。
- fixture 受理 test（io 層）が green で、90-traceability.md が再生成済み（CI generated drift gate pass）。
- 対象商品・閾値・開始在庫・販売数が台本内で固定値として記述され、step 2 終了時に在庫少判定（pcs 既定 3 以下）へ到達する数列になっている。
- decision-log D-069 が記録され、Plans.md 項4 が本 change を参照する。
- `./scripts/doc-consistency-check.sh` 全チェック通過。

## Design Sources

- Requirements / spec: `docs/Plans.md` 中期 roadmap 項4・項5（owner 裁定 2026-07-16）
- Architecture: `docs/ARCHITECTURE.md`（層責務の参照のみ）
- Function / command / DTO: `function-design/55-ui-csv-import.md`（UI-07、DAILY-SOURCE-D1 = UI-07-D12）/ `29-io-daily-report-parser.md` / `37-biz-daily-report-import-service.md` / `45-cmd-daily-report-import.md` / `58-ui-stock-inquiry.md`（UI-06a/b、D-047 deep-link）/ `69-ui-threshold-settings.md` / `73-ui-stocktake.md` + `35-biz-stocktake-service.md` / `75-ui-integrity-check.md` / `68-ui-backup-restore.md` / `52-ui-shared-layout.md` §52.6
- DB: `docs/DB_DESIGN.md`（stock_unit / sale_records 正本定義）
- Screen / UI: 上記 UI 系 function-design と `docs/SCREEN_DESIGN.md`
- Decision log / ADR: D-047（在庫少 deep-link）、D-069（本 change で新設）、`archive/plans/2026-08-01-field-evidence-operations-sync.md`（日報標準手順の owner 決定）、`docs/DEV_SETUP_CHECKLIST.md` §4.6（Windows native L3 同期手順）

## Required Design Artifacts

Use `docs/DEV_WORKFLOW.md` Design artifact selection to decide what must exist before implementation.

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | 各 step の正本 function-design（Design Sources 参照） | existing sufficient（参照のみ、改変なし） |
| Command / DTO / generated binding / wire shape | 該当なし（wire 変更なし） | existing sufficient |
| DB / transaction / audit / rollback / migration | DB_DESIGN.md（参照のみ） | existing sufficient |
| Screen / UI / route state / Japanese wording | 55/58/69/73/75/68 + 52 §52.6 | existing sufficient（台本は実装済み画面の記述のみ） |
| CSV / TSV / report / import / export format | 29-io-daily-report-parser.md（fixture の shape 根拠） | existing sufficient |
| Durable decision / ADR | decision-log D-069（経路確定 + Z004 gate 前提条件） | updated in this PR |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| REQ coverage 追加（fixture 受理 test） | `cargo run --bin generate_traceability` で `90-traceability.md` 再生成（AUTO-GENERATED、手動編集は禁止のまま） |
| source / workflow doc 新設（`docs/ACCEPTANCE_SCENARIO.md`） | `docs/Plans.md` 項4 と `docs/PROJECT_HANDOFF.md` から link し、参照導線を確保する |

Tauri command / route / operator 画面 / function-design doc の新設はなし = 該当なし。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| roadmap 項4 | Plans.md 中期 roadmap | D-069 | 在庫反映は手動入出庫経路（案1）。案2（Z004 fixture 同乗）は layout A/B 未検証の順序ねじれ、案3（defer）は一気通貫の喪失で却下。Codex 諮問 2026-08-12 で実コード裏取り（commit.rs pos_stock_sync 分岐 / daily_report tests の在庫不変 assert）、Coordinator 三点一致確認済み | docs/ACCEPTANCE_SCENARIO.md | owner L3 1 周 |
| UI-07-D12 | 55-ui-csv-import.md | DAILY-SOURCE-D1 | 台本 step 1 は標準手順（EcrDatas 選択）を fixture bundle で模す | 台本 step 1 + fixture README | fixture 受理 test |
| D-047 | 58-ui-stock-inquiry.md | — | 在庫少検知は独立画面でなく status deep-link として記述 | 台本 step 3 | owner L3 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes — 各 step の正本 function-design が実装済み挙動を規定しており、台本はその operator 視点の再叙述。経路判断は D-069 へ昇格する。
- Plan-only durable decisions found and promoted to source docs / decision-log: D-069（案1 経路 + Z004 gate 前提条件）。
- Assumptions and constraints: 日報取込み（Z001/2/5）は在庫を動かさない（`daily_report_import_service/tests.rs` の在庫不変 assert で機械保証）。在庫連動は Z004 の `pos_stock_sync` 分岐のみ（`csv_import_service/commit.rs`）。整合性検証は stock_quantity と movement 合計の突合のため、movement を作らない SQL 直 INSERT seed は偽不整合を作る。手動販売・入庫に取消 CMD はない。
- Deferred design gaps, risk, and follow-up target: Z004 経路受入は第2版（Z004 layout A/B R3 後）。台本 PASS ≠ Z004 受入を D-069 に明記し、項5 で gate 判断。
- Test Design Matrix can cite design decision IDs or source doc sections: R2 のため Matrix optional、fixture 受理 test は 29-io の shape 契約を cite。
- Absolute guarantee / escape hatch self-check completed: 本 change は挙動変更なしのため新規 guarantee なし。fixture は synthetic のみ（Data Safety 参照）。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable — 実装変更なし | — |
| Fact check / design decision split | 「日報取込み→在庫反映」が直結しない事実を Codex 諮問 + Coordinator 実読の三点一致で確認し、design 判断（案1）と分離して D-069 化 | decision-log D-069 |
| Lifecycle / retry | 前段失敗時の切り戻し = baseline backup 復元 + step 1 再実行を台本に規定（手動販売・入庫の取消 CMD 不在のため） | 台本 事前準備節 |
| Operator workflow | 台本第1層が operator 手順書の初実体（repo 内に手順書不在の gap を初めて埋める） | docs/ACCEPTANCE_SCENARIO.md |
| Replacement path | not applicable — 既存物の置換なし | — |
| Data safety / evidence | 実 POS CSV は使用せず synthetic bundle のみ。受入は専用 DB で本番 DB に触れない | 台本 事前準備節 + fixture README |
| Reporting / accounting semantics | step 1 の集計値確認は fixture 内容から導出した固定期待値で判定 | 台本 step 1 期待値表 |
| Manual verification | Human Gate = owner L3 1 周（項4 実走そのもの） | 本 packet Human Gate |
| 環境・再現性 | Windows native + 専用受入 DB + 決定的 fixture で再現可能。新規環境依存の追加なし | — |

## Design Readiness

State whether the design is ready for implementation.

- Existing design docs are sufficient because: 6 step 全ての正本 function-design が実装完了状態を規定済みで、本 change は新規挙動を設計しない。
- Source docs updated in this PR: decision-log（D-069）、Plans.md 項4、PROJECT_HANDOFF link。
- Design gaps intentionally deferred: Z004 経路（第2版）、店舗マニュアル完成版、連続実走で穴が出た場合の smoke E2E 評価。
- Durable decisions discovered in this plan and promoted to source docs: D-069。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): 変更なし（参照のみ）。
- Backend function design: 変更なし。
- Command / DTO / data contract: 変更なし。
- Persistence / transaction / audit impact: 変更なし。台本は専用受入 DB 前提。
- Operator workflow / Japanese UI wording: 台本は画面の実文言に一致させる（Writer は実画面 or 正本 docs の文言を転記、創作しない）。
- Error, empty, retry, and recovery behavior: 失敗時切り戻し（baseline 復元）を台本に規定。
- Testability and traceability IDs: fixture 受理 test は REQ-401 系 token を含め traceability 再生成で拘束。

## Contract Probe

R2 につき必須ではない。外部前提（日報取込みの在庫不変 / pos_stock_sync の Z004 限定）は Codex 諮問と Coordinator 実読の三点一致で裏取り済みのため N/A。

## Contract Coverage Ledger

R2 につき N/A（R3/R4 required）。台本の確認観点と正本契約の対応は Design Intent Trace と Review Focus で担保する。

## Test Plan

- targeted tests: fixture 受理 test（`tests/fixtures/daily-report/` の 3 file を読み parse 成功 + 代表集計値 assert、io 層）。`./scripts/doc-consistency-check.sh`。
- negative tests: なし（fixture の誤 shape 検証は既存 parser エラー系 test が保有済み、追加しない）。
- compatibility checks: 90-traceability.md 再生成の CI drift gate pass。
- data safety checks: fixture 3 file と README に実店舗値が含まれないこと（Review Focus で独立確認）。
- main wiring/integration checks: なし（実装変更なし）。owner L3 1 周が end-to-end 実証。

## Boundary / Wire Contract

not applicable — wire / DTO / API / config / DB schema に変更なし。fixture は既存 parser の受理 shape に従う入力データのみ。

## Review Focus

- 台本各 step の操作手順・確認観点が正本 function-design の実装済み挙動と一致しているか（創作された手順・文言がないか）。
- fixture bundle が 29-io の受理 shape に適合し（**CP932 エンコード済みであること**を含む）、README が synthetic であることを明記しているか。実店舗値の混入がないか。
- 事前準備節が偽不整合を作らない構成か（アプリ登録経路、SQL 直 INSERT 禁止）。
- baseline backup と受入 backup の作成タイミング分離 + 作成日時メモの対応付けが、実装済み挙動（自動タイムスタンプ命名・命名機能なし）に即して曖昧さなく書かれているか。
- step 2 の固定数列（開始 0 → 入庫 5 → 販売 3 → 残 2）が閾値 3 以下判定へ確実に到達するか。

## Spec Contract

R2 につき N/A（R3/R4 required）。

## Trace Matrix

R2 につき N/A（R3/R4 required）。

## Data Safety

- 実 POS / 店舗 CSV・実売上値・実商品名は commit しない（fixture は synthetic のみ、README に生成根拠を明記）。
- 受入実走は専用受入 DB で行い、本番 DB / 実 backup file は台本から参照しない。
- `docs/research/real-csv/`（git 管理外、owner local）は台本から参照しない。

## Implementation Results

- Writer implementation: completed — 2 層・6 step の `docs/ACCEPTANCE_SCENARIO.md`、CP932 synthetic daily-report bundle、実ファイル受理 test、D-069、Plans / PROJECT_HANDOFF 登録、traceability 再生成を実装した。
- Verification: fixture targeted test、全 Rust test、format check、doc consistency check、L1 full は clean content commit に対して pass。generated artifact drift と終了時 clean tree も確認した（implementing → local-verified の遷移根拠）。
- PR: 未作成（Coordinator が Final Review 後に作成する契約）。

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

Fill after review.
If R3 review-only sub-agent is skipped, record an explicit line beginning with `Review-only skipped because:` and the reason.
- Findings Freeze: not yet frozen; post-freeze exceptions: none.

### Plan Review（独立 Sonnet、rally 天井 3）

- round 1（対象 `d563820`）: NOT CLOSED — P1×1（fixture の CP932/SHIFT_JIS 再エンコード義務の明記漏れ = UTF-8 直書き出しだと parser strict decode で reject、`daily_report_parser.rs` の decode 実装と test helper `encode_cp932` を引用）/ P2×1（backup「命名分離」が実在しないカスタム命名機能を示唆、実装は自動タイムスタンプ命名のみ）/ P3×1（step 2 数列の固定値化推奨）。packet が依拠する事実主張 (a) 日報取込みの在庫不変 (b) pos_stock_sync の Z004 限定 (c) 整合性検証の movement 突合 (d) アプリ登録の初期在庫 movement 生成は、reviewer 独立実読で全件一致。全 findings に修正案添付（fix-proposal 義務充足）。Coordinator が引用 3 点を実読裏取りのうえ全件 accept、是正 commit `19daa33`（P2 は「命名」の packet 全文 rg sweep 済み、残存 1 件は Non-scope の別文脈で正当）。
- round 2（対象 `19daa33`、focused verification）: **CLOSED（P1/P2 = 0）** — 3 disposition とも実装済み挙動への引用一致を確認、新規 findings なし。P1+P2 単調収束 2→0。
- owner plan 承認: 2026-08-12（介入 1/3。plan-gate→plan-approved の遷移根拠）。implementing 遷移は Codex Writer 発注の前提として Coordinator が完了（発注 preconditions）。

### Final Review（独立 Sonnet、対象 = Reviewed Content HEAD `cf70131`）

- 判定 **CLOSED（P1/P2 = 0）**、AC1〜AC7 全充足を reviewer 自前証拠で確認 — 台本全 step の UI 文言を実装 component と突合（全 MATCH、D-047 deep-link / backup 自動命名を実コード確認）/ fixture 3 file は UTF-8 decode 失敗 + Shift_JIS 可読を機械確認、既存 test リテラルとバイト単位一致、実店舗値 scan 0 hit / 受理 test は実ファイル `std::fs::read` 読取り + assert 代表値（12000/8・11000/7・3000/4）の fixture 実内容由来を目視突合、`cargo test --lib io::daily_report_parser` 10 passed / D-069 verbatim 一致 / 90-traceability は REQ-401 行のみの差分 / doc-consistency 全通過 / Data Safety 適合。
- findings = P3×1 のみ（step 4 整合性表示の期待値が一文の部分引用を独立文言のように表記）→ Coordinator accept、本 commit で是正（「文末の部分引用」注記化）。post-audit 差分は当該 1 行のみ。
- Writer 完了条件 backstop: `cargo check --release` pass を Coordinator が実測（L3 Human Gate 前提、DEV_WORKFLOW 規則）。
- 遷移記録: local-verified → independent-review（FR 従事）→ human-confirm（P1/P2 = 0 確定）。STATECAP state-only 予算（3 本）消化済みのため、本遷移は content commit（P3 是正）同乗で実体化（PR #58 先例の cap 内完走方式）。

### owner L3 実走 1 回目（2026-08-13、Windows native、HEAD `0e49697`）: FAIL（Step 4 で停止）

- Step 1〜3 PASS（日報集計・在庫不変 / 入庫 +5 → 手動販売 -3 → 残 2 / 在庫少 filter 表示）。Step 4 で台本の fail-closed 規則どおり停止、baseline backup へ復元済み（復元後 DB の空状態を owner 確認、失敗時点は自動 backup に保存）。evidence 正本 = PR #74 comment（2026-08-13）。
- **Blocker（gated Amendment 1 起源）**: 台本 Step 4「棚卸し入力」の期待値が差異 `-1` — 正本 35-biz §20.4 / 実装 `stocktake_service.rs:227` の契約は差異 = `stock_quantity - actual_count`（このケース 2-1 = **+1**、正 = システム在庫が多い）であり符号が逆。補正 movement は `actual_count - stock_quantity` = -1 で台本の「在庫変動履歴 `-1`」は正しい。画面差異と補正 movement の 2 値を区別しなかった台本の欠陥（Writer 起草時混同、Plan Review / Final Review とも未検出、owner L3 が捕捉した true positive）。
- 追加 UX 観察（blocker と別、pre-existing 仕様）: 在庫 2・基準 3 の同一商品が「すべて」filter では状態「通常」、「在庫少」filter では「在庫少」と表示され operator には矛盾に見える。query source 依存の現行仕様。→ Plans.md backlog へ起票（本 Amendment commit 同乗）。

### Final Review round 2（focused、対象 = Amendment `cfa0506`）: CLOSED（P1/P2 = 0）

- L134 是正は 35-biz §20.4（`difference: system_stock - actual_count`）/ `stocktake_service.rs:227`（画面差異）/ `:409`（補正 movement = 逆符号）と完全一致を reviewer 実読で確認。注記の 2 値区別自体も実装裏付けあり。
- 符号・方向系 sweep: 全 6 step の数値期待値を表示式・movement 生成式（receiving.rs / manual_sale.rs / stocktake-formatters.ts）まで遡り追跡、**同型の表示値・movement 値混同は他に無し**。step 5 の算術（+5-3-1=1）・step 6 の復元後履歴も整合。
- packet の L3 FAIL / backtrack 記録は実況一致（PR #74 OPEN・diff 一致・doc-check / check-workflow-git pass）。
- P3×1: 「gated Amendment 1」呼称と `Amendments: none` の不整合 → disposition = `Amendments:` へ `cfa0506` を追記して呼称を維持（本 commit。commit message は履歴書き換えなしの原則で不変）。
- 遷移記録: implementing → local-verified（docs-only 是正、doc-check / workflow-git pass 実測）→ independent-review（round 2 従事）→ human-confirm（P1/P2 = 0 確定、Reviewed Content HEAD を `cfa0506` へ更新）。本遷移も content commit 同乗（STATECAP cap 内完走方式の継続）。次 = 再 L3（Step 1 から再走）。

### owner L3 実走 2 回目（2026-08-13、HEAD `a881bbe`）: FAIL — 外部 pre-existing UI drift の捕捉（台本は正）

- Step 1〜3 PASS。Amendment 1 の計算是正（画面差異 +1 / 補正 movement -1）は実走 + DB で正しいと owner 確認。Step 4 で新規 finding により fail-closed 停止、baseline へ復元済み。evidence 正本 = PR #74 comment（2026-08-13 round 2）。
- **新規 finding（本 change の Non-scope = アプリ実装変更のため別 change へ）**: 棚卸し確定結果画面の差異が生値表示（`StocktakePage.tsx` の `{item.difference}`）で正差異に `+` が付かず、UI-10-D10 / §73.6 の「符号付き数値・進行中一覧（`formatListDifference` = `+3`/`-2`/`0`）と表現統一」契約と drift。Coordinator が正本・formatter・両表示箇所の 4 点を実読裏取りし confirmed。disposition = 別 change `2026-08-13-stocktake-result-difference-sign`（R2）で是正し、merge 後に本 branch を main へ rebase して再 L3（Step 1 から）。Phase は human-confirm を維持（台本・fixture は本 round で正当性確認済み、Human Gate は外部是正待ち）。

### owner L3 実走 3 回目（2026-08-13、HEAD `1dd60cd` = PR #75 是正 merge 取り込み後）: 総合 PASS — Human Gate 完了

- **6 step を Windows native 1 セッションで完走**（介入 4/3、予算超過は owner 明示承認 — 過去 2 FAIL がいずれも実欠陥の true positive 捕捉だったため）。evidence 正本 = PR #74 comment（2026-08-13 round 3）: step 1 集計値一致 + 在庫不変 / step 2 入庫 +5 → 販売 -3 → 在庫 2 / step 3 在庫少 filter 表示 / step 4 **画面差異 +1・補正 movement -1（PR #75 是正を実機確認）**・不整合 0 / step 5 現在庫 1 = movement 合計 / step 6 backup → 一時入庫 → 復元で消失・履歴残存・ホーム通知確認。
- 実走環境の復帰: 通常 DB へ復帰し SHA-256（DB/WAL/SHM）完全一致を owner 確認、L3 専用 DB は別名保存。
- 追加観察（非 blocker、Plans.md backlog へ起票）: サイドバー label「整合性検証」と遷移先ページ見出し「在庫整合性チェック」の名称差（双方とも正本どおりの実装で操作可能、統一は表示幅含め後日検討の P3）。在庫状態の filter 依存 UX 差は既起票の backlog 項を再確認。
- roadmap 項 4 の受入実走が成立、項 5（v1.0 gate = MSI 配布手順 docs 化 + 配布判定）の入口条件が成立。
- 遷移記録: human-confirm → ready-hosted-final（L3 PASS + CI 全 green on `1dd60cd`。本遷移は L3 記録 content commit 同乗）。次 = owner merge 承認 → merge → archive closeout。
