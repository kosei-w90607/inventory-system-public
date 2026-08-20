# Plan Packet: stacked train + 発注書規律の workflow docs 正本化（R3 workflow docs change）

## Workflow State

Use the field definitions, enums, transition evidence, packet-selection rule, and fail-closed behavior from `docs/DEV_WORKFLOW.md` `Workflow State`. Keep exactly one `- Key: value` line per field.

- Phase: ready-hosted-final
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: 3829b95
- Amendments: 4ec0630, 2135aa0, d21f5b9
- Coordinator: Fable
- Writer: Codex
- Plan Reviewer: Sonnet subagent（独立、Writer と別 context）
- Final Reviewer: Sonnet subagent（独立、Writer と別 context）
- Reviewed Content HEAD: d21f5b9
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: owner plan approval / Ready / merge（画面変更なしのため visual confirmation なし）

Transition narrative（append-only）:

### 起草（2026-08-20、Fable Coordinator）

- 起源: PR #84 / #85 / #86 の WER 候補（Plans.md「次の行動」各 closeout 記録）+ PR #86 Plan Gate round 1 P2-6 の stacked train 明文化 follow-up。PR #86 の base 付け替えで rebase / 2 段 merge がともに機械 gate に落ちる構造を実測したため、確立手順の正本化を先行する。
- 編成 = PR #70（WER Deferred workflow docs 正本化）と同型: Fable Coordinator / Codex Writer / 独立 Sonnet Plan+Final Reviewer、workflow gate change の Double Audit 適用。

## Owner Effort Budget

- 介入予算: 3 回（plan approval / Ready 承認 / merge）
- relay 往復上限: 2
- Plan Review round 天井: 3（既定 hard cap）

## Risk

Risk: R3

- R3（workflow docs change）。`docs/DEV_WORKFLOW.md` / `docs/AGENT_OPERATING_MANUAL.md` / `docs/templates/plan-packet.md` は全 change の運用規範であり、誤った規則の正本化は以後の全 PR に波及する。
- 実装 code / 画面 / DB / wire への変更なし（docs-only）。

## Goal

Goal Invariant:

PR #84〜#86 で実測された workflow gap 4 系統を正本 docs へ昇格し、次回の stacked train / 並行 lane / Codex 発注で同じ失敗を再現させない。既存規範の文言（D-055 / D-038 / D-039、drift test が保全する token を含む）は削除・改変しない。

### 最小完了条件

1. `DEV_WORKFLOW.md` Wave Operation に stacked train（逐次依存 lane）の小節が新設され、base 付け替えの確立手順（単段 merge）と STATECAP 継承計上の扱いが機械検査の現仕様と矛盾なく記述されている。
2. 連番契約 registry の採番規律が Review Rules 系の正本に 1 項目として存在する。
3. Writer 発注書規律（doc 節番号の実在確認 / generated 再生成の完了条件明記）が `AGENT_OPERATING_MANUAL.md` §5.6 に存在する。
4. L1 full PASS（doc-consistency ERROR 0 を含む）。

### 失敗定義

- 新設規則が既存の Rebase Map 契約（D-055 / PK5）や STATECAP 契約（D-038 / D-039）と矛盾する記述になる。
- 実測に基づかない規則の発明（rally で検出対象）。

### 非目的

- checker script（`check-workflow-git.sh` / `doc-consistency-check.sh`）の挙動変更。
- D-052-E1 語義分離などの decision-log 整理。

## Scope

docs-only、4 系統:

1. **stacked train 小節新設**（`docs/DEV_WORKFLOW.md` Wave Operation 末尾）:
   - 定義: 後続 lane が先頭 lane の branch 上に stack する逐次依存 train。「file footprint 互いに素 / 生成 file は 1 wave に 1 lane」規則は適用対象外（逐次依存で衝突は base 付け替え時に解消される）。Draft PR の base は先頭 lane branch とし、`ready-hosted-final への遷移は merge train 先頭の lane のみ`の既存規則を維持する。
   - base 付け替え（先頭 lane が squash merge された後）: squash で ancestry が断絶するため、(a) conflict-free rebase + Rebase Map は plan-first commit の replay が closeout drift（`Plans.md` / archive 移動）と衝突して原則成立しない。適用可否の `git merge-tree` 事前判定は **記録上未実測の推奨手順**として区別して記述する（PR #85 closeout WER 候補 (1) の提案由来。PR #86 の base 付け替えでは Coordinator が session 内で使用したが archived packet に実行記録がなく、citable evidence を欠く — 次回 stacked train 適用時に記録付きで有効性を確認する）。(b) 確立手順 = **origin/main の単段 merge**（旧 tip 保存、Plan Commit / Amendments / Human Gate evidence SHA の ancestry 維持、Rebase Map 不要）。(c) 先頭 lane branch tip を追加 merge する多段 merge は禁止 — 他 lane の forward state-only 遷移 commit が STATECAP 検査範囲 `merge-base(origin/main, HEAD)..HEAD` に入り上限を機械超過する。
   - STATECAP 継承計上: stack 点以前の他 lane forward state-only commit は squash 後 main から不可達のため自 PR の計数に含まれる（機械検査の現仕様、実測 = PR #86 で継承 2 本 + 自 lane 1 本 = 3/3）。STATECAP は aggregate ≤3 と post-implementation subset ≤2（D-038）の**独立した二段 cap** であり、継承 commit は両方に計上されうる — PR #86 実測では post-impl 判定は継承 1 本のみで aggregate が先に律速したが、より長い stack では subset cap が先に fail-closed し得ることを明記する（rally round 2 P2-1）。継承で枠が尽きた場合の Ready 遷移は content commit 同乗（既存の正規圧縮手段）で行い、packet 遷移記録に継承 commit の SHA と理由を明記する。
   - merge 解消が実装 file に及んだ場合は独立 Final Reviewer の delta 再検証を挟んでから遷移する（docs-only 解消なら delta ack のみ）。
   - 出典実測: PR #86（rebase 即衝突 / 2 段 merge STATECAP 超過 / 単段 merge + 同乗遷移で成立、archived packet「main 吸収の merge 記録」）。
   - 併せて **decision-log `D-074` を新設**し、stacked train の base 付け替え契約（単段 merge 確立 / 多段 merge 禁止 / STATECAP 継承計上圧縮 / merge-tree 事前判定 = Revisit 対象）を durable decision として正本化する。D-055 は「file footprint 互いに素な並列 lane + rebase」の定義を持ち stacked train を想定していないため、細則埋め込みでなく独立 entry とする（rally round 2 裁定、D-039 が D-034/035/038 から独立昇格した precedent に整合）。DEV_WORKFLOW 小節は D-074 を参照する。
2. **連番契約 registry の採番規律**（`docs/DEV_WORKFLOW.md` Review Rules へ 1 項目）: 並行または stacked な複数 lane が同一の連番契約 registry（例: D-052 C-n、decision-log D-n、REQ-n）へ新番号を割当てる場合、merge 済み正本側を不変とし、後続 lane は正本 merge 後に採番（改番は gated amendment として記録 + 同一 packet 内 full sweep）するか、packet 起草時に番号予約を宣言する。追記文には Design Phase Rules「Design decision IDs」節への参照を含め、既存の ID 採番規範と孤立させない（rally round 1 P3-2）。出典実測: PR #86 C18 二重割当（C19 改番で解消）/ PR #84 packet-local D-n 衝突（Plan Gate 2 round 連続 P1）。
3. **Writer 発注書規律 2 点**（`docs/AGENT_OPERATING_MANUAL.md` §5.6 へ追記）:
   - 発注書が doc 節番号（`§n` 等）を指定するときは、起草時に rg で実在確認し、**その節番号が指す既存内容と発注意図の対象が一致すること（referent 一致）まで確認**してから書く（PR #84 実測は §12 が実在した上で既存 legacy path と発注対象 migration v5 の occupancy 不一致 — 実在確認だけでは検出できない型、rally round 2 P3-1）。
   - REQ token に触れる変更（test 追加を含む）を依頼する発注書は、generated `90-traceability.md` の再生成を完了条件に明記する（PR #72 / #84 / #85 の 3 実測で再発）。
4. **L3 / visual fixture の encoding 規律**（`docs/DEV_WORKFLOW.md`「Human Visual Confirmation For Screen Changes」節へ 1 行）: Coordinator が提示する取込み fixture は対象機能の実 encoding（例: 商品 CSV は CP932）に合わせる（PR #86 visual confirmation で UTF-8 BOM fixture が fail-closed した実測）。配置裁定 = 同節が visual confirmation 準備の実質正本のため（rally round 1 P1-1、AGENT_OPERATING_MANUAL に該当節は実在しない）。

## Non-scope

- `scripts/check-workflow-git.sh` の STATECAP 検査に stacked train 継承除外を実装する機械側是正（範囲判定の設計が非自明なため別 change。backlog 起票）。
- PK4 `###` 小見出し抽出打ち切り gap の是正（既存 backlog、script change）。
- `docs/templates/plan-packet.md` の変更（今回の 4 系統はいずれも DEV_WORKFLOW / manual が正本。template 追記が必要になれば Plan Gate で判断）。
- PR #85 WER 候補 (3)（S3 / S14 の L3 手順書期待値是正）は受入台本第2版（⑤）へ引き継ぎ、本 change に含めない。

## Acceptance Criteria

- AC1: Scope 1〜4 の各規則が指定正本 doc に存在し、anchor token（Test Plan 参照）が `rg -F -c` exact で 1 hit する。
- AC2: 新設記述が `docs/DEV_WORKFLOW.md` / `docs/decision-log.md` の D-055（Rebase Map）/ D-038・D-039（STATECAP）既存契約文と矛盾しない（Plan / Final Reviewer の突合観点、M-S9 の `git diff` 既存行変更 0 検査を含む）。
- AC3: 規則ごとに出典実測（PR 番号）が本文または近傍に記録され、実測なき規則の発明がない（rally が `docs/archive/plans/` の一次資料と突合済み）。
- AC4: L1 full PASS、doc-consistency ERROR 0、既存 test / checker への変更なし。

## Design Sources

- `docs/DEV_WORKFLOW.md` Wave Operation / Workflow State / Review Rules（現行規則）
- `docs/AGENT_OPERATING_MANUAL.md` §5.6（Writer 発注書規律の既存節）
- PR #86 archived packet `docs/archive/plans/2026-08-19-plu-bulk-onboarding-implementation.md`「main 吸収の merge 記録 + gated amendment 5」「遷移記録」
- PR #85 archived packet `docs/archive/plans/2026-08-18-plu-slot-core-implementation.md`「main drift 吸収の merge 記録」（注: これは PR #87 由来 main drift の一般的な merge-over-rebase 先例であり、stacked train base 付け替えの実測は PR #86 側の記録。両者は D-055 判断を共有するが別事象）
- PR #84 archived packet `docs/archive/plans/2026-08-18-plu-slot-onboarding-design.md` Review Response P1-1 / P1-2（packet-local D-n 衝突の一次資料）
- Plans.md「次の行動」PR #84 / #85 / #86 closeout 記録の WER 候補

## Required Design Artifacts

| 対象 | 変更 |
|---|---|
| `docs/DEV_WORKFLOW.md` Wave Operation | stacked train 小節新設（Scope 1） |
| `docs/DEV_WORKFLOW.md` Review Rules | 連番契約 registry 採番規律 1 項目（Scope 2） |
| `docs/AGENT_OPERATING_MANUAL.md` §5.6 | 発注書規律 2 点追記（Scope 3） |
| `docs/DEV_WORKFLOW.md` Human Visual Confirmation For Screen Changes | fixture encoding 1 行（Scope 4） |
| `docs/decision-log.md` | D-074 新設（stacked train base 付け替え契約、Revisit = merge-tree 事前判定の実測検証） |
| `docs/Plans.md` | 本 packet の active 登録 + backlog へ STATECAP 機械側是正の起票 |

## Registration / Generation Obligations

- 新規 command / route / REQ / 画面なし。generated file 変更なし（90-traceability は REQ 不変のため再生成不要 — Writer は `--check` で不変を確認する）。

## Design Intent Trace

| 起源 | 規則 | 出典実測 |
|---|---|---|
| PR #86 WER (1) + P2-6 | stacked train 小節（Scope 1） | PR #86 base 付け替え実測 |
| PR #85 WER (1)（提案由来） | merge-tree 事前判定（Scope 1 内、未実測注記付き） | 記録上未実測 — D-074 Revisit で次回 stacked train 適用時に検証 |
| PR #86 WER (2) / PR #84 WER (2) | 採番規律（Scope 2） | C18 衝突 / packet-local D-n 衝突 |
| PR #84 WER (1) | 節番号実在確認（Scope 3a） | §12 誤指定 |
| PR #84 WER (3) / PR #85 WER (2) | traceability 再生成の完了条件（Scope 3b） | PR #72 / #84 / #85 |
| PR #86 WER (3) | fixture encoding（Scope 4） | UTF-8 BOM fail-closed |

## Design Intent Audit

- 全規則が実測起源を持つ（AC3）。規則の一般化は「同型の再発を防ぐ最小限」に留め、未実測の状況（例: 3 段以上の stack、並行 wave との混成）への外挿は書かない。

## Impact Review Lenses

- 整合性: D-055 Rebase Map は「conflict-free rebase 限定」の既存文言を変えず、stacked train 側から参照する（二重定義しない）。
- STATECAP: content commit 同乗は既存の正規手段（D-038 Evidence Ownership の記述）を参照し、新しい免除を発明しない。
- 環境・再現性: docs-only、環境依存なし。
- 公開境界: workflow docs は public repo に置かれる既存慣行どおり。実データ・秘匿情報なし。

## Design Readiness

- 全 4 系統の実測 evidence は archived packet / PR body / Plans.md に記録済み。新規調査は不要。

## Contract Probe

- Probe 1: 新設 stacked train 小節の記述する STATECAP 挙動が現実装と一致するか — `check-workflow-git.sh` の STATECAP 範囲定義（`merge-base(origin/main, HEAD)..HEAD`）と **aggregate ≤3 / post-implementation subset ≤2 の二段 cap** を Writer が実読して引用一致を確認する（script は変更しない）。

## Contract Coverage Ledger

| # | 契約 | 正本 | 検証 |
|---|---|---|---|
| L1 | stacked train 定義 + 適用除外 | DEV_WORKFLOW Wave Operation | M-S1 |
| L2 | base 付け替え = 単段 merge、多段 merge 禁止、merge-tree 事前判定 | 同上 | M-S2 |
| L3 | STATECAP 継承計上 + content commit 同乗 | 同上 | M-S3 |
| L4 | merge 解消が実装に及ぶ場合の delta 再検証 | 同上 | M-S4 |
| L5 | 連番契約 registry 採番規律 | DEV_WORKFLOW Review Rules | M-S5 |
| L6 | 節番号実在確認 | AGENT_OPERATING_MANUAL §5.6 | M-S6 |
| L7 | traceability 再生成の完了条件明記 | 同上 | M-S7 |
| L8 | fixture encoding | DEV_WORKFLOW Human Visual Confirmation For Screen Changes | M-S8 |
| L9 | stacked train base 付け替え契約の durable decision | decision-log D-074 | M-S11 |

## Test Plan

Test Design Matrix: [2026-08-20-stacked-train-workflow-docs.md](test-matrices/2026-08-20-stacked-train-workflow-docs.md)

docs-only のため drift-test 形式（PR #70 と同型）: 各規則に一意の anchor token を置き、`rg -F -c` exact 1 hit を検証する。mutation は anchor 文の削除 / 意味反転（例: 「単段 merge」→「多段 merge」）で該当検査が red になることを Writer / Final Reviewer が独立に確認する。

| # | 対象 | anchor（例、Writer が確定） | 検証 |
|---|---|---|---|
| M-S1 | stacked train 定義 | `逐次依存の stacked train` | rg 1 hit |
| M-S2 | 単段 merge 手順 | `origin/main の単段 merge` | rg 1 hit + 「多段 merge は禁止」共起 |
| M-S3 | STATECAP 継承 | `STATECAP 検査範囲に含まれる` 系 | rg 1 hit + content commit 同乗の共起 |
| M-S4 | delta 再検証 | `delta 再検証` | Wave Operation 節内 1 hit |
| M-S5 | 採番規律 | `連番契約 registry` | rg 1 hit |
| M-S6 | 節番号実在確認 | `節番号` + `実在確認` | §5.6 内共起 |
| M-S7 | traceability 完了条件 | `90-traceability` + `完了条件` | §5.6 内共起 |
| M-S8 | fixture encoding | `CP932` or `実 encoding` | manual 内 1 hit |

anchor は汎用語の cross-reference hit を避け、rg -c で重複出現 0 を確定してから固定する（Matrix anchor uniqueness の既存教訓）。

## Boundary / Wire Contract

- なし（docs-only、code / wire / DB 不変）。

## Review Focus

- 規則発明の検出（実測なき一般化・外挿）— rally の主眼。
- D-055 / D-038 / D-039 既存文言との矛盾・二重定義。
- STATECAP 記述と `check-workflow-git.sh` 実装の一致（Probe 1）。

## Spec Contract

- REQ 変更なし。**decision-log D-074 を新設する**（rally round 2 裁定で確定）: D-055 の定義（並列 lane + rebase）は stacked train を想定せず、細則埋め込みは D-055 の暗黙拡張になる。merge-tree 事前判定の未実測項目は D-074 の Revisit フィールドで構造的に追跡する。round 1 P3-3 → round 2 意見聴取 → 本裁定の経緯は Review Response 参照。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| D-074 | Scope 1（stacked train 小節 + D-074 新設） | M-S1〜M-S4 / M-S11 | 規則発明・D-055 整合 | anchor rg + mutation 記録 |
| D-052 C-n / D-n 採番 | Scope 2（Review Rules 採番規律） | M-S5 | 既存 ID 規範との整合 | anchor rg |
| §5.6 発注書規律 | Scope 3（referent 一致 / 90-traceability 完了条件） | M-S6 / M-S7 | 出典実測との一致 | anchor rg |
| fixture encoding | Scope 4（Human Visual Confirmation 節） | M-S8 | 配置先実在 | anchor rg |
| 既存契約不変 | 横断 | M-S9 / M-S10 | D-055 / D-038 / D-039 無改変 | `git diff` + L1 full |

- Matrix: `docs/plans/test-matrices/2026-08-20-stacked-train-workflow-docs.md`

## Data Safety

- 実データなし。public repo に置ける内容のみ（PR 番号 / SHA / 規則文）。

## Implementation Results

（Writer が追記）

- Scope 1〜4 を source docs へ追記し、D-074 を D-073 の後へ新設した。既存の D-055 / D-038 / D-039、Wave Operation bullet、§5.6 本文は変更せず、追加行だけで正本化した。
- Probe 1: `scripts/check-workflow-git.sh` を実読し、STATECAP の計数範囲が `merge-base(origin/main, HEAD)..HEAD`、forward aggregate cap と post-implementation subset cap が独立検査であることを確認した。新設記述はこの実装と一致し、script は変更していない。
- anchor は repo 内の事前重複なしを確認後、M-S1〜M-S8 / M-S11 の exact 文字列を Matrix へ固定した。各 target doc で exact hit を確認した。
- mutation: M-S1〜M-S8 / M-S11 の anchor をそれぞれ意味反転し、対応する `rg -F -c` が red になることを確認した後、全 anchor を復元して green を再確認した。
- M-S9: source docs の zero-context diff は追加行のみで、既存契約行の変更がないことを確認した。

## Review Response

- Findings Freeze: not yet frozen; post-freeze exceptions: none.

（rally 記録は以下に追記）

### Plan Gate rally round 1（2026-08-20、独立 Sonnet Plan Reviewer、fresh context）

- Verdict: P1 1 / P2 2 / P3 3、全件 accept・修正案付き。
- P1-1（配置先実在せず）: Scope 4 の「AGENT_OPERATING_MANUAL fixture 準備規律」は実在しない節 — packet 自身が禁じる「節番号未確認引用」と同型の true positive。裁定 = DEV_WORKFLOW「Human Visual Confirmation For Screen Changes」節へ配置（visual confirmation 準備の実質正本）。Scope 4 / Required Design Artifacts / M-S8 を是正。
- P2-1（merge-tree 未実測混在）: `git merge-tree` 事前判定は記録上未実測の提案由来 — 実測済み手順と分離し、未実測注記 + 次回検証予定を明記。Design Intent Trace の扱いも同注記に従う。
- P2-2（一次資料 citation 欠落）: Design Sources へ PR #84 design packet（Review Response P1-1/P1-2）を追加。
- P3-1（PR #85 citation の事象混同リスク）: 注記追加（一般 merge 先例 vs stacked train 実測の区別）。
- P3-2（採番規律の孤立リスク）: Design decision IDs 節への相互参照を追記文の要件に追加。
- P3-3（新 D-n 要否の軽い扱い）: rally での明示再検討 + 裁定理由の記録を義務化。Coordinator 現時点見解 = D-055 運用細則として新 D-n 不要（stacked train は D-055 の適用形であり独立判断を持たない）だが、round 2 reviewer の意見を求める。
- 是正 commit = 本 commit。round 2 は fresh context で新規指摘 0 まで（天井 3 round）。

### Plan Gate rally round 2（2026-08-20、独立 Sonnet Plan Reviewer、fresh context）

- Verdict: 新規 P2 2 / P3 1（round 1 是正の残存なし・是正への異論なし）+ 新 D-n 新設意見。全件 accept。
- P2-1（STATECAP 二段 cap 未記載）: `check-workflow-git.sh` は aggregate ≤3 と post-impl subset ≤2 を独立検査（D-038 正本化済み）。Scope 1 / Probe 1 / M-S3 へ両 cap の明記を追加。
- P2-2（Plan Review round 天井 field 欠落）: DEV_WORKFLOW の must-record 規定に対する非準拠 — 本 packet 自身の欠落という true positive。Owner Effort Budget へ追加。
- P3-1（節番号規則の精度）: PR #84 実測は「実在しない節」でなく「実在する節の referent 不一致」（一次資料 = design packet の Coordinator 裁定行を round 2 が実読、Coordinator も本 round で再実読して確認）。Scope 3a を referent 一致確認まで拡張。
- 新 D-n 裁定 = **D-074 新設で確定**。理由: D-055 は「file footprint 互いに素な並列 lane + rebase」を定義しており stacked train はその裏返し — 細則埋め込みは D-055 の暗黙拡張になる。D-039 の独立昇格 precedent、merge-tree 未実測項目の Revisit 構造化も新設側を支持。Coordinator の round 1 見解（細則で足りる）は撤回。
- 是正 commit = 本 commit。round 3（天井）は fresh context で新規指摘 0 の収束確認。

### Plan Gate rally round 3（2026-08-20、独立 Sonnet Plan Reviewer、fresh context、round 天井）

- Verdict: **新規指摘 0、収束**（P1/P2/P3 = 0）。disposition route への遷移不要。
- round 1 / 2 是正の全数適合を独立確認: D-074 新設の 6 箇所一貫（Scope 1 / Required Design Artifacts / Ledger L9 / M-S11 / Spec Contract / Plans.md entry）、STATECAP 二段 cap の script 実装一致（aggregate ≤3 / post-impl ≤2）、Scope 4 配置先の実在、D-073 が最終 entry で D-074 空き。
- 新規角度の精査も指摘なし: Workflow State 13 field 形式一致・D-062 vendor 制約充足、D-074↔D-055 は単方向参照で循環なし（D-039 独立昇格 precedent と整合）、Non-scope 境界・AC 検証可能性・M-S9/M-S11 の実行可能性を確認。
- Plan Gate 収束 = rally 3 round（P1+P2: 3 → 3 → 0、evidence = 是正 commit `c6747f5` / `dfe2cc5` / `90854ce`、round 1 P1-1 は packet 自身が禁じる節引用欠陥の true positive）。次 = owner plan approval（介入 1 回目 / 予算 3 回、記録 = 遷移記録節）。

### owner plan approval / 遷移記録（2026-08-21）

- owner plan approval（介入 1 回目 / 予算 3 回、owner 発言 `両方とも承認するよ` = PR #88 Ready 承認との一括裁定）。D-074 新設・Scope 4 系統・Non-scope 分離に異論なし。
- state-only 遷移（append-only、STATECAP forward 1 本目）: `plan-draft -> plan-gate -> plan-approved -> implementing` の隣接 forward 圧縮。evidence = plan-gate: rally round 1 開始（plan-first `3829b95` + round 1 発注）/ plan-approved: rally 3 round 収束 P1/P2 = 0（round 3 新規指摘 0、是正 commit `c6747f5` `dfe2cc5` `90854ce` 収束記録 `cd8375b`）+ owner approval / implementing: Plan Commit `3829b95`（plan-first、全実装 commit に先行）確定。Codex 発注書は本遷移後に提示。
- 以後の予定: Codex Writer 実装（worktree 隔離）→ L1 full → 独立 Sonnet Final Review（Double Audit）→ Ready 承認（介入 2 回目）→ state-only 2 本目（`implementing -> local-verified -> independent-review -> human-confirm -> ready-hosted-final`。Human Gate に visual confirmation なしのため human-confirm の evidence は owner plan approval + Ready 承認で構成、PR #70 先例）→ docs-only の explicit dispatch で三点一致 → merge（介入 3 回目）。

### gated amendment 1（2026-08-21、Codex Writer fail-closed 起源、true positive）

- 事象: packet `## Risk` 節が bullet 形式（`- R3（...）`）のみで、PK1 の必須形式 = 行全体が `Risk: Rn` の standalone 行（`doc-consistency-check.sh` `get_valid_plan_risk` の `grep -xE`、先例 = PR #70 / #86 packet）を欠いており、`doc-consistency-check.sh` が ERROR 1 で fail。Writer の発注書は packet 変更を Implementation Results 追記に限定しているため fail-closed 停止（正しい停止判断）。
- 検出経緯の記録: Coordinator 起草時と Plan Gate rally 3 round はいずれも doc-consistency-check を未実行（round 1 / 2 は「未実施」と明示申告、round 3 は plan-draft 段階の対象外整理）。checker 実行を伴う最初の工程 = Writer 着手時に検出された。plan-draft 段階の packet に対する checker 実行を rally 発注書へ含める改善は WER 候補として記録する。
- 裁定 = A 案: `## Risk` 節冒頭へ standalone `Risk: R3` 行を追加（既存の説明 bullet は維持）。発注書の「packet は Implementation Results 以外変更禁止」は Writer / Coordinator の正しい分業のため改訂しない（B 案不採用）。設計意味は不変、Plan Commit `3829b95` 維持。
- amendment commit = 本 commit（SHA は state-only 遷移 2 本目で Workflow State `Amendments` 行へ追記する）。

### gated amendment 2（2026-08-21、Codex Writer fail-closed 起源、true positive）

- 事象: gated amendment 1 で `Risk: R3` が PK1 に認識された結果、R3 固有検査が段階発火 — (1) packet が Test Design Matrix への Markdown link / 専用節を欠く（Test Plan 節は prose のみ、Matrix 参照は Trace Matrix 節の backtick のみ）(2) `## Review Response` に `- Findings Freeze:` 行がない。`doc-consistency-check.sh` ERROR 2。いずれも Implementation Results 外のため Writer は分業境界で停止（正しい判断、2 回連続の true positive）。
- 裁定 = A 案（gated amendment 1 と同じ分業判断）: Test Plan 節冒頭へ Markdown link（PR #70 packet の先例形式）、Review Response へ `- Findings Freeze: not yet frozen; post-freeze exceptions: none.`（PR #86 packet の先例形式）を追加。設計意味は不変、Plan Commit `3829b95` 維持。
- 教訓の追記（gated amendment 1 の WER 候補を拡張）: R3 packet の checker 検査は `Risk: Rn` 認識後に検査項目が段階発火する。plan-draft 段階の rally 発注書へ「doc-consistency-check を実行し ERROR 0 を確認」を含めれば、形式系 3 件（Risk 行 / Matrix link / Findings Freeze）は起草直後に一括検出できた。
- amendment commit = 本 commit（SHA は state-only 遷移 2 本目で `Amendments` 行へ追記する）。

### gated amendment 3（2026-08-21、`doc-consistency-check.sh` WARN 6 件の形式充足、Coordinator 実施）

- 事象: Writer 完了報告の特記事項どおり、packet 起源の `doc-consistency-check.sh` WARN 6 件（D-046 Goal Invariant marker / PK3 Trace Matrix data row / PK3 AC1〜AC3 観測 token ×3 / PK6 数値主張の evidence 参照）が残存。ERROR 0 のため gate は通るが、先例 packet（PR #70 / #86）は WARN 0 相当で Final Review の指摘対象になる形式差。
- 裁定: Coordinator が一括充足 — Goal Invariant block 追加 / Trace Matrix へ data row 5 行 / AC1〜AC3 へ観測 token（`rg -F -c` 等の backtick）/ rally round 3 記録行へ evidence commit 参照を追記（数値・内容は不変、形式補完のみ。append-only 記録の本文改変はこの evidence 参照追加 1 行に限る）。
- 設計意味・Scope・Matrix 検証行は不変、Plan Commit `3829b95` 維持。amendment commit = 本 commit（SHA は state-only 遷移 2 本目で `Amendments` 行へ追記）。

### Final Review round 1（2026-08-21、独立 Sonnet Final Reviewer、content `d21f5b9`、worktree 隔離、Double Audit）

- Verdict: **P1 0 / P2 0 / P3 0**。Writer 自己検証記録に依存しない独立再現で齟齬なし。
- Audit A: Contract Coverage Ledger L1〜L9 全行 OK（正本 doc 実文言との突合）。L2 = merge-tree が「記録上未実測の推奨手順」として明示区別済み / L3 = 二段 cap が `check-workflow-git.sh` 実装（`-gt 3` / `-gt 2`・同一範囲定義）と完全一致 / L9 = D-074 が Decision / Status / Why / Impact / Alternatives considered / Revisit の 6 項目完備、Revisit = merge-tree 事前判定の実測検証。
- Audit B: M-S1〜M-S8 / M-S11 の anchor を独立再実行（`rg -F -c` exact 1 hit + repo 重複なし、全 PASS）。mutation は Writer 注入形と独立の 4 系統（単段→多段反転 / D-074 Revisit 行削除 / 二段 cap 数値改変 / referent 一致文削除）全 red → 復元 → tree clean。M-S9 = 既存契約行（D-055 / D-038 / D-039 / Wave Operation 既存 bullet / §5.6 既存文）の書換え 0 を hunk 単位で確認（diff 全行が追加のみ）。
- 機械検査: `doc-consistency-check.sh` ERROR 0（既存 per_page WARN のみ）/ `generate_traceability --check` 不変 / `check-workflow-git.sh` PASS。規則発明の最終確認 = PR #86 一次資料と正本化文言の一致、未実測への外挿なし。
- 未実施: reviewer は `local-ci.sh full` を diff scope（docs-only）判断で 3 点検査に代替。L1 full は Writer が content `496d0c4` で PASS 取得済みで、Ready 遷移後の exact HEAD で再取得する（規定どおり、envelope は PR body）。
- 残る Human Gate = Ready 承認（介入 2 回目 / 予算 3 回）→ state-only 遷移 2 本目（`implementing -> local-verified -> independent-review -> human-confirm -> ready-hosted-final`、`Amendments` へ amendment commit 3 本を追記、Reviewed Content HEAD = `d21f5b9`）→ 同 HEAD 系で L1 full → PR body refresh → docs-only の explicit dispatch → 三点一致 → merge。

### state-only 遷移 2 本目（2026-08-21、隣接 forward 圧縮）

- `implementing -> local-verified -> independent-review -> human-confirm -> ready-hosted-final`（STATECAP forward 2/3、post-impl subset 1/2）。
- evidence: local-verified = Writer L1 full PASS（content `496d0c4`、envelope は PR body）+ 本遷移後の exact HEAD で L1 full 再取得。independent-review = Final Review round 1 P1/P2/P3 = 0（content `d21f5b9`、Double Audit）。human-confirm = 本 change は画面変更なしで visual confirmation なし（Human Gate 構成どおり）、owner plan approval + Ready 承認で構成。ready-hosted-final = owner Ready 承認（owner 発言 `readyしたよー`、2026-08-21。介入 2 回目 / 予算 3 回）。
- Amendments 行へ gated amendment 1〜3（`4ec0630` / `2135aa0` / `d21f5b9`）を追記、Reviewed Content HEAD = `d21f5b9` を設定（以後の差分 = Final Review 記録 `55e490e` + 本 state-only commit のみ）。
- 運用逸脱の記録: DEV_WORKFLOW は Ready 遷移 commit を Draft 中に作成 → owner が Ready トリガーの順を規定するが、owner が承認と同時に GitHub 上の Ready 化を先行実施（非同期対応、PR #88 と同型）。本遷移 commit はその後になった。Ready 時点の趣旨（最終 exact HEAD での検証）は、本 commit を最終 HEAD として L1 full + docs-only explicit dispatch を取得することで充足する。
