# Workflow Effectiveness Review: wave 1（2 lane pilot、D-055 初 dogfood）

対象: wave 1 = 順17（PR #29 squash `5573446`）× 順22（PR #30 squash `88a5c14`）、2026-07-28 完了。D-055 Wave Operation の最初の実運用。

## Workflow Used

- scaffolding = 両 lane packet + Matrix + Wave Registry を main 上に 3 commit で置き、両 lane branch をそこから分岐（PK4 の『次の行動』節内 link 検査と R3 link 実在検査を両 branch で満たし、Plans.md を lane footprint から外す配置）
- Plan Gate rally は 2 lane 並列（Sonnet 独立 fresh context、裁定は Coordinator 直列）、round 2 で両 lane 収束
- 実装は Codex relay。単一 clone のため直列（lane 1 → lane 2）
- Final Review は lane 間で並列化（lane 2 実装中に lane 1 を git object 経由の read-only でレビュー — working tree 占有と両立）
- Coordinator mutation 独立再実測を両 lane 全件実施。merge train = #29 → #30、rebase は Codex + Coordinator 独立検証

## What Worked

- **batch 承認の介入削減**: 各 lane 介入 1/3 で完了（従来単 lane は 3/3 が通例）。1 decision point で両 lane の Ready 承認 + train 順序指定 + Ready 遷移実行委任が成立。owner の実操作は batch 承認 1 回 + merge クリック 2 回
- **merge train**: rebase は conflict-free、per-commit patch-id 3 pair + whole-diff patch-id の 2 層証明が主張どおり成立し（Coordinator 独立再計算で一致）、PK5 が Rebase Map を機械検証、Phase 維持で再レビューなしに lane 2 が続行できた
- **fail-closed の実効性**: Writer（Codex）の contradiction scan が 3 回とも正当に停止（REQ token × traceability 矛盾 / Spec Contract 旧文残存 / 共有 seed 変更 × 既存 test 改変禁止規範）。いずれも実契約矛盾で、誤発火 0
- **検査の深さ全維持の価値**: Coordinator mutation 独立再実測が lane 2 X2 の survivor（空集合 oracle 衝突）を捕捉（順6 X3 / PR #27 X7 に続く 3 例目）。plan rally round 1 も Matrix の実在しない機構への mutation 設計（pagination placeholder）と Workflow State 必須 field の系統的欠落を捕捉
- **レビュー並列**: plan rally 2 lane 同時、Final Review の read-only protocol（`git show` / `gh` 限定）により writer の working tree 占有中もレビューが進行

## What Did Not Work

- **Coordinator の amendment 発注の sweep 漏れ 2 連発**: 順22 の fail-closed 3 回のうち 2 回は、Coordinator の是正指示が packet 内旧前提（Spec Contract）・既存規範（test 改変禁止）との突合を欠いたことが原因。packet-correction-full-sweep 規律の適用範囲を発注書起草時へ拡張して対処（memory 反映済み）
- **checker と D-055 契約文のずれ**: PK4 の section 抽出が `###` 小見出しで打ち切られ、`### Wave Registry` 配下の packet link が検査対象にならない（起票時に発見、link を項 0 直置きで充足）。また PK4 は Workflow State の必須 field 欠落（Coordinator / Writer / Reviewer / Hosted CI Requirement 等）を検査しない（plan rally が人力捕捉）。両方 Plans.md backlog 済み
- **whole-diff patch-id の比較点が契約文で自明でない**: 「rebase 前後で同値」の after は Rebase Map 追記 commit の前の tip で取る必要があり、Coordinator 検証も一度比較点を誤った（Map 追記自体が diff を変えるため）。DEV_WORKFLOW の該当文への注記が望ましい（軽微、backlog 判断は次回 wave 前）

## Issues Caught Before Implementation

- plan rally round 1: lane 2 Matrix の F3/X4 = 実在しない機構（pagination placeholder — LIMIT/OFFSET は literal 埋め込み）への mutation 設計（P1）/ lane 1 経由で両 lane の Workflow State 必須 field 7 点欠落（P1、fail-closed 条項該当）/ C4 の裁量表現と Goal Invariant の矛盾（P2）/ Matrix C4 実質防御の非明記（P2）

## Issues Caught by Tests

- 既存 gate では捕捉不能だった placeholder ずれ・bind 交差を、新設の組合せ test（独立転記 oracle + 非空期待）が mutation 実測で検出（X1/X2 両形/X3 red）

## Issues Caught by External Review

- Final Review 一次（lane 1）: PR body の実在しない check（M-A4）の pass 記録（P2、evidence 正確性）
- Writer review-only（lane 2）: fail-closed 3 件の契約矛盾検出
- Coordinator 再実測: X2 survivor（空集合 oracle 衝突）— Writer の kill 主張は別注入形では正しく、注入形の違いが検出/素通りを分けることを実証

## Escaped / Late Findings

- merge 後の escape なし（hosted final 両 lane green、三点一致）

## Test Adequacy

- 空集合期待の組合せ case は「結果を空にする」mutant を構造的に素通しする — 組合せ oracle には非空期待を最低 1 case 含める（memory: empty-set-oracle-collision として一般化済み）。seed 追加が既存 test 改変禁止と衝突する場合は新規 test 内へ隔離する

## Signal / Noise

- fail-closed 3 回はすべて true positive。reviewer findings も全件 accept（誤指摘 0）。checker の STATECAP heuristic 警告（amendment 系 docs-only commit への prefix 注意）は既知の noise で実害なし

## Cost / Friction

- owner 介入: lane 1 = 1/3、lane 2 = 1/3（batch 承認 1 decision point + merge 2 回）。単 lane 通例 3/3 × 2 = 6 に対し実質 2 で、D-055 の介入削減目標を達成
- relay 回数: 実装 2 + 是正 3 + rebase 1 = 6（うち是正 2 は Coordinator 起草ミス由来 — sweep 規律拡張で削減可能）
- 実装は単一 clone のため直列で、wave の throughput 上限は writer。並列効果は plan / review / 検証段に集中

## Recommended Workflow Adjustment

- 3 lane 化の判断材料: 並列効果は plan rally / review / Coordinator 検証で実証済み。一方 writer が単一 clone 直列である限り実装段は延びない。3 lane 化するなら (a) lane サイズを S に限定して writer 回転で回す、または (b) worktree による writer 並列化の設計が前提。判断は owner
- checker 是正 2 件（PK4 の ### 抽出 / Workflow State field 検査）は独立の小 R3 として起票可能（backlog 済み、優先度は owner 判断）
- Coordinator の amendment / 発注書起草 checklist に「対象 packet 全節 sweep + 既存規範突合」を機械的に含める（memory 反映済み、次回 wave で実効を確認）

## Retired / Consolidated Rules

- なし（本 WER は新規 rule の廃止・統合を行わない。D-055 本文の改訂は checker 是正 lane を起票する場合にその packet で扱う）
