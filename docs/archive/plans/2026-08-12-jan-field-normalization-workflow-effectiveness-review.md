# Workflow Effectiveness Review: JAN 専用欄正規化（design PR #67 + 実装 PR #68）

対象: design-first PR #67（squash merge `f26ab51`、2026-08-11）+ 実装 PR #68（squash merge `5976b3f`、2026-08-11）。起票の直接契機は、実装 packet 初稿が「誤配された引き継ぎを起点に Codex が正式発注フロー外で起草した」変則 provenance であり、その監査採用フローの効果を記録すること。D-062 (c) 編成そのものの評価は [formation WER（2026-08-04）](2026-08-04-d062c-formation-workflow-effectiveness-review.md) が正本であり、本 WER は編成評価を繰り返さず、本 change 固有の新規事象のみ扱う。

## Workflow Used

- 編成: Fable Coordinator（監査・裁定・state 管理）/ Codex Writer（実装）/ Sonnet 5 independent Plan+Final Reviewer（D-062 (c) 適合）
- 変則点: 実装 packet 初稿は Codex の正式発注フロー外起草。Coordinator が再起草せず「監査採用フロー」で処理 — Sonnet 一次監査 12 観点（Ledger 継承 / fixture 置換対象表 / golden 2 profile / 既存 test 凍結 / scope 整合 / 編成 D-062 / Coordinator 所有 field / D-062 数値主張 / fixture sweep / Plans.md 導線 / commit 体裁 / 幻覚検査）+ Coordinator による fixture sweep 独立再実行 + Draft Provenance の packet 記録
- gates: Plan Gate rally（2 round 収束）、owner plan 承認、Writer mutation 自己実測 + Coordinator 独立再実測（注入形独自設計）、independent Final Review、owner L3、exact-HEAD 三点一致
- packets: [実装 packet](2026-08-11-jan-field-normalization-implementation.md) / [design packet](2026-08-11-jan-field-normalization-design.md)

## What Worked

- **誤配起草 packet の監査採用フロー**: 再起草せず監査 12 観点で P1 = 0 を確認し、是正 5 点（golden 2 profile 転記 / frontend sweep 実測 embed / Coordinator 再実行記録 / Draft Provenance / commit subject）で採用。Plan Gate rally は 2 round で収束（formation WER の rally 天井 3 以内）し、再起草 cost を回避しつつ品質を維持した。Draft Provenance 記録により provenance の追跡可能性も確保。
- **捏造引用の refute 規律**: rally round 1 P3-2 が design 正本の「None通過」なる文言を引用したが、`rg` 0 hit の捏造引用と実読で判明。前提を refute し evidence 紐付け欠如のみ accept、round 2 の独立再検証で裁定 VERIFY。reviewer-claims-need-reproduction 規律が plan-gate 段でも機能した実例。
- **mutation 独立再実測の非対称価値**: X11 主形（adapter が BIZ core を流用）が `pub(super)` 可視性による compile-time 遮断（E0603）で防がれることを発見 — Matrix 想定の diff guard より強い構造保証の実証は、Writer 報告の追認ではなく独自注入の再実測でしか得られない。X5/X6/X7 は等価でない変形（index shift 等）でも red を確認し、注入形依存の kill 主張を排除した。
- **design-first 凍結義務の継承**: Ledger「実装 PR への予約」・fixture 置換対象表・golden 2 profile・既存 test 凍結が Writer 実装で drift 0。fixture sweep の実測コマンド + 出力 embed が Writer / Reviewer / Coordinator 三者の検証共通基準として機能した。
- **予算実績**: 介入 3/3・relay 1/2（発注 1 回のみ、fail-closed 停止 0 — 発注書環境節 + Coordinator の事前 state 整備〈Plan Commit 記入・implementing 遷移〉の効果）・STATECAP forward 3/3。

## What Did Not Work

- **Coordinator の誤診断 1 件**: root `Plans.md` を「公開スナップショット以来 stale の複製」と誤認し、owner への是正提案 → owner 指示 → backlog 起票まで進んだ。着手時実測で実体は docs/Plans.md への symlink（mode 120000）と判明し作業なしで終結（`3b0a1cd`）。`git log` の静止と `diff --stat` の行数差を複製の証拠へ昇格させた観測盲点で、owner の判断時間を浪費した（軽微だが実害）。memory `symlink-before-stale-duplicate-claim` へ教訓化済み。
- **reviewer 幻覚は plan-gate でも発生し続ける**: 捏造引用は refute 規律で吸収できたが、実装レビューだけでなく docs-only の plan review でも file 引用ごと幻覚する前提が再確認された。
- **X2 の mutation adequacy gap**: helper `normalizeComposedDigits` 内部 guard の単独破壊は call-site guard 重複（defense-in-depth）で素通し（両 guard 同時撤去では red）。helper は PR #65 既存コードで本 PR diff 外のため production 欠陥ではないが、helper 単体の直接 unit oracle が無いことが判明した。

## Issues Caught Before Implementation

- rally round 1: P2-1（Draft Provenance の是正内訳未記録）/ P3-1（BIZ validator の file path 未指定 — Writer 裁量の残存）。発注前に発注書曖昧性を除去した。
- 一次監査: commit subject 非標準（`docs(plan):`）等の体裁逸脱を採用前に是正。

## Issues Caught by Tests

- Writer の design compliance gate が実装中に未文書化 public 関数を検出し、`pub(super)` へ可視性を狭めて再 green 化（Writer 報告、Final Review が実装で裏取り）。この可視性是正が結果として X11 の compile-time 遮断を成立させた。

## Issues Caught by Review-only Sub-agent

- Final Review: Contract Coverage Ledger 13/13 適合、P1/P2 = 0、P3×1 = compositionend 二重発火が jsdom で exercise 不能（Matrix Residual Test Gaps 開示済み）。裁定 = 追加対応不要、L3-2 を実機優先確認へ変換 — 残存 gap を Human Gate の焦点指定に翻訳する処理が機能した。

## Issues Caught by External Review

- owner L3: L3-1〜L3-11 全件 PASS（優先指定した L3-2 二重入力なしを含む）。L3 起点の新規 finding 0。

## Escaped / Late Findings

- merge 後の product / runtime escape は確認されていない。
- workflow 側の誤診断（symlink）は次タスク着手時の実測まで潜伏した。検証手段（file type 確認）を欠いた主張が owner 判断まで到達した点が escape に相当する。

## Test Adequacy

Strong tests:

- golden 2 profile の独立転記 oracle + 偶奇反転 kill case の設計段階指定（survivor 値 `4901234567894` / `96385074` を kill case から排除済み）— 実測で全 class kill。
- fixture 置換対象表の実測 embed（旧 literal 0 hit / frozen 残存の再測定条件つき）。

Weak or missing tests:

- helper `normalizeComposedDigits` 単体の unit oracle（X2 注記）。新規 backlog は作らず、同 helper を将来変更する PR で unit test 同時新設を要求する（packet Review Response の注記が正本）。
- jsdom の composition 二重発火再現（開示済み、L3 が最終防衛線であることを継続認識）。

## Signal / Noise

- rally findings 3 件 = accept 2 + partial refute 1（捏造引用）。noise 起因の round 増 0、2 round 収束。
- Final Review P3 1 件は真の残存 gap の開示確認で、false positive 0。
- 監査 12 観点の指摘（P2×2 + P3×2）は全件 actionable で、監査層の noise 0。

## Cost / Friction

- subagent 5 本（一次監査 1 / rally 2 / Final Review 1 / mutation 再実測 1）+ Codex 発注 1。
- rally 2 round + Final 1 回で収束、backtrack 0、gated Amendment 0。
- 誤診断による owner 往復 1（本来不要だった指示・確認）。

## Recommended Workflow Adjustment

Keep:

- 誤配起草 packet の監査採用フロー（監査 12 観点 + Coordinator 独立再実行 + Draft Provenance 記録）。再起草より安価に P1 = 0 を達成し、rally 収束も速かった。
- mutation 独立再実測の「注入形独自設計」原則（Writer 注入形の非参照）。X11 の構造保証発見はこの原則の直接成果。

Change:

1. **変則 provenance packet の監査手順の再利用可能化**: 今回の 12 観点 checklist は同型再発（フロー外起草・引き継ぎ事故由来の artifact）にそのまま適用できる。AGENT_OPERATING_MANUAL への昇格は formation WER Deferred の workflow docs PR に同送して判断する。
2. **「不在・stale・複製」主張の前の file type 確認**: `eza -l` / `git ls-files -s`（mode 120000）の先行確認を Coordinator 自己検証手順へ含める。memory 化済み、正本化は同上の workflow docs PR で判断。

Follow-up:

- formation WER（2026-08-04）Deferred の workflow docs PR（Change 1〜4 正本化 + rally round 天井の owner 裁定）は本 WER 起票時点で未起票。上記 Change 1・2 の正本化判断はそこへ同送する。

## Retired / Consolidated Rules

- 「正式発注フロー外で起草された packet は再起草が既定」という暗黙前提を退役する。第一選択は監査採用（provenance 記録 + 全観点監査 P1 = 0 + Coordinator 独立再実行）とし、再起草は監査 fail 時の fallback へ統合する。

## Applied / Deferred Workflow Changes

Applied:

- 本 WER 起票により PR #67 / #68 closeout の WER 起票判断を消化した。
- 誤診断の教訓は memory `symlink-before-stale-duplicate-claim` として適用済み。X2 adequacy 注記は実装 packet Review Response に記録済み（新規 backlog は作らない）。

Deferred:

- Change 1・2 の正本化は formation WER Deferred の workflow docs PR へ同送。

Not applied:

- フロー外起草の禁止強化（fail-closed 側の追加ガード）。今回の監査採用で品質担保が成立したため、禁止よりも監査手順の再利用可能化が適切と判断した。
