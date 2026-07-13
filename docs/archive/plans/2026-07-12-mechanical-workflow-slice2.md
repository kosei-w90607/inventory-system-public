# Plan Packet: mechanical workflow slice 2（D-034 slice 2 design + implementation）

## Workflow State

Use the field definitions, enums, transition evidence, packet-selection rule, and fail-closed behavior from `docs/DEV_WORKFLOW.md` `Workflow State`. Keep exactly one `- Key: value` line per field.

- Phase: ready-hosted-final
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: ca4a3f8
- Amendments: none
- Coordinator: Fable (main thread)
- Writer: Sonnet subagent 群（fresh context、Plan Gate の Plan Reviewer とは非兼任。W1=PK4/PK1拡張、W2=PK5/STATECAP/drift test、W3=正本昇格）
- Plan Reviewer: 未定（plan-gate 時に fresh context で選任し、Writer と兼任しない）
- Final Reviewer: 未定（independent-review 時に fresh context で選任し、Coordinator/Writer と兼任しない）
- Reviewed Content HEAD: f722b7e（Double Audit 対象内容 + 全指摘の閉包修正を含む audited content。exact-HEAD の三点一致 evidence は PR body 側）
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: Plan Gate 承認済み（hook 裁定含む）/ Ready 承認済み（human-confirm 兼、2026-07-13）/ 残り merge のみ

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 0（既定 2 からの引き下げ。理由: 本 packet は docs/scripts のみの R3 で外部端末への Codex 実装委譲を計画せず、実装・レビューとも同一 session 内の subagent 発注で完結するため、owner を介した relay を設計上使用しない。必要が生じた場合は budget 超過として Coordinator が記録・報告する。なお fable-window 全体の relay 既定値の改定は本 packet では行わず、D-039 の検討候補として記録のみ行う — packet 個別 override を隠れ既定にしないため）

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。

## Risk

Risk: R3

Reason:
`scripts/doc-consistency-check.sh` / `scripts/pre-push.sh` / `scripts/local-ci.sh` への新規 ERROR 級チェック追加は Plan Gate というワークフロー gate 自体の挙動を変える。`docs/DEV_WORKFLOW.md` Risk Tiers は「merge gate changes」を R3 の対象として明示しており、既存 PK1-PK3 に隣接する PK4/PK1 拡張、および pre-push/local-ci への PK5・state-only 上限チェック追加は、既存 packet が新チェックにより新規に ERROR 化されるリスクを伴うため R3 が妥当。

## Goal

`docs/DEV_WORKFLOW.md` の prose-only 規律（Workflow State 整合 / Plan Commit ancestry / D-038 新語彙 / state-only commit 上限）を、既存 `scripts/doc-consistency-check.sh` PK1-PK3 と同じ line-regex/awk 機構の拡張、および `scripts/pre-push.sh` / `scripts/local-ci.sh` への git 系検査追加によって機械強制し、D-034 Appendix C と D-038 Status 行が「follow-up」としていた PK4/PK5/checker/drift-test/hook の採否と仕様を Plan Gate 前に確定する。

## Scope

1. **PK4**（`scripts/doc-consistency-check.sh` 新規関数 `check_plan_packet_workflow_state`、ERROR 級、既存 `check_plan_packet_sections` と同じ line-regex/awk 機構を再利用）
   - R2+ active packet に `## Workflow State` セクションが存在すること
   - `- Phase:` 値が 13 phase enum（kickoff, spec-check, design, plan-draft, plan-gate, plan-approved, implementing, local-verified, independent-review, human-confirm, ready-hosted-final, merge, archive）のいずれかであること
   - `- Risk:` の値が `## Risk` セクションの `Risk: Rn` と一致すること、`- Execution Mode:` が fable-window/dual-vendor-no-fable/codex-only のいずれかであること
   - R3+ packet で Findings Freeze 状態行（`- Findings Freeze:` で始まる行、`## Review Response` 内）が存在すること（R3+ 限定の根拠: Freeze の運用対象は Broad Audit = Contract Audit lane（R3/R4、DEV_WORKFLOW.md:310 ①）であり、template 上は全 packet に行が存在するが機械 ERROR は R3+ のみに掛ける）
   - active packet と `docs/Plans.md` 「次の行動」からのリンクが一致すること（リンク欠落・複数 active packet の同時存在は ERROR）
   - field 関係検査: `- Phase:` が plan-approved 以降（plan-approved/implementing/local-verified/independent-review/human-confirm/ready-hosted-final/merge）なのに `- Plan Commit:` が `pending` のままの packet は ERROR（PR #163 WER の「line presence でなく field relationships を検査せよ」に対応。Plan Commit が pending の間 PK5 が skip されるため、この関係検査が唯一の網）
2. **PK1 拡張**（`check_plan_packet_sections` の `base_sections`/`r3_sections` 配列拡張）: 必須セクションリストに R2+ で `## Owner Effort Budget`、R3+ で `## Contract Probe` を追加
3. **PK5**（`scripts/pre-push.sh` と `scripts/local-ci.sh` に同居する新規 git 検査関数、CI docs job は対象外。理由は Contract Probe P1 参照。前例拘束（archived test matrix L87「PK4/PK5 は同機構」）との整合: 同拘束の射程は packet 本文の解析部に適用し、`Plan Commit:` / `Amendments:` 行の抽出は PK1-PK3 と同じ line-regex で行う。ancestry 判定そのものは Appendix C L272 が当初から git 検査として定義したものであり、`git merge-base` は既存 scripts が依存する git plumbing の範囲内で「YAML パーサ等の新機構」には当たらない）
   - (a) packet の `Plan Commit:` SHA が現 HEAD の ancestor であること（`git merge-base --is-ancestor <SHA> HEAD`）
   - (b) reconcile モデル: original `Plan Commit` は不変。Plan Gate 後の修正は packet 内 `Amendments:` 行への追記型で記録し、各 amendment SHA も ancestry 検査対象にする（元 SHA の書き換えは fail）
   - (c) `Plan Commit:` 行の値を後から書き換える変更は fail（対象 packet ファイルの git 履歴を `git log -p -- <file>` で辿り、`- Plan Commit:` 行の初回確定値と現在値を比較する）
4. **state-only commit 上限**（PK5 と同じ git 検査ファイルに同居）: commit subject の正規表現 `^docs\(plans\): state-only遷移` に一致する commit を対象範囲（`$(git merge-base origin/main HEAD)..HEAD`）で計数し、3件超で ERROR、うち post-implementation 相当（state-only commit の subject 遷移列に local-verified / independent-review / human-confirm / ready-hosted-final / merge のいずれかの token を含むもの。DEV_WORKFLOW.md:115 と D-038 の遷移名ベース定義に一致させ、判定を安定させるため subject 正規形 `docs(plans): state-only遷移 <from>-><to>[->…]` を Scope 8 で正本化する。順序ベース判定（最初の非 state-only commit を基準にする案）は PR #165 実データで plan-first commit を基準点と誤認するため不採用）が2件超でも ERROR。`docs/plans/` 配下のみを変更していながら該当 prefix を持たない commit は WARN（ラベル逃れの補足網）
5. **drift test**（`scripts/tests/` に新規 bash test ファイルを追加）: `AGENTS.md` 以外の docs ファイルで canonical reading order（AGENTS → DEV_WORKFLOW → Plans → project-memory → task docs の順序列挙）を再掲している箇所を `rg` で検出する grep test。除外対象: `AGENTS.md` 自身、`docs/archive/**`（歴史記録）、`docs/decision-log.md`（追記型の決定記録であり過去決定の文面は書き換えない。既知の再掲 = `docs/decision-log.md:250` の D-034 本文はこの除外の実例として test 内に記録し、除外がないと即 fail することを負例で確認する）
6. **WARN→ERROR 段階**: 「R2+ 相当 diff で active plan が存在しない場合」の check は現状 WARN としても存在せず（Double Audit pass 2 で実証: 該当機構は repo に未実装、Appendix C L273 も「導入」を slice 2 の宿題として記載）、本 slice では導入自体を行わず全体を次 slice へ deferred する。導入時は WARN で開始し ERROR 昇格は運用実績の蓄積後に別 decision で判断
7. **hook（優先度最後、条件付き採用、droppable）**: plan-approved 前の実装ファイル Write/Edit を deny する PreToolUse hook。Contract Probe P2 でロジック自体（fail-open、`docs/plans/` 系ファイル免除、4 ケース）は成立確認済み。ただし `settings.json` 登録による実行時 interception の統合検証は本 Design Phase では未実施のため、「条件付き採用: 実装 phase で最小 scope（対象 glob を `src/**` `src-tauri/src/**` のみに絞る）で導入し、統合検証で問題が判明した場合は follow-up PR へ降格する」を採否とする。Codex は hook 機構を持たないため、これは Claude 側の補助的な二次防御であり、D-034 Alternatives が「大規模状態機械の一括導入は見送る」とした判断を継承する
8. **正本昇格**（docs の穴の是正）
   - PK5 の定義を `docs/archive/plans/2026-07-10-workflow-model-neutral-redesign.md` Appendix C からのみ引ける状態から、`docs/DEV_WORKFLOW.md` Workflow State ブロックへ正本として追加
   - 「gated amendment」（`docs/Plans.md` および PR #163 系 archive にのみ登場する語）の定義を `docs/DEV_WORKFLOW.md` へ追加: Plan Gate 通過後に発生する packet 修正で、original `Plan Commit` を書き換えず `Amendments:` 行への追記のみで記録するもの
   - D-034 / D-035 / D-038 が同一 slice 2 バケットを三重参照している状態を、本 packet の Scope 1-8 を単一の統合チェックリストとして `docs/decision-log.md` の新規 `D-039` に起票して解消する。あわせて D-034 / D-035 / D-038 の各既存エントリに `Superseded in part by: D-039` 形式の前方参照を追記し、古いエントリから読んだ読者が D-039 に到達できるようにする（既存の D-034:253 / D-035:262 の同形式パターンを踏襲）
   - state-only commit subject の正規形 `docs(plans): state-only遷移 <from>-><to>[->…]` を `docs/DEV_WORKFLOW.md` Workflow State ブロックに正本化する（Scope 4 の post-implementation 判定の前提）
   - fable-window における relay 既定値（現行 ≤2）の改定要否を D-039 の検討候補として記録する（本 packet の relay 0 は packet 個別 override であり既定変更ではない）
   - Contract Probe の検査対象ファイル群（`.github/workflows/ci.yml`、scratchpad hook script、`git log` の commit subject 群）を `docs/DEV_WORKFLOW.md` Plan Packet Rules の Contract Probe 説明箇所に明記する
   - 「checker」= `scripts/doc-consistency-check.sh`、「drift test」= `scripts/tests/` 配下の bash test という語彙対応を `docs/DEV_WORKFLOW.md` に明記する

## Non-scope

- Owner Effort Budget の数値自体（介入回数・実働時間・relay 往復）の機械検証。自己申告の narrative 値であり機械検証不能なため、D-038 も節の存在チェックのみを要求している
- Evidence Ownership（D-038 item 7、テスト件数等 volatile evidence の tracked docs 転記検出）の機械検査。`docs/decision-log.md:282` の slice 2 対象語彙の明示列挙に含まれていないため、本 slice では N/A と裁定する。将来 slice の候補として Scope 8 の統合チェックリストに記録のみ行う
- CI `docs` job（`.github/workflows/ci.yml` L315 付近）への PK5 追加。理由は Contract Probe P1（shallow clone のため）
- WARN→ERROR 段階の実際の昇格実施
- Codex 側で hook に相当する強制機構の実装

## Acceptance Criteria

- 新設 `check_plan_packet_workflow_state`（PK4）を本 packet 自身（正例）に対して実行し `bash scripts/doc-consistency-check.sh --target plan docs/plans/2026-07-12-mechanical-workflow-slice2.md` で ERROR 0 になること
- `docs/plans/test-matrices/2026-07-12-mechanical-workflow-slice2.md`（後続 Test Design Matrix、本 packet では未作成）に定義される negative / dependency-missing / mutation の各 fixture 行に対応する固定ファイルで、期待どおり ERROR または WARN が出ること
- PK5 の git ancestry 検査の automated test は、test 自身が一時ディレクトリに構築する synthetic git fixture repo（plan-first → 実装 → state-only の commit 列を再現）で正例/負例を判定すること。PR #165 の実 SHA 列（plan-first `e70ae30` → 実装 `dcd5f7c` は true、`e70ae30` → squash 後 `main` は false、Plan Gate ラリー中の packet 修正 commit `4d3f5d1`（plan-approved 前のため gated amendment には該当しない — Double Audit pass 2 P2 反映）は descendant で true）は Contract Probe の一次証跡であり、squash merge 後は dangling で CI・新規 clone から到達不能のため automated fixture には使わない（Plan Gate R1 反映）
- state-only commit 計数の automated test は synthetic git fixture repo で判定すること（3 件で pass / 4 件目で ERROR / post-implementation 3 件目で ERROR / prefix なし plans-only commit で WARN、の各系列を fixture repo 内に構築）。PR #165 実測（prefix 一致 3/3）と PR #163・#164（該当 0 件、label なし）は Contract Probe P3 の一次証跡として扱い、automated fixture には使わない（到達不能性は同上）
- `scripts/tests/` に追加する drift test が `scripts/tests/local-ci.test.sh` と同じ実行経路で `bash scripts/local-ci.sh full` の一部として pass すること
- hook の 4 ケース（plan-gate 中の実装ファイル deny / `docs/plans/` ファイル allow / implementing 中 allow / packet 不在時の fail-open allow）が最小 scope glob 適用後も pass すること

## Design Sources

List the source design docs this plan relies on. Plan Packets are not durable design source of truth.

- Requirements / spec: 該当なし（workflow gate 変更のため REQ/UI/BIZ 系 spec 対象外）
- Architecture: 該当なし
- Function / command / DTO: 該当なし
- DB: 該当なし
- Screen / UI: 該当なし
- Decision log / ADR: `docs/decision-log.md` D-034（:246-253）、D-035（:255-262）、D-038（:280-286）。`docs/archive/plans/2026-07-10-workflow-model-neutral-redesign.md` Appendix C（PK4/PK5/drift test/hook の定義出典）と同 test matrix。`docs/archive/plans/2026-07-11-workflow-model-neutral-redesign-effectiveness-review.md`（PK5 reconcile 問題の出典）。`docs/archive/plans/2026-07-12-ui11c-pr164-workflow-effectiveness-review.md` と `docs/archive/plans/2026-07-12-pr164-wer-workflow-hardening.md`（D-038 新語彙の出典）

## Required Design Artifacts

Use `docs/DEV_WORKFLOW.md` Design artifact selection to decide what must exist before implementation.

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | 対象外（Rust コードへの変更なし） | 対象外 |
| Command / DTO / generated binding / wire shape | 対象外 | 対象外 |
| DB / transaction / audit / rollback / migration | 対象外 | 対象外 |
| Screen / UI / route state / Japanese wording | 対象外 | 対象外 |
| CSV / TSV / report / import / export format | 対象外 | 対象外 |
| Durable decision / ADR | `docs/decision-log.md` 新規 `D-039`（Scope 8） | 本 PR で追加予定 |

## Design Intent Trace

Use spec/requirement IDs as the root. Use child decision IDs such as `UI-01a-D1`, `BIZ-08-D2`, or `SPEC-WF-...-D1` when a design choice needs rationale.

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-WF-PK4 | DEV_WORKFLOW.md Workflow State ブロック / D-034 | SPEC-WF-PK4-D1 | line-regex/awk 機構を再利用（新規 YAML パーサ導入は D-034 Alternatives で既に却下済み） | `scripts/doc-consistency-check.sh` `check_plan_packet_workflow_state` | drift test + fixture packet |
| SPEC-WF-PK1EXT | plan-packet.md テンプレート / D-038 | SPEC-WF-PK1EXT-D1 | Owner Effort Budget と Contract Probe の節存在チェックのみ（数値検証は Non-scope で明示済み） | `check_plan_packet_sections` の配列拡張 | fixture packet（節欠落ケース） |
| SPEC-WF-PK5 | Appendix C（archive 2026-07-10）/ D-035 | SPEC-WF-PK5-D1 | `local-ci.sh changed` 側配置案と比較し、pre-push + local-ci 双方への配置を採用（push 前後どちらの経路でも検査できるようにするため） | `scripts/pre-push.sh` / `scripts/local-ci.sh` 新規関数 | PR #165 SHA 列を使った fixture |
| SPEC-WF-STATECAP | D-038 item 8 | SPEC-WF-STATECAP-D1 | message-regex 分類を採用、path のみでの判定は Contract Probe P3 で PR #165 実データにより過大計上（7 vs 真値 3）を実証したため不採用 | SPEC-WF-PK5 と同じファイルの state-only 計数関数 | PR #165 / #163 / #164 の commit 列 fixture |
| SPEC-WF-DRIFT | AGENTS.md Session Start / D-034 Appendix C | SPEC-WF-DRIFT-D1 | 既存 `scripts/tests/` の bash test 形式を踏襲（新規テストフレームワーク導入は不採用） | `scripts/tests/` 新規 bash test | 同ファイル自体が test |
| SPEC-WF-HOOK | Appendix C（archive 2026-07-10）/ D-034 Alternatives | SPEC-WF-HOOK-D1 | 大規模状態機械での全作業停止は却下済み（D-034）。settings.json 統合検証が未了のため「条件付き採用」とし、scope を `src/**` `src-tauri/src/**` に限定 | scratchpad 由来 hook script の `.claude/hooks/` 移設 + `settings.json` 登録（最小 scope） | Contract Probe P2 の 4 ケース |
| SPEC-WF-PROMOTE | D-034/D-035/D-038 散在箇所 | SPEC-WF-PROMOTE-D1 | 三重参照の統合先を新規 decision-log entry に一本化（既存 decision の改変ではなく新設） | `docs/decision-log.md` D-039、`docs/DEV_WORKFLOW.md` PK5/gated amendment 定義追加 | `bash scripts/doc-consistency-check.sh`（Markdown リンク検証） |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 本 PR 完了後は Yes（Scope 8 の正本昇格により、PK5 定義と gated amendment 定義が `docs/DEV_WORKFLOW.md` に一本化されるため）。現時点（plan-gate、Plan Gate ラリー中）ではまだ archive 三箇所（Appendix C、PR #163 WER、PR #164 WER）に散在しており No
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: PK5 reconcile モデル（original 不変 + `Amendments:` 追記型）と state-only 計数の message-regex 採用を D-039 として昇格する
- Assumptions and constraints: CI `docs` job は shallow clone のため PK5 は pre-push/local-ci 限定（Contract Probe P1）。hook は settings.json 統合検証未了という制約を明記した上での条件付き採用
- Deferred design gaps, risk, and follow-up target: Evidence Ownership の機械検査（Non-scope 参照）、WARN→ERROR 段階の実昇格は次 slice 候補として D-039 に記録する
- Test Design Matrix can cite design decision IDs or source doc sections: 後続作成予定の `docs/plans/test-matrices/2026-07-12-mechanical-workflow-slice2.md` は本 packet の SPEC-WF-PK4/PK5/STATECAP/DRIFT/HOOK 各 ID を参照する前提で設計する

## Impact Review Lenses

Fill this when the task starts from field investigation, real-device confirmation, external tool behavior, POS/register integration, CSV/TSV/report format changes, operator workflow discoveries, or a finding that may change source design assumptions. Otherwise write `not applicable` and why.

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable。checker/hook は開発ワークフロー内部機構であり、POS/register 等の external adapter 境界には触れない | 該当なし |
| Fact check / design decision split | applicable。Contract Probe P1-P3 が観測事実（fetch-depth 分布、hook ロジック 4 ケース、message-regex の実 SHA 計数）を提供し、採否判断（PK5 配置、hook 条件付き採用、state-only 分類方式）は本 packet の設計判断として分離した | 本 packet Design Intent Trace |
| Lifecycle / retry | not applicable。import/export やリトライを伴う機能変更ではない | 該当なし |
| Operator workflow | not applicable。店舗運用者が触れる画面・操作を変更しない | 該当なし |
| Replacement path | not applicable。POS/レジ等の外部システム差し替えに関する変更ではない | 該当なし |
| Data safety / evidence | applicable。Contract Probe の証跡は repo 内の git SHA・commit subject という匿名化不要な開発メタデータのみで、実データを含まない | Data Safety 節 |
| Reporting / accounting semantics | not applicable。売上・在庫等の会計的意味論には触れない | 該当なし |
| Manual verification | applicable。hook の settings.json 統合 interception は自動テストで再現し切れず、実際の Claude Code runtime での 1 回の手動確認が必要 | Review Focus / Test Plan |

## Design Readiness

State whether the design is ready for implementation.

- Existing design docs are sufficient because: PK4/PK5/state-only 上限/drift test/hook の方向性自体は D-034・D-035・D-038 に既に accepted 済みであり、本 packet はその「follow-up slice 2」として明示的に予約されていた具体仕様（grep パターン、配置ファイル、エラー文言、reconcile モデル）を確定する Design Phase output である
- Source docs updated in this PR: `docs/decision-log.md`（新規 D-039）、`docs/DEV_WORKFLOW.md`（PK5 定義・gated amendment 定義・checker/drift test 語彙対応の正本化、Scope 8）
- Design gaps intentionally deferred: Evidence Ownership 機械検査、WARN→ERROR 段階昇格（Non-scope 参照のとおり次 slice 候補）
- Durable decisions discovered in this plan and promoted to source docs: PK5 の pre-push+local-ci 二重配置、state-only 計数の message-regex 採用、hook の条件付き採用スコープ（`src/**` `src-tauri/src/**` 限定）

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): 対象外（アプリ本体の層を持たない workflow ツールのため N/A）
- Backend function design: 対象外
- Command / DTO / data contract: 対象外
- Persistence / transaction / audit impact: 対象外（DB非接触、Data Safety 節参照）
- Operator workflow / Japanese UI wording: 対象外
- Error, empty, retry, and recovery behavior: checker/hook の fail-open・ERROR/WARN 区分・fail-closed 継承（`docs/DEV_WORKFLOW.md` 既存 Fail-closed rule）を Scope 1-7 で定義済み
- Testability and traceability IDs: SPEC-WF-PK4/PK5/STATECAP/DRIFT/HOOK/PROMOTE を Design Intent Trace / Contract Coverage Ledger / Trace Matrix で一貫させた

## Contract Probe

Required for R3/R4 plans that rely on an unverified external premise (external library behavior, OS/hardware behavior, etc.). Record the minimal experiment and its result as one line per premise. If not applicable, state N/A and the reason in one line instead of deleting the section.

- PK5 の git 前提（CI `docs` job が fetch-depth 完全か）: `.github/workflows/ci.yml` を確認 -> `fetch-depth: 0` は L45-47 の 1 job のみで `docs` job（L315 付近）を含む他ジョブは shallow clone。PR #165 実 SHA で ancestry 判定を実行 -> plan-first `e70ae30` は最初の実装 commit `dcd5f7c` の ancestor（true）、Plan Gate ラリー中の packet 修正 commit `4d3f5d1`（plan-approved 前のため gated amendment 定義には該当しない。descendant 検査の機構確認としての証跡）は plan-first の descendant（true）、一方 squash merge 後の `main`（squash commit `c0dd65f`）に対して `e70ae30` は ancestor ではない（`git merge-base --is-ancestor` false、squash のため）。結論: PK5 は pre-merge gate（pre-push / local-ci）として設計し、CI `docs` job には追加しない。証跡の再現手順: これらの SHA は squash merge 後 dangling であり通常 clone では到達不能のため、再検証は `git fetch origin '+refs/pull/165/head:refs/probe/pr165'` で pull ref を取得して行う（automated fixture には使わない — Acceptance Criteria 参照）
- hook 判定ロジック（PreToolUse deny が成立するか）: `check-plan-on-exit.sh` と同機構（bash+jq）の最小 hook を scratchpad に作成し 4 ケース（plan-gate 中の実装ファイル deny / `docs/plans/` ファイル allow / implementing 中 allow / packet 不在時 fail-open allow）を実行 -> 全 4 ケースで期待どおりの allow/deny。残存未検証点: `settings.json` 登録による Claude Code hook runtime への実統合（実際に PreToolUse イベントで発火するか）は本 Design Phase では未検証。この限定を disposition として明記し、Scope 7 の「条件付き採用」判断の入力とする
- state-only commit の分類方式（message-regex vs path ベース）: PR #165 で `^docs\(plans\): state-only遷移` を `git log` に適用 -> `37bf468` / `81f833c` / `179181b` の 3 件が正確に一致（3/3）。PR #163 / #164 には同 convention が存在せず該当 0 件（convention は D-038 以後の新規 PR にのみ適用可能で遡及不可）。比較として path ベース分類（`docs/plans/` 配下のみの変更を state-only とみなす）を PR #165 の同一範囲に適用したところ 7 件を state-only と過大計上した（plan-first commit・gated amendment・`Plans.md` 同期を弁別できないため）。結論: message-regex を採用し、path のみでの判定は不採用

## Contract Coverage Ledger

Required for R3/R4. Include every contract or design decision in the touched source-doc sections; a missing row is a Plan Gate blocker. Re-verify every row against real implementation at independent-review.

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| SPEC-WF-PK4（Workflow State 13 phase enum / Risk-Execution Mode 整合 / Findings Freeze 行 / active packet 一意性） | `scripts/doc-consistency-check.sh` `check_plan_packet_workflow_state` | drift fixture packet（enum 外 Phase 値、Findings Freeze 行欠落、複数 active packet の各ケース） | automated |
| SPEC-WF-PK1EXT（Owner Effort Budget / Contract Probe 節必須化） | `check_plan_packet_sections` 配列拡張 | 節欠落 fixture packet | automated |
| SPEC-WF-PK5（Plan Commit ancestry / original 不変 / `Amendments:` 追記型） | `scripts/pre-push.sh` / `scripts/local-ci.sh` 新規関数 | synthetic git fixture repo（tmpdir 構築）の ancestry fixture。probe 証跡 = PR #165 実 SHA 列（plan-first `e70ae30` / 実装 `dcd5f7c` / gate 中修正 `4d3f5d1` / squash 後 `main` 負例） | automated |
| SPEC-WF-STATECAP（state-only commit 上限 3、post-implementation 上限 2、message-regex 分類） | SPEC-WF-PK5 と同じファイルの計数関数 | synthetic git fixture repo（3件 pass / 4件目 ERROR / post-impl 3件目 ERROR / prefix なし WARN）。probe 証跡 = PR #165 3件 / PR #163・#164 0件 | automated |
| SPEC-WF-DRIFT（canonical reading order 再掲の grep 検出） | `scripts/tests/` 新規 bash test | 同ファイル自体（再掲文書を仕込んだ negative fixture 含む） | automated |
| SPEC-WF-HOOK（plan-approved 前 deny、fail-open、scope 限定） | scratchpad hook script の `.claude/hooks/` 移設 + `settings.json` 最小 scope 登録 | Contract Probe P2 の 4 ケース（ロジック部分は automated 再現可能） | manual（settings.json 統合 interception の実発火確認のみ。Contract Audit の manual verification boundary であり、L3 Eligibility（Windows native 観測、DEV_WORKFLOW.md:297）には該当しない） |
| SPEC-WF-PROMOTE（PK5/gated amendment 定義の正本化、D-039 起票） | `docs/decision-log.md` D-039、`docs/DEV_WORKFLOW.md` 該当節 | `bash scripts/doc-consistency-check.sh`（Markdown リンク検証、曖昧表現検出） | non-scope（docs 昇格の正しさは Plan Reviewer / Final Reviewer の読み合わせで確認、自動テスト対象ではない） |

## Test Plan

For R3/R4, include or link a Test Design Matrix: `docs/plans/test-matrices/2026-07-12-mechanical-workflow-slice2.md`（本 packet では未作成、実装開始前に別途コミットする）

- targeted tests: `bash scripts/doc-consistency-check.sh --target plan docs/plans/2026-07-12-mechanical-workflow-slice2.md`、`bash -n scripts/doc-consistency-check.sh scripts/pre-push.sh scripts/local-ci.sh`
- negative tests: Phase enum 外の値、Findings Freeze 行欠落、複数 active packet、`Plan Commit` 書き換え、ancestor でない SHA、state-only 上限超過（4件目）、post-implementation 上限超過（3件目）の各 fixture が ERROR になること
- compatibility checks: 既存 packet（本 packet 自身、および過去 archive 済み packet を `--target plan` の明示パス指定で実行した場合）で新規 ERROR が発生しないこと
- data safety checks: 新規スクリプトが repo 外パスや実データを読み書きしないこと（`git grep` で追加関数の書き込み先パスを確認）
- main wiring/integration checks: `bash scripts/local-ci.sh full` に drift test が組み込まれ CLEAN で完走すること、`scripts/pre-push.sh` の hook 経路で PK5/state-only 上限チェックが呼ばれること

## Boundary / Wire Contract

Required when the change touches JSON API, browser state, CSV, config, manifest, cache schema, Tauri command DTOs, generated bindings, report output, or DB-backed compatibility.

- producer: 該当なし（本 slice は docs/scripts のみを変更し、JSON API・DTO・CSV・cache schema のいずれも生成/消費しない）
- consumer: 該当なし
- wire type: 該当なし
- internal type: 該当なし
- precision/range: 該当なし
- round-trip path: 該当なし
- invalid input: 該当なし
- compatibility: 該当なし

## Review Focus

- (a) PK5 reconcile モデル（`Amendments:` 追記型）が PR #163 WER の要求「original 置換は fail」を満たしているか
- (b) state-only 判定の message convention 依存という残存リスク（label 逃れ）と、path ベース WARN 補足網の妥当性
- (c) hook の条件付き採用判断（ロジックは automated 検証済み、settings.json 統合のみ L3 に回した判断が妥当か）
- (d) 正本昇格（Scope 8）の記述先（`docs/decision-log.md` D-039 と `docs/DEV_WORKFLOW.md` 該当節）の妥当性、および三重参照（D-034/D-035/D-038）の解消が漏れていないか

## Spec Contract

Required for R3/R4.
Use at least one data row. Put concrete test names in the Test column when a regression test exists; use review/evidence labels only for plan-only checks.

Contract ID: SPEC-WF-SLICE2

- SPEC-WF-PK4: R2+ active packet は `## Workflow State` を持ち、Phase は 13 phase enum の値域内であること。逸脱は ERROR
- SPEC-WF-PK1EXT: R2+ は `## Owner Effort Budget`、R3+ は `## Contract Probe` の節が必須。欠落は ERROR
- SPEC-WF-PK5: `Plan Commit` の SHA は現 HEAD の ancestor であり、Plan Gate 後の修正は `Amendments:` 追記型でのみ記録される。original SHA の書き換えは ERROR
- SPEC-WF-STATECAP: `docs(plans): state-only遷移` prefix の commit は 1 PR あたり 3 件まで、うち post-implementation 相当（subject 遷移列に local-verified / independent-review / human-confirm / ready-hosted-final / merge のいずれかの token を含むもの、Scope 4 の遷移名 token 判定と同一）は 2 件まで。超過は ERROR、prefix なしの plans-only commit は WARN
- SPEC-WF-DRIFT: `AGENTS.md` 以外の docs で canonical reading order を再掲していないこと。検出は ERROR（drift-fix sweep の適用対象）
- SPEC-WF-HOOK: plan-approved 未満の Phase で実装ファイル（`src/**` `src-tauri/src/**`）への Write/Edit は hook で deny、`docs/plans/` 系ファイルは fail-open で allow

## Trace Matrix

Required for R3/R4.

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-WF-PK4 | Scope 1 | drift fixture packet（enum外/Findings Freeze欠落/複数active） | Contract Coverage Ledger 行1 | `bash scripts/doc-consistency-check.sh --target plan` の ERROR 出力 |
| SPEC-WF-PK1EXT | Scope 2 | 節欠落 fixture packet | Contract Coverage Ledger 行2 | 同上 |
| SPEC-WF-PK5 | Scope 3 | synthetic git fixture repo（probe 証跡: PR #165 SHA 列） | Review Focus (a) | `git merge-base --is-ancestor` exit code |
| SPEC-WF-STATECAP | Scope 4 | synthetic git fixture repo（probe 証跡: PR #165 3件 / #163・#164 0件） | Review Focus (b) | `git log` regex 一致件数 |
| SPEC-WF-DRIFT | Scope 5 | 再掲 negative fixture | 該当なし（機械テストのみ） | `scripts/tests/` 新規ファイルの pass/fail |
| SPEC-WF-HOOK | Scope 7 | Contract Probe P2 の 4 ケース | Review Focus (c) | scratchpad hook script 実行ログ + 手動確認 1 件（manual boundary、L3 非該当） |
| SPEC-WF-PROMOTE | Scope 8 | `bash scripts/doc-consistency-check.sh` リンク検証 | Review Focus (d) | Markdown リンク ERROR 0 |

## Data Safety

Required for R3/R4.

- 本 slice は `docs/` および `scripts/` のみを変更し、DB ファイル・POS CSV・PLU export・バックアップ・レシート画像などのユーザーデータには一切触れない
- local-only paths: 該当なし（新規スクリプトは repo 内の git メタデータと Markdown ファイルのみを読み書きする）
- synthetic-only paths: Test Plan の fixture packet は `docs/plans/test-matrices/` 配下の合成テストファイルとして作成し、実際の店舗データを含まない

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

- Scope 1-2（PK4 / PK1 拡張）: `check_plan_packet_workflow_state` 新設 + 必須節配列拡張、tmpdir fixture の専用 test 追加。self-dogfood（本 packet で ERROR 0）と full check の非退行を確認済み
- Scope 3-4（PK5 / STATECAP）: 共有実体 `scripts/check-workflow-git.sh` を新設し pre-push / local-ci 双方から無条件呼び出し（check-env-safety.sh と同じ既存慣習）。synthetic git fixture repo 方式の test で全系列検証。実 branch dogfood で PK5/STATECAP OK、plans-only 無 prefix commit への WARN も設計どおり発火
- Scope 5（drift test）: `scripts/tests/reading-order-drift.test.sh`。除外 = AGENTS.md 自身 / docs/archive/ / docs/decision-log.md / docs/plans/（4 つ目は実装時の追加裁定: packet 自身が説明文で読み順文字列を引用するため。根拠 = DEV_WORKFLOW「Plan Packets are not durable design source of truth」）
- Scope 6: WARN→ERROR 昇格は実施せず（計画どおり）
- Scope 7（hook）: **follow-up PR へ降格を確定**。判定ロジックは Contract Probe P2 で検証済みだが、sandbox が `.claude/hooks/` と `settings.json` への書込みを deny しており本 PR 内で統合登録を完遂できない。owner 手作業での導入は Owner Effort Budget（介入 3 接点）を超過するため、条件付き採用条項の降格条件に該当と裁定
- Scope 8（正本昇格）: DEV_WORKFLOW.md に PK5/gated amendment/state-only 正規形/語彙対応を正本化、D-039 起票、D-034/D-035/D-038 に前方参照追記。`Amendments` field 定義の追加は実装時の追加裁定（定義なしの参照増殖を避けるため）
- 実装時の追加配線: `scripts/ci/classify-changes.sh` の workflow 分類リストに新 script を追加（1 行）
- 発見された既存の潜在バグ（scope 外、follow-up 候補）: `check_signature_cross_reference` の rg pipeline に `|| true` がなく、`docs/function-design/*.md` に `^fn` 一致ゼロの合成環境で set -e により全体 abort し得る
- PR: private archive PR #166

## Review Response

Fill after review.
If R3 review-only sub-agent is skipped, record an explicit line beginning with `Review-only skipped because:` and the reason.
- Findings Freeze: frozen after Broad Audit（post-implementation の Double Audit pass 1 + pass 2 が initial Broad Audit を構成、両 pass 完了 2026-07-13 をもって発効。Plan Gate ラリー R1-R3 は plan 段階のレビューで Freeze の基準点ではない）; post-freeze exceptions: none.

Plan Gate ラリー記録（独立 Plan Reviewer、fresh context）:
- R1（2 lens 並列）: 契約 lens = P1×2（STATECAP post-impl 順序ベース判定の自壊 / drift test が decision-log.md:250 の既存再掲に即 fail）+ P2×2 + P3×4。workflow lens = P1×2（dangling SHA の automated fixture 使用 / 境界 fixture 4d3f5d1 の事実誤り）+ P2×3 + P3×3。全件 accept、反映 = 5ef1ce6
- R2: 新規 P1×1（Spec Contract に棄却済み順序ベース定義が残存）+ P2×1（Phase 現況の自己参照 3 箇所未波及）+ P3×1（同根）。機械検出クラスのため rally 継続でなく `rg` 全箇所 sweep で一括修正、反映 = 1ae2134
- R3: closure confirmation、R2 指摘 3 件すべて反映確認、新規指摘なし、**Pass（P1/P2=0 収束）**
- owner の Plan Gate 承認（Human Gate 接点 1、hook 条件付き採用の裁定を含む）: 承認済み（2026-07-13、実装続行の指示つき）

Double Audit 記録（R3 workflow gate change のため必須、独立 Contract Auditor 2 pass 並列、fresh context・Writer 非兼任）:
- pass 1（Contract Coverage Ledger 実装再検証 + anti-tautology/mutation）: P1×1（PK1 拡張が archive packet の明示パス実行で遡及 ERROR、対応 test が実条件を未再構成 = anti-tautology gap）、P2×1（template plan-packet.md に Amendments field 未伝播）、P3×3（enum 全値の positive 網羅欠落 / Amendments SHA 抽出の hex 誤検出脆弱性 / check_plan_commit_ancestry の field 抽出が section 非 scoped）。PK5/STATECAP/DRIFT/HOOK/PROMOTE の各 Ledger 行は line-by-line 照合で clean 宣言
- pass 2（negative space + adjacent pattern + drift sweep + docs 鮮度）: P1×1（PR 本文の陳腐化、STATECAP を「順序ベース」と実装と逆に記載）、P2×2（Contract Probe P1 の `4d3f5d1` を gated amendment と誤ラベル（plan-approved 前の gate 中修正が正） / 「no-active-plan WARN のまま維持」が事実誤認 — 該当機構は WARN としても未実装で、誤記が Scope 6・matrix・D-039 に伝播）。adjacent pattern / fail-open / test 削除 / CI 配線 / 3 正本間の定義整合は clean 宣言
- 裁定: P1/P2 全 accept、本 commit で一括修正（archive 免除 + test 実条件化 / template 追記 / 4d3f5d1 ラベル訂正 / no-active-plan 記述の全箇所訂正（D-039 は本 PR 生まれ・未 merge のため修正は過去決定の書き換えに非該当） / PR 本文更新）。P3 は enum 網羅のみ同 commit で修正、残り 2 件 + 既存 check_signature_cross_reference の pipefail 潜在バグ（W1 発見、scope 外）は follow-up 候補として本行に記録
