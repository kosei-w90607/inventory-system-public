# Workflow Effectiveness Review: D-045 follow-up workflow guards（PR #4）

## Workflow Used

- Plan Packet / Test Design Matrix: [packet](2026-07-15-d045-followup-workflow-guards.md) / [matrix](test-matrices/2026-07-15-d045-followup-workflow-guards.md)
- review: 独立 Sonnet plan rally 3 round、独立 Double Audit 2 pass（機構レンズ / 規範整合レンズ）+ 差し戻し再検証
- 実装: Codex 発注（owner コピペ relay）、是正のみ Coordinator（Fable）直接実装
- gates: doc-consistency checker、workflow-git 検査、drift test T1〜T8 + T4b、local-ci full、hosted CI

## What Worked

- Goal Invariant の先行自己適用: packet 自身が新構造で書かれ、plan review R1 が「Goal Invariant の自己違反」（scope が Goal を超過）を検出した。作ろうとしている guard が plan 自身の欠陥を先に捕まえた。
- Plan rally が単調収束した（R1: P1×3/P2×2 → R2: P2×1/P3×1 → R3: 0）。「存在しない前例の引用」を R1 で検出できたのは大きい。
- Double Audit の独立性が実益を出した: pass A が合成 repo での実証込みで cross-commit backtrack チェーン回避（cap 迂回）を発見。Writer 自己申告の「Double Audit closure: PASS」を独立監査に算入しない裁定も機能した。
- 承認カウンタの手動 dogfood: 全承認接点に「N 回目 / 予算 M / 利用者可視の完了1文」を付け、予算ちょうど（接点3/3、relay 2/2）で完了した。
- Codex の fail-closed が誤環境（history-view clone）起動を実装前に停止した。

## What Did Not Work

- 発注書に作業ディレクトリを書かず、relay 1 往復を空費した（2 clone 体制の罠、memory 化済み）。
- ready-hosted-final の state-only commit を作る前に owner が Ready 化・merge した。実害なし（PR body に final evidence あり）だが、遷移記録の厳密な順序は崩れた。
- PR #4 では Ready 後の head 更新が発生せず、CI `synchronize` / cancellation の実動作確認は UI-13 に持ち越し。

## Issues Caught Before Implementation

- Goal Invariant の自己違反（plan review R1 P1-1）。
- backtrack 判定機構の未設計・実装可能性の未裏取り（R1 P1-2）。
- WER 遡及なし判定の偽前例引用（R1 P1-3）。

## Issues Caught by Tests

- checker（PK1/PK3/PK4）が packet の Matrix リンク欠落・観測 token 欠落・Findings Freeze 行欠落を機械検出。
- 是正後の drift test が連続 backtrack ERROR / 実作業挟み PASS の両方向を固定。

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| cross-commit backtrack チェーンで多段後退が cap 除外のまま素通り（pass A、合成 repo 実証） | candidate safety（機械 gate の実効性欠陥） | 隣接 state-backtrack ERROR 化 + test 2 case、差し戻し再検証で blocked 確認 |
| Evidence Ownership の 3-cap 記述に backtrack 除外の相互参照欠落（pass B） | evidence quality（docs 整合） | 118行に括弧書き追加 |
| packet Goal が新テンプレ H3 形式でなく checker の代替分岐で通過（pass B、plausible） | evidence quality | UI-13 dogfood follow-up へ降格（Goal 節は Plan Gate 後凍結のため） |

## Issues Caught by External Review

- なし（hosted CI green のみ。外部レビューは本 change では未使用）。

## Escaped / Late Findings

- backtrack 間に実作業 commit を挟む偽装は機械検出外（content commit として review 可視のため owner 承認済み残余リスク）。
- `.codex/bin/read-safe-file.sh` が history-view clone を参照（Writer の scope 外報告で発見、backlog 起票）。

## Test Adequacy

Strong tests:

- T3/T4/T4b: backtrack の正当経路と回避経路の両方向を合成 repo で固定。
- T8: 複製した phase 配列の両 script 一致（意図的 script 分離の drift 保険）。
- mutation-kill 実証: 監査が guard を実際に壊して test が赤くなることを確認した。

Weak or missing tests:

- 承認カウンタの会話上の運用は機械検査不能（PR body 外）。本 PR と UI-13 の手動 dogfood で観察する。
- goal-drift signal 停止手順と one-shot 様式は発動条件が実地のため token 存在検査のみ。

Mutation-style observations:

- 「単一 hop 制限」は commit 単位の検査では複数 commit への分割で迂回できる — 検査の単位（commit）と契約の単位（補正エピソード）のずれが穴になる。隣接禁止で lazy 迂回は塞げるが、単位のずれ自体は残る（review 可視で受容）。

## Signal / Noise

- 独立 audit のレンズ分離（機構 / 規範整合）は重複ゼロで相補的だった。高 signal。
- checker の既知 plans-only WARN（plan review commit への WARN）は今回も無害 noise。slice 2 follow-up の no-active-plan check 系と合わせて再訪。

## Cost / Friction

- useful cost: plan rally 3 round、Double Audit 2 pass + 再検証、合成 repo 実証。すべて具体的欠陥の発見・封鎖に直結した。
- excessive friction: 誤環境起動による relay 1 往復の空費のみ。
- owner 実働: 承認接点 3 回（relay 2 + Ready/merge 1）、予算ちょうど。12時間暴走との対比で、同じ R3 workflow change が承認3接点で完了した。

## Retired / Consolidated Rules

- retire: `docs/DEV_WORKFLOW.md` Owner Effort Budget の旧・宣言型超過処理（「Coordinator simplifies; the owner does not absorb the overrun」だけで停止装置を持たない形）。hard stop + 承認依頼フォーマット + goal-drift signal 停止手順へ置換され、旧文言は役目を終えた（D-038 の実証失敗が根拠、D-046-7）。
- consolidate: backtrack の扱いが「Workflow State の correction 規則」と「Evidence Ownership の cap 記述」に分散していたのを、state-backtrack 契約 + 相互参照で単一の参照構造に統合した。

## Recommended Workflow Adjustment

Keep:

- Goal Invariant の packet 先行自己適用と、plan rally の収束条件（新規指摘 0）。
- Double Audit のレンズ分離と、Writer 自己実行監査を独立監査に算入しない裁定。
- 承認カウンタ付き Human Gate 欄。

Change:

- Codex 発注テンプレに「環境」節（cwd pin / origin 確認 / checkout 手順 / 不一致停止)を常設する（memory 化済み、テンプレ昇格は次回発注時）。
- ready-hosted-final の state-only commit は owner へ Ready 依頼を出す前に作る（本件は事後記録になった）。

Follow-up:

- UI-13: Goal 節 H3 形式 dogfood、CI synchronize/cancellation 実動作確認。
- backlog: read-safe-file.sh の clone 参照修正。

## Applied / Deferred Workflow Changes

Applied:

- D-046（8 sub-decision）を decision-log に、guard 一式を DEV_WORKFLOW / templates / AGENT_OPERATING_MANUAL / checker / git 検査に正本化（PR #4）。

Deferred:

- hook 化（sandbox 制約）、PR body 機械検査（gh 依存）、H3 形式の ERROR 昇格判断。
