# Plan Packet: Codex 計画癖対策の workflow docs PR

## Workflow State

- Phase: human-confirm
- Risk: R3
- Execution Mode: fable-window（未確認 — 本 Packet は drafting subagent が起票したもので live vendor slot 可用性を独立確認できない。Plan Gate 時に Coordinator が実確認して確定する。これは本 Packet 自身が導入する「数値・状態主張は実測か明示未確認タグの二択」規律のドッグフーディングでもある）
- Plan Commit: c437897744ac445c1aa2069cbbd90a025b7b6256
- Amendments: none
- Coordinator: Claude (Fable 5 相当、main session。実際の起票は Sonnet 5 drafting subagent、Coordinator 裁定は発注元)
- Writer: Claude subagent (Sonnet 5)
- Plan Reviewer: independent Claude subagent (Sonnet 5, fresh context)
- Final Reviewer: independent Claude subagent (Sonnet 5, fresh context) — 本 change は「workflow gate change」に該当するため、DEV_WORKFLOW.md `Review Rules` の Double Audit 規定（R4 or workflow gate change は Contract Audit を独立 2 context で実施）が Owner 発注書の「Reviewer 独立」という短い表現より優先し、Final Reviewer は独立 2 pass 必須とする
- Reviewed Content HEAD: 1ef84984d6ced6565fbf83af1e5f2e729230bee7
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required（`scripts/doc-consistency-check.sh` という非 docs-only path を含むため通常の PR event で hosted CI が走り、明示 workflow_dispatch は不要という前提。ci.md のクラス分類は実装時に再確認する）
- Human Gate: Ready 承認 + merge 承認（pending）

Narrative（append-only）:

- 2026-07-31 kickoff -> spec-check -> plan-draft: 契約の正本は `docs/Plans.md`「次の行動」項目 0 の「並行可能な独立 track」段落（順12/14 実測で確定した 3 対策 (a)(b)(c) + 任意 PK）。Coordinator 裁定により、本 PR は全編 Claude 側実装（単一 PR、design+impl、D-055 型）とし、(c) の条文と PK heuristic は「縛られる側（Codex）に書かせない」原則で Claude が書く。spec-check は「既存設計書（AGENTS.md / DEV_WORKFLOW.md / plan-packet.md template / test-design skill / doc-consistency-check.sh 自身）が変更対象そのもの」であり、本 Packet 内で改訂内容を確定するため design → plan-draft ではなく spec-check → plan-draft 経路を取る。
- 2026-07-31 read-only 実測（本 Packet 起票時点）: 挿入位置を実ファイルで確認した — `AGENTS.md` Working Rules は 29-42 行（11 bullet）、`docs/templates/plan-packet.md` Impact Review Lenses table は 139-148 行（既存 8 行）、`docs/DEV_WORKFLOW.md` Review Rules は 331-345 行（R3 review-only default は 338 行）、`scripts/doc-consistency-check.sh` の PK3 実装（`check_plan_packet_heuristic_warnings`, 1163-1221 行）を heuristic 実装パターンの precedent として確認した。歴史的 red/green 対象は `git log --all -S` で実在確認済み（下記 Contract Probe）。
- 2026-07-31 既知の未解消ブロッカー（実測）: `bash scripts/doc-consistency-check.sh --target plan` を本 Packet に対して実行すると `PK4: docs/Plans.md の '## 次の行動' に active packet '2026-07-31-codex-plan-habit-guards.md' へのリンクが見つかりません` で ERROR 1 件（PK1/PK2/PK3 は OK）。本 drafting task は `docs/Plans.md` の編集を scope に含めないため意図的に未修正のまま残す。Plan Gate へ進める前に、Coordinator が `docs/Plans.md`「次の行動」項目 0 の本 track 段落へこの Packet へのリンクを追加し、再実行で ERROR 0 を確認すること。

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 15分
- relay 往復上限: 0

既定値（3/30分/2）からの縮小は Coordinator 明示裁定による。理由: Writer が Claude subagent 単独（Codex owner-relay を使わないため relay 往復が構造的に発生しない）、かつ (a)(b)(c) の対策内容自体は既に Coordinator 裁定で凍結済みで、owner 判断が必要な残りの決定点は Ready 承認と merge 承認のみに限定される。
既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

§5.5 を使わない change のため両方 `none` のままにする。

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
DEV_WORKFLOW.md `Risk Tiers` の「merge gate 変更」に該当する workflow gate change。(a)(b)(c) は Plan Packet / Test Design Matrix の書き方と Plan Reviewer 独立性という merge gate の実効契約そのものを変更し、任意 PK は `scripts/doc-consistency-check.sh`（既存 PK1-5 の gate 実装）に新規 heuristic（PK6）を追加する。業務データ・DB schema・Tauri command DTO には触れないため R4 には該当しない。

Rollback は本 PR の実装 commit revert。PK6 は WARN-only（exit code に影響しない）ため、revert してもそれ以外の gate（L1 full / hosted final / PK1-5）は無傷で継続する。

## Goal

Goal Invariant: 順12/14 の実測で確定した 3 対策 (a) 数値主張の実測 or 未実測タグ二択規則、(b) Impact Review Lenses への環境・再現性 lens、(c) Codex 起草 packet の Plan Reviewer 別 vendor 必須の 1 行明文化、および任意 (PK) doc-consistency-check.sh への数値×実測 token heuristic WARN を、tracked doc / skill / checker へ正本化する。既存 PK1-5・Execution Mode enum・Writer ≠ Plan Reviewer 契約・Findings Freeze・Double Audit のいずれも変更しない。

### 最小完了条件

- `AGENTS.md` Working Rules と `.agents/skills/test-design/SKILL.md` Rules の両方に、数値主張は実測コマンド+出力併記か `未実測` タグの二択である旨の規則が同趣旨で存在する
- `docs/templates/plan-packet.md` の Impact Review Lenses table に「環境・再現性」行が追加され、既存行と同じ 3 列構造を保つ
- `docs/DEV_WORKFLOW.md` Review Rules に、Writer が Codex の packet では Plan Reviewer が別 vendor 必須である旨、かつ `codex-only` Execution Mode でもこの独立性が免除されない旨が明記される
- `docs/decision-log.md` に D-062 として上記 3 対策の durable decision が新設される
- （任意）`scripts/doc-consistency-check.sh` に PK6 heuristic が追加され、`scripts/tests/doc-consistency-plan-packet.test.sh` に red（D-059 round1 相当の未実測文言で WARN 発火）/ green（D-059 round2 相当の実測併記文言で WARN 非発火）の fixture が追加される
- `bash scripts/doc-consistency-check.sh` が exit code 0（PASS、WARN のみ許容）を維持する

### 失敗定義

- PK1-5 の既存挙動（ERROR/WARN の区別、exit code 契約）を変更する
- 新設 PK6 が ERROR 相当になり既存 gate の exit code 契約を壊す
- (c) の新規則が既存 `Writer ≠ Plan Reviewer`（AGENT_OPERATING_MANUAL.md）と矛盾する記述になる、または `codex-only` Execution Mode 下で免除されると誤読される文言になる
- Execution Mode enum（fable-window / dual-vendor-no-fable / codex-only）を変更する
- 退役済みの Self-Review 7 観点（D-059）を復活させる

### 非目的

- 監査是正 順12/14 の実装（別 track、並行可能なだけで本 PR の scope 外）
- PK1-4 の再設計・書き換え
- 相談窓口役（D-058）の profile 変更
- `scripts/doc-consistency-check.sh` 以外のチェッカー・CI job 構成の変更

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

- `AGENTS.md` Working Rules 節（現行 29-42 行）へ 1 bullet 追加: 「Plan Packet 内で数値（期間・回数・割合等）を主張するときは、実測コマンドとその出力を併記するか、`未実測` と明示タグ付けする二択のみを使う（D-062、D-059 の内部 deadline 仮置きの教訓）。」
- `.agents/skills/test-design/SKILL.md` の `## Rules` 節（現行 47-54 行）へ同趣旨の 1 bullet 追加: Test Design Matrix の数値クレーム（duration / count / percentage / threshold）は測定コマンドと出力を併記するか、明示的に `未実測` とタグ付けする（D-062、AGENTS.md の数値主張規則と同一趣旨）。
- `docs/templates/plan-packet.md` の `## Impact Review Lenses` table（現行 139-148 行、8 行）へ「環境・再現性」行を追加: 新設の環境依存（toolchain / CI runner / OS 差異等）は repo-pinned config で強制するか、明示的に defer するかを記録する。Node 24 `.node-version` single-owner pin の教訓（`docs/archive/plans/2026-07-30-node24-toolchain-alignment.md`）を注記として引用する。
- `docs/DEV_WORKFLOW.md` の `## Review Rules` 節へ、R3 review-only sub-agent default の記述（現行 338 行）の直後に新規 bullet を追加: 「Writer が Codex（発注書駆動の実装者）である packet の Plan Reviewer は、Writer と同一 vendor であってはならない。同一 vendor の fresh context はこの独立性を満たさない（D-062）。この vendor 単位の制約は `Execution Mode` が `codex-only`（AGENT_OPERATING_MANUAL.md §3.2）であっても免除されない。non-Codex の Plan Reviewer が実在しない場合は、免除するのではなく AGENT_OPERATING_MANUAL.md §3.3 Capacity-degraded に従って Plan Reviewer を pending 化し、Phase を前進させない。」既存の `Writer ≠ Plan Reviewer`（AGENT_OPERATING_MANUAL.md、role 独立性の記述箇所）を vendor 粒度へ拡張する形で明記し、矛盾する記述にしない（Plan Review round 1 P1 是正、AGENT_OPERATING_MANUAL.md:58 の `codex-only` 期間定義を言い換えて重複させない）。
- `docs/decision-log.md` へ D-062 を新設: 上記 3 対策 (a)(b)(c) の durable decision（Decision / Status / Why / Impact / Alternatives considered / Rollback / Revisit の既存フォーマット）。Why には順12/14 実測と D-059 の内部 deadline 仮置き事例を実証根拠として引用する。
- （任意、PK heuristic）`scripts/doc-consistency-check.sh` の `check_plan_packet_heuristic_warnings`（PK3、1163-1221 行）に隣接する新規関数として PK6 を追加する:
  - 対象セクション: `Contract Probe` と `Review Response`（後者は `### 見出し` を含むため `extract_markdown_h2_section` を使う。前者は現行 `extract_markdown_section` で足りるが一貫性のため同ヘルパーに統一してもよい）
  - 数値+単位トークン検出パターン: `[0-9]+(\.[0-9]+)?[[:space:]]*(秒|分|回|件|%)`
  - 各該当行について、同一行にバッククォート区切りのトークン（`` `[^`]+` ``、既存 PK3 の `has_acceptance_observable_token` と同じ「任意の backtick span で足りる」寛容な基準を踏襲）または `未実測` の literal が無ければ WARN
  - WARN メッセージ: `PK6: $file (R${level}) の Contract Probe/Review Response に実測 evidence のない数値主張があります -> $line`
  - `check_plan_packet_heuristic_warnings` の呼び出し箇所（1905/1959 行）に相乗りさせるか、独立関数として同じ呼び出しリストに追加する。exit code には影響しない（既存 `WARNINGS` カウンタのみ加算）
  - `scripts/tests/doc-consistency-plan-packet.test.sh`（既存の PK3/PK4 synthetic fixture test file、1-5 行のコメントに用途明記済み）へ新規 fixture group を追加する。新規ファイルではないため `local-ci.sh` / hosted CI static test への新規登録は不要（既存呼び出しに相乗り）。

## Non-scope

- 監査是正 順14 実装 PR2（domain family (2)〜(14)）
- PK1〜PK4 の contract 変更・書き換え
- `Execution Mode` enum（fable-window / dual-vendor-no-fable / codex-only）の追加・変更
- 退役済み Self-Review 7 観点の復活
- 相談窓口役（D-058、AGENT_OPERATING_MANUAL.md §5.5）の profile 変更
- Writer/Plan Reviewer の vendor 不一致を machine gate で検知する新規 PK（Workflow State の Writer/Plan Reviewer field は自由記述文字列であり、本 PR は文書契約のみを追加する。機械検知は将来の別 change）
- `docs/decision-log.md` の既存 D-034〜D-061 エントリの書き換え

## Acceptance Criteria

- `rg -c "実測コマンドとその出力を併記" AGENTS.md` → `1`（baseline 0 実測）
- `rg -c "未実測" .agents/skills/test-design/SKILL.md` → `1`+ （baseline 0 実測）
- `rg -n "^\| 環境・再現性 " docs/templates/plan-packet.md` → 1 行ヒット、かつ同行の `|` 区切り数が既存 Impact Review Lenses 行（例: `| Replacement path |  |  |`）と同数（3 列 = `|` 4 個）
- `rg -c "must be a different vendor than Codex" docs/DEV_WORKFLOW.md` → `1`（baseline 0 実測）
- `rg -c "Capacity-degraded" docs/DEV_WORKFLOW.md` → `1`+（baseline 0 実測。round 1 P1 是正で追加した non-Codex Plan Reviewer 不在時の pending fallback 参照）
- `rg -c "^## D-062" docs/decision-log.md` → `1`（baseline 0 実測。次番号であることを `rg -n "^## D-0[0-9]+" docs/decision-log.md \| tail -1` の実測 `D-061`（473 行）で確認済み）
- （任意 PK）`bash scripts/tests/doc-consistency-plan-packet.test.sh` が新規 fixture group を含めて exit code 0
- `bash scripts/doc-consistency-check.sh` が exit code 0（既存 PASS 維持、PK6 導入時は WARN 増加を許容するが ERROR は 0 のまま）

## Design Sources

Plan Packets are not durable design source of truth.

- Requirements / spec: 該当なし（業務 REQ 非接続の workflow gate change）
- Architecture: 該当なし
- Function / command / DTO: 該当なし
- DB: 該当なし
- Screen / UI: 該当なし
- Decision log / ADR: `docs/decision-log.md` D-034（Plan Packet 契約） / D-035（state/evidence 分離） / D-038（Findings Freeze / Owner Effort Budget） / D-050（数値の Evidence Ownership 拡張） / D-055（Wave Operation） / D-056（Opus role） / D-058（相談窓口役） / D-059（hook zero-inventory、内部 deadline 仮置きの実測事例）。本 PR で D-062 を新設する

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | 該当なし | 該当なし |
| Command / DTO / generated binding / wire shape | 該当なし | 該当なし |
| DB / transaction / audit / rollback / migration | 該当なし | 該当なし |
| Screen / UI / route state / Japanese wording | 該当なし | 該当なし |
| CSV / TSV / report / import / export format | 該当なし | 該当なし |
| Durable decision / ADR | `docs/decision-log.md` | updated in this PR（D-062 新設） |

## Registration / Generation Obligations

該当なし — 新規 Tauri command、function-design doc、route、operator 画面のいずれも追加しない。PK6 の新規 test は既存 `scripts/tests/doc-consistency-plan-packet.test.sh`（`scripts/local-ci.sh:211` にのみ登録済み — hosted CI の docs job は `doc-consistency-check.sh` を直接呼ぶのみで本 test file は呼ばない。実測: `.github/workflows/ci.yml` に参照 0 hit、既存 gap で本 PR の退行ではない。Final Review P2 で是正）へのテストケース追加であり、新規ファイル登録は不要。§5.5 consultation relay は使わない。

| 新規追加物 | 登録・生成義務 |
|---|---|
| （該当なし） | — |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-WF-CPHG | AGENTS.md Working Rules / test-design SKILL.md Rules | D-062-D1 | 数値主張の実測 or 未実測タグ二択。棄却: AGENTS.md のみへの追加（Test Design Matrix 側の数値行が主要発生源のため test-design skill 側も必須）/ 強制 ERROR 化（既存 PK1-5 と同格の WARN 運用に留め、過剰な gate 化を避ける） | AGENTS.md / test-design/SKILL.md | Matrix C1, PK6 fixture |
| SPEC-WF-CPHG | plan-packet.md Impact Review Lenses | D-062-D2 | 環境・再現性 lens の追加。棄却: 新設セクションとして独立させる案（既存 Impact Review Lenses と趣旨が重複するため 1 行追加に留める） | docs/templates/plan-packet.md | Matrix C2 |
| SPEC-WF-CPHG | DEV_WORKFLOW.md Review Rules | D-062-D3 | Codex 起草 packet の Plan Reviewer 別 vendor 必須。棄却: AGENT_OPERATING_MANUAL.md 側のみへの追記（Review Rules が Plan Reviewer 独立性の実務規定を持つため DEV_WORKFLOW 側に置く。Plans.md 契約の正本指定どおり）/ `codex-only` を規則の適用除外にする案（self-closure gap を再発させるため却下）/ `codex-only` の既存定義（AGENT_OPERATING_MANUAL.md:58、期間定義）を条文内で言い換えて免除根拠にする案（round 1 P1 是正で却下、定義の複製は正本を分散させる）。non-Codex Plan Reviewer 不在時は免除ではなく AGENT_OPERATING_MANUAL.md §3.3 Capacity-degraded の pending 化フローに委ねる | docs/DEV_WORKFLOW.md | Matrix C3 |
| SPEC-WF-CPHG | scripts/doc-consistency-check.sh PK3 (heuristic warnings) | D-062-D4（任意） | 数値×実測 token の PK6 heuristic。棄却: ERROR 化（過剰な gate 化、既存 PK3 と非対称になる）/ 独立スクリプト新設（既存 checker との二重実装を避ける） | scripts/doc-consistency-check.sh | Matrix C4 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 部分的に可能。`docs/Plans.md`「次の行動」項目 0 の対象段落が契約の正本であり、本 Packet はその実測根拠（D-059 archive）を合わせて読むことで再構成できる。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: 本 PR 自体が D-062 として decision-log へ昇格させる（3 対策 (a)(b)(c) + 任意 PK）。
- Assumptions and constraints: Execution Mode の実際の値は本 Packet 起票時点で未確認（drafting subagent は live vendor 可用性を検証できない）。Plan Gate 時に Coordinator が確定する。
- Deferred design gaps, risk, and follow-up target: Writer/Plan Reviewer の vendor 不一致を機械検知する PK は本 PR の Non-scope とし、将来の別 change へ defer する。
- Test Design Matrix can cite design decision IDs or source doc sections: できる。[test-matrices/2026-07-31-codex-plan-habit-guards.md](test-matrices/2026-07-31-codex-plan-habit-guards.md) が SPEC-WF-CPHG / D-062-D1〜D4 を参照する。
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: PK6 は WARN-only（exit code 非影響）であり「絶対に見逃さない」保証は主張しない。既存 PK1-5・Execution Mode enum・Findings Freeze・Double Audit との非互換は生じない（Matrix C4/C5 で確認）。

## Impact Review Lenses

not applicable — 本 PR は workflow docs / チェッカーの内部規律変更であり、現地調査・実機確認・外部ツール挙動・POS/レジ連携・CSV/TSV/レポート様式変更・operator workflow の発見のいずれにも該当しない。

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable | — |
| Fact check / design decision split | not applicable | — |
| Lifecycle / retry | not applicable | — |
| Operator workflow | not applicable | — |
| Replacement path | not applicable | — |
| Data safety / evidence | not applicable | — |
| Reporting / accounting semantics | not applicable | — |
| Manual verification | not applicable | — |

## Design Readiness

- Existing design docs are sufficient because: 変更対象そのものが AGENTS.md / DEV_WORKFLOW.md / plan-packet.md template / test-design SKILL.md / doc-consistency-check.sh であり、本 Packet が改訂内容を確定する。上位の workflow gate 契約（Plan Packet Rules、Review Rules、Workflow State、Owner Effort Budget、Subagent Budget）は既存 DEV_WORKFLOW.md / AGENT_OPERATING_MANUAL.md が正本のまま変わらない。
- Source docs updated in this PR: AGENTS.md、`.agents/skills/test-design/SKILL.md`、`docs/templates/plan-packet.md`、`docs/DEV_WORKFLOW.md`、`docs/decision-log.md`（D-062 新設）、（任意）`scripts/doc-consistency-check.sh` + `scripts/tests/doc-consistency-plan-packet.test.sh`。
- Design gaps intentionally deferred: Writer/Plan Reviewer vendor 不一致の機械検知（PK 新設）は defer。
- Durable decisions discovered in this plan and promoted to source docs: D-062（本 PR で新設）。

Minimum design checks for business-app work（本 PR は業務層に触れないため大半が該当なし）:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): 該当なし
- Backend function design: 該当なし
- Command / DTO / data contract: 該当なし
- Persistence / transaction / audit impact: 該当なし
- Operator workflow / Japanese UI wording: 該当なし
- Error, empty, retry, and recovery behavior: PK6 の「セクション欠落時は WARN を出さずスキップする」という fail-open ではなく fail-quiet な既定挙動を Matrix の Negative Paths で検証する
- Testability and traceability IDs: SPEC-WF-CPHG / D-062-D1〜D4 をテストの引用 ID とする

## Contract Probe

- PK6 heuristic が D-059 の歴史的 red/green を実際に弁別できるか: 実験 -> `docs/archive/plans/2026-07-31-claude-hook-contract-audit.md` の実 commit 履歴を `git log --all -S` で特定し、round 1（未実測の是正、commit `4c4284f`）の Review Response 文言「outer 30秒より短い内部20秒 + kill-after 2秒deadlineを契約・AC・Matrixへ追加した」（backtick なし、`未実測` タグなし）と、round 2（実測後の是正、commit `863c25b`）の Contract Probe 文言「checker runtime（同一WSL2 warm state）: `scripts/doc-consistency-check.sh` fullは33.53 / 33.70 / 33.64秒、`--target plan`は20.73 / 20.01秒。...」（backtick でコマンド名を併記）を、それぞれ独立ファイルへ書き出し、提案パターン `[0-9]+(\.[0-9]+)?[[:space:]]*(秒|分|回|件|%)`（数値+単位トークン検出）と `` `[^`]+` ``（backtick span 検出）/ `未実測`（明示タグ検出）を `rg` で実行 -> round1 文言は数値+単位トークン 3 件（30秒/20秒/2秒）を含みながら同一行に backtick span も `未実測` タグも無い（PK6 適用時 WARN 発火が期待される red）。round2 文言は数値+単位トークン 5 件（33.64秒/20.01秒/22秒/30秒/10秒）を含みながら同一行に backtick span（`` `scripts/doc-consistency-check.sh` `` / `` `--target plan` ``）がある（PK6 適用時 WARN 非発火が期待される green）。両者とも実行済み・出力を確認済み（本 Packet 起票時点の read-only 実測、実装は未着手）。
- mutation 感度: green fixture から backtick span のみを除去（数値+単位トークンは維持）した変種を作り同じ検出パターンを再実行 -> backtick span 検出が 0 件になり、PK6 適用時に WARN 発火へ転じることを確認済み（実測コマンド参照を除去すると red 化する mutation 感度がパターンレベルで成立）。
- 実際の bash 実装（`extract_markdown_h2_section` 経由での section 抽出 + 行単位ループ）は Contract Probe 時点では未着手のため、上記はパターンレベルの実証であり、実装後に Test Design Matrix の X1（red fixture）/ X2（green fixture）/ X3（mutation）で同一実証をスクリプト経由で再現する。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| D-062-D1 数値主張二択規則 | AGENTS.md / test-design/SKILL.md | drift anchor（AC 1,2）+ PK6 fixture（任意実装時） | L3 なし |
| D-062-D2 環境・再現性 lens | docs/templates/plan-packet.md | drift anchor（AC 3） | L3 なし |
| D-062-D3 Plan Reviewer 別 vendor 必須 | docs/DEV_WORKFLOW.md | drift anchor（AC 4）+ 独立レビューでの AGENT_OPERATING_MANUAL.md 整合確認 | L3 なし（review-only） |
| D-062-D4（任意）PK6 heuristic | scripts/doc-consistency-check.sh | scripts/tests/doc-consistency-plan-packet.test.sh 新規 fixture（red/green/mutation） | L3 なし |
| D-062 decision-log 新設 | docs/decision-log.md | drift anchor（AC 5） | L3 なし |

## Test Plan

Test Design Matrix: [2026-07-31-codex-plan-habit-guards.md](test-matrices/2026-07-31-codex-plan-habit-guards.md)

- targeted tests: `bash scripts/doc-consistency-check.sh`、（任意実装時）`bash scripts/tests/doc-consistency-plan-packet.test.sh`
- negative tests: Contract Probe / Review Response セクション自体が無い packet（PK6 は skip、WARN を出さない）、数値+単位トークンが無い packet（該当なし扱い）
- compatibility checks: 既存 PK1〜PK4 の挙動不変、既存 archived packet 群（`docs/archive/plans/**`）に対する `--target plan` 実行が本 PR 前後で同一結果になること
- data safety checks: 実データ非接触。テスト fixture は既存 test file の tmpdir 生成パターンを踏襲し、tracked fixture file を増やさない
- main wiring/integration checks: PK6 は既存 `check_plan_packet_heuristic_warnings` の呼び出し経路（1905/1959 行）に相乗りし、新規 registration 不要であることを `bash scripts/doc-consistency-check.sh --target plan` の実行ログで確認

## Boundary / Wire Contract

not applicable — JSON API、browser state、CSV、config、manifest、cache schema、Tauri command DTO、generated bindings、report output、DB-backed compatibility のいずれにも触れない。

## Review Focus

- (c) の新規則が既存 `Writer ≠ Plan Reviewer`（AGENT_OPERATING_MANUAL.md）と矛盾しないか、`codex-only` Execution Mode 下での適用除外と誤読されない文言か。non-Codex Plan Reviewer が実在しない場合に AGENT_OPERATING_MANUAL.md §3.3 Capacity-degraded の pending fallback へ正しく委譲しているか（免除ではなく前進禁止であることが明記されているか）
- PK6（任意実装時）が既存 PK1-5 の exit code 契約（ERROR は PK1/PK2/PK4 のみ、PK3/PK6 は WARN のみ）を壊していないか
- D-062 が既存 D-034/D-035/D-038/D-050/D-055/D-056/D-058/D-059 と矛盾する記述になっていないか
- (a) の規則が AGENTS.md と test-design skill の両方で同趣旨になっているか（一方だけの追加で終わっていないか）

## Spec Contract

Contract ID: SPEC-WF-CPHG

- D-062-D1: Plan Packet / Test Design Matrix 内の数値主張（期間・回数・割合等）は、実測コマンドとその出力を併記するか、`未実測` と明示タグ付けする二択のみを使う。AGENTS.md と test-design/SKILL.md の両方に同趣旨で存在する。
- D-062-D2: `docs/templates/plan-packet.md` の Impact Review Lenses table は「環境・再現性」lens を持ち、新設の環境依存は repo-pinned config 強制 or 明示 defer のいずれかを記録する。
- D-062-D3: Writer が Codex である packet の Plan Reviewer は、Writer と別 vendor でなければならない。この制約は `Execution Mode` が `codex-only` であっても免除されない。non-Codex Plan Reviewer が実在しない場合は、免除するのではなく AGENT_OPERATING_MANUAL.md §3.3 Capacity-degraded に従って pending 化し前進しない。
- D-062-D4（任意）: `scripts/doc-consistency-check.sh` の PK6 heuristic は、Plan Packet の Contract Probe / Review Response 内の数値+単位トークンのうち、同一行に backtick span も `未実測` タグも無いものを WARN する。exit code には影響しない。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-WF-CPHG/D1 | AGENTS.md + test-design SKILL.md 改訂 | `rg -c "実測コマンドとその出力を併記" AGENTS.md` / `rg -c "未実測" .agents/skills/test-design/SKILL.md` | 両方に同趣旨で存在するか | AC 1,2 |
| SPEC-WF-CPHG/D2 | plan-packet.md Impact Review Lenses 改訂 | `rg -n "^\| 環境・再現性 " docs/templates/plan-packet.md` | table 構造が既存行と整合するか | AC 3 |
| SPEC-WF-CPHG/D3 | DEV_WORKFLOW.md Review Rules 改訂 | `rg -c "must be a different vendor than Codex" docs/DEV_WORKFLOW.md` + `rg -c "Capacity-degraded" docs/DEV_WORKFLOW.md` + 独立レビュー | 既存 Writer≠Plan Reviewer との整合、codex-only 免除の誤読なし、non-Codex Plan Reviewer 不在時の pending fallback（§3.3）明記 | AC 4, AC 4b, review |
| SPEC-WF-CPHG/D4（任意） | doc-consistency-check.sh PK6 追加 | `scripts/tests/doc-consistency-plan-packet.test.sh` 新規 fixture | red/green/mutation 感度、exit code 非影響 | Matrix C4 |
| D-062 decision-log | decision-log.md 新設 | `rg -c "^## D-062" docs/decision-log.md` | 既存決定との非矛盾 | AC 5 |

## Data Safety

- 実データ・秘密情報・生成物のいずれも本 PR では触れない。
- local-only: なし
- synthetic-only: PK6 実装時の test fixture のみ（既存 `scripts/tests/doc-consistency-plan-packet.test.sh` の tmpdir 生成パターンを踏襲し、tracked fixture file を増やさない）

## Implementation Results

- `AGENTS.md`（Working Rules に (a) 数値主張二択規則 1 bullet 追加）: `rg -c "実測コマンドとその出力を併記" AGENTS.md` → `1`。
- `.agents/skills/test-design/SKILL.md`（Rules 節に同趣旨 1 bullet 追加）: `rg -c "未実測" .agents/skills/test-design/SKILL.md` → `1`。
- `docs/templates/plan-packet.md`（Impact Review Lenses table へ「環境・再現性」行 + Node 24 precedent 引用の注記 1 文を追加）: `rg -n "^\| 環境・再現性 " docs/templates/plan-packet.md` → 149 行ヒット、列数（`|` 4 個）は既存行と同数。
- `docs/DEV_WORKFLOW.md`（Review Rules へ (c) 条文 1 bullet 追加、R3 review-only default 行の直後）: `rg -c "must be a different vendor than Codex" docs/DEV_WORKFLOW.md` → `1`、`rg -c "Capacity-degraded" docs/DEV_WORKFLOW.md` → `1`。
- `docs/decision-log.md`（D-062 新設、Decision/Status/Why/Impact/Alternatives considered/Rollback/Revisit の既存フォーマット踏襲）: `rg -c "^## D-062" docs/decision-log.md` → `1`。既存 D-034/D-035/D-038/D-050/D-055/D-056/D-058/D-059 との文言非矛盾を目視確認済み（独立レビューでの再確認は Final Reviewer に委ねる）。
- `scripts/doc-consistency-check.sh`（`check_plan_packet_numeric_evidence_warnings` を PK3 に隣接する新規関数として追加し、`check_plan_packet_heuristic_warnings` の両呼び出し箇所（`--target plan` モード / 通常 docs チェックモード）に相乗り。WARN-only、`WARNINGS` カウンタのみ加算、exit code 契約は変更なし）。
- `scripts/tests/doc-consistency-plan-packet.test.sh`（新規 fixture group #20 を追加。X1 red / X2 green / X3 mutation を synthetic packet 経由で再現し、加えて R2 packet での Contract Probe 欠落時の skip 挙動を確認）。`PKT_CONTRACT_PROBE_LINE` / `PKT_REVIEW_RESPONSE_EXTRA` を `reset_packet_defaults` / `write_packet` へ追加（既定値は既存の "fixture premise..." 文言のまま、既存 fixture 群への副作用なし）。

Contract Probe 実証（パターンレベル + スクリプト経由の両方で確認済み）:

- 歴史的 red（D-059 round1、commit `4c4284f`、「outer 30秒より短い内部20秒 + kill-after 2秒deadline」相当、backtick なし）: `rg`によるパターンレベル実測で数値+単位トークン 3 件検出・backtick/未実測なし（Contract Probe 記載どおり）。synthetic packet へ同文言を注入し `bash scripts/doc-consistency-check.sh --target plan` を実行 -> PK6 WARN 発火を確認（exit code 0 のまま）。
- 歴史的 green（D-059 round2、commit `863c25b`、「checker runtime...33.64秒...20.01秒...」相当、backtick でコマンド参照あり）: パターンレベルで数値+単位トークン 5 件検出・backtick span 2 件あり。synthetic packet へ同文言を注入し実行 -> PK6 WARN 非発火（`PK6: 数値主張の実測 evidence 欠落 OK`）を確認。
- mutation（green から backtick span のみ除去、数値+単位トークンは維持）: パターンレベル・スクリプト経由の両方で WARN が再発火することを確認（実測コマンド参照を除去すると red 化する mutation 感度が成立）。

Noise 実測（現 active packet 本 packet 自身 + 直近 archive 5 packet、`bash scripts/doc-consistency-check.sh --target plan <file>` を個別実行、各 exit code 0）:

| Packet | PK6 WARN 件数 |
|---|---|
| `docs/plans/2026-07-31-codex-plan-habit-guards.md`（本 packet、active） | 2 |
| `docs/archive/plans/2026-07-31-finite-ipc-enum-impl-pr1.md` | 0 |
| `docs/archive/plans/2026-07-31-settings-service-boundary-impl.md` | 1 |
| `docs/archive/plans/2026-07-31-finite-ipc-enum-design.md` | 1 |
| `docs/archive/plans/2026-07-31-settings-service-boundary-design.md` | 0 |
| `docs/archive/plans/2026-07-31-claude-hook-contract-audit.md` | 1 |
| 合計 | 5（6 packet 中） |

全 5 件は Negative Paths に明記済みの既知偽陽性クラス（evidence-backed だが同一行に backtick/未実測 が無いプローズ、例: `settings-service-boundary-impl.md` の「17 件を独立実注入で全 kill 再現」）に一致し、ERROR は 0 件のまま。

Mutation 実注入（Matrix M1/M2/M3a、機械 oracle。各実施後に revert し `git diff --stat` で元通りであることを確認済み）:

| Mutation | 対象 | 実施前 AC | 実施後 AC | 判定 |
|---|---|---|---|---|
| M1 | `AGENTS.md` の新規 bullet を一時削除 | `rg -c "実測コマンドとその出力を併記" AGENTS.md` = 1 | 0 | red 化を確認、revert 済み |
| M2 | `plan-packet.md` の「環境・再現性」行を一時削除 | `rg -n "^\| 環境・再現性 "` = 1 hit | 0 hit | red 化を確認、revert 済み |
| M3a | `DEV_WORKFLOW.md` の (c) bullet を一時削除 | `must be a different vendor than Codex` = 1、`Capacity-degraded` = 1 | 両方 0 | red 化を確認、revert 済み |
| M3b/M3c | (c) の `codex-only` 免除除外文 / Capacity-degraded pending fallback の一時削除誤読可能性 | review-only（Matrix 記載どおり） | — | Plan Review round 1 P1 で既に同種の懸念を is accept/是正済み。独立 Plan Reviewer による再確認は Final Reviewer フェーズへ委譲 |

Gate 結果:

- `bash scripts/doc-consistency-check.sh`（full）: exit 0（WARN 2 件、PK6 の既知偽陽性、ERROR 0 件）。
- `bash scripts/doc-consistency-check.sh --target plan`: exit 0（WARN 2 件、同上、ERROR 0 件）。
- `bash scripts/tests/doc-consistency-plan-packet.test.sh`: PASS（新規 PK6 fixture group #20 含む全 20 groups）。
- `mise exec -- bash scripts/local-ci.sh full`: `RESULT=PASS` / `EXIT_CODE=0`（npm-audit の既存 warn-only advisory 5 件は本 PR 非接触の既存 pre-existing dependency 事項、`GATE_EXIT_CODE=1`/`WARN_ONLY_GATE=npm-audit` として PASS に含まれる既定挙動）。

## Review Response

Fill after review.

Plan Review round 1（Coordinator 裁定 = 全 accept、修正案どおり）:

- P1: (c) の DEV_WORKFLOW 新規 bullet 案が `codex-only` の既存定義（AGENT_OPERATING_MANUAL.md:58、期間定義）を言い換えて免除根拠にしていた点を accept。言い換えを削除し、「non-Codex Plan Reviewer が実在しない場合は AGENT_OPERATING_MANUAL.md §3.3 Capacity-degraded に従い pending 化し前進しない」の fallback を条文（Scope）へ明記した上で、Spec Contract / Design Intent Trace / Review Focus / Trace Matrix / Acceptance Criteria / Test Design Matrix（C3, F3, Test Matrix 行, Mutation-style Adequacy）を全節 sweep して同旨記述を追随させた。
- P2: PK6 heuristic が実プローズ型・evidence-backed だが backtick なしの文（例:「17 件を独立実注入で全 kill 再現」）を偽陽性として WARN しうる点を accept。Test Design Matrix の Negative Paths に当該 fixture を追加し、WARN 発火は許容（ERROR 化しない）、実装時に既存 active packet 群 + 直近 archive packet 群への noise 量を一度実測して PR の Review Response で報告することを期待動作として明記した。
- P3: Compatibility Checks の archive 不変検査が機序を明記していなかった点を accept。`iter_active_dated_plans()` は `-maxdepth 1` で `docs/archive/plans/**` を元々スキャン対象外にしていることを実測確認済みの記述へ是正した（`scripts/doc-consistency-check.sh:804`）。
- 是正後: P1/P2 = 0（round 1 是正で解消、Coordinator 裁定）。

- Findings Freeze: frozen after Broad Audit; post-freeze exceptions: none.

### Final Review（independent Claude subagent, Sonnet 5。audited = c0a2298 + 是正）

- diff 過不足なし、PK6 WARN-only を code+実行で二重確認、歴史的 red/green・mutation M1〜M3a・noise 5/6 を独立再現。M3b/M3c の敵対的読解で骨抜き余地なしを確認
- P2（fixture test の hosted CI 登録という未検証主張 — **D-062 導入 PR 自身の D-062 違反**）: accept、「local-ci のみ」へ実測付き訂正。ci.yml への追加は既存 gap のため scope 外（本 PR の退行ではない）
- P3（DEV_WORKFLOW 新 bullet の英文重複）: accept、削除
- 是正後 P1/P2 = 0
