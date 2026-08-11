# Test Design Matrix: WER Deferred workflow docs 正本化

対象 packet: [2026-08-12-workflow-docs-wer-deferred.md](../2026-08-12-workflow-docs-wer-deferred.md)

## Drift Anchor Cases

anchor literal は Plan Gate 時点で Coordinator が下表のとおり仮確定済み。Writer の責務は repo 全体での `rg -c` 一意性確認と、cross-hit した場合の「より固有の literal への特定化」（Matrix へ追記記録）のみで、anchor の新規選定は行わない（rally round 1 P3-4 — self-fulfilling anchor の防止）。既存文書と衝突する汎用語（「修正案」単独、「sweep」単独）を anchor にしない。

| ID | 対象 | anchor（Coordinator 仮確定済み literal） | oracle |
|---|---|---|---|
| M-W1 | DEV_WORKFLOW Review Rules の rally 天井 bullet | `round 数 3 を天井` および `同型指摘の一括是正 / backlog 化 / owner escalation` | 各 `rg -c` = 1（DEV_WORKFLOW 内） |
| M-W2 | Owner Effort Budget round 行 + plan-packet template round 行 | `Plan Review round 天井` | DEV_WORKFLOW と plan-packet.md の各 file で `rg -c` >= 1、天井値 3 が DEV_WORKFLOW 側と一致 |
| M-W3 | subagent-review-packet の修正案必須 + 差し戻し | `受理せず差し戻す` | 同 file で `rg -c` = 2（Output Required + Sub-agent Prompt） |
| M-W4 | Plan Packet Rules の是正 sweep bullet | `旧前提の keyword で` | `rg -c` = 1、Contract Audit 節の既存 `Drift-fix sweep` 文言は無改変 |
| M-W5 | AGENT_OPERATING_MANUAL §5.6 | 節見出し `従来型 Writer 発注書の共通出力契約` および `narrative 記述のみで遷移を主張しない` | 各 `rg -c` = 1、§5.4 節範囲（L154-164 相当）の diff 0 |
| M-W6 | AGENT_OPERATING_MANUAL §5.7 | 節見出し `変則 provenance packet の監査採用手順` および `再起草へ fallback` | 各 `rg -c` = 1。JAN 固有語彙（`golden 2 profile` / `jan-code` / `ProductAddSuggest`）が §5.7 内 0 hit |
| M-W7 | DEV_WORKFLOW の file type 確認 bullet | `git ls-files -s` および `120000` | 同 bullet 内で各 `rg -c` >= 1（DEV_WORKFLOW 内新規） |
| M-W8 | 既存保全 token | `candidate safety` / `mutation authority` / `goal-drift signal` / `one-shot irreversible` / `task-shape` | 各 `rg -c` が変更前 count と一致（Writer が baseline を実測記録してから編集） |
| M-W9 | decision-log D-065 | `## D-065` 見出し + Rollback 行 | `rg -c '^## D-065'` = 1 |

## Mutation Sensitivity（X 系）

| ID | 一時注入（削除） | RED oracle |
|---|---|---|
| X1 | DEV_WORKFLOW の天井 bullet を削除 | M-W1 の `rg -c` が 1 → 0、M-W2 の 3 点整合が破れる |
| X2 | review-packet template の差し戻し文を削除 | M-W3 の `rg -c` が期待 count から減る |
| X3 | §5.6 の narrative 遷移主張禁止文を削除 | M-W5 の anchor `narrative 記述のみで遷移を主張しない` の `rg -c` が 1 → 0 |

oracle は Matrix に固定した anchor literal の `rg -c` であり、実装文からの逆算コピペで恒真化させない（Writer は anchor を実装前に本 Matrix へ確定記入し、Coordinator が独立に同じ literal で再実測する）。

## Negative Paths

- 既存 token の誤削除: M-W8 が検出（baseline count 比較）。
- anchor の cross-hit: 実装時に repo 全体 `rg -c` で一意性確認、複数 hit なら anchor をより固有の literal へ特定化（Matrix anchor uniqueness の教訓）。
- §5.4 への混入: M-W5 の §5.4 範囲 diff 0 検査が検出。

## Boundary Checks

- 天井値の 3 点整合（DEV_WORKFLOW / Budget / template）: M-W2 で値の一致まで確認。
- docs-only 境界: `git diff --name-only` が docs/ のみ（packet AC4）。
- 既存 drift test: `scripts/tests/` 一式 green（packet AC3）が append-only 性の最終防衛線。

## Residual Test Gaps

- 追記文言の「意味の正しさ」（WER 原文との一致）は機械検証できず、Plan Review rally / Final Review Double Audit の実読が担う。
- §5.7 の 9 観点が将来の変則 provenance 事案に十分かは次回実運用まで検証不能（発生時に WER で評価）。
