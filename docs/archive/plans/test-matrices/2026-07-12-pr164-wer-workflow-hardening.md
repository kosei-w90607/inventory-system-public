# Test Design Matrix: PR #164 振り返り反映 — WER作成 + workflow規律のrepo昇格

> 親 packet: [../2026-07-12-pr164-wer-workflow-hardening.md](../2026-07-12-pr164-wer-workflow-hardening.md)

## Risk

Risk: R3

## Contracts Under Test

- SPEC-WF-FREEZE: Findings Freeze（初回 Broad Audit 完了後に凍結、R4/workflow gate の Double Audit は 2 回まとめて初回を構成）
- SPEC-WF-OWNER-BUDGET: Owner Effort Budget（介入 ≤3、実働 ≤30分、relay 往復 ≤2、超過時は Coordinator が簡略化）
- SPEC-WF-L3-ELIG: L3 Eligibility（Windows/Tauri ネイティブ限定・新規ツール導入禁止・手動故障注入級手順の排除）
- SPEC-WF-EVIDENCE: Evidence Ownership 拡張（テスト件数も volatile evidence）+ state-only commit 上限 3（うち post-implementation 2）
- SPEC-WF-ROLES: モデル slot 固定表の撤廃、独立性制約への置換
- SPEC-WF-PROBE: Contract Probe（不確実な外部前提の Plan Gate 前最小実験）

## Failure Modes

- Findings Freeze の文言が Double Audit の 2 回目を無意味化し、PR #159/#164 型の見落とし再発防止効果を失う
- Owner Effort Budget が数値目標のみで、超過時に誰が吸収するか（Coordinator vs Owner）が曖昧なまま残る
- L3 Eligibility が「実機確認は全部 L3」のような広すぎる表現になり、UI-11c L3-7/L3-8 型の手動故障注入手順を排除できない
- Evidence Ownership 拡張が既存 archive の historical narrative を遡及的に無効化してしまう（D-038 は今後の記述のみ適用という限定を失う）
- state-only commit 上限がWorkflow State の必須 2 遷移（`independent-review → human-confirm` / `human-confirm → ready-hosted-final`）と矛盾し、遷移表と数値上限が二重に定義されて drift する
- AGENT_OPERATING_MANUAL.md §3 の pipe table 削除時に、Fable 起用条件・design board 例外・Execution Mode 定義の prose が意図せず巻き込まれて消える
- モデル実名（Fable/Sol/Terra/Luna/Sonnet）が規範文へ再度紛れ込む（§3.4 用語集・decision-log・archive 以外）
- Workflow State の 13-phase enum 定義行が本 PR で意図せず変更される
- `docs/Plans.md` の「個別WERは新設せず」が更新漏れで残存し、新設した WER へのリンクが張られない
- `.claude/hooks/check-plan-on-exit.sh` の fallback 修正が、active plan が存在する通常経路の既存 ERROR 判定（プランの PK1-PK3 違反等）を弱めてしまう
- 新設 WER が `docs/templates/workflow-effectiveness-review.md` の必須見出し構成を継承せず、Cost/Friction 等の記録項目が欠落する
- D-038 が D-034/D-035 の実フォーマット（Decision/Status/Why/Impact/Alternatives considered/Revisit）と異なる要素名・欠落要素で記録され、decision-log の一貫性が崩れる

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| SPEC-WF-FREEZE / SPEC-WF-OWNER-BUDGET / SPEC-WF-L3-ELIG / SPEC-WF-EVIDENCE / SPEC-WF-ROLES / SPEC-WF-PROBE | 各契約の docs 記述に必須節欠落・placeholder 残存・リンク切れ | docs check | TM-1: `bash scripts/doc-consistency-check.sh` | exit code が 0 以外、または ERROR 件数 > 0 |
| SPEC-WF-FREEZE / SPEC-WF-OWNER-BUDGET / SPEC-WF-L3-ELIG / SPEC-WF-EVIDENCE / SPEC-WF-PROBE | 用語 5 語が定義なきまま他ファイルから参照される、または定義自体が漏れる | grep | TM-2: `rg -n "Findings Freeze\|Contract Probe\|Owner Effort Budget\|L3 Eligibility\|Evidence Ownership" docs/DEV_WORKFLOW.md` で各語 1 件以上の定義行を確認した上で `rg -rn "<各語>" docs/ .claude/ .github/` を実行 | `docs/DEV_WORKFLOW.md` に定義行が 0 件の語がある、または `docs/DEV_WORKFLOW.md` 以外での参照が全語について 0 件 |
| SPEC-WF-ROLES | モデル実名の規範文への再混入 | grep | TM-3: `rg -n '\bFable\b\|\bSol\b\|\bTerra\b\|\bLuna\b\|\bSonnet\b' docs/AGENT_OPERATING_MANUAL.md docs/DEV_WORKFLOW.md docs/templates/` の hit を `docs/AGENT_OPERATING_MANUAL.md` §3.4 表以外で確認。`docs/Plans.md` は規範文書ではなく履歴ダッシュボードのため全文走査せず、本 PR で追加・変更した行（`git diff main -- docs/Plans.md` の `+` 行）のみ同条件でチェックする（2026-07-12 より前の PR 進捗・履歴叙述行は対象外） | 除外対象以外の規範文、または `docs/Plans.md` の本 PR 追加・変更行で 1 件以上ヒットする |
| SPEC-WF-EVIDENCE（隣接） | Workflow State 13-phase enum の意図しない改変 | diff | TM-4: `git diff main -- docs/DEV_WORKFLOW.md` で `Phase`: の enum 定義行を確認 | enum 定義行に文字レベルの差分がある |
| bundle全体（Plans.md 閉loop同期） | 「個別WERは新設せず」の残存と WER 未リンク | grep | TM-5: `rg "個別WERは新設せず" docs/Plans.md` の件数確認 + `rg -n "2026-07-12-ui11c-pr164-workflow-effectiveness-review" docs/Plans.md` の件数確認 | 前者が 1 件以上残る、または後者が 0 件 |
| SPEC-WF-EVIDENCE | hook fallback が active plan 有無の両経路で誤動作する | 実行 + review | TM-6: `docs/plans/` に本 packet が存在する状態で `bash scripts/doc-consistency-check.sh --target plan` を実行し ERROR/WARN 判定を確認（active-plan-exists 経路）。`docs/plans/` を空にした経路は本 PR では実行せず、`.claude/hooks/check-plan-on-exit.sh` の fallback 分岐（`grep -q "チェック対象のプランファイルが見つかりません"` 一致時のみ通常 full check へ fallback）を目視レビューで確認する | active-plan-exists 経路で既存 ERROR 判定が変化する、または fallback 分岐の条件が「見つかりません」以外の exit 2 ケースまで誤って拾う |
| bundle全体（WERテンプレ準拠） | WER が template の必須見出し構成を継承せず記録項目が欠落する | grep | TM-7: `rg -o '^## .*' docs/templates/workflow-effectiveness-review.md` で全見出しを列挙し、各見出しについて `rg -qF "<見出し>" docs/archive/plans/2026-07-12-ui11c-pr164-workflow-effectiveness-review.md` を確認 | テンプレの `## ` 見出しのいずれかが WER ファイルに存在しない |
| bundle全体（D-038 記録フォーマット） | D-038 が D-034/D-035 実フォーマットと異なる要素名・欠落要素で記録される | grep | TM-8: `awk '/^## D-038/{f=1;next}/^## D-/{f=0}f' docs/decision-log.md \| rg -c "^- (Decision\|Status\|Why\|Impact\|Alternatives considered\|Revisit):"` の一致件数を確認 | 一致件数が 6 未満、または `## D-038` セクション自体が存在しない |
| SPEC-WF-ROLES | §3.1〜3.3 の pipe table 削除時に、存置すべき prose 3 点（design board 例外 / Execution Mode 定義 / 希少・高コスト slot 投入条件）が意図せず巻き込まれて消える | grep | TM-9: `rg -n "design-only" docs/AGENT_OPERATING_MANUAL.md`（design board 例外の残存）、`rg -c "Execution Mode" docs/AGENT_OPERATING_MANUAL.md`（hit ≥ 1、3 値定義の残存）、`rg -n "希少・最高能力" docs/AGENT_OPERATING_MANUAL.md`（希少・高コスト slot 投入条件の残存）を確認 | 3 点のいずれかの anchor 語句が §3 全面書き換え後に見つからない |

## Data Safety Checks

- source-derived data: 非接触（docs のみ）
- generated outputs: 非接触
- secrets: 非接触
- local-only files: 非接触
- synthetic sample boundaries: 該当なし

## Residual Test Gaps

- TM-6 の空 active-plan 経路（`docs/plans/` が空の状態）は本 PR では実行しない。本 packet 自体が active plan として存在するため実測できず、fallback 分岐のロジックレビューに留める。次に `docs/plans/` が一時的に空になる機会（本 packet の archive 直後等）での実測が residual gap
- SPEC-WF-FREEZE の Double Audit「まとめて初回」扱いの実効性は、本 PR 自身が R3/workflow gate change として Double Audit を経ることで初回実証となる。長期的な再発防止効果は次の UI-13 WER で検証する
- SPEC-WF-L3-ELIG は本 PR に画面変更がないため L3 実測なし。次の operator-facing R3 change が実地の dogfood target
- TM-9 の anchor 語句（`design-only` / `Execution Mode` / `希少・最高能力`）は §3 書き換え実装前の想定文言であり、Slice B の実装が異なる model-neutral 表現を選んだ場合は independent-review での目視確認に留まる
