# Workflow Effectiveness Review — 整合性補正 D-051 実装 follow-up（監査是正 順 3、PR #20）

## Workflow Used

- Project Profile: [../../project-profile.md](../../project-profile.md)
- Plan Packet: [2026-07-22-integrity-fix-semantics-impl.md](2026-07-22-integrity-fix-semantics-impl.md)
- Test Design Matrix: [test-matrices/2026-07-22-integrity-fix-semantics-impl.md](test-matrices/2026-07-22-integrity-fix-semantics-impl.md)
- review-only sub-agent: 不使用（R3 Contract Audit は Double Audit 2 pass 構成で実施）
- external review: Codex ×4 relay（先行 plan review / 実装 Writer / 2 pass 独立監査 / fix round）+ Fable self rally 4 round（Plan agent 独立 context、Codex findings 非開示）
- human approval: 介入 2/2（plan 承認 / Ready + visual confirmation 裁定）。relay 上限 2 に対し実績 4 で超過（packet に記録済み）
- gates: Plan Gate（Codex 先行 → self rally 収束）→ owner 承認 → Codex 実装 + L1 full → Double Audit 2 pass → state-backtrack + gated amendment ×2 + fix → closure 独立再実測 → Findings Freeze → hosted final 三点一致 `509d85e` → squash merge `739b117`

## What Worked

- **試行フロー「Codex 先行 plan review → self rally（findings 非開示）」**: 捕捉クラスが相補的に分離した。Codex = 機械 gate の実走（PK2/PK4）・正本/実コードとの衝突（L3 eligibility・可視文言残存）・repo 内 precedent の発掘（trigger / mock_builder / &tx）。rally = plan 内部整合と**是正の副作用**（round 3 が「round 1 の是正自身が書いた未検証前提」を検出 — 独立 context の実証価値）。
- **2 pass の systematic mutation testing が survivor 10 件を検出**。PR #15（P2×5）/ #16（P2×4）/ #17（P1+P2×2）に続き 4 連続で「2 pass を独立 vendor + 実 mutation で実施する」設計が実バグ相当を検出。
- Writer の fail-closed 停止（T3 契約 vs 共有 `update_stock_quantity` の updated_at 意味論の衝突を編集前検出）→ 相互修正案 → Coordinator 実読裁定の loop が設計どおり機能。
- closure で代表 survivor（S1 Rust / S8 frontend）を独立 subagent で再実測 — Writer 自己申告に依存しない第三者確認。
- 逆順フローでも rally が Codex の指摘に汚染されない独立性を「findings 非開示」で担保できた。

## What Did Not Work

- **Coordinator 自身が是正で書く新規契約文の未検証前提**が同一 change 内で 2 回発生（①「roadmap 1-4 で操作ログ確認」= Plans.md 実文言に不存在、rally round 3 検出 ②T3「product 他列完全一致」= updated_at 既存意味論と衝突、Writer fail-closed 検出）。memory `feedback-verify-own-corrective-claims` として保存済み。
- `Reviewed Content HEAD` の先行記入（設定タイミング契約の運用誤り）を 2 pass に指摘されるまで自覚できなかった。
- Owner Effort Budget の relay 上限 2 が Codex 先行フロー（発注 relay 4）を想定しておらず形骸化した。

## Issues Caught Before Implementation

- Codex 先行 plan review: P1×3 + P2×3 + P3×2（機械 gate 失敗 / L3 正本衝突 / UI-13 可視文言捕捉漏れ / §21.6 隣接契約不足 / traceability 無条件化 ほか）
- self rally 4 round: 重要×7 + 軽微×3（StocktakePage パターン整合 / 是正起因の新矛盾 2 件 / `_req904_` 命名罠 ほか）、round 4 で新規 0 収束

## Issues Caught by Tests

- 実装後の product regression はゼロ。強化後 oracle は X1〜X5 + S1〜S10 の全 mutant を red 化（実測）。

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| （review-only 構成は不使用） | — | Double Audit 2 pass 構成で代替 |

## Issues Caught by External Review

- Double Audit 2 pass（Codex 独立 fresh context）: P1×2 + P2×7 + P3×1、survivor mutation 10 件（S1〜S10）。全件 accept、state-backtrack + gated amendment ×2 + テスト強化 fix `9b3552b` で解消。

## Escaped / Late Findings

- oracle 感度不足（T3 snapshot 列不足 / T12 field 非対称 / jsdom sr-only 限界 / details 到達可能性 / 残数一般性）は **plan 段階の Matrix 定義に起源**があり、Codex 先行 plan review と rally 4 round の両方を通過して 2 pass まで到達した。plan review は「oracle の存在と設計」は検査できるが「oracle の mutation 感度」は実装後の実 mutation でしか検証できない — mutation testing を plan review の代替ではなく必須の別レイヤーとして維持する根拠。

## Test Adequacy

Strong tests:

- T1 失敗注入（restore.rs の trigger precedent 再利用、rollback 完全性を stock/movements 不変で実証）
- T2 detail_json 具体値 + skipped 2 系 + voided / zero-movement fixture
- T5 SQL 等式（COALESCE + is_voided=0、実装非経由の独立 oracle）

Weak or missing tests（検出 → 強化済み）:

- T3 snapshot 列不足、T12 field 非対称、T8 可視性（jsdom 限界）、T10 到達可能性、T13 境界一般性

Mutation-style observations:

- jsdom/jest-dom は Tailwind `sr-only` を不可視判定しない — 可視性 oracle は `toBeVisible()` ではなく class / attribute の否定 assert で書く
- snapshot 系 oracle は「対象 entity の全列 + 許容変化列の明示」を既定にしないと非対象列の改変 mutant が素通りする

## Signal / Noise

- sub-agent findings total: plan phase 18（Codex 8 + rally 10）+ impl phase 10 findings + survivor 10
- accepted: 全件（P3-1 の 74-ui 昇格のみ縮小採用 = packet 内 degrade instance 扱い）
- rejected: 0
- deferred: 0
- question: 0

## Cost / Friction

- useful cost: Codex 先行 review / rally 4 round / 2 pass mutation testing / closure 独立再実測 — いずれも実 findings に直結
- excessive friction: 特になし
- confusing steps: `Reviewed Content HEAD` の設定タイミング（正本には明記があったが Coordinator が読み落とし）
- review rounds (broad audit / closure確認の内訳): plan = Codex 1 + rally 4 / impl = 1 pass + 2 pass + closure 1
- state-only commits / 総commit数: forward state-only 3 + state-backtrack 1 / branch 総 commit 17

## Recommended Workflow Adjustment

Keep:

- **「Codex 先行 plan review → self rally（findings 非開示）」を条件付き採用**。適用条件 = 設計正本が確定済みの実装 follow-up（正本・実コードとの突合が主リスク）。正本未確定で plan 自体の探索が必要な change は従来どおり rally 先行。
- 2 pass 独立 vendor + 実 mutation（4 PR 連続で実バグ相当検出、waive 不可）
- Writer 発注書の「契約衝突時は編集前に停止して相互修正案」条項

Change:

- Owner Effort Budget の relay 上限を execution mode 別既定に（Codex 先行フローは発注 relay が構造的に +2）
- Matrix の snapshot 系 oracle は「全列 + 許容変化列の明示」を既定形式に（T3 の教訓）
- Coordinator が是正で書く新規契約文・事実主張にも実読裏取りを義務化（memory 保存済み、workflow docs への昇格は下記 defer）

Follow-up:

- roadmap 1-4 受入テスト台本に「整合性検証 → 補正 → 操作ログ確認」ステップと §74.15 機能別 L3 行追加を検討（visual confirmation 残余リスクの解消先）
- PR #19 WER Recommended 3 点（契約文書 Matrix の構造 anchor 既定化 / 現状整理の sweep evidence 義務 / 1 pass の survivor 探索 charge 化）は引き続き次期 workflow docs PR へ

## Retired / Consolidated Rules

- Contract Probe の「実験必須」運用を「repo 内 precedent の実読引用で verified 記録可」へ統合した（本 change で 3 前提を実験なしで確定し、probe 実験 round を 1 つ退役。precedent 引用は file 実在検証を伴うため検証強度は維持）
- 「operator 可視変更の visual confirmation = screenshot 必須」という暗黙運用を「表示条件が fault-injection 依存の画面は owner 裁定で受入テスト集約へ委譲可（skip 理由 + 受容者の記録必須）」へ統合した（DEV_WORKFLOW 既存の skip 記録規定の実運用化であり、新規ルールの追加ではない）

## Applied / Deferred Workflow Changes

Applied:

- 本 change 内で実施: 逆順 plan review フローの実証、precedent 引用型 Contract Probe、snapshot 全列 oracle（T3）、survivor 回帰群（S1〜S10）の Matrix 常設

Deferred:

- relay 予算の execution mode 別化 / snapshot oracle 既定形式 / 逆順フロー適用条件の明文化 → 次期 workflow docs PR（PR #19 WER Recommended 3 点・D-050 defer 群との同送を検討）

Not applied:

- なし
