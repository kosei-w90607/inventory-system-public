# Test Design Matrix — workflow docs WER consolidation

## Risk

Risk: R3

## Contracts Under Test

- SPEC-WF-WERC-D1〜D12（packet Contract Coverage Ledger 参照。採用規範文 1 本 = 1 契約 + D-050 記録契約）

## Failure Modes

- 意味改変: 規範文が WER 原文の意図と異なる意味で書かれる（希釈・増幅・条件の脱落）
- 節ズレ: 指定節（Review Rules / Design checklist / Contract Audit / Workflow State / Implementation Rules / Draft PR Checkpoint / template 各節）と異なる場所への追記
- 既存文破壊: 追記のみ制約に反する既存行の書換・削除（splice）
- 既存規範との矛盾: D5 追記が backtrack 契約 / STATECAP cap 定義と両立しない
- 列挙残存: 消化済み項目が Plans.md roadmap 1-1 に残る、または消化先が特定不能
- 裁定不整合: D-050 の採否と実装が食い違う（採用なのに規範文なし / 不採用なのに実装あり）
- 置換過剰: DEV_SETUP_CHECKLIST で対象外の `:92`/`:252`/`:261` が置換される

## Test Matrix

検証は doc 検証型: `bash scripts/doc-consistency-check.sh`（構造整合）+ rg（存在・不在確認）+ review evidence（意味等価性は Double Audit で人的突合）。rg 検索語は実装後の文言に依存するため、下表は「検索対象の意味核」を規定し、Writer が実文言確定後に PR body へ実行コマンドを記録する（Evidence Ownership: 検証結果の SHA/count は packet に転記しない）。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| D1 doc 目次行 | 節ズレ / 裁定不整合 | schema (doc) | M-D1: rg "目次" templates/plan-packet.md（Registration 表内） | 表に doc 目次義務行がない、または表外に置かれた |
| D2 相互修正案方式 | 意味改変 / 節ズレ | schema (doc) | M-D2: rg "修正案" DEV_WORKFLOW.md（Review Rules 節内）— 「添付 + 相互採否裁定 + 異議窓口」の 3 要素 | 3 要素のいずれかが脱落、または Review Rules 外に追記 |
| D3 絶対保証自己突合 | 意味改変 | schema (doc) | M-D3: rg "保証" DEV_WORKFLOW.md（Design checklist 内）+ templates/plan-packet.md（Design Intent Audit） | 「同 PR 内の例外・escape hatch との両立確認」の意味核が欠落 |
| D4 実 mutation 注入 | 意味改変 | schema (doc) | M-D4: rg "mutation" DEV_WORKFLOW.md Contract Audit — 既存行に「推論判定は不十分 / 実 mutation 注入」の強化が追加 | 既存の mock 可弁別性文のみで実 mutation 要求がない |
| D5 cap 枯渇フォールバック | 既存規範との矛盾 / 既存文破壊 | schema (doc) + regression | M-D5: rg "closeout" DEV_WORKFLOW.md Workflow State + `git diff --unified=0` で Evidence Ownership 段落の既存文が無変更 | 追記が段落外にある / 既存文が書き換わった / backtrack 契約と矛盾する表現 |
| D6 clone パス追随 | 置換過剰 | schema (doc) | M-D6: `rg -P 'projects\\inventory-system(?!-public)' docs/DEV_SETUP_CHECKLIST.md` = 0 件 かつ `:92` の clone URL / `:261` の対比表現が無変更 | パス形が残存、または対象外 3 箇所が置換された |
| D7 可変 count 拡張 | 意味改変 | schema (doc) | M-D7: rg "count" DEV_WORKFLOW.md Evidence Ownership — 「test counts」限定から可変 count 全般への拡張 | 拡張文がない、または test counts の既存規定を書き換えた |
| D8 旧文言 grep evidence | 意味改変 / 節ズレ | schema (doc) | M-D8: rg "旧文言\|grep" DEV_WORKFLOW.md Draft PR Checkpoint | PR evidence 記録要求が checkpoint 外、または「契約文言変更 commit」の適用条件が脱落 |
| D9 release-profile check norm | 意味改変 | schema (doc) | M-D9: rg "release" DEV_WORKFLOW.md Implementation Rules + templates/plan-packet.md Test Plan — 「L3 を Human Gate に含む packet」の条件付き | 無条件要求に増幅、または条件が脱落 |
| D10 Matrix 実在確認 | 意味改変 | schema (doc) | M-D10: rg "実在" templates/test-design-matrix.md + DEV_WORKFLOW.md Design checklist | 「既存テストで回帰担保」行への rg 実在確認要求がない |
| D11 adjacent-contract sweep | 意味改変（WER 制約違反） | schema (doc) | M-D11: rg "adjacent\|隣接" DEV_WORKFLOW.md Contract Audit + templates/plan-packet.md Ledger 節 | sweep 要求がない、または「検出前倒しのみ」を超えて新規律を追加した |
| D12 D-050 採否裁定 | 裁定不整合 | schema (doc) | M-D12: rg "D-050" docs/decision-log.md — 採用/部分採用/不採用 defer の 3 区分 + 不採用 3 件の「発動条件事実」と「却下理由」の分離 | 区分がない / 事実と理由が混在 / 実装と裁定が食い違う |
| 全体 | 列挙残存 | regression | M-ALL: rg で消化済み 4 件（checklist 昇格 / Contract Probe 仮適用 / materialize 検査 / read-safe-file）が Plans.md roadmap 1-1 の未消化列挙から消えている | 消化済み項目が未消化として残存 |
| 全体 | 既存文破壊 | regression | M-DIFF: `git diff main --unified=0 -- docs/DEV_WORKFLOW.md docs/templates/` に削除行（`-` 行）が存在しない（純追記。例外 = DEV_SETUP_CHECKLIST の 2 行） | 追記のみ制約に反する削除・書換 hunk |

## State Lifecycle Matrix

本 PR は workflow-state の**規範文**を変更する（実装 state machine 自体は不変）ため、workflow-state changes の明示行を記載する:

| State / subject | 検証内容 | Evidence |
|---|---|---|
| content candidate -> L1 / independent review -> state-only human-confirm commit | 本 packet 自体がこの遷移列を実走して規範文の自己適用を確認（dogfood） | packet State Narrative + PR body |
| owner authorization -> Draft state-only Ready commit -> exact-HEAD L1 -> PR body -> Ready/dispatch -> merge | docs-only のため dispatch 明示 1 run。三点 SHA 一致 | PR body |
| state-only violation 検査 | state-only commit の file allowlist + `git diff --unified=0` hunk 検査（Scope/AC/契約の混入で implementing へ戻す） | review evidence |
| hosted-not-required incidental failure | 非該当（本 PR は Hosted CI Requirement: required） | — |

D5 追記（cap 枯渇時 = closeout narrative 実体化）は上記 1 行目の遷移列で cap を消費し尽くした場合の分岐として、追記文と本 packet の実運用が一致することを Double Audit で確認する。

## Adjacent Pattern Audit

not applicable — 借用パターンなし（IME / Enter / focus / formatter / query invalidation / error-kind / route state / a11y のいずれも非該当）。類似の「規範文追記」precedent（Public PR #7 = UI-13 WER 正本化）とは追記スタイル（既存節への箇条書き追加、出典 lesson 併記）を踏襲する。

## Negative Paths

- missing input: WER 原文に存在しない項目の創作追記 → M-DIFF + Review Focus（意味等価性）で検出
- invalid input: 行番号ズレ（実装時に対象節が移動）→ 節名アンカーで特定、行番号は参考値
- duplicate/ambiguous input: 同一規範の二重追記（DEV_WORKFLOW と template の重複記載が正本二重化しないか）→ Review Focus
- unknown reference: 規範文中のファイル参照が実在しない → doc-consistency-check full
- dependency missing: 非該当
- permission/write failure: 非該当
- dry-run side effect: 非該当

## Boundary Checks

非該当（数値・enum・wire 境界なし。唯一の境界 = D6 の negative lookahead パターンが `:92` の clone URL 形式 `inventory-system.git` を誤検出しないこと — パス形 `projects\` 限定で回避済み）

## Compatibility Checks

- old schema/input: 既存規範文（:105 backtrack 契約 / :120 cap 定義 / :334 anti-tautology）が無変更で残ること = M-DIFF
- new schema/input: 追記規範が既存規範と同一節内で矛盾なく読めること = M-D5 通し読み + Double Audit
- output order: 非該当
- optional field behavior: 非該当

## Data Safety Checks

- source-derived data: 非該当（実データなし）
- generated outputs: `.local/ci-evidence/` を commit しない
- secrets: 非該当
- local-only files: `.local/`
- synthetic sample boundaries: 非該当

## Main Wiring / Integration Checks

- helper connected to main path: 非該当（script 変更なし）
- output reaches manifest/report: 非該当
- effective config reaches runtime: 非該当
- CLI arg reaches implementation: doc-consistency-check --target plan が本 packet を検査対象にすること（active plan 検出）

## Mutation-style Adequacy Questions

doc 検証型のため「実装 mutation」は「規範文の意図的改変」に読み替える:

- D2 の 3 要素（修正案添付 / 相互採否裁定 / 異議窓口）から 1 つを削って M-D2 が fail するか → する（3 要素の rg AND 確認）
- D5 の追記を Evidence Ownership 段落外へ移して M-D5 が fail するか → する（段落内 rg + diff hunk 位置）
- D6 で `:252` を誤置換して M-D6 が fail するか → する（対象外無変更の diff 確認）
- D9 の「L3 を Human Gate に含む packet」条件を削って M-D9 が fail するか → する（条件語の rg）
- D-050 から不採用 1 件を消して M-D12 が fail するか → する（3 区分 + 3 件の存在確認）
- 既存行を 1 行書き換えて M-DIFF が fail するか → する（削除行ゼロ判定）
- tracked Workflow State に exact-HEAD SHA を書いて検査が fail するか → する（Evidence Ownership、Data Safety 節で禁止明記）

## Residual Test Gaps

- 意味等価性（WER 原文 ↔ 規範文）の機械検証は不可能 — Double Audit 2 pass（Codex 独立の原文突合）で人的に閉じる。これが本 Matrix 最大の残余 gap であり、R3 + Double Audit を要求した理由そのもの。
- 規範文の将来の遵守率（実際に次の PR で相互修正案方式等が実行されるか）は本 PR では検証不能 — 次 PR の WER で観測する。
