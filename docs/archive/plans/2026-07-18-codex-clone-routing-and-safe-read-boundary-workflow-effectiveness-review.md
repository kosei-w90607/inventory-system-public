# Workflow Effectiveness Review: `.codex/` clone routing + safe-read boundary 是正（PR #15）

## Workflow Used

- Project Profile: R3 workflow gate change（`.codex` execpolicy = Codex auto-allow 境界）
- Plan Packet: [2026-07-18-codex-clone-routing-and-safe-read-boundary.md](2026-07-18-codex-clone-routing-and-safe-read-boundary.md)
- Test Design Matrix: [test-matrices/2026-07-18-codex-clone-routing-and-safe-read-boundary.md](test-matrices/2026-07-18-codex-clone-routing-and-safe-read-boundary.md)
- review-only sub-agent: Plan Gate 独立レビュー（Sonnet subagent、3 round）
- external review: Contract Audit Double Audit 2 pass（1 pass = Fable inline 直接 / 2 pass = Codex 独立 mutation testing）
- human approval: 発注起動（介入 1/3）/ Ready 承認（介入 2/3）/ merge（介入 3/3）
- gates: doc-consistency（--target plan）/ check-workflow-git（PK5・STATECAP）/ local-ci full（三点一致）/ hosted CI success

## What Worked

- Codex read-only 棚卸し → Coordinator の実証裁定（traversal 再現 / mirror cmp / line 実読）で A/B/C 分類が確定し、「機械的一括置換禁止」の backlog 注記を守れた。
- Plan Gate の独立 3 round が、C6 の文言矛盾（sensitive 判定を生引数のまま許す → symlink alias で迂回可能）を P1 として plan 段階で掴んだ。設計 phase で境界穴を 1 つ潰せた。
- **Contract Audit Double Audit が中核的に機能した**（下記 Escaped 参照）。workflow gate change で Double Audit を必須にしていたことが実バグ相当 5 件の検出に直結。

## What Did Not Work

- Claude subagent への review 発注が、safe wrapper / path 境界の敵対的検証という**分野**で safeguard の model routing 切替（Fable→Opus）を繰り返し誘発し、3 回の発注試行がすべて停止した。文言を防御框組みに言い換えても、発注書を Fable が生成する行為自体でも切り替わった。委譲経路がこの分野で信頼できないことが判明。
- closeout 時、sandbox で `.claude/hooks/` が read-only のため `git reset --hard` が失敗。`reset --mixed`（working tree 非接触）で回避した。

## Issues Caught Before Implementation

- C6 sensitive 判定の canonical 化漏れ（Plan Gate R1 P1）。symlink alias すり抜けを実装前に閉塞。
- dry-run 出口の Scope 明記漏れ / canonicalize 失敗の明示拒否 / execpolicy 全件単純置換の一本化（Plan Gate R1 P2×5）。

## Issues Caught by Tests

- 常設 regression test T1–T15 が境界拒否を実走で担保。ただし当初版は anti-tautology 感度が不足（下記 Test Adequacy）。

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| Plan Gate R1: C6 生引数判定の symlink alias 迂回（P1） | accepted | canonical 相対 path 判定に統一 + T14 |
| Plan Gate R1: dry-run / canonicalize 失敗 / rg・find canonical / execpolicy 一本化 / T4 無引数（P2×5） | accepted | 全件是正 + T15 |
| Plan Gate R1/R2: 誤字・正規表現明示・役割分離・A 群書き分け（P3×5） | accepted | 全件是正 |

## Issues Caught by External Review

- **Contract Audit 2 pass 目（Codex 独立 mutation testing）が P2×5 + P3×1 を検出**。5 P2 はすべて test の anti-tautology 不足（実装は契約一致だが、実装デグレを test が検出できない = missing critical tests）: 拒否時 stdout 非検査 / allowlist 最終境界の入力ケース欠落 / default 各 entry 未走査 / directory 経由 sensitive 除外未検証 / hook encoded namespace drift 取りこぼし。P3 = 改行 path 受理。全件 accept、同一 PR（`9f58050`）で是正。Coordinator が F1/F2 を実 mutation 注入で回帰感度を再確証。

## Escaped / Late Findings

- **1 pass 目（Fable inline）の anti-tautology 判定が 5 件の test 素通りを見逃した**。1 pass 目は「実装を緩めれば対応 T が落ちる構造」を**コード読解の推論**で判定し、実 mutation 注入をしなかった。2 pass 目（Codex）が実注入して 5 件を掴んだ。**推論ベースの anti-tautology 判定は不十分で、実 mutation 注入が必要**という教訓。CLAUDE.md「Claude は自己 bias に気付けない、機械強制でしか質担保できない」の実例。Double Audit を waive していれば 5 件は escape していた。

## Test Adequacy

Strong tests:
- 是正後の T1–T15 は実 mutation で個別に fail することを確認済み（拒否時 stdout 空 / allowlist 最終境界 / default 全 entry / sensitive descendant / encoded namespace / CR/LF）。

Weak or missing tests:
- 当初版（`b66dd53`）は上記 5 mutation をすべて素通りさせた。

Mutation-style observations:
- anti-tautology は「実装を壊したら test が落ちる」ことを**実注入で**確かめないと保証にならない。構造読解の推論では今回 5 件を取りこぼした。

## Signal / Noise

- sub-agent findings total: Plan Gate 3 round 計 P1×1/P2×6/P3×9 + Contract Audit 2 pass P2×5/P3×1
- accepted: 全件
- rejected: 0
- deferred: 0（owner 環境 follow-up 4 項目は非 finding、PR body に記録）
- question: 0

## Cost / Friction

- useful cost: Double Audit の 2 pass 目（Codex 独立 mutation testing）— 5 件の実バグ相当を検出した最大の価値源。
- excessive friction: Claude subagent review の routing 切替による停止 3 回 + owner の手動 model 切替往復。この分野特有の摩擦。
- confusing steps: なし
- review rounds (broad audit / closure確認の内訳): Plan Gate 3 round + Contract Audit 2 pass（broad audit）+ closure 確認 1 round（実 mutation 再確証）
- state-only commits / 総commit数: forward state-only 3 件（plan-approval / human-confirm / ready-hosted-final、cap 内）/ 総 commit 数 8（content 2 + review record 2 + state-only 3 + Plans 同期 1）

## Retired / Consolidated Rules

- 既存 backlog「`.codex/` 旧 clone 参照一括是正」と「`read-safe-file.sh` history-view clone 参照修正」を本 PR で統合・消化し、backlog から除去した（net rule 増ではなく backlog 縮小）。D-049 が wrapper root 解決・containment・execpolicy 分離の 3 契約を 1 決定に集約。

## Recommended Workflow Adjustment

Keep:
- workflow gate change の Double Audit 必須。今回それが 5 件検出の直接要因。

Change:
- **セキュリティ境界の敵対的レビューは Claude subagent 発注を第一選択にしない**。routing 切替で停止する分野があるため、Fable inline 直接 + Codex 発注に迂回する（memory `feedback-security-review-subagent-routing-guardrail` に固定）。
- **anti-tautology は実 mutation 注入で確かめる**。構造読解の推論判定は不十分（今回 1 pass 目が 5 件見逃し）。

Follow-up:
- 上記 2 点は次の実装 R4 2 PR（backup/migration failure contract = restore 原子性・destructive lifecycle）で同種のセキュリティ境界レビューが出るため再発前提で適用する。

## Applied / Deferred Workflow Changes

Applied:
- memory `feedback-security-review-subagent-routing-guardrail`（routing 迂回の運用教訓）を固定済み。
- D-049 を decision-log に確定。

Deferred:
- 「anti-tautology は実 mutation 注入で確かめる」の DEV_WORKFLOW / Contract Audit 節への明文化は、次の workflow docs PR（Plans.md 次の行動 1.i）へ deferred。現時点は本 WER と memory で記録。

Not applied:
- なし
