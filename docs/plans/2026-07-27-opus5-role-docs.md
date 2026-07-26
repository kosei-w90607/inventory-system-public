# Plan Packet: Opus 5 役割確定の正本化（D-056 候補、R3 workflow gate change docs-only）

## Workflow State

- Phase: implementing
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: bb4aa29
- Amendments: none
- Coordinator: Fable
- Writer: Fable（design board 例外: workflow design-only change、owner 明示指示 = 2026-07-27 協議での「R2 docs PR で即正本化」選択〈Risk は Plan Review round 1 指摘で R3 へ是正〉。実装 code なし）
- Plan Reviewer: Sonnet（独立 fresh context、rally round 1〜3）+ Opus 5（round 4 較正 = 低制約 profile、owner 指示の dogfood）。両系統とも P1/P2 = 0 で収束
- Final Reviewer: pending（独立 fresh context ×2 = Double Audit、Plan Reviewer とも別 context）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: pending（Ready 化 / docs-only workflow change のため owner-directed workflow_dispatch / merge）

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 2

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Risk

Risk: R3

Reason:
docs-only だが、AGENT_OPERATING_MANUAL §3 の制約 list（現行 6 項: Writer≠Plan Reviewer / Writer≠Final Reviewer / Final Reviewer fresh context / R4・workflow gate change = Double Audit / Human Gate owner 限定 / 希少・高コスト slot は Writer 不可）に第 7 項を追加し、審査体制の実施者制約を定める governance 変更に当たる。当初 R2 と自己判定したが、独立 Plan Review round 1 が「uncertain なら R3」原則と D-055 precedent（同種 governance doc 改訂を R3 workflow gate change として Double Audit）を根拠に根拠不足を指摘し、accept して R3 へ再分類した。workflow gate change 扱いとして Double Audit を実施する。既存 gate（evidence 要件 / 承認経路 / 検査内容 / 既存 6 項の意味）は変更しない — これは Matrix の不変 guard で機械証明する。

## Goal

Goal Invariant:

### 最小完了条件

- 2026-07-27 の owner 最終決定（Opus 5 = read-only 発注書駆動の claims-producer 専任 / メインスレッド代役不採用 / 代役ドラフト条件付き凍結 / 発注書二形化 / 難所からの投入基準）が、agent memory ではなく repository 正本（AGENT_OPERATING_MANUAL + decision-log）から読める状態になる。

### 失敗定義

- 正本化の過程で既存の workflow gate・独立性制約 6 項・予算のいずれかの意味が変わる。または「決定の理由と revisit 条件（Fable slot の恒久喪失）」が正本から読めず、将来の再協議が memory 依存のままになる。

### 非目的

- 代役ドラフト 3 点（output style / hook / rules 点検）の実装（凍結対象。revisit 条件のみ D-056 に記録する）
- DEV_WORKFLOW / Subagent Budget / Wave Operation 節の変更
- §3.1「希少・最高能力 slot の投入条件」の改訂（同節の主語は従来どおり Fable 系 slot のまま。新 slot 区分は self-contained な新項で扱い、§3.1 に接続しない）
- Opus 5 への初回実発注（難所 lane 着手時の別作業）

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- `docs/AGENT_OPERATING_MANUAL.md`:
  - §3 の制約 list に第 7 項を追加（self-contained な新 slot 区分）: **高自律・低制約適性 slot**（§3.4 で対応）は read-only の Reviewer / Explorer 発注書ロール専任とし、Writer / Coordinator / state 遷移管理に割り当てない。**§3.1 の design board 例外の対象外**（同例外の主語は希少・最高能力 slot であり本区分に適用しない旨を明示）。投入はレビュー難所・広域調査の発注書単位で Coordinator が判断し、通常レビューは既存分業を維持（D-056）
  - §3.4 slot 表に `Opus` 行を追加（**informational のみ**: 現行実体 = Claude Opus 5。区分・規範は §3 第 7 項 / D-056 への参照に留め、規範文を表内に転記しない — Plan Review round 1 P2-1）。表ヘッダの時点表記（現行「2026-07-10 時点」）を追加行に合わせて更新（round 4 P3-1）
  - §5 見出しを「追加 prompt / 発注 profile（本 manual が正本）」へ改称（固定カウント「3 本」の drift 解消 — round 1 P2-2）し、§5.4「低制約発注書 profile」を新設: 必須 5 点（goal / scope 境界 / read-only 宣言 / 報告フォーマット / subagent 生成上限）のみで構成し、過程指示・検証手順の指定を書かないことを規定
- `docs/decision-log.md`: D-056 新設（決定・理由〈公式 prompting 指針の非対称性 + workflow の claims-until-verified 構造への適所配置〉・棄却代替案〈代役整備 / 単純不使用〉・revisit 条件〈Fable slot の恒久喪失で代役ドラフト解凍を検討〉・投入基準〈レビュー難所から、通常レビューは既存分業を維持〉・凍結対象〈代役ドラフト 3 点〉）
- `Plans.md`: 『次の行動』節の本 packet link（追加済み、PK4 要件）
- `docs/PROJECT_HANDOFF.md`: 同期 1 行
- Test Design Matrix: [test-matrices/2026-07-27-opus5-role-docs.md](test-matrices/2026-07-27-opus5-role-docs.md)

## Non-scope

- `docs/DEV_WORKFLOW.md` / `docs/ci.md` / `scripts/` 全て（gate 非接触の機械証明 = Matrix M-N1）
- `docs/AGENT_OPERATING_MANUAL.md` の §3 既存 6 項・§3.1〜§3.3・§3.5・§5.1〜§5.3 の既存文（非改変 guard = Matrix M-N2。§5 見出し 1 行の改称のみ例外として許可）
- `.claude/` / `.agents/` の skill・rules・hook（凍結ドラフトの実装を含む）

## Acceptance Criteria

- `rg -F 'D-056' docs/decision-log.md docs/AGENT_OPERATING_MANUAL.md` が両 file で hit する（決定と適用指針の接続）
- Matrix の anchor A1〜A7 が全て baseline 0 hit → 実装後 hit で実測され、mutation X1〜X7 の実注入で対応 assertion が exit 1 へ反転することを clean tree で実測（X7 は M-A6 green 維持 = file 別弁別まで確認、記録は PR body）
- 不変 guard 自体の感度実測 G1〜G4（guard command のバグ検出能力）: 各 guard の対象 file へ Matrix 記載の注入を行い、`git diff` / `rg` の exit code が期待から反転することを clean tree で実測し PR body に記録（round 2 P2-1 の anti-tautology 要件）
- `git diff origin/main -- docs/DEV_WORKFLOW.md docs/ci.md scripts/` が空（gate 非接触、Matrix M-N1）
- `git diff origin/main -- docs/AGENT_OPERATING_MANUAL.md` の削除行が §5 見出し 1 行のみ（既存規範の非改変、Matrix M-N2）
- `bash scripts/doc-consistency-check.sh` PASS（active plan があるため `--target plan` も PASS）
- 最終 HEAD で `bash scripts/local-ci.sh full` CLEAN PASS（evidence は PR body）

## Design Sources

- Requirements / spec: なし（製品仕様非接触）
- Decision log / ADR: D-034（役割・Subagent Budget）、D-055（wave 運用 = claims-until-verified のレビュー構造。Opus の席はこの構造の一次レビュアー枠）
- 一次記録: agent memory `project-opus5-order-driven-role`（owner 最終決定 2026-07-27。本 packet が repository 正本化の実施物）。背景事実 = 公式 Opus 5 prompting guide の非対称性（検証系・過程系指示は消す / 出力契約と委譲上限は足す、2026-07-26 裏取り済み）と本 repo の実測（Writer / Coordinator 双方の claims が独立検証で複数回訂正された実績 → 検証は workflow 層に置き、実行者への process 内面化を要求しない設計が既に機能している）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend / Command / DB / Screen / CSV | なし | 該当なし |
| Durable decision / ADR | `docs/decision-log.md` D-056 | updated in this PR |

## Registration / Generation Obligations

該当なし（新規 command / route / 画面 / function-design doc なし。AGENT_OPERATING_MANUAL の節追加・見出し改称は同 file 内構成で、doc-consistency-check の既存対象内）

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-WF-OPUS5 | AGENT_OPERATING_MANUAL §3 第 7 項 | D-056-D1 | 新 slot 区分の self-contained 項。棄却: 希少・最高能力 slot 区分への編入（§3.1 design board 例外・投入条件と衝突 — round 1 P1-1） | §3 制約 list | A1/A2, X1/X2 |
| SPEC-WF-OPUS5 | AGENT_OPERATING_MANUAL §5.4 | D-056-D2 | 低制約発注書 profile（5 点のみ・過程指示なし）。棄却: 従来型発注書の共用（公式指針の非対称性と衝突） | §5.4 新設 + §5 見出し改称 | A3/A4, X3/X4 |
| SPEC-WF-OPUS5 | decision-log D-056 | D-056-D3 | 代役不採用 + ドラフト凍結 + revisit 条件。棄却: 廃案（Fable 恒久喪失時の保険価値を失う）/ 代役整備（process 規律と公式指針の正面衝突） | decision-log | A5, X5 |
| SPEC-WF-OPUS5 | decision-log D-056 | D-056-D4 | 投入基準 = レビュー難所から。棄却: 全レビュー置換（Sonnet 分業の実績を捨てるコスト） | decision-log + §3 第 7 項の投入 1 文 | A6/A7, X6/X7 |
| SPEC-WF-OPUS5 | （変更なし） | D-056-D5 | security 隣接迂回は従来どおり維持 | 変更なし（D-056 に記録のみ） | M-N1/M-N2（非接触 guard） |

## Impact Review Lenses

not applicable — field investigation / 実機 / POS / CSV 形式変更 / operator workflow 発見を含まない workflow governance docs の正本化のため（lens で見るべき運用リスクは Review Focus と Matrix の guard 系で扱う）。

## Design Readiness

- Existing design docs are sufficient because: 変更は運用ルールの正本化のみで、AGENT_OPERATING_MANUAL の既存構成（§3 制約 list / §3.4 slot 表 / §5 prompt 正本群）と decision-log の既存書式（D-055 と同型）にそのまま収まる。一次記録 = agent memory の owner 最終決定（2026-07-27）は Design Sources に明記済み
- Source docs updated in this PR: AGENT_OPERATING_MANUAL / decision-log / Plans.md / PROJECT_HANDOFF
- Design gaps intentionally deferred: 低制約 profile の実運用調整は初投入後（必要なら D-056 の revisit で追記）
- Durable decisions discovered in this plan and promoted to source docs: D-056 全体（本 packet は証跡のみ、恒久判断は decision-log と manual へ）

## Contract Probe

N/A — 外部 library / OS / hardware の未検証前提なし（docs-only の運用ルール正本化。checker 挙動にも非接触で、PK4 の per-packet link 要件は既に Plans.md 上で充足を実測済み）。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| D-056-D1 高自律・低制約適性 slot = read-only 発注専任、design board 例外対象外 | §3 第 7 項 + §3.4 informational 行 | A1/A2 baseline-red→green、X1/X2 mutation red | non-scope（初回実発注は難所 lane 着手時） |
| D-056-D2 低制約発注書 profile（5 点のみ・過程指示なし） | §5.4 + §5 見出し改称 | A3/A4、X3/X4 mutation red | non-scope |
| D-056-D3 代役不採用・ドラフト凍結・revisit = Fable slot の恒久喪失 | decision-log D-056 | A5、X5 mutation red | non-scope |
| D-056-D4 投入基準（難所から、通常は既存分業。§3 第 7 項の self-containment 込み） | decision-log + §3 第 7 項 | A6/A7、X6/X7 mutation red（file 別二重検証） | non-scope |
| D-056-D5 security 隣接迂回の維持（変更なし） | 非接触 | M-N1/M-N2 guard + G1〜G4 guard 感度実測 | non-scope |

## Test Plan

Test Design Matrix: [test-matrices/2026-07-27-opus5-role-docs.md](test-matrices/2026-07-27-opus5-role-docs.md)

- targeted tests: anchor A1〜A6 の baseline-red 固定 → 実装後 green
- negative tests: X1〜X6 の実 mutation 注入（clean tree、注入 → red → 復元 → green、記録は PR body）
- compatibility checks: `bash scripts/doc-consistency-check.sh`（full + `--target plan`）、M-N1/M-N2 不変 guard
- data safety checks: 実 POS / 店舗 data 非接触、commit は docs のみ
- main wiring/integration checks: なし（code 非接触）

## Boundary / Wire Contract

該当なし（JSON / CSV / DTO / bindings / DB 非接触の docs-only 変更）。

## Review Focus

- R3 再分類後の残リスク: §3 第 7 項の文言が既存 6 項・§3.1〜§3.3 のいずれかの読みを変えないか（特に §3.3 Capacity-degraded の代替担当指名と第 7 項の専任制約の交差）
- 低制約 profile 5 点が DEV_WORKFLOW `Subagent Budget`（output contract / one-writer / 上限表）と矛盾なく接続するか
- model-neutral 原則: 規範の主語が slot 抽象で、model 名が §3.4 informational 表にのみ現れるか
- Matrix の anchor 弁別性（重複出現の有無 — memory `matrix-anchor-uniqueness` の教訓を authoring 時に適用済みかの検証）

## Spec Contract

Contract ID: SPEC-WF-OPUS5-2026-07-27

- D-056-D1: 高自律・低制約適性 slot（§3.4 対応表で解決）は read-only の Reviewer / Explorer 発注書ロール専任。Writer / Coordinator / state 遷移管理に割り当てず、§3.1 の design board 例外の対象外とする
- D-056-D2: 当該 slot への発注書は低制約 profile（goal / scope 境界 / read-only 宣言 / 報告フォーマット / subagent 生成上限の 5 点のみ）を用い、過程指示・検証手順の指定を書かない
- D-056-D3: メインスレッド代役は不採用。代役ドラフト 3 点は凍結し、revisit 条件 = Fable slot の恒久喪失
- D-056-D4: 投入基準 = レビュー難所（L 級 lane の一次等）・広域調査から。通常レビューは既存分業を維持
- D-056-D5: security 隣接の敵対的レビュー迂回は従来どおり（本決定で変更しない）

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| D-056-D1 | §3 第 7 項 + §3.4 行 | A1/A2, X1/X2 | §3.1/§3.3 との交差 | Matrix 実測（PR body） |
| D-056-D2 | §5.4 + 見出し改称 | A3/A4, X3/X4 | Subagent Budget 接続 | Matrix 実測（PR body） |
| D-056-D3 | decision-log | A5, X5 | revisit 条件の永続性 | Matrix 実測（PR body） |
| D-056-D4 | decision-log + §3 | A6, X6 | 投入判断の帰属（Coordinator） | Matrix 実測（PR body） |
| D-056-D5 | 非接触 | M-N1/M-N2 | 迂回契約の非改変 | Matrix 実測（PR body） |

## Data Safety

- 実 POS CSV / 店舗 data / DB file / backup / log / secret は commit しない（本 change は docs のみ）
- local-only paths: `.local/ci-evidence/`（L1 証跡、非 commit）
- synthetic-only paths: なし

## Implementation Results

Fill after implementation.

## Review Response

- Findings Freeze: not yet frozen; post-freeze exceptions: none.

**Plan Review round 1（2026-07-27、独立 Plan Reviewer = Sonnet fresh context）**

- 結果: P1×2 / P2×2 / P3×1、全件 accept（P1-1 は相互修正案方式で修正方向を変更）
- P1-1: §3.4 追加だけでは design board 例外（§3.1）と D-056-D1 が矛盾し、投入基準が manual 上で空文化 → **修正方向を変更して解消**: Opus を希少・最高能力 slot 区分に入れず、self-contained な新区分「高自律・低制約適性 slot」の第 7 項を立て、design board 例外対象外を明示。§3.1 は無改訂（Non-scope に明記）
- P1-2: 「既存 5 項」は誤カウント（正 = 6 項）+ R2 自己判定は uncertain-rule と D-055 precedent に照らし根拠不足 → **R3 workflow gate change 扱いへ再分類**（Matrix 新設 + Double Audit + Contract Audit）
- P2-1: §3.4 informational 表への規範転記は将来 drift → Opus 行は現行実体のみ + §3/D-056 参照に変更
- P2-2: §5 見出し「3 本」の固定カウント drift → 見出し改称を Scope に追加
- P3-1: AC diff guard の `main` 参照 → `origin/main` へ変更

**Plan Review round 2（2026-07-27、同 reviewer による closure 確認）**

- 結果: round 1 の 5 件は全件解消確認（P1-1 の新区分方式は §3.3 Capacity-degraded との交差も新規矛盾なしと判定）。新規 P2×2、全件 accept:
- P2-1: 不変 guard M-N 系自体に mutation 感度実測がなく anti-tautology 不充足 → Guard 感度実測 G1〜G4 を Matrix へ新設（guard command のバグ検出能力を実注入で確認）
- P2-2: 投入基準が decision-log 側 anchor のみで §3 第 7 項の self-containment が検出網の外 → A7（字句 variant で file 別一意）+ X7（M-A6 green 維持の弁別確認込み）を追加

**Plan Review round 3（2026-07-27、同 reviewer による closure 確認）**

- 結果: round 2 P2×2 の解消確認、P1/P2/P3 = 0（Sonnet 系 rally はここで収束）

**Plan Review round 4（2026-07-27、Opus 5 較正実験 = 低制約発注書 profile 5 点のみでの独立 fresh context レビュー。owner 指示による profile dogfood）**

- 結果: P1×1 / P2×2 / P3×1、全件 Coordinator 実証確認の上 accept。**Sonnet 3 round + PK1 checker が揃って見逃した必須セクション欠落を検出**:
- P1: `## Design Readiness` 節の丸ごと欠落（DEV_WORKFLOW L61 の R3 必須 + spec-check→plan-draft skip の唯一根拠。R2→R3 全面改稿時の Coordinator 取り落とし、PK1 は本見出しを機械強制しておらず素通り）→ 節を precedent 同型で追加
- P2: `## Impact Review Lenses` 節欠落（非該当でも節必須の規定）→ not applicable 1 行で追加
- P2: revisit 条件の字句割れ（`Fable slot 恒久喪失`×3 vs anchor 正 = `Fable slot の恒久喪失`）→ 3 箇所を Matrix anchor literal へ統一（M-A5 の実装後 red 化リスクを事前解消）
- P3: §3.4 表ヘッダ時点表記の陳腐化 → Scope に更新を追記
- 較正実験の観測: 観点リストなしで Risk 判定・precedent 突合・checker 実走・baseline 実測まで自己導出、報告契約・read-only・委譲上限 0 を全て遵守。所見は別途 D-056 の実測データとして記録
- round 4 closure（Opus、`d036625` 差分確認）: 全件解消確認、新規なし、P1/P2/P3 = 0

**遷移記録（2026-07-27、state-only）**

- Sonnet 系 rally（round 1〜3）と Opus 較正（round 4 + closure）の両系統が P1/P2 = 0 で収束し、plan-first commit `bb4aa29` は全実装 commit に先行（実装未着手）。既存 evidence により `plan-gate -> plan-approved -> implementing` を本 state-only commit で一括実体化。Writer = Fable（design board 例外、Workflow State 記載どおり）

**gated Amendment 1（2026-07-27、実装前の Writer 自己検出）**

- round 4 P3（§3.4 表ヘッダ時点表記の更新）を Scope へ反映した際、表ヘッダ行の置換が削除 diff を生み **M-N2 guard（削除行 = §5 見出しのみ許可）と衝突**することを実装着手時に検出。M-N2 の除外条件へ表ヘッダ旧行を追加（guard の趣旨 = 「Scope が予定しない削除の禁止」は不変、許可 list を Scope と同期させたのみ）。G2 guard 感度実測は引き続き「許可外の 1 行削除」で反応することを確認する
