# Plan Packet: 店舗調査証跡と導入時運用契約の同期

## Workflow State

- Phase: ready-hosted-final
- Risk: R3
- Execution Mode: dual-vendor-no-fable
- Plan Commit: 2902177341b455833a5193bfa9519a6565ad41c1
- Amendments: none
- Coordinator: Codex GPT-5.6 (main session)
- Writer: Codex GPT-5.6 (main session)
- Plan Reviewer: independent Claude Sonnet 5
- Final Reviewer: independent Claude Sonnet 5
- Reviewed Content HEAD: 657c3cc56a93613d7562d447e910c67277284dd8
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: pending merge

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 2

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
実装コードを変えない docs-only change だが、POS CSV の実形状、CV17 のoperator workflow、PLU段階導入、日報画面の受入境界を正本化する。誤ると Z004 parser、在庫増減、PLUスロット割当、日報取込み主経路の後続R3実装が誤った前提から始まる。

## Goal

Goal Invariant: 2026-07-06 店舗調査で既に得た事実と2026-08-01 owner補足が、確認済み事実・未決設計・後続作業に分離され、次の実装者が「Z004は将来得られるファイル」と誤読せず、実データをrepositoryへ持ち込まずに導入準備を再開できる。

### 最小完了条件

- Z004がCV17のPLU別売上レポートで、個数・金額を持ち、Z001/Z002/Z005と同じレポート画面群から同時出力できる事実を記録する。
- 「将来」はZ004の存在や在庫増減ロジックの新設ではなく、二形状対応で店舗採取layoutを既存pipelineへ到達させ、実運用で再検証することだと正す。
- Excel印刷・バインダーの現在の役割と、日報画面の代替受入が未確認であることを分離する。
- CV17取込み後のPC側EcrDatasを店舗の標準取込み元とし、layout A/B対応をoperatorの選択肢ではなくadapter互換性として追跡できる。
- 段階的PLU移行、固定スロット、Z004取込みを次の設計判断として追跡できる。

### 失敗定義

- Z004を将来取得候補またはPLUマスタと誤記する。
- `Z001/Z002/Z005` の公式集計と `Z004` の商品別売上をアプリ内部で同一正本に混ぜる。
- layout A/B対応を理由に、SD・EcrDatas・明示書出しのどれを使ってもよいというoperator手順にする。
- 紙廃止をowner確定済みとして扱う。
- 実CSV、実JAN、実商品名、価格、DB、スクリーンショットを追跡対象へ入れる。

### 非目的

- Z004 parser、在庫増減、PLUスロット永続割当、bulk PLU onboarding の実装。
- EcrDatas自動探索、4ファイル一括取込み、印刷機能の仕様確定。
- 日報画面が紙を完全代替したという受入判定。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- `docs/plu-export-and-real-csv-verification.md`: 店舗調査事実、二形状、日報ファイル群、Excel/バインダー運用、残る設計判断を同期。
- `docs/project-memory.md`: 安定したPOS事実とownerの段階的PLU導入意図を同期。
- `docs/ARCHITECTURE.md`, `docs/architecture/biz-task-specs.md`, `docs/architecture/ui-task-specs.md`: Z004商品別売上・在庫増減は実装済みでlayout Aが未接続という境界へ同期。
- `docs/function-design/23-io-z004-parser.md`, `32-biz-csv-import-service.md`, `55-ui-csv-import.md`: 現行parser gapと既存在庫増減pipelineの境界を明記。
- `docs/DB_DESIGN.md`, `docs/db-design/pos-tables.md`: 標準入力元と既存sale_records/inventory_movements契約の現況を同期。
- `docs/function-design/56-ui-daily-sales.md` / `57-ui-monthly-sales.md`: 紙・Excel代替は導入前受入が残ることを明記。
- `docs/decision-log.md` D-025: 2026-07-06証拠でZ004の位置づけを補強。
- `Plans.md` / `docs/PROJECT_HANDOFF.md`: active changeと後続作業を同期。

## Non-scope

- Rust / TypeScript / workflow YAML / DB schema / generated file の変更。
- local-only `inventory-field-check` 配下の編集または追跡。
- Z004の返品・複数数量・同日再精算について未取得の証拠を推測で埋めること。
- `日報ファイル群` を4ファイルの原子的な単一import bundleと定義すること。

## Acceptance Criteria

- `rg -n "PLU別売上レポート|日報ファイル群|バインダー" docs/plu-export-and-real-csv-verification.md docs/project-memory.md` が新しい事実境界を返す。
- `rg -n "導入前受入|紙.*代替|バインダー" docs/function-design/56-ui-daily-sales.md docs/function-design/57-ui-monthly-sales.md` が日次・月次の受入保留を返す。
- `rg -n 'Z004.*在庫(自動)?(引落し|増減)候補|在庫.*接続.*未実装|Z004.*使えるか.*評価' docs/ --glob '!docs/archive/**' --glob '!docs/plans/**'` のstale表現を0件にする。active Plan Packetは棄却語彙と検査式自体を記録するため走査対象外とする。
- `git diff --name-only origin/main...HEAD -- .github/workflows src src-tauri` が0行。
- `bash scripts/doc-consistency-check.sh --target plan` exit 0。
- `bash scripts/local-ci.sh full` が最終candidateでCLEAN/PASS。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-401 / REQ-402 / REQ-501
- Architecture: `docs/ARCHITECTURE.md` POS adapter boundary（D-023）
- Function / command / DTO: `docs/function-design/23-io-z004-parser.md`, `29-io-daily-report-parser.md`, `34-biz-sales-service.md`, `37-biz-daily-report-import-service.md`, `55-ui-csv-import.md`, `56-ui-daily-sales.md`, `57-ui-monthly-sales.md`, `73-ui-stocktake.md`
- DB: `docs/DB_DESIGN.md`（参照のみ、変更なし）
- Screen / UI: `docs/SCREEN_DESIGN.md`（参照のみ）
- Decision log / ADR: D-023, D-025, D-028
- Field evidence: local-only `inventory-field-check/summaries/2026-07-06-z00x-shape-analysis.md`, `sd-pc-tool-ingestion.md`, `z004-plu-investigation.md`, `approved-readable/ECRCV17.pdf`

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend parser / validation / inventory linkage | `23-io-z004-parser.md`, `32-biz-csv-import-service.md`, architecture task specs | updated in this PR（existing BIZ pipelineは不変、layout A実装はdeferred） |
| Command / DTO / generated binding / wire shape | 変更なし | existing sufficient |
| DB / transaction / audit / rollback / migration | `DB_DESIGN.md`, `db-design/pos-tables.md` | existing sufficient、標準入力元と現況表現のみ同期 |
| Screen / UI / route state / Japanese wording | `56-ui-daily-sales.md`, `57-ui-monthly-sales.md` | updated in this PR（受入保留のみ） |
| CSV / report / import / export format | `plu-export-and-real-csv-verification.md` | updated in this PR |
| Durable decision / ADR | `decision-log.md` D-025 | updated in this PR（既存判断の証拠補強） |

## Registration / Generation Obligations

該当なし。新規command、function-design file、route、REQ coverage、generated bindingを追加しない。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-401 | field verification / 23 IO-02 / 32 BIZ-03 | FIELD-Z004-D1 | Z004は確認済みPLU別売上で既存在庫増減pipelineを持つ。将来取得・在庫接続候補という表現を棄却 | docsのみ | Matrix M1-M4 |
| REQ-401 / REQ-501 | 56 / 57 | REPORT-ACCEPT-D1 | 画面の項目充足だけで紙代替済みとする案を棄却 | docsのみ、実機受入はfollow-up | Matrix M5-M6 |
| REQ-402 | D-028 / Plans | PLU-ROLLOUT-D1 | 段階導入で再採番Fullを繰返す案は固定スロット衝突を残す | follow-up R3 | Matrix M7 |
| REQ-401 | field verification / 55 / Plans | DAILY-SOURCE-D1 | 通常手順を複数提示せず、CV17取込み後のPC側EcrDatasを標準入力元に固定。SDバックアップ・明示書出しは復旧/調査へ分離 | docsのみ、保持等はfollow-up R3 | Matrix M8 |

## Design Intent Audit

- source docsだけで、確認済みファイル事実と未実装アプリ挙動を区別できるようにする。
- Z004の出力画面・列・テスト販売はadapter facts、実装済みの在庫増減・import lifecycleはcore designとして分離する。店舗採取layout Aが未接続であるため、runtime capabilityとfield readinessも分ける。
- 「日報ファイル群」はoperator/CV17上の集合名に限定し、内部DBの単一bundleを意味させない。
- 紙代替は外部提出要件ではなく、過去日の検索・修正状態・欠落把握・backup/restoreへの信頼を含むoperator受入とする。

## Impact Review Lenses

- Adapter / core boundary: CV17のタブ・ファイル形状と、アプリの集計・在庫責務を分離。
- Fact check / design decision split: 2026-07-06観測、説明書、2026-08-01 owner判断を記録し、EcrDatas標準経路と未設計の保持・再取込み境界を分ける。
- Lifecycle / retry: Z004取込みの重複・rollback・`pos_stock_sync`は実装済み。layout A/B、同日再精算、実データend-to-end再検証をfollow-upの必須観点として残す。
- Operator workflow: SD→CV17→EcrDatas、Excel貼付→印刷→バインダー、段階的PLU移行を一連の運用として記録。
- Replacement path: CASIO adapter detailをcore日報モデルへ漏らさない。
- Data safety / evidence: 匿名化summaryと説明書だけを根拠として、実ファイルはcommitしない。
- Reporting / accounting semantics: Z001/Z002/Z005公式集計とZ004商品別を混算しない。
- Manual verification: 紙代替受入と実機Z004返品・複数数量は後続L3/field check。

## Design Readiness

- 本changeのdocs同期に必要な観測証拠は揃っている。
- EcrDatas標準経路は本changeで決定する。保持期間・命名・部分転送・再取込み、固定PLUスロット、Z004二形状実装、実データでの既存在庫増減pipeline再検証、紙代替合格は後続事項として明示するため、本changeのblockerではない。
- 後続実装はそれぞれ別R3 Plan PacketとTest Design Matrixを必要とする。

## Contract Probe

- local-only匿名化summary `2026-07-06-z00x-shape-analysis.md`: Z004列=`メモリNo./コード/名称/個数/金額`、全5000slot、テスト販売1行のみ個数非ゼロ、layout Aで現行parserが精算日抽出に安全停止することを確認。
- local-only `sd-pc-tool-ingestion.md` + `ECRCV17.pdf`: Z001/Z002/Z004/Z005が同じ売上日報/月報の種別群で、日付別閲覧・書出し・期間書出しとEcrDatas保存経路を持つことを確認。
- repository fact: `docs/function-design/23-io-z004-parser.md` は1行目日付+2行目headerを現行contractとし、Issue採取layout A（メタ6行+header）をまだ受け付けない。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| FIELD-Z004-D1 Z004は数量・金額を持つ確認済みPLU別売上で、BIZ-03在庫増減pipelineは実装済み | verification / project-memory / architecture / 32 / D-025 | Matrix M1-M3 | 実値はnon-scope |
| FIELD-Z004-D2 CV17上はZ00x同一レポート群、app coreは二系統 | verification / D-025 | Matrix M4 | UI統合はnon-scope |
| FIELD-Z004-D3 internal/exportの二形状とIO-02 gap | verification / 23 / Plans | Matrix M2, M8 | parser実装はfollow-up |
| REPORT-ACCEPT-D1 Excel/紙の保存目的と代替受入保留 | verification / 56 / 57 / Plans | Matrix M5-M6 | go-live前operator確認 |
| PLU-ROLLOUT-D1 段階的PLU移行で固定slot設計が必要 | project-memory / Plans / handoff | Matrix M7 | 実装はfollow-up |
| DAILY-SOURCE-D1 EcrDatasを標準入力元とし複数形式対応をoperator選択にしない | verification / 55 / Plans / handoff | Matrix M8 | 保持・再取込み境界はfollow-up |
| Data safety 実店舗artifact非追跡 | packet / git diff | Matrix M9 | 実ファイル全てnon-scope |

## Test Plan

Test Design Matrix: [test-matrices/2026-08-01-field-evidence-operations-sync.md](test-matrices/2026-08-01-field-evidence-operations-sync.md)

- docs token/semantic checks M1-M8。
- data-safetyと変更範囲 M9-M10。
- `doc-consistency-check.sh --target plan` と最終 `local-ci.sh full`。

## Boundary / Wire Contract

runtime wire変更なし。

- External producer: CV17 1.1.1 / SR-S4000。
- Observed external family: Z001/Z002/Z004/Z005。同じCV17レポート画面群から出力可能。
- Core consumers: Z001/Z002/Z005はdaily_report系、Z004は既存のsale_records/inventory_movements別track。
- Current Z004 parser wire: layout B相当の1行目日付+2行目header。layout A対応は未実装。
- Compatibility: 本changeはbyte parser、DTO、DB、UI runtimeを変更しない。

## Review Focus

- 「Z004取得・在庫増減が将来」ではなく「layout Aを既存pipelineへ接続して実データ再検証することが将来」へ正しく直っているか。
- `日報ファイル群` が単一transaction/bundleを暗示していないか。
- EcrDatas標準経路を明記しつつ、layout A/B対応をoperatorの選択肢として露出していないか。
- 紙廃止を確定扱いしていないか。
- 現行parser contractと実採取layout Aの差を混同していないか。
- 実店舗値やlocal-only artifactを追跡していないか。

## Spec Contract

- FIELD-Z004-D1: Z004はCV17のPLU別売上レポートで、メモリNo./コード/名称/個数/金額を持つ。2026-07-06の1件販売で個数非ゼロ行を確認済み。BIZ-03は既にsale_records作成と`pos_stock_sync=true`商品の在庫増減・rollbackを実装しており、field readinessの残件はlayout A/B対応と実データend-to-end再検証である。
- FIELD-Z004-D2: CV17/operator上の「日報ファイル群」はZ001/Z002/Z004/Z005を含み同時出力可能。ただしapp coreでは公式日報集計と商品別売上/在庫trackを分離する。
- FIELD-Z004-D3: CV17 internal保存と明示書出しに小さなshape差があり、IO-07は二形状対応済み、IO-02はIssue採取layout A未対応。
- REPORT-ACCEPT-D1: Z001/Z002/Z005は既存Excelファイル群へ毎日ほぼそのまま貼り付けられ、同じファイルが上書きされるためExcel側に日別履歴は残らない。印刷・バインダーだけが現在の各日記録保持手段で、外部提出用途ではない。日次/月次画面の紙代替はgo-live前operator受入まで未確定。
- PLU-ROLLOUT-D1: app導入時は段階的にPLU販売へ移るowner意図があり、固定slot割当とbulk onboardingを導入準備として再評価する。
- DAILY-SOURCE-D1: 店舗の標準手順は、SDからCV17へデータを取り込み、そのPC側`EcrDatas`からアプリへファイルを選ぶ経路に固定する。初回は手順書に従って所定フォルダを選び、以後は既存の前回選択フォルダ記憶を使う。SDの`XZ_BKUP`とCV17の明示書出しは通常手順の選択肢にせず、復旧・調査用途とする。layout A/B対応はadapter互換性でありoperatorに形式を選ばせない。保持・命名・部分転送・再取込み境界は後続R3で設計する。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| FIELD-Z004-D1/D2 | verification / memory / D-025同期 | M1-M4 | 事実とcore判断の分離 | 匿名化summary + ECRCV17 manual |
| FIELD-Z004-D3 | 23 / Plans同期 | M2, M8 | 現行runtimeを過大主張しない | source doc diff |
| REPORT-ACCEPT-D1 | verification / 56 / 57 / Plans同期 | M5-M6 | 紙廃止を確定しない | owner補足 |
| PLU-ROLLOUT-D1 | memory / Plans / handoff同期 | M7 | rollout prerequisiteの優先度 | owner補足 + D-028 |
| DAILY-SOURCE-D1 | verification / 55 / Plans / handoff同期 | M8 | 標準手順と互換入力の分離 | owner判断 + field evidence |

## Data Safety

- 実POS CSV、PLU export、DB、backup、JAN、商品名、価格、売上金額、screenshotはcommitしない。
- local-only evidenceはpathと匿名化shapeだけを参照する。
- `git status --short` とdiffでapproved-readable/Issue採取ファイルが追跡されていないことを確認する。

## Implementation Results

（Plan Gate後に記入）

## Review Response

- Findings Freeze: not yet frozen; post-freeze exceptions: none.
- Plan Review（2026-08-01、Reviewed Content HEAD `2902177341b455833a5193bfa9519a6565ad41c1`）: P1=0 / P2=0 / P3=1。Plan GateのP1/P2=0条件は満たした。
- P3-1 accepted same-change: stale-grepが自身の検査式・棄却説明・正常なgo-live準備候補へ自己一致した。active plan/archiveを除外し、検出語彙を過去の誤記へ限定した改訂ACを実行してno matches（rg exit 1）を確認。correction HEADのclosure確認はpending。
- Closure Review（2026-08-01、Reviewed Content HEAD `7100d345f22a4a44d5bc19eba46ed6d38b55353d`）: P3-1はCLOSED。新規P2-1として、限定後のstale-grepが是正前の実在variant `在庫自動引落し候補` を検出しないことをacceptした。Plan Gateは継続する。
- P2-1 accepted same-change: `自動` の任意挿入、`引落し` / `増減`、`使えるか` から `評価` までの表現差を吸収するregexへ改訂した。`main`の実在variantを検出し、現行active source docsではno matches（rg exit 1）を確認。correction HEADのclosure確認はpending。
- Plan Review Closure（2026-08-01、Reviewed Content HEAD `657c3cc56a93613d7562d447e910c67277284dd8`）: P3-1 / P2-1はCLOSED、新規P1/P2/P3は0。Plan GateのP1/P2=0条件を満たした。
- State Transition（2026-08-01）: plan-first commit `2902177341b455833a5193bfa9519a6565ad41c1` とPlan Review closureがimplementationより前に揃ったため、このstate-only commitでplan-gate -> plan-approved -> implementingをmaterializeする。pre-approval correctionは`7100d345f22a4a44d5bc19eba46ed6d38b55353d` / `657c3cc56a93613d7562d447e910c67277284dd8`で、`Amendments: none`を維持する。
- Final Contract Audit（2026-08-01、exact live HEAD `a5ae3f0aa83a73396707a084c8de7666a7812780`）: independent Claude Sonnet 5がContract Coverage Ledger、negative space、adapter/core境界、reporting semantics、operator workflow、current/future境界、manual verification、data safety、stale wording guard、state/evidence separationを監査し、P1/P2/P3=0。Findings Freezeをfrozenとする。
- Reviewed Content HEAD adjudication（2026-08-01）: reviewerはL1 evidence HEADとの一致を理由に`a5ae3f0aa83a73396707a084c8de7666a7812780`を推奨したが、同commitはstate-onlyであり、D-035はこのfieldを監査済みcontent-bearing commitと定義し、final L1 evidenceから分離する。したがって対象source docsの最終content commit `657c3cc56a93613d7562d447e910c67277284dd8`を記録し、L1 full CLEAN/PASSの`a5ae3f0aa83a73396707a084c8de7666a7812780`はPR body evidenceとして扱う。
- State Transition（2026-08-01）: content candidate `657c3cc56a93613d7562d447e910c67277284dd8`、exact live HEAD `a5ae3f0aa83a73396707a084c8de7666a7812780`のL1 full CLEAN/PASS、Final Contract Audit P1/P2=0がこのcommitより前に揃ったため、implementing -> local-verified -> independent-review -> human-confirmをmaterializeする。
- Owner Ready Authorization（2026-08-01）: ownerが介入2/3として「Ready OK」を明示し、Draft PR #55をready-hosted-finalへ進めることを承認した。
- State Transition（2026-08-01）: owner Ready authorizationを受け、このstate-only commitでhuman-confirm -> ready-hosted-finalをmaterializeする。resulting exact HEADでL1 fullを再実行し、PR bodyを全面更新してからReady化・required hosted finalへ進む。
