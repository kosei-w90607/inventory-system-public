# Workflow Effectiveness Review: mechanical workflow slice 2（PR #166）

## Workflow Used

- Project Profile: `../../project-profile.md`
- Plan Packet: [2026-07-12-mechanical-workflow-slice2.md](2026-07-12-mechanical-workflow-slice2.md)（design と実装を単一 PR で完遂、Plan Commit `ca4a3f8`、plan-first）
- Test Design Matrix: [test-matrices/2026-07-12-mechanical-workflow-slice2.md](test-matrices/2026-07-12-mechanical-workflow-slice2.md)
- review-only sub-agent: 独立 Plan Reviewer（fresh context、Plan Gate R1-R3）、独立 Contract Auditor 2 pass 並列（Double Audit、fresh context・Writer 非兼任）
- external review: GitHub PR #166 上の可視 review オブジェクトなし（review 記録はすべて Plan Packet 内 append-only）
- human approval: Plan Gate 承認（hook 条件付き採用の裁定含む）、Ready 承認（human-confirm 兼、2026-07-13）、merge
- gates: `bash scripts/doc-consistency-check.sh --target plan`、`bash scripts/local-ci.sh full`、Contract Probe 3 本（Plan Gate 前）、pre-push 新規 git 検査（PK5/STATECAP 自己適用）、hosted CI（`Rust (fmt + clippy + test)` 集約 gate のみ FAILURE、実体 7 job は全 SUCCESS、無料枠切れによる infrastructure failure として owner disposition）

## What Worked

- Findings Freeze の初回 dogfood: Double Audit 完了（pass 1 + pass 2 両方）をもって Freeze が発効し、Freeze 後の post-freeze exception は 0 件。D-038 が意図した「初回 Broad Audit 後は closure 確認のみ」という設計が、初適用でそのまま成立した。
- Owner Effort Budget も初 dogfood で機能した: 介入 3 接点（Plan Gate 承認 / Ready 承認 / merge）に収まり、relay 往復は本 packet 自身が既定 2 から 0 へ引き下げた値どおり 0 で完了した。
- Contract Probe は Plan Gate 前に 3 本（PK5 の CI fetch-depth 前提、hook ロジック 4 ケース、state-only 分類方式の message-regex vs path ベース比較）を実施し、いずれも Plan Gate の実指摘に先行して事実を確定した。特に state-only 分類方式の probe は path ベースが 7 件（真値 3 件の倍以上）を過大計上することを実測で示し、Scope 4 の設計判断を実装前に固めた。
- state-only commit cap は自己適用でぴったり収まった: PR #166 の実 commit 列（`gh pr view 166 --json commits` で確認、12 commit）のうち `docs(plans): state-only遷移` prefix は 3 件（`1f6a653` plan-gate→plan-approved→implementing、`048ad64` implementing→local-verified→independent-review、`4bac6e2` independent-review→human-confirm→ready-hosted-final）、うち post-implementation 相当（transition-name token 判定）は後 2 件で、新設した上限（総3・post-impl 2）に一致した。
- Plan Gate R2 で新規指摘が「機械検出クラス」（Spec Contract の棄却済み定義残存、Phase 自己参照の未波及）と判定された際、rally 継続でなく `rg` 全箇所 sweep に即座に切替え、R3 で収束した。D-038 の drift-fix sweep 規律を Plan Gate 段階でも実践した初例。

## What Did Not Work

- Contract Probe が事前に検証した「PK5 の git 前提」probe そのものが、squash merge 後の SHA が dangling になり CI/新規 clone から到達不能になるという別の問題を見落としていた。この見落とし自体は probe 実施後、Plan Gate R1 で「dangling SHA を automated fixture に使う設計」として指摘されて初めて表面化した（後述 Escaped / Late Findings）。
- 実装後の Double Audit で P1 が 2 件検出された。うち 1 件（pass 1: PK1 拡張が archive packet の明示パス実行で遡及 ERROR）は anti-tautology gap（対応 test が実条件を再構成していなかった）であり、Contract Coverage Ledger の line-by-line 照合だけでは検出できず、mutation 系の追加検証で初めて捕まった。
- PR 本文の陳腐化（pass 2 P1: STATECAP を実装と逆の「順序ベース」と記載）が Double Audit まで残存した。実装は message-regex 方式で確定していたにもかかわらず、PR 本文がその後の設計転換を反映していなかった。
- GitHub 上に可視化された review オブジェクトは 0 件。Plan Gate 3 ラウンド + Double Audit 2 pass、計 5 ラウンド相当の review 実体がすべて Plan Packet 内 append-only 記録としてのみ存在し、PR タイムラインだけからは追跡できない。

## Issues Caught Before Implementation

- Contract Probe（Plan Gate 前）: state-only 分類の path ベース方式が PR #165 実データで 7 件と過大計上することを実測し、message-regex 方式を採用する根拠を実装前に確定。
- Plan Gate R1（2 lens 並列、契約 lens + workflow lens）: dangling SHA を automated fixture に使う設計、境界 fixture `4d3f5d1` の事実誤り、STATECAP post-impl 順序ベース判定の自壊、drift test が `decision-log.md:250` の既存再掲に即 fail、ほか計 P1×4/P2×5/P3×7 相当。全件実装コード着手前に検出され、5ef1ce6 で反映。
- Plan Gate R2: 新規 P1×1（Spec Contract に棄却済み順序ベース定義が残存）/ P2×1（Phase 現況の自己参照 3 箇所未波及）/ P3×1（同根）。機械検出クラス判定により rally でなく `rg` sweep で一括修正（1ae2134）。
- Plan Gate R3: 新規指摘ゼロで収束（P1/P2=0）。

## Issues Caught by Tests

- 新規 3 test（PK4/PK1 拡張 fixture、synthetic git fixture repo 方式の PK5/STATECAP、drift test）と既存 regression（pre-push / local-ci / classify-changes）が local-ci full 内で CLEAN 完走。
- テストが捕まえなかったもの: PK1 拡張の archive packet 遡及 ERROR（anti-tautology gap）は Double Audit pass 1 の人手 mutation 検証で初めて発覚し、自動テストの実条件再構成不足を機械テストだけでは検出できなかった。

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| STATECAP post-impl 判定の自壊（順序ベースだと plan-first commit を基準点と誤認）（Plan Gate R1、契約 lens P1） | accepted | message-regex + transition-name token 判定へ設計変更 |
| drift test が既存 `decision-log.md:250` の D-034 本文再掲に即 fail（Plan Gate R1、契約 lens P1） | accepted | `docs/decision-log.md` を除外対象に追加、negative fixture で確認 |
| dangling SHA の automated fixture 使用（Plan Gate R1、workflow lens P1） | accepted | synthetic git fixture repo 方式へ転換、実 SHA は probe 一次証跡のみに限定 |
| 境界 fixture `4d3f5d1` の事実誤り（Plan Gate R1、workflow lens P1） | accepted | plan-approved 前の gate 中修正であり gated amendment に非該当と訂正 |
| Spec Contract に棄却済み順序ベース定義が残存（Plan Gate R2、P1） | accepted | rg sweep で一括修正 |
| Phase 現況の自己参照 3 箇所未波及（Plan Gate R2、P2/P3） | accepted | 同上 sweep で解消 |
| PK1 拡張が archive packet 明示パス実行で遡及 ERROR + 対応 test の anti-tautology gap（Double Audit pass 1、P1） | accepted | archive packet を免除、test を実条件再構成に修正 |
| PR 本文の STATECAP 記載が実装と逆（Double Audit pass 2、P1） | accepted | PR 本文を message-regex 方式に訂正 |
| template `plan-packet.md` に `Amendments` field 未伝播（Double Audit pass 1、P2） | accepted | template に field 追加 |
| Contract Probe の `4d3f5d1` を gated amendment と誤ラベル（Double Audit pass 2、P2） | accepted | plan-approved 前の gate 中修正と訂正 |
| 「no-active-plan WARN のまま維持」の事実誤認（該当機構は未実装）（Double Audit pass 2、P2） | accepted | Scope 6・matrix・D-039 の該当記述を全箇所訂正 |
| enum 全値の positive 網羅欠落 / Amendments SHA 抽出の hex 誤検出脆弱性 / `check_plan_commit_ancestry` の section 非 scoped 抽出（Double Audit pass 1、P3） | 一部 accepted（enum網羅は同commit修正） / 残り follow-up | enum網羅のみ即時修正、他 2 件は follow-up 候補として記録 |

## Issues Caught by External Review

- GitHub review オブジェクトとして可視化されたものは 0 件（`gh pr view 166 --json statusCheckRollup` で確認できるのは CI 実行結果のみ）。Plan Gate 3 ラウンド + Double Audit 2 pass のレビュー実体は、すべて Plan Packet 内 append-only 記録としてのみ存在する。

## Escaped / Late Findings

- PK5 の git 前提を検証した Contract Probe そのものが、squash merge 後に検査対象 SHA が dangling 化し CI・新規 clone から到達不能になるという設計上の欠陥を見落とした。probe は「fetch-depth が shallow かどうか」という前提は検証したが、「probe で使った実 SHA 自体が squash 後も生き続けるか」は検証範囲外だった。この見落としは Contract Probe 実施後、Plan Gate R1（workflow lens P1）で初めて検出され、synthetic git fixture repo 方式への転換で是正された。Contract Probe の限界事例として記録する価値がある: 外部前提の実験検証は、実験に使うデータ自体の持続可能性まで検証範囲に含める必要がある。
- 実 PR SHA を automated fixture に使う設計は Contract Probe から Plan Gate R1 まで生き残った。Design Phase 段階では気づかれず、独立 Plan Reviewer による指摘で初めて転換点に到達した。

## Test Adequacy

Strong tests:
- synthetic git fixture repo（tmpdir 構築）による PK5/STATECAP の ancestry・state-only 分類 test は、squash merge 後の SHA 到達不能性という制約下でも正例/負例を再現可能な形で検証できた。
- drift test の negative fixture（`decision-log.md:250` の既存再掲を負例として仕込む）は、除外規則がなければ即 fail することを確認済み。

Weak or missing tests:
- PK1 拡張の archive packet 遡及 ERROR は、Contract Coverage Ledger の line-by-line 照合だけでは検出できず、Double Audit の mutation/anti-tautology 観点で初めて捕まった。テスト自体が実条件（archive packet への明示パス実行）を再構成していなかった。
- Amendments SHA 抽出の hex 誤検出脆弱性、`check_plan_commit_ancestry` の section 非 scoped 抽出は Double Audit pass 1 で P3 として記録されたのみで、本 PR では未修正のまま follow-up。

Mutation-style observations:
- Double Audit pass 1 の anti-tautology 検証で、archive packet への明示パス実行という実条件を外した状態のテストが誤って PASS していたことが判明し、実条件再構成後に正しく ERROR を検出するよう修正された。

## Signal / Noise

- sub-agent findings total: Plan Gate 3 ラウンド（R1 P1×4/P2×5/P3×7 相当 + R2 P1×1/P2×1/P3×1 + R3 新規0）+ Double Audit 2 pass（pass1 P1×1/P2×1/P3×3 + pass2 P1×1/P2×2）
- accepted: Plan Gate 全件、Double Audit の P1×2・P2×3 全件、P3 は enum 網羅の1件のみ同commit修正
- rejected: 0（一次証跡上確認できず）
- deferred: 3（Double Audit pass1 P3 の Amendments SHA hex誤検出 / `check_plan_commit_ancestry` section非scoped の2件、および既存 `check_signature_cross_reference` の pipefail 潜在バグ）
- question: 0

## Cost / Friction

- review rounds 内訳: Plan Gate 3（R1 broad + R2 機械sweep + R3 closure）+ 実装後 Double Audit 2 pass（並列、Findings Freeze の基準点）。UI-11c（PR #164、Plan Gate 2 + 実装後 7 = 計9）と比べ、実装後ラウンドは 7 → 2 に圧縮された。D-038 の Findings Freeze が初 dogfood で意図どおり機能したと言える。
- state-only commits / 総commit数: 3 / 12（新設 cap ちょうど自己適用で収まった。post-impl 2 / 総commit数 12）。
- Owner hands-on: 介入3接点（Plan Gate承認・Ready承認・merge）で Owner Effort Budget（介入上限3・relay上限0）内に収まった。hook（Scope 7）の sandbox 書込み制約による follow-up 降格判断も owner の追加手作業なしで Coordinator 裁定として完結した。
- hosted CI 儀式税: 集約 gate `Rust (fmt + clippy + test)` のみ無料枠切れで未起動 FAILURE、実体 7 job は全 SUCCESS。owner disposition（課金による枠拡張は費用対効果が低いため見送り、local-ci mirror を compensating evidence として受理）で merge まで進んだ。Hosted CI Requirement の運用がこの種の infrastructure failure を継続的に生む場合、D-039 revisit 候補としてどう扱うかは未確定のまま残る。
- 比較: UI-11c（PR #164）は差分規模+2896/-72・review 9ラウンド・review-only findings 実質25件超に対し、PR #166 は docs/scripts中心の変更でPlan Gate 3+Double Audit 2の計5ラウンド。規模・性質が異なるため round数の単純比較はできないが、Findings Freeze 導入後の実装後ラウンド数（2）はD-038が想定した「収束条件による抑制」の方向と整合する。

## Recommended Workflow Adjustment

Keep:
- Findings Freeze（Double Audit 完了をもって発効、post-freeze exception 0件）は初 dogfood で意図どおり機能した。継続する。
- Owner Effort Budget（介入3接点・relay0）と Contract Probe（3本、Plan Gate前の事実確定）は費用対効果が高かった。継続する。
- Plan Gate での機械検出クラス即時sweep切替は、R2→R3の収束を早めた。継続する。

Change（各々どの finding から導出したか）:
- **Contract Probe の射程拡張**: PK5 probe が「squash後dangling」という自身の限界を見落とした。Contract Probe の記録様式に「probe対象データ自体の持続可能性」を明示チェック項目として追加することを検討する。
- **PR本文鮮度チェック**: Double Audit pass2 でPR本文の実装との逆記載（STATECAP）が検出された。Findings Freeze発効前の必須チェック項目として「PR本文と実装の整合」を明記する。

Follow-up:
- hook（Scope 7）の `.claude/hooks/` + `settings.json` 統合登録: sandbox書込み制約により本PRでは完遂できず、follow-up PRへ降格確定。
- Amendments SHA抽出のstrict化（hex誤検出脆弱性）、`check_plan_commit_ancestry` のsection-scoped抽出、既存 `check_signature_cross_reference` のpipefail潜在バグ: Double Audit/W1発見のP3群、いずれも本PR scope外のfollow-up候補としてpacket Review Responseに記録済み。
- no-active-plan check の導入（WARN先行）: D-039 Revisit候補として次sliceへ据え置き。
- CI無料枠切れ下の Hosted CI Requirement の扱い: 本PRでは個別のowner dispositionで処理したが、同種のinfrastructure failureが繰り返す場合にHosted CI Requirementの既定をどう扱うかは未確定。D-039 Revisit候補として記録する。

## Applied / Deferred Workflow Changes

Applied（D-039、本PR `mechanical-workflow-slice2` で適用。詳細は[decision-log.md D-039](../../decision-log.md)）:
- PK4（`check_plan_packet_workflow_state` 新設）: Workflow State節の存在・13 phase enum・Risk/Execution Mode整合・Findings Freeze行（R3+）・active packet一意性・field関係検査（plan-approved以降でPlan Commit pending はERROR）。
- PK1拡張: 必須節に `## Owner Effort Budget`（R2+）・`## Contract Probe`（R3+）を追加。
- PK5（`scripts/check-workflow-git.sh` 新設）: Plan Commit ancestry検査、original不変+`Amendments:`追記型reconcileモデル、書き換え検出。pre-push/local-ci双方から無条件実行。
- state-only commit cap: 総3・post-impl 2、message-regex分類+transition-name token判定。
- drift test（`scripts/tests/reading-order-drift.test.sh`）: canonical reading order のAGENTS.md外再掲を検出。
- 正本昇格: PK5定義・gated amendment定義・state-only正規形・checker/drift test語彙対応をDEV_WORKFLOW.mdへ、D-039起票、D-034/D-035/D-038に前方参照追記。

Deferred:
- hook（Scope 7、Codex側の統合強制機構は元々non-scope）: sandbox制約によりfollow-up PRへ降格。
- Evidence Ownership機械検査、WARN→ERROR段階昇格、no-active-plan check導入、fable-window relay既定値（≤2）の改定要否: D-039 Revisit候補として記録のみ。

Not applied:
- WARN→ERROR段階の実際の昇格実施（本slice計画どおり非実施）。
- CI docsジョブへのPK5追加（shallow cloneのためContract Probe P1で不採用と確定）。
