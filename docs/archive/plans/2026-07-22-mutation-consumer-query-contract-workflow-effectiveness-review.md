# Workflow Effectiveness Review — 監査是正 順 4: mutation→consumer query 契約（PR #21）

## Workflow Used

- Project Profile: docs/project-profile.md
- Plan Packet: [2026-07-22-mutation-consumer-query-contract.md](2026-07-22-mutation-consumer-query-contract.md)
- Test Design Matrix: [test-matrices/2026-07-22-mutation-consumer-query-contract.md](test-matrices/2026-07-22-mutation-consumer-query-contract.md)
- review-only sub-agent: Plan Gate self rally 5 round（Sonnet 独立 context ×5）
- external review: Codex plan review 3 round + Double Audit 2 pass（独立 fresh context、系統的 mutation testing）+ Writer fail-closed 2 回の相互裁定
- human approval: plan 承認（介入 1/2）+ Ready 承認・merge/closeout 委任（介入 2/2）
- gates: local-ci full ×3（実装 / fix / Ready exact-HEAD）、doc-consistency、check-workflow-git、M1〜M8 production-only mutation 実測、hosted final success 三点一致

## What Worked

- **Writer fail-closed の実地機能（2 回）**: 実装中の Codex が「契約と backend 実書込みの矛盾」（pluDirty 過剰）と「原則文の字義適用が prefix 機構と衝突」を検出して停止し、Coordinator 裁定 → gated amendment で契約が精緻化された。plan 段階では到達できない粒度の契約検証が実装時に働いた
- **Double Audit の相補性（5 change 連続の実証）**: 1 pass（Fable inline 突合）blocker 0 の判定を、2 pass の系統的 mutation testing が P1×3 で覆した。特に re-export 経由の共有 tautology 復活は「機械強制があっても推移到達を見なければ破られる」ことの実証で、mutant 実測でしか見つからない類だった
- **オーソドックス順の plan review（rally 先行 → Codex 後段）**: rally 22 指摘は導出の対称性・伝播整合を磨き、Codex は機械 gate 実走・正本節番号・test 実在・共有 tautology という実体欠陥を検出。捕捉クラスの分離は逆順試行（順 3）と同様に成立
- **相互修正案方式**: Codex 提示の修正案に対し Coordinator が別方向で裁定した 4 件（P2-2 補完側 / round 2 C 契約表拡張 / round 3 P2-D 基準明文化 / P2-3 第 2 案）がすべて次 round で異議なく通り、裁定の質が担保された

## What Did Not Work

- **round 1 反映を追記方式で行い旧文言の置換漏れを生んだ**（Codex round 2 P1）。設計転換（oracle 独立化）は旧記述の grep 全箇所置換で閉じる、という既存規律の適用漏れ。relay 超過 3/2 の主因
- **数値・参照の転記 drift が rally/Codex 計 5 round にわたり断続検出された**（16 mutation ×7 箇所、doc 数 ×2 箇所、E 採番、literal 箇所数、版名空白）。可変値の複数箇所転記は構造的に漏れる — 正本参照化で解消した箇所は再発していない
- **Reviewed Content HEAD の設定タイミング違反を再発**（順 3 の同型違反が survivor として検出済みだったのに、1 pass 完了時に設定）。memory 化済みだが、機械 gate がないと再発する類

## Issues Caught Before Implementation

- 契約正本の節番号誤り（§6 → §2.5、Codex round 1 P1-1）— そのままなら二重管理 drift を自作するところだった
- CSV hook test の不在（idle mock 全置換、P8b-1 同型）を「既存拡張」と誤認していた Matrix 虚偽（Codex round 1 P1-2）
- 共有 SSOT tautology（test が production contract を import する設計、Codex round 1 P1-1）→ 独立 oracle 方式の確立
- 棚卸し開始/明細更新の契約網羅漏れ、staleTime 除外論法の隠れ結合、除外判断基準の精緻化（rally round 2〜3）

## Issues Caught by Tests

- M1〜M8 の production-only mutation がすべて red（欠落 key 検出・guard 退行・prefix 破壊・re-export/concat/computed call の gate 検出）
- Writer 自己検出: 閾値「成功 0 件」不発火 test の欠如と `> 0 → >= 0` survivor

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| rally 5 round 計 22 件（P1×2 / P2×15 / P3×5） | 全 accepted | §2.5 是正・CSV test 新設化・productForm.root 補完・latest-check 一律対象外・契約表 16 行化・除外基準明文化ほか。packet Review Response に round 別記録 |

## Issues Caught by External Review

- Codex plan review 3 round: P1×4 / P2×8 / P3×3（全 accept、うち 4 件は修正方向を Coordinator が変更して合意）
- Double Audit 2 pass: P1×3 / P2×2 + green survivor 3 件（全て実バグ相当 → 全是正、fixture regression 化）
- Writer fail-closed 2 回: pluDirty 過剰 / prefix collateral 原則衝突 + E6 境界不正確

## Escaped / Late Findings

- C14 の lowStock/stockInquiryRoot 欠落は plan 段階（契約表導出）で拾えたはずのもの — 1 pass も SELECT 列突合の深さ不足で素通りし、2 pass まで到達した。「query が返す DTO の全列」を導出時に機械的に列挙する手順があれば早期化できた
- Reviewed Content HEAD タイミング違反と Evidence Ownership 違反（遷移記録への件数転記）は 2 pass の P2 で検出 — Coordinator の state 記録作法の問題で、実装品質とは独立

## Test Adequacy

Strong tests:
- 独立 oracle 完全一致比較（欠落・余分・重複 red）+ 静的 gate 3 層（AST/import-graph）+ fixture regression。M1〜M8 で感度実測済み

Weak or missing tests:
- oracle 転記 drift（packet 契約表と oracle の同期）は依然人間レビュー依存（Matrix Residual Gaps に明示済み）

Mutation-style observations:
- 「定義どおりの mutant が構造的に green になる」設計欠陥（共有 SSOT）は、mutant を書く前の設計文書レビューでは 4 独立 context が素通りした。mutation 感度は設計時に「その mutant は何との差分で red になるか」を書かせると早期検出できる

## Signal / Noise

- sub-agent findings total: 22（rally）
- accepted: 22
- rejected: 0
- deferred: 0
- question: 0
- external total: Codex 17 + 2 pass 5 + fail-closed 3 = 25、全 accept（部分 accept 2 件含む、rejected 0）

## Cost / Friction

- useful cost: Double Audit 2 pass（実バグ相当 3 survivor）、Writer fail-closed 2 停止（契約精緻化）、rally 5 round
- excessive friction: 追記方式反映による round 2 P1 の手戻り（relay +1）、数値転記 drift の是正 round
- confusing steps: 非 canonical state commit の作法（canonical subject / Evidence Ownership / 設定タイミング）を Coordinator が 3 種同時に誤った
- review rounds (broad audit / closure確認の内訳): plan gate = rally 5 + Codex 3 / broad audit = 1 pass + 2 pass / closure = fix 差分確証 1
- state-only commits / 総commit数: 3（human-confirm / ready 遷移 + 圧縮 content 同乗、cap 3 内）/ branch 総 20 commit（squash で 1 に集約）

## Recommended Workflow Adjustment

Keep:
- Double Audit 2 pass の Codex mutation testing（5 連続で 1 pass 見逃しを検出）、Writer fail-closed、相互修正案方式、オーソドックス順 plan review（契約未正本の change に適用）

Change:
- （次期 workflow docs PR へ）①Reviewed Content HEAD のタイミングを checker で機械検査（Phase が human-confirm 未満で HEAD 非 pending なら ERROR）②「設計転換の反映は旧記述 grep 全箇所置換 + 置換完了 grep を evidence 化」を DEV_WORKFLOW の gated amendment 作法へ明文化 ③契約表導出時に「query の返す DTO 全列」を列挙する手順（C14 見逃しの再発防止）

Follow-up:
- 独立 test oracle パターン（検証対象と oracle のソース分離 + 推移的 import 遮断）を DEV_WORKFLOW Contract Audit 節へ正本化する価値がある — 本 change の invalidation 契約に限らず、SSOT 化を伴う全変更に適用可能な一般規律

## Retired / Consolidated Rules

- 除外表の個別許容行（productForm.suppliers）を prefix collateral 一般原則（E2）へ統合し、個別事例の列挙増殖を止めた
- 契約表・除外表の版名（v1/v2）運用を廃止し、版番号転記 drift の発生源を除去した

## Applied / Deferred Workflow Changes

Applied:
- 独立 oracle + 静的 gate（AST/import-graph）+ fixture regression を本実装で確立
- 過剰 invalidate 禁止と prefix collateral 許容の対をなす導出原則を UI_TECH_STACK §2.5 / D-052 に正本化

Deferred:
- Recommended 3 点（checker 機械化 / 置換 evidence 化 / DTO 全列手順）と独立 oracle パターンの正本化 → 次期 workflow docs PR
- P5-4（operation-logs 系 literal の factory 収容）→ 別是正単位（D-4 ヘッダの期限付き例外注記が追跡先）

Not applied:
- leaf 単位 invalidation の厳密化（全 root 再設計を要するため。prefix collateral 許容で契約は閉じている）
