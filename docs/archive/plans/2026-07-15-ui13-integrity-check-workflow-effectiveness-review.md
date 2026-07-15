# Workflow Effectiveness Review: UI-13 在庫整合性検証画面（Public PR #5）

## Workflow Used

- Plan Packet / Test Design Matrix: [packet](2026-07-15-ui13-integrity-check.md) / [matrix](test-matrices/2026-07-15-ui13-integrity-check.md)
- 体制: Codex 機能実装（owner コピペ relay）+ Claude Sonnet visual polish（表示層限定の非重複 ownership、independent-review 前に一次実施）+ Fable Coordinator 裁定
- review: 独立 Sonnet plan rally 3 round、独立 Final Review（R3 Contract Audit、Ledger 全行突合）、targeted re-review ×2（Amendment 4 / 5 是正後、いずれも新規独立 context）
- gates: Contract Probe（plan 段階）、L1 full ×4、workflow-git 検査、hosted CI（`synchronize` 経由の final）、owner L3 + 実 operator 検証
- dogfood: D-038（Findings Freeze / Owner Effort Budget 実測 / L3 Eligibility）、D-046（承認カウンタ interface / Goal H3 形式）、D-043（CI `synchronize` + `cancel-in-progress` 初実測）

## What Worked

- Codex の fail-closed 停止が 4 回全て正当だった（Plan Commit 未記入、specta 属性欠落、compliance test 未登録、PK4）。誤実装の混入前に毎回止まった。
- owner L3 が automated test 圏外の Goal Invariant 違反を検出した: navigation 導線 disabled 残置は独立 Final Review（Ledger 全行 pass）を通過した後に、実機のサイドバーで初めて可視化された。review は「実装と doc の整合」を検証するが「利用者が画面に到達できるか」は検証していなかった。
- 実 operator 検証が語彙 finding を出した: 「DB在庫 / 移動合計」はラベルとして意味を運ばず、operator は差異の +/- 数字から意味を構成していた。是正後の遅延返信で新語彙「入出庫」の正しい読み（意図したメンタルモデルと一致）まで検証できた。operator 可読性は自動テスト不能で、実 operator が唯一の検証手段。
- 承認カウンタ dogfood: 全接点に「N 回目 / 予算 M + 利用者可視の完了 1 文」を付け、事前拡張した予算（4）ちょうどで完了。予算の可視化が Ready/merge 判断を軽くした。
- D-043 dogfood 成功: Ready 化 → `ready_for_review` run in_progress 中に API 経由 ref 更新 → `synchronize` run 起動 + 旧 run cancelled + 新 run success を初実測（PR #4 積み残し消化）。「通常の local hook 経路外の Ready 更新」という D-043 の想定経路がそのまま機能した。
- workflow-git の STATECAP gate が実際に cap 超過を検出した（下記参照）。gate 新設（PR #4）から 1 change 目で実効性が実証された。

## What Did Not Work

- 登録・生成義務の plan 列挙漏れが 4 件連発した（Amendment 1: specta 属性 / 2: compliance test 登録 / 3: traceability 再生成 / 4: navigation 到達導線）。全て同一 failure class「新規 command / 新設 doc / 新規 REQ / 新画面に付随する登録・生成義務の plan 段階での列挙漏れ」で、relay 空費・backtrack 1 回・L1 再走行の主因。checklist は memory 化済みだが template 未昇格。
- Contract Probe を「是正を仮適用しない状態」で回したため、登録後に初めて顕在化する specta 属性欠落を見逃した（probe は是正仮適用で end-to-end に回すべき）。
- 再走行 3 回目（Amendment 5 後）の forward materialize を state-only 単独 commit にして STATECAP 超過（forward 4 件目 / post-implementation 3 件目）。ready-hosted-final 遷移前の L1 full まで潜伏し、そこで merge evidence が作れない構造的 blocker として顕在化した。compression 規則（超過分は隣接 content commit へ相乗り）どおり承認記録 commit へ rebase 再構成して解消（audited content SHA は不変）。materialize commit 作成時に `check-workflow-git.sh` を即時実行していれば commit 時点で検出できた。
- transcript に幻の user メッセージ（存在しない文言決定を含む）が混入する事象が発生。owner の明示否認と実判断（Amendment 5）で解決し、memory 化済み。幻由来の内容を owner 決定として扱わない規律が機能した。
- backtrack ×2 により human-confirm 到達が 3 回になり、L1 full を 4 回走行した。いずれの backtrack も正当（Goal Invariant 違反 / 実 operator finding）だが、1 件目は plan 段階の列挙漏れ起源で予防可能だった。

## Issues Caught Before Implementation

- Contract Probe が specta `collect_commands` への integrity 2 command 未登録を検出（前提否定 → 是正を Scope 化）。
- plan rally R1: polish pass の Phase 整合、L3 差異注入の fault-injection 疑義（`create_product` の初期在庫 movement 記録を実証して確定）、remount/restart テスト追加（P1×2 / P2×1 / P3×2）。R2: Budget 超過理由の記録、D-043 の Design Sources 追記。R3 で収束。

## Issues Caught by Tests

- `design_compliance_test` が新設 75-ui doc の module 登録を要求（Amendment 2）。
- L1 の traceability drift 検査が 2 回検出（Amendment 3 の REQ-904 coverage 更新、到達テスト追加時の再生成）。
- workflow-git STATECAP gate が forward cap 超過を検出（ready-hosted-final 遷移前の L1、merge 前に封鎖）。

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| `integrity_cmd.rs` 既存 `test_fix_integrity_req904_empty_codes_validation` が本体を呼ばない tautological test（Final Review） | evidence quality（本 PR diff 外） | backlog（次に同ファイルを触る PR で実呼び化） |
| 75-ui §75.16 の navigation 除外旧記述残置（Amendment 4 後 re-review） | evidence quality（docs 整合） | 処方どおり 1 行訂正 + 生成物再生成 |
| Amendment 5 後 re-review | — | 新規指摘 0（範囲一致・ロジック不変・旧語彙残置 0 を確認） |

## Issues Caught by L3 / Owner / 実 Operator

- navigation 導線 disabled 残置 = Goal Invariant「利用者が画面から実行できる」違反（post-freeze exception 1、Amendment 4）。plan の列挙漏れ 4 件目であると同時に、Ledger に到達導線の契約行が欠けていた review 盲点。
- 語彙不通（post-freeze exception 2、Amendment 5）: 実 operator は「DB在庫 / 移動合計」から意味を構成できなかった。「チェックデジット不正」への疑問は synthetic テストデータの商品名であり画面文言 finding ではないことも切り分けた。

## Escaped / Late Findings

- STATECAP 超過は前セッション作成の commit に起因し、Ready 直前の L1 まで潜伏した（merge 前に封鎖、escape ではないが検出が遅い）。
- merge 後の escape は現時点でなし。

## Test Adequacy

Strong tests:

- 誤操作防御 3 点セット（`fixIntegrity` 引数 = 選択行のみ / select-all 不在 / 未選択 disabled）が Spec Contract と 1:1。
- Amendment 4 の到達テストは ui-11c 前例と同強度で、route 直 render テストが持つ「到達性を検証しない」盲点を機械的に塞いだ。
- Matrix 全行が UI-13-D1〜D8 / spec 行を cite し、Final Review が Ledger と実テストを突合できた。

Weak or missing tests:

- 到達性テストが当初 Matrix に存在しなかった（Ledger にも契約行がなかった）。到達導線を Ledger 標準行にする判断が必要。
- operator 語彙の可読性は機械検証不能。実 operator 検証を L3 の正式な検証面として扱う運用が続く。

## Signal / Noise

- 独立レビュー 3 回（Final + targeted ×2）は毎回異なる新規 finding を出しており redundant でなかった。高 signal。
- workflow-git の prefix WARN（docs/plans-only commit への注意喚起）は依然 noise 寄り。ただし STATECAP ERROR の隣接情報としては文脈を与えた。

## Cost / Friction

- useful cost: plan rally 3 round、Contract Probe、独立 Final Review + targeted re-review ×2、L3 + 実 operator 検証、D-043 dogfood。全て具体的欠陥の発見か契約の実証に直結。
- excessive friction: 登録義務列挙漏れ起源の Amendment 4 件と relay 空費、STATECAP 是正の rebase 再構成、L1 full 4 回走行のうち 2 回は予防可能な再走行だった。
- owner 実働: 介入 4 / 予算 4（既定 3 から事前拡張）、relay 3 / 上限 3（2→3 延長 1 回）。予算超過なしだが、両方とも上限ちょうどで余裕ゼロ。

## Retired / Consolidated Rules

- consolidate: 登録・生成義務 checklist（specta 登録 / specta 属性 / compliance test / traceability / navigation / route / doc 目次 / REQ coverage）は memory `project-registration-obligations-checklist` に集約済み。次の正本化は Plan Packet template の Required Design Artifacts への昇格（follow-up、workflow PR）。
- retire: なし（本 change で退役させた規範なし。D-038 / D-043 / D-046 の dogfood 対象規範は全て実測で有効性を確認し存続）。

## Recommended Workflow Adjustment

Keep:

- Ledger ベースの R3 Contract Audit と targeted re-review（backtrack 後の差分限定再レビュー）の組み合わせ。
- 実 operator 検証を operator 向け画面の L3 に含める運用。
- 承認カウンタ付き Human Gate と Owner Effort Budget の事前拡張（既定を黙って超えない）。

Change:

- Plan Packet template（Required Design Artifacts 付近）に「登録・生成義務の機械列挙」checklist を常設する。UI-13 の Amendment 1〜4 は全てこの 1 表で防げた。
- Contract Probe の標準手順を「是正を仮適用した状態で end-to-end」に明文化する。
- forward materialize commit を作ったら直後に `bash scripts/check-workflow-git.sh` を局所実行する（STATECAP 超過の即時検出。今回は Ready 前 L1 まで潜伏した）。

Follow-up:

- backlog: `integrity_cmd.rs` tautological test の実呼び化（P3-1）。
- Contract Coverage Ledger の標準行に「operator 到達導線」を含めるか、template 昇格時に判断する。

## Applied / Deferred Workflow Changes

Applied:

- なし（本 change は D-038 / D-043 / D-046 の dogfood であり、規範の新設・変更は行っていない）。

Deferred:

- 上記 Change 3 点（checklist template 昇格 / probe 手順明文化 / materialize 時の局所検査）は次の workflow docs PR で正本化する。
