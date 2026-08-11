# WER Deferred workflow docs 正本化 Plan Packet

## Workflow State

- Phase: human-confirm
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: 0b36e7a
- Amendments: none
- Coordinator: Fable 5（main thread / owner relay）
- Writer: Codex（本 branch の実装担当）
- Plan Reviewer: Sonnet 5（independent / fresh context）
- Final Reviewer: Sonnet 5（independent / fresh context、workflow gate change のため Double Audit）
- Reviewed Content HEAD: 0250c51
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: owner plan approval（消化済み 2026-08-12、介入 2/3。§5.6 縮小裁定の追認を含む）; Ready/merge approval（Windows native L3 なし — operator 可視挙動の変更を含まない workflow docs change）

STATECAP 予算 3 本設計（state-only 遷移 commit）: ① `plan-gate -> plan-approved -> implementing`（発注直前に一括実体化）② `independent-review -> human-confirm` ③ `human-confirm -> ready-hosted-final`。その他の遷移は content commit 同乗。各 forward materialize 直後に `bash scripts/check-workflow-git.sh` を実行する。

## Owner Effort Budget

- 介入回数上限: 3（消費 1 = 2026-08-12 の owner 裁定 3 問〈天井 3 正本化 / manual 発注 profile 節へ / 一般化新設〉）
- 実働時間上限: 30分
- relay 往復上限: 2
- Plan Review round 天井: 3（本 packet が正本化する運用の self-dogfood）

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

owner relay では本 Packet / Matrix と reviewer findings を会話で中継し、target branch に発注書専用 commit を混ぜない。

## Risk

Risk: R3

Reason:
`docs/DEV_WORKFLOW.md`（merge gate / review workflow の正本）・`docs/AGENT_OPERATING_MANUAL.md`・発注書 / packet template を書き換える workflow gate change。誤った正本化は以後の全 change の運用を誤導する。diff は docs-only（scripts / product code / CI yml 不変）だが、workflow contract の docs-only change は `docs/ci.md` の分類により hosted final required。

## Goal

Goal Invariant:

formation WER（2026-08-04）Deferred の Change 1〜4 と JAN WER（2026-08-12）の Change 1〜2 を、先行 dogfood 実測の裏付きで tracked 正本（DEV_WORKFLOW / AGENT_OPERATING_MANUAL / templates / decision-log）へ昇格し、発注書直書き・memory 頼みの運用を repo 正本参照に置き換える。既存規範の文言（drift test が保全する token を含む）は削除・改変しない。

### 最小完了条件

- 6 項目それぞれの正本化文言が対応 doc に存在し、AC の drift anchor（`rg -c`）で機械検証できる。
- rally round 天井 3 と到達時 disposition 切替が DEV_WORKFLOW Review Rules + Owner Effort Budget + plan-packet template の 3 点で整合する。
- Writer 発注書共通の出力契約（STATECAP canonical subject 遵守・正規 state-only commit によらない narrative 遷移主張の禁止）が AGENT_OPERATING_MANUAL §5 に新設され、§5.4（read-only slot 専用 profile）とは独立の節として区別される。
- 変則 provenance packet の監査採用手順が JAN 固有語彙を含まない一般化カテゴリで新設される。
- decision-log D-065 が本正本化の決定・根拠 WER・rollback を記録する。

### 失敗定義

- 既存規範文言（`candidate safety` / `mutation authority` / `goal-drift signal` / `one-shot irreversible` / `task-shape` 等の drift test 保全 token）を消す・書き換える。
- §5.4（高自律・低制約適性 slot 専用、Writer / state 遷移に割り当てない）へ Writer 向け契約を混入させる。
- 天井を hard cap ではない曖昧表現、または disposition 切替なしの単純打ち切りとして書く（owner 裁定 = 天井 3 で正本化、到達時は disposition 裁定へ切替）。
- JAN 固有語彙（golden 2 profile 等）を監査手順の正本へそのまま転記する。

### 非目的

- 新しい workflow 規則の発明（本 change は両 WER の Recommended Workflow Adjustment の転記・正本化のみ。文言の一般化は行うが運用の意味は変えない）。
- checker / drift test / scripts の変更（docs-only。既存 test はそのまま green であること）。
- §5.4 low-constraint profile・§5.5 相談窓口・Wave Operation 規則の変更。
- Writer 発注書の専用 template file 新設（owner 裁定 = manual の発注 profile 節へ追記、テンプレ新設なし）。

## Scope

### W1 — DEV_WORKFLOW.md（3 箇所、いずれも既存 bullet 無改変の append）

- Review Rules 節へ rally round 天井の新 bullet: 反復 plan / contract review（rally）は同一 reviewer 系での round 数 3 を天井とし、到達時は Coordinator が残 findings の disposition 裁定（同型指摘の一括是正 / backlog 化 / owner escalation）へ切替える。天井は per-change の Owner Effort Budget 行として packet に記載する。根拠 = formation WER（長 rally 5 件すべて Coordinator 起草起因、vendor 非依存）。
- Review Rules 節へ file type 確認の新 bullet: file の不在・stale・複製・乖離を finding や是正提案として主張する前に、`eza -l`（symlink 矢印）または `git ls-files -s`（mode `120000`）で file type を確認する。`git log` の静止と `diff --stat` の行数差は symlink でも同じシグネチャを示すため単独では複製の証拠にならない（JAN WER の root Plans.md 誤診断起源）。既存の irreversible finding 4 条件 bullet は変更しない。
- Plan Packet Rules 節へ Coordinator 是正 sweep の新 bullet: packet の契約・前提を是正する commit の前に、同一 packet（と対応 Matrix・Plans.md entry）内を旧前提の keyword で `rg` 全節 sweep し、残存を同 commit で是正する。Contract Audit 節の Drift-fix sweep（review finding 起因の repo 横断 sweep）とは対象が異なる（こちらは Coordinator 自身の packet 内是正の完全性）ことを 1 文で明記。

### W2 — templates（2 file、append のみ）

- `docs/templates/plan-packet.md` Owner Effort Budget skeleton へ `- Plan Review round 天井: <N>（既定 3）` 行を追加（既存 3 行と同じく DEV_WORKFLOW 参照の形）。
- `docs/templates/subagent-review-packet.md`: Sub-agent Prompt の `## Findings` 出力契約へ「各 finding に具体的修正案（smallest safe fix）を必須添付。修正案なしの finding は Coordinator が受理せず差し戻す（DEV_WORKFLOW Review Rules 準拠）」を明記し、`## Output Required` 節にも同旨を 1 文追加。既存の書式行（`P2 - confidence: ...`）は変更しない。

### W3 — AGENT_OPERATING_MANUAL.md §5 へ 2 節新設（既存 §5.1〜5.5 無改変）

- §5.6「従来型 Writer 発注書の共通出力契約」新設: 従来型（手順込み）発注書で Writer に実装を発注する際、発注書に state-only 遷移 commit の canonical subject（`docs(plans): state-only遷移 <from>-><to>` / `state-backtrack`、正本 = DEV_WORKFLOW Workflow State 節）の遵守と、遷移の実体化は正規の state-only commit で行い narrative 記述のみで遷移を主張しないこと、を明記する義務を正本化（formation WER Change 4 — PR #61 P2-1 の非 canonical subject と PR #60 の narrative backtrack の再発防止）。遷移 commit の作成主体（Writer / Coordinator の分担）は既存正本（DEV_WORKFLOW L126）と per-change packet の定めに従い、本節では変更しない（rally round 1 P1 — 当初案の「Coordinator 所有」明文化は WER が支持しない規則発明のため縮小）。§5.4 は read-only slot 専用 profile であり本節の対象外であることを冒頭 1 文で区別。
- §5.7「変則 provenance packet の監査採用手順」新設（一般化カテゴリ、owner 裁定 = 一般化して新設）: 正式発注フロー外で起草された packet（引き継ぎ事故・誤配・自発起草由来の artifact）は、再起草を既定とせず次の監査で採用可否を判定する — ①設計正本の凍結義務・予約事項の継承 ②scope 整合 ③編成の D-062 適合 ④Coordinator 所有 field の越権不在 ⑤数値主張の D-062 準拠（実測併記 or 未実測タグ） ⑥packet が依拠する基幹実測の Coordinator 独立再実行 ⑦導線・登録義務 ⑧commit 体裁 ⑨事実主張の幻覚検査（引用 file:line の実在）。採用条件 = P1 相当 0 + 指摘の是正、採用時は Draft Provenance を Workflow State に記録、監査 fail 時は再起草へ fallback（JAN WER — 「フロー外起草は再起草が既定」の退役を正本化）。

### W4 — decision-log D-065 新設 + 検証

- D-065: 両 WER の Recommended Workflow Adjustment 6 項目の正本化決定（Decision / Status / Why〈先行 dogfood 実測の要約と WER 参照〉/ Impact / Alternatives considered〈天井 soft 運用・§5.4 混載・実例転記の各不採用〉/ Rollback〈本 commit revert のみ〉/ Revisit）。
- 検証: doc-consistency 全通過、`scripts/tests/` drift test 一式 green（既存 token 保全の確認）、AC の drift anchor 実測。

## Non-scope

- 「非目的」に同じ。scripts / `.github/workflows/` / product code / bindings は diff 0。

## Acceptance Criteria

- AC1: 6 項目（formation WER Change 1〜4 + JAN WER Change 1〜2 = 6。Contract Coverage Ledger は doc 単位でさらに細分し 8 行）の drift anchor が各対応 file で `rg -c "<anchor literal>"` = 期待 count（baseline 0 → 追記後 1。anchor は Matrix に Coordinator が仮確定済み、Writer は一意性確認と必要最小限の特定化のみ）。
- AC2: 既存保全 token（`candidate safety` / `mutation authority` / `goal-drift signal` / `one-shot irreversible` / `task-shape`）が `rg -c` で変更前 count を維持。
- AC3: `bash scripts/tests/doc-consistency-plan-packet.test.sh` を含む `scripts/tests/` の drift test 一式 green + `bash scripts/doc-consistency-check.sh` 全チェック通過。
- AC4: `git diff --name-only` が docs/ 配下（DEV_WORKFLOW / AGENT_OPERATING_MANUAL / templates 2 file / decision-log / 本 packet / Plans.md）のみ。
- AC5: mutation X1〜X3 の一時削除で AC1/AC2 の対応 `rg -c` 検査が期待値から外れることを実測し復元（Writer 自己実測 + Coordinator 独立再実測）。

## Design Sources

- formation WER: `docs/archive/plans/2026-08-04-d062c-formation-workflow-effectiveness-review.md` L89-96（Change 1〜4 と Follow-up。Change 1・3・4 は describeError PR #63 で発注書直書きの先行適用済み、正本化のみ残存）。
- JAN WER: `docs/archive/plans/2026-08-12-jan-field-normalization-workflow-effectiveness-review.md` L74-78（Change 1〜2 と同送指示）。
- 既存規則の転記元: `docs/DEV_WORKFLOW.md` L344（fix-proposal 義務、Review Rules 既存）。
- owner 裁定（2026-08-12、介入 1/3）: 天井 3 で正本化 / manual の発注 profile 節へ（テンプレ新設なし）/ 監査手順は一般化して新設。
- 置き場所の訂正記録: owner 裁定時の選択肢文言は「§5.4 profile へ追記」だったが、実読（§5.4 L154-156・§3 L36）により §5.4 は read-only slot 専用で Writer / state 遷移に割り当てない旨が明文のため、裁定意図（manual §5 の発注 profile 節・テンプレ新設なし）を §5.6 新設で実現する。plan 承認時に owner へ明示確認する。
- 「目安」qualifier の扱い: formation WER 原文 L89 は「目安の天井」だが、owner 裁定（2026-08-12）は soft 運用の選択肢を明示的に不採用とし hard cap 化を選択したため、正本化文言では qualifier を落とす。到達時の disposition 切替（一括是正 / backlog 化 / owner escalation）が排出弁として実質的な柔軟性を保持する（rally round 1 P2-3 の判断記録）。
- §5.6 の範囲縮小記録: 当初案の「state 遷移は Coordinator 所有」明文化は、DEV_WORKFLOW L126（`The Writer updates this section at each materialized tracked transition.`、実測引用）の現行正本と矛盾し、formation WER Change 4 の支持範囲（canonical subject 追記のみ）を超える規則発明だったため削除（rally round 1 P1 裁定 = 選択肢 b）。作成主体の分担は per-change packet の定めに残す。

## Required Design Artifacts

- 追加の設計 doc 新設は不要（decision-log D-065 と各正本への追記のみ）。

## Registration / Generation Obligations

- 生成物なし（bindings / routes / traceability 対象外）。新規 command / route / 画面なし。

## Design Intent Trace

- formation WER Change 1〜4（rally 長期化の根本 = Coordinator 起草品質 / enforcement 欠落 / state 逸脱 2 件）→ W1 / W2 / W3 §5.6。
- JAN WER Change 1〜2（変則 provenance の監査採用初運用 / symlink 誤診断）→ W3 §5.7 / W1 file type bullet。
- 「フロー外起草は再起草が既定」の退役（JAN WER Retired Rules）→ §5.7 の採用第一・再起草 fallback。

## Design Intent Audit

- 全追記が append-only であり、既存規範の意味変更を含まないことを diff で検証可能にする（AC2 + AC4）。
- 天井・disposition・budget 行の 3 点（DEV_WORKFLOW 2 箇所 + template 1 箇所）が同じ値・同じ運用を指すことを Trace Matrix で拘束。

## Impact Review Lenses

- 以後の全 change の Plan Gate 運用に影響（天井・修正案必須・sweep 手順）。誤導リスクは Non-scope の「意味を変えない転記」制約と rally で防御。
- 発注書作成（Coordinator 業務）への影響: §5.6 / §5.7 は既に実運用している手順の正本化であり、新規負担を生まない。

## Design Readiness

- source design sufficient。全 6 項目は両 WER に実測裏付きで記録済みであり、本 change は転記・一般化のみ。

## Contract Probe

current HEAD（`bdb248d` 起点 branch）実測。

fix-proposal 義務の既存正本（転記元、`rg -n 'fix proposal' docs/DEV_WORKFLOW.md`）:

```text
344:- For iterative plan or contract review, each finding must attach a concrete fix proposal; the reviewer and Coordinator then use mutual adjudication, and the reviewer retains an objection channel when the proposed disposition would leave the contract unsound (backup/migration design WER lesson).
```

rally 概念の未正本化（`rg -c 'rally' docs/DEV_WORKFLOW.md` = 0 hit、exit 1）→ 天井の追記は新設であり既存文言との衝突なし。

review-packet template の現行 Findings 出力契約（`bat -p --line-range 183:192 docs/templates/subagent-review-packet.md`）: 書式行 `P2 - confidence: medium - path:line - issue / impact / smallest safe fix` は存在するが、修正案の必須義務と差し戻し運用の明文はない。

§5.4 の対象限定（`bat -p --line-range 154:156 docs/AGENT_OPERATING_MANUAL.md` + §3 L36）: 「高自律・低制約適性 slot への発注書はこの profile を用いる」「read-only の Reviewer / Explorer 発注書ロール専任とし、Writer / Coordinator / state 遷移管理に割り当てない」— Writer 向け契約の追記先として不適合。従来型発注書は「他 slot 向けに従来どおり使用する」（L164）とあり専用節が存在しない → §5.6 新設が整合的。

decision-log の最新番号（`rg -n '^## D-06[0-9]' docs/decision-log.md | tail -1`）= `503:## D-064` → 新設は D-065。

## Contract Coverage Ledger

| # | 契約 | 担保 |
|---|---|---|
| 1 | rally round 天井 3 + disposition 切替の正本化（DEV_WORKFLOW / Budget / template の 3 点整合） | W1 + W2 + M-W1/M-W2 + X1 |
| 2 | reviewer 発注書 template への修正案必須 + 差し戻し明文 | W2 + M-W3 + X2 |
| 3 | Coordinator 是正 sweep 手順（Drift-fix sweep との区別明文） | W1 + M-W4 |
| 4 | Writer 発注書共通出力契約（canonical subject 遵守 / narrative 遷移主張の禁止）を §5.6 新設、§5.4 と区別・L126 無改変 | W3 + M-W5 + X3 |
| 5 | 変則 provenance 監査採用手順の一般化 §5.7 新設（JAN 固有語彙なし） | W3 + M-W6 |
| 6 | file type 確認 bullet（不在・stale 主張前） | W1 + M-W7 |
| 7 | 既存規範 token の無改変 | AC2 + M-W8 |
| 8 | D-065 記録 | W4 + M-W9 |

## Test Plan

Test Design Matrix: [2026-08-12-workflow-docs-wer-deferred.md](test-matrices/2026-08-12-workflow-docs-wer-deferred.md)

- 検証は drift anchor（`rg -c`）+ 既存 drift test 一式 + doc-consistency。anchor literal は Matrix で固定し、Writer は実装時に anchor の一意性（`rg -c` が repo 全体で期待 count）を確認する。
- mutation X1〜X3 は Writer 自己実測 + Coordinator 独立再実測。

## Boundary / Wire Contract

- docs-only。scripts / CI / product code との wire なし。drift test（`scripts/tests/doc-consistency-plan-packet.test.sh` の D-046 token 群）が保全する既存文言に対し append-only で接する。

## Review Focus

- 転記が両 WER の原文の意味を変えていないか（特に天井の disposition 3 択と §5.7 の採用条件）。
- §5.6 と §5.4 / §5.5 の境界が明確か（read-only slot と Writer の混同を誘発しないか）。
- anchor literal の一意性（汎用語 anchor の cross-hit 素通し防止）。
- 既存 token の保全（AC2）。

## Spec Contract

- SPEC-WD-1: rally round 天井は 3、到達時は Coordinator が disposition 裁定（同型指摘の一括是正 / backlog 化 / owner escalation）へ切替える。per-change の値は Owner Effort Budget に記載。
- SPEC-WD-2: 反復 plan / contract review の各 finding は具体的修正案必須。修正案なしは Coordinator が差し戻す。
- SPEC-WD-3: packet 是正 commit 前に同一 packet 内の旧前提 `rg` 全節 sweep を行う。
- SPEC-WD-4: 従来型 Writer 発注書は state-only 遷移 commit の canonical subject 遵守と「正規 state-only commit によらない narrative のみの遷移主張の禁止」を明記する（作成主体の分担は per-change packet の定めに従う）。
- SPEC-WD-5: フロー外起草 packet は §5.7 の監査（9 観点）で採用可否を判定し、採用時は Draft Provenance を記録、fail 時は再起草。
- SPEC-WD-6: 不在・stale・複製の主張前に file type 確認（`eza -l` / `git ls-files -s`）を行う。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-WD-1 | W1/W2 | M-W1/M-W2 | 3 点整合 | rg anchor + X1 |
| SPEC-WD-2 | W2 | M-W3 | 差し戻し明文 | rg anchor + X2 |
| SPEC-WD-3 | W1 | M-W4 | sweep 区別 | rg anchor |
| SPEC-WD-4 | W3 | M-W5 | §5.4 区別 | rg anchor + X3 |
| SPEC-WD-5 | W3 | M-W6 | 一般化語彙 | rg anchor + JAN 語彙 0 hit |
| SPEC-WD-6 | W1 | M-W7 | 手段の具体性 | rg anchor |

## Data Safety

- docs-only、実店舗データ・credential・実 JAN の混入なし。WER からの転記は workflow 記録のみ。

## Implementation Results

未着手。Plan Gate と owner plan 承認後に Codex Writer へ発注する。

## Review Response

- Findings Freeze: frozen 2026-08-12（human-confirm 遷移時、P1/P2 = 0 確定後）; post-freeze exceptions: none.
- Plan Review rally round 1（Sonnet 5 independent / fresh context、2026-08-12）: P1 1 / P2 2 / P3 2、全件 accept（Coordinator が DEV_WORKFLOW L126・WER 原文 L89・self-closure 0 hit を実読裏取りで一致確認）。
  - P1（§5.6(b) の「state 遷移 Coordinator 所有」が DEV_WORKFLOW L126 の現行正本と矛盾し WER 支持範囲を超える規則発明）: accept、選択肢 b = §5.6 を canonical subject 遵守 + narrative 遷移主張禁止に縮小、L126 無改変。Design Sources に縮小記録、SPEC-WD-4 / Ledger / M-W5 / X3 同期。
  - P2-2（§5.7 ③の「self-closure 不在」が両 WER 無出典）: accept、削除して「編成の D-062 適合」へ戻す。
  - P2-3（「目安」qualifier の落とし方が無記録で packet 内不整合）: accept、owner 裁定（soft 運用不採用）を根拠に hard cap へ統一し Design Sources に判断記録、packet Budget 行も「天井」表記へ統一。
  - P3-4（anchor の Writer 実装時確定は self-fulfilling リスク）: accept、Coordinator が Matrix 上で全 anchor を仮確定、Writer は一意性確認のみへ変更。
  - P3-5（AC1「6 項目」と Ledger 8 行の対応が非直感的）: accept、AC1 に数え方の注記を追加。
- Plan Review rally round 2（Sonnet 5 independent / fresh context、2026-08-12）: round 1 裁定 4 件を独立再検証で全件 VERIFY（M-W1〜M-W9 全 anchor の baseline `rg -c` = 0・cross-hit なしを実測、12→9 観点の集約対応も過不足なしと判定）。新規 P1×1 = Goal 最小完了条件（L52）に round 1 で否認済みの旧文言「state 遷移の Coordinator 所有」が能動的仕様として残存する sweep 漏れ — 本 packet が正本化する sweep 規則が防ぐ失敗パターンの実例（Coordinator の sweep keyword が狭すぎた: `Coordinator 所有であり Writer scope 外` では L52 の異表現を検出できず、`Coordinator 所有` の広い pattern が必要だった）。
- round 2 P1 是正: accept、L52 を W3 / SPEC-WD-4 と同語の縮小後契約へ置換。再 sweep は広い pattern `rg -n 'Coordinator 所有'` で実施し、残存は §5.7 観点④（Coordinator 所有 field — 別語義）と履歴記録のみであることを確認。
- Plan Review rally round 3（Sonnet 5 independent / fresh context、2026-08-12、reviewed HEAD 356834d）: round 2 是正を独立再検証で VERIFY（`rg -n 'Coordinator 所有'` の残存 6 hit は全件履歴文 or §5.7 観点④の別語義で能動的仕様 0）。最終 sweep = 全 file:line 引用実在・Ledger⇔Trace⇔Matrix 3 点整合・12→9 観点の畳み込み過不足なし・anchor 一意性（file 単位 scope で cross-hit リスクなし）・X1〜X3 red oracle 成立・STATECAP/ci.md 分類整合を実測確認、**新規指摘 0。rally 収束（P1/P2 = 0、3 round、天井内）、owner plan 承認待ちへ遷移。**
- owner plan 承認（2026-08-12、介入 2/3）: rally 収束（P1/P2 = 0、天井 3 round 内）を受けた plan 承認と Codex 発注指示。§5.4 → §5.6 の置き場所訂正と §5.6 の範囲縮小（canonical subject + narrative 遷移主張禁止のみ）を明示提示のうえ追認。遷移 `plan-gate -> plan-approved -> implementing` は state-only 遷移 commit（STATECAP ①）で実体化、Plan Commit = `0b36e7a`。
- Writer implementation handoff（Codex、2026-08-12、content = 0250c51）: W1〜W4 完了、docs 5 file / 42 行純追加・削除 0。anchor 全実測（baseline 0 → 期待値）と M-W8 保全 token 同数維持、mutation X1〜X3 自己実測 red / 復元を報告。Workflow State / Plans.md の遷移は作成していない。
- Final Review（Sonnet 5 independent / fresh context Double Audit、2026-08-12、reviewed content = 0250c51）: Contract Coverage Ledger 8/8 適合、Audit A（契約適合 — anchor 独立再実行全一致・append-only 検証 削除行 0・§5.6 への「Coordinator 所有」非混入）/ Audit B（規範整合 — 既存 §5 群・L126・D-065・新 PK4 検査との衝突なし、検査 script 4 本 green）とも適合、P1/P2 = 0、P3×1 = Sub-agent Prompt の英語 verbatim block 内に日本語 2 文が新設され言語一貫性を崩す（機能影響なし）。
- P3 disposition（Coordinator 裁定）: 現状維持。該当 2 行の一方は M-W3 の凍結 anchor `受理せず差し戻す` そのもので、是正には gated Amendment + Matrix 改訂 + anchor 再測が必要となり可読性の便益に対し過大。将来 template を触る PR での英語化を備忘として本記録に残す（新規 backlog は作らない）。
- Coordinator mutation 独立再実測（2026-08-12、注入形独自設計・Writer / Final Reviewer 非参照）: X1〜X3 全 red（X1 は 3 点整合の一角消失まで観測、X2 は 2→1、X3 は 1→0）+ 追加形 = M-W8 保全 token `candidate safety` 単独削除で baseline 比較 red を確認（append-only 契約の検査感度実証）。survivor 0、復元後 doc-consistency 全通過・tree clean 実証済み。
- 遷移 implementing -> local-verified -> independent-review -> human-confirm を本 state-only commit（STATECAP ②）で一括実体化。evidence = Writer L1 full PASS（PR #70 body）+ Final Review Double Audit P1/P2 = 0 + Coordinator mutation / append-only 独立再検証。
