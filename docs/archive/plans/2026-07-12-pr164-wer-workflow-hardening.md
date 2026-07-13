# Plan Packet: PR #164 振り返り反映 — WER作成 + workflow規律のrepo昇格 + モデル固定役割の撤廃

## Workflow State

- Phase: archive
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: e70ae30
- Coordinator: Fable (main thread)
- Writer: Sonnet subagent
- Plan Reviewer: Sonnet subagent (fresh)
- Final Reviewer: Sonnet subagent (fresh ×2, double audit)
- Reviewed Content HEAD: 21867af
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: none（Ready authorization / merge とも owner 実施済み 2026-07-12）

design board 例外適用（MANUAL §3.1）: workflow design-only change + owner 明示指示（2026-07-12 本 plan 承認）により Fable = Coordinator（design docs の Writer には割り当てない）。Plan Reviewer / Final Reviewer は Fable 以外の独立 fresh context（Sonnet subagent）。

## Owner Effort Budget

本 packet 単位の既定上限（DEV_WORKFLOW.md へ本 PR で新設する `## Owner Effort Budget` 節の自主 dogfood）:

- 介入回数: ≤3（Plan 承認 / Ready 承認 / merge の 3 接点のみ）
- 実働時間: ≤30 分（目視確認 + 承認判断のみ、証跡整形・PR 本文転記・waiver 文言化は agent 側が行う）
- relay 往復: 0（owner をモデル間の伝書鳩にしない）

超過が見込まれる場合は Coordinator（Fable）が工程を簡略化する。owner が吸収しない。

## Risk

Risk: R3

Reason:
`docs/DEV_WORKFLOW.md` の Review Rules（Findings Freeze）・Workflow State/Evidence Ownership・新設 `Owner Effort Budget`、`docs/AGENT_OPERATING_MANUAL.md` §3 の役割定義全面書き換え、`docs/templates/plan-packet.md` / `workflow-effectiveness-review.md` の必須節追加を含む merge gate 変更。Risk Tiers の「operator workflow, or merge gate changes」に該当し、docs-only であっても R3 workflow gate として扱う（DEV_WORKFLOW.md Human Visual Confirmation 節および D-034/D-035 の前例と同水準）。

## Goal

PR #164（UI-11c）が P1 流出ゼロを達成しつつもレビュー9ラウンド・遷移/docs同期のみのコミット9/20（うち純粋なphase遷移5、WER一次証跡集計）・owner hands-on過多という高コストを払った原因（フルスコープ再監査の収束条件欠如、drift規律がClaude auto-memoryに閉じてCodex実装者に届かない、モデル固定役割表の属人化、外部前提の未検証）を Workflow Effectiveness Review（WER）として記録し、その是正を `docs/DEV_WORKFLOW.md` / `docs/AGENT_OPERATING_MANUAL.md` / テンプレ2件 / `docs/decision-log.md` / `docs/Plans.md` の正本へ反映する。次の R3 change（UI-13）が同じ税金を払わないようにする。

## Scope

- `docs/archive/plans/2026-07-12-ui11c-pr164-workflow-effectiveness-review.md`（新規）: `docs/templates/workflow-effectiveness-review.md` 準拠で PR #164 の 9 ラウンド内訳・P2 推移・D5 drift 3 ラウンド残存経路・遷移/docs同期のみコミット 9/20（うち純粋 phase 遷移 5）・doc-only 監査 6/9 ラウンド GH 非可視・owner hands-on 実態・既存規定（遷移バッチ圧縮 L101/L109、伝書鳩禁止 MANUAL §3.4 L91）が機能しなかった事実を記録する
- `docs/DEV_WORKFLOW.md`:
  - Plan Packet Rules: R3/R4 で不確実な外部前提がある場合、Plan Gate 前に **Contract Probe**（最小実験）実施・packet 記録を 1 行追加する規定を追加
  - Workflow State ブロック直後（D-035 節）: (a) Evidence Ownership 拡張 — テスト件数も volatile evidence として tracked docs 転記禁止、PR 本文/CI 出力のみ正本（D-038、今後の記述のみ適用）、(b) state-only commit 上限 = 1 PR あたり 3（plan-approval 遷移 1 + post-implementation 必須 2 遷移、Audit #2 P2 指摘により 2→3 へ改定）
  - Subagent Budget 直後: 新規節 `## Owner Effort Budget`（本 packet 上記節と同内容を正本化）
  - Human Visual Confirmation For Screen Changes 節: **L3 Eligibility** 3 条件（Windows/Tauri ネイティブでしか観測できない項目のみ／human gate 中の新規ツール導入禁止／DB lock・synthetic row 投入・設定復元のような手動故障注入級の手順を人間 L3 に置かない）+ owner は目視+PASS/FAIL 判定のみ
  - Review Rules: **Findings Freeze**（初回 Broad Audit 完了後に finding set を凍結。2 本の Contract Audit pass が実際に走る場合は常に — 必須の R4/workflow gate の Double Audit でも、Contract Audit 節の推奨2本目を選択した R3 change でも — 両 pass まとめて「初回 Broad Audit」を構成し freeze は両 pass 完了後に発効、Audit #2 P1 指摘により R3 側も対象化。凍結後の新規 P2 は runtime failure 実証時のみ blocker、新規 P3 は follow-up、broad review lane は 1 本でリスクの所在により選択）
  - Contract Audit (R3/R4): drift 指摘初回受領時に指摘 keyword を rg でリポジトリ全体検索し 1 コミット一括修正、を既存箇条書きと同粒度で追加
  - Post-Merge Closeout: 「manual check 記録は agent が記録する、owner に転記させない」を追記
- `docs/AGENT_OPERATING_MANUAL.md` §3（主戦場）: §3.1〜3.3 のモデル slot 固定役割表（pipe table）を削除し、単一の独立性制約リストへ置換（Writer≠Plan Reviewer / Writer≠Final Reviewer / Final Reviewer は Coordinator・Writer と fresh context / R4・workflow gate は Double audit / Human Gate は owner 限定 / 希少・高コスト slot は通常実装 Writer に充てない、例外は Workflow State に理由 1 行）。以下の prose は model-neutral 表現で §3 内に存置する: Fable を呼ぶ/呼ばない条件（3 条件）、design board 例外、Execution Mode 各値の定義。§3.4 slot 表は非規範的用語集として存続（「唯一の載せ替え点」文言は削除）。§3.5 Capacity-degraded は実質維持。§2 Coordinator 行に Owner Effort Budget 監視・超過時簡略化の責務を追記
- `docs/templates/plan-packet.md`: 新規節 `## Owner Effort Budget`（Workflow State 直後）+ `## Contract Probe`（Design Readiness と Contract Coverage Ledger の間、N/A 時は理由 1 行）、Review Response に Findings Freeze 状態の記録行、Implementation Results に「SHA・テスト件数は転記しない」注記
- `docs/templates/workflow-effectiveness-review.md`: Cost/Friction に「review rounds（broad+closure内訳）」「state-only commits/総commit数」の 2 行追加
- `docs/decision-log.md`: **D-038** 新設（本変更 bundle、Why=WER リンク、Alternatives= 毎回フル再監査継続/即hook化/Contract Audit廃止/phase enum改名を rejected、Revisit=UI-13 dogfood WER、D-034 slice 2 対象の新規語彙一覧を明記）。D-034 の Status 行に slice 2 対象語彙追記、D-034/D-035 の Revisit 行に「resolved (2026-07-12): see D-038 + WER」追記、`Superseded in part by: D-038` 追加
- `docs/Plans.md`: L26「個別WERは新設せず」を WER リンク + 「UI-13を新ルールのdogfood target」へ書き換え。本改定タスクを進行中エントリに追加
- `.claude/hooks/check-plan-on-exit.sh`: 作業ツリーに適用済みの fallback bugfix（`docs/plans/` に active plan が無い状態で `--target plan` が「チェック対象のプランファイルが見つかりません」で exit 2 になり ExitPlanMode hook が誤って deny する edge case を、`--target plan` が該当メッセージで失敗したときのみ通常 full check へ fallbackさせて修正。DEV_WORKFLOW.md L62 の「no active plans なら full check」規定の hook 側実装。今回のテーマ「規定はあるが実効性欠如」の実例として同 PR で拾う）。この変更は 2026-07-12 に owner が作業ツリーへ手動適用済みで、`plan-approved → implementing` 遷移後の最初の content commit として記録する
- `.agents/skills/inventory-workflow-start/SKILL.md` L21 の 1 行 model-neutral 化（Audit #2 P2 指摘によるscope拡大）: 「Missing Fable or Claude capability changes the mode; it does not block the workflow.」を MANUAL §3.1「希少・最高能力 slot」表現と整合する model-neutral 文言へ書き換える。他行は触らない

## Non-scope

- Workflow State 13-phase enum の改名（`docs/DEV_WORKFLOW.md` の enum 定義行は無変更のまま維持する）
- exact-HEAD 三点一致（D-033/D-035）の変更
- `scripts/doc-consistency-check.sh` の編集（PK4/PK5 機械強制は D-034 slice 2 の scope）
- 過去 archive 済み Plan Packet / WER の遡及編集
- 上記 `inventory-workflow-start/SKILL.md` L21 の 1 行を除く他の `.agents/skills/*` の編集

## Acceptance Criteria

- `bash scripts/doc-consistency-check.sh` が exit 0（`結果: 全チェック通過` または WARN のみ）
- `rg -n "Findings Freeze|Contract Probe|Owner Effort Budget|L3 Eligibility|Evidence Ownership" docs/DEV_WORKFLOW.md` の各語につき定義箇所 1 件以上が存在し、他ファイルからの参照が 1 箇所以上ある
- `rg -n '\bFable\b|\bSol\b|\bTerra\b|\bLuna\b|\bSonnet\b' docs/AGENT_OPERATING_MANUAL.md docs/DEV_WORKFLOW.md docs/templates/` の hit が MANUAL §3.4 用語集を除いてゼロ。`docs/Plans.md` は規範文書ではなく履歴ダッシュボードのため全文走査せず、本 PR で追加・変更した行（`git diff main -- docs/Plans.md` の `+` 行）のみを同条件でチェックする（2026-07-12 より前の PR 進捗・履歴叙述行は対象外）
- `git diff main -- docs/DEV_WORKFLOW.md` で Workflow State の `Phase`: 行（13 値 enum 定義行）に差分がない
- `rg "個別WERは新設せず" docs/Plans.md` の hit が 0 件、かつ `docs/archive/plans/2026-07-12-ui11c-pr164-workflow-effectiveness-review.md` への Markdown リンクが `docs/Plans.md` に 1 件以上存在する
- `docs/archive/plans/2026-07-12-ui11c-pr164-workflow-effectiveness-review.md` が `docs/templates/workflow-effectiveness-review.md` の全 `## ` 見出しを保持する（TM-7）
- `docs/decision-log.md` に `## D-038` セクションが存在し、D-034/D-035 実フォーマットと同じ Decision/Status/Why/Impact/Alternatives considered/Revisit の 6 要素を含む（TM-8）
- `.claude/hooks/check-plan-on-exit.sh` の fallback 分岐が `bash -n .claude/hooks/check-plan-on-exit.sh` で syntax エラーなし、かつ `docs/plans/` に active plan が存在する通常経路で `bash scripts/doc-consistency-check.sh --target plan` の ERROR 系判定が変化しない

## Design Sources

- Requirements / spec: `docs/DEV_WORKFLOW.md`（Flow / Risk Tiers / Plan Packet Rules / Workflow State / Review Rules / Contract Audit / Post-Merge Closeout）
- Architecture: `docs/AGENT_OPERATING_MANUAL.md`（役割 / mode の正本）
- Function / command / DTO: 該当なし（runtime code 非接触）
- DB: 該当なし
- Screen / UI: 該当なし
- Decision log / ADR: `docs/decision-log.md` D-034 / D-035 / D-036 / D-037（新設 D-038 が本 PR の主対象）、`docs/archive/plans/2026-07-08-ui10-stocktake-workflow-effectiveness-review.md`（PR #159 一次入力、Contract Audit 前例）、`docs/archive/plans/2026-07-10-workflow-model-neutral-redesign.md`（Workflow State / role-split の直近前例、rally 収束・packet 構成の踏襲元）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | 該当なし（runtime 非接触） | existing sufficient |
| Command / DTO / generated binding / wire shape | 該当なし | existing sufficient |
| DB / transaction / audit / rollback / migration | 該当なし | existing sufficient |
| Screen / UI / route state / Japanese wording | 該当なし | existing sufficient |
| CSV / TSV / report / import / export format | 該当なし | existing sufficient |
| Durable decision / ADR | `docs/decision-log.md` D-038 | updated in this PR |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-WF-FREEZE | DEV_WORKFLOW.md Review Rules | D-038 | 毎ラウンドのフルスコープ再監査を継続する案は rejected（PR #164 の 9 ラウンド化の主因）。即座に closure-only 化する案も rejected（R4/Double Audit の価値を殺す）ため、Double Audit は「まとめて初回」扱いにする但し書きを採用 | DEV_WORKFLOW.md Review Rules（本 PR） | Test Matrix TM-1 / TM-2 |
| SPEC-WF-OWNER-BUDGET | DEV_WORKFLOW.md 新設 `## Owner Effort Budget` | D-038 | owner を伝書鳩にしない既存規定（MANUAL §3.4）はあったが定量上限がなかった。定量化しない案は rejected（実効性欠如の再生産） | DEV_WORKFLOW.md + plan-packet.md テンプレ（本 PR） | Test Matrix TM-1 / TM-2、本 packet 自身の dogfood |
| SPEC-WF-L3-ELIG | DEV_WORKFLOW.md Human Visual Confirmation | D-038 | UI-11c の L3-7/L3-8（SQLite CLI・synthetic row・DB lock/WAL操作）が手動故障注入級に膨張し waiver された実績を根拠に、L3 対象外条件を明文化。全 L3 廃止案は rejected（実機観測が必要な項目は残す） | DEV_WORKFLOW.md Human Visual Confirmation（本 PR） | Test Matrix TM-1 / TM-2、次 R3 UI 変更での dogfood |
| SPEC-WF-EVIDENCE | DEV_WORKFLOW.md Workflow State / D-035 ブロック | D-038 | テスト件数の tracked docs 転記が owner hands-on の一部だった（PR #164 実態）。state-only commit 上限は plan-approval 遷移 1 + Workflow State L95/L96 の必須 2 遷移 = 計 3（Audit #2 P2 指摘で 2→3 へ改定）に対応させ、それ以外は既存 L101 圧縮規定に乗せる | DEV_WORKFLOW.md（本 PR） | Test Matrix TM-1 / TM-6 |
| SPEC-WF-ROLES | AGENT_OPERATING_MANUAL.md §3 | D-038 | モデル固定 pipe table を維持する案は rejected（属人化の直接原因）。全 prose 削除案も rejected（Fable 起用条件・design board 例外・Execution Mode 定義は内容として必要、model-neutral に書き直すだけで足りる） | AGENT_OPERATING_MANUAL.md §2/§3（本 PR） | Test Matrix TM-3 |
| SPEC-WF-PROBE | DEV_WORKFLOW.md Plan Packet Rules | D-038 | UI-11c の Round 5 P2 群（chrono format 挙動・TanStack Query cache 挙動）が外部前提の未検証に起因した事実を根拠に、Plan Gate 前の最小実験を規定化。既存 Impact Review Lenses の「Fact check / design decision split」を拡張し新概念を重複させない | DEV_WORKFLOW.md Plan Packet Rules + plan-packet.md テンプレ（本 PR） | Test Matrix TM-1 / TM-2、次の外部前提を含む R3/R4 change での dogfood |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 本 PR 後、Findings Freeze / Owner Effort Budget / L3 Eligibility / Evidence Ownership / Contract Probe は `docs/DEV_WORKFLOW.md` に、role 定義は `docs/AGENT_OPERATING_MANUAL.md` に、判断根拠は D-038 と本 WER から復元可能
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: 6 契約すべてを D-038 として `docs/decision-log.md` へ昇格する（本 packet を唯一の home にしない）
- Assumptions and constraints: 本変更は docs-only（runtime code 非接触）、既存 13-phase enum / exact-HEAD 三点一致 / Contract Audit 標準は不変という前提
- Deferred design gaps, risk, and follow-up target: PK4/PK5 等の機械強制（D-034 slice 2）は今回の scope 外。D-038 に slice 2 対象の新規語彙一覧（Owner Effort Budget 節存在チェック / Findings Freeze 状態行 / Contract Probe 節 / state-only commit 数）を明記し取りこぼしを防ぐ
- Test Design Matrix can cite design decision IDs or source doc sections: [test-matrices/2026-07-12-pr164-wer-workflow-hardening.md](test-matrices/2026-07-12-pr164-wer-workflow-hardening.md) は SPEC-WF-FREEZE / OWNER-BUDGET / L3-ELIG / EVIDENCE / ROLES / PROBE を引用する

## Impact Review Lenses

本タスクは実機調査・POS/register 統合・CSV/TSV 変更ではなく、PR #164 の運用実績（review ラウンド数・state-only commit 比率・owner hands-on 実態）に基づく workflow 規律の是正のため、該当するレンズのみ埋める。

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable。外部アダプタ非接触 | なし |
| Fact check / design decision split | applicable。PR #164 の 9 ラウンド内訳・state-only 比率・「既存規定が機能しなかった」2 件は観測事実、その是正手段（Findings Freeze 等 6 契約）は設計判断として D-038 に分離 | D-038、WER |
| Lifecycle / retry | not applicable。stateful UI/data lifecycle 非接触 | なし |
| Operator workflow | not applicable。店舗 operator 画面に非接触 | なし |
| Replacement path | not applicable | なし |
| Data safety / evidence | not applicable。実データ・secret 非接触 | なし |
| Reporting / accounting semantics | not applicable | なし |
| Manual verification | applicable。モデル名残存 rg・用語定義-参照整合 rg・doc check green は自動化できるが、§3 削除 scope の正確性（prose の意図せぬ削除がないか）は independent-review の人手確認が必要 | Review Focus、Trace Matrix |

## Design Readiness

- Existing design docs are sufficient because: 本タスクの一次入力は owner 承認済みの改定方針（rally 3 ラウンドで P1/P2 = 0 に収束済み）と本 PR で新規作成する WER であり、両方とも本 packet が直接引用する。追加の外部設計ドキュメントは不要
- Source docs updated in this PR: `docs/DEV_WORKFLOW.md`、`docs/AGENT_OPERATING_MANUAL.md`、`docs/templates/plan-packet.md`、`docs/templates/workflow-effectiveness-review.md`、`docs/decision-log.md`（D-038）、`docs/Plans.md`、`docs/archive/plans/2026-07-12-ui11c-pr164-workflow-effectiveness-review.md`（新規 WER）
- Design gaps intentionally deferred: PK4/PK5 等の機械強制の具体実装（grep パターン・エラーメッセージ文言）は D-034 slice 2 の Design Phase で確定する
- Durable decisions discovered in this plan and promoted to source docs: D-038（Findings Freeze / Owner Effort Budget / L3 Eligibility / Evidence Ownership 拡張 / role 独立性制約 / Contract Probe の 6 契約バンドル）

Minimum design checks for business-app work:

- Layer ownership（UI → CMD → BIZ → IO/MNT）: 非接触、変更なし
- Backend function design: 非接触
- Command / DTO / data contract: 非接触
- Persistence / transaction / audit impact: 非接触
- Operator workflow / Japanese UI wording: 非接触
- Error, empty, retry, and recovery behavior: 非接触（Workflow State の fail-closed / 遷移規則は既存のまま変更しない）
- Testability and traceability IDs: SPEC-WF-FREEZE / SPEC-WF-OWNER-BUDGET / SPEC-WF-L3-ELIG / SPEC-WF-EVIDENCE / SPEC-WF-ROLES / SPEC-WF-PROBE

## Contract Probe

該当なし（N/A）。本変更は docs-only で、外部ライブラリ・POS/register・OS API 等の未検証な外部前提を含まない。Contract Probe 契約（SPEC-WF-PROBE）自体は今回新設するが、その適用対象は次の R3/R4 change から。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| SPEC-WF-FREEZE | DEV_WORKFLOW.md Review Rules | `bash scripts/doc-consistency-check.sh`（TM-1）+ 用語 rg（TM-2） | non-scope。Double Audit の実効性は次の R4/workflow gate dogfood で検証（本 PR 自身が初回実証） |
| SPEC-WF-OWNER-BUDGET | DEV_WORKFLOW.md 新設節 + plan-packet.md テンプレ | TM-1 + TM-2 | non-scope。本 packet の Owner 実働時間・介入回数を Implementation Results に記録し自主 dogfood とする |
| SPEC-WF-L3-ELIG | DEV_WORKFLOW.md Human Visual Confirmation | TM-1 + TM-2 | non-scope（本 PR に画面変更なし）。次の operator-facing R3 change で dogfood |
| SPEC-WF-EVIDENCE | DEV_WORKFLOW.md Workflow State/D-035 ブロック + Post-Merge Closeout | TM-1 + TM-2 | non-scope。state-only commit 上限 3（うち post-implementation 2）は本 packet 自身の Wave 2 以降の遷移コミットで dogfood |
| SPEC-WF-ROLES | AGENT_OPERATING_MANUAL.md §2/§3 | TM-3（モデル名残存 rg）+ TM-1 + TM-9（存置すべき prose 3 点の残存 rg） | non-scope。独立性制約リストの実効性は independent-review（本 packet の Plan Reviewer / Final Reviewer 役割分離自体）で確認 |
| SPEC-WF-PROBE | DEV_WORKFLOW.md Plan Packet Rules + plan-packet.md テンプレ | TM-1 + TM-2 | non-scope（本 PR は Contract Probe = N/A 事例）。次に外部前提を含む R3/R4 change が実地の dogfood target |

## Test Plan

Test Design Matrix: [test-matrices/2026-07-12-pr164-wer-workflow-hardening.md](test-matrices/2026-07-12-pr164-wer-workflow-hardening.md)

- targeted tests: `bash scripts/doc-consistency-check.sh`（TM-1）。契約と検証点の対応は `## Contract Coverage Ledger` を正とする
- negative tests: 用語 5 語の「定義なき参照」ゼロ（TM-2）、モデル名残存ゼロ（TM-3）
- compatibility checks: Workflow State enum 行の無変更（TM-4）、`docs/Plans.md` の旧文言残存ゼロ（TM-5）
- data safety checks: 該当なし（docs-only、店舗データ・secret 非接触）
- main wiring/integration checks: hook fallback の active-plan-exists 経路が既存 ERROR 判定を変えないこと（TM-6）
- artifact fidelity checks: WER が template の全 `## ` 見出しを保持すること（TM-7）、D-038 が D-034/D-035 実フォーマットの 6 要素を含むこと（TM-8）、MANUAL §3 書き換え後も存置すべき prose 3 点（design board 例外 / Execution Mode 定義 / 希少・高コスト slot 投入条件）が残存すること（TM-9）

## Boundary / Wire Contract

該当なし。本変更は docs-only で JSON API、browser state、CSV、config、manifest、cache schema、Tauri command DTO、generated binding、report output、DB-backed compatibility のいずれにも接触しない。

## Review Focus

- Findings Freeze と Double Audit の整合: R4/workflow gate の Double Audit（独立2回）が「まとめて初回 Broad Audit」を構成するという但し書きが、Freeze の早期発効による見落とし再発（PR #164 型）を招かないか
- `docs/AGENT_OPERATING_MANUAL.md` §3 の削除 scope の正確性: 削除対象が §3.1〜3.3 の pipe table のみに限定され、Fable 起用条件・design board 例外・Execution Mode 定義などの prose が意図せず消えていないか
- 用語 5 語（Findings Freeze / Contract Probe / Owner Effort Budget / L3 Eligibility / Evidence Ownership）の定義-参照整合: 各ファイルで一字一句一致しているか、定義なき参照が残っていないか

## Spec Contract

Required for R3/R4.

Contract ID: SPEC-WF-2026-07-12-HARDENING

- SPEC-WF-FREEZE: R3/R4 の independent-review は初回 Broad Audit 完了後に finding set を凍結する。R4/workflow gate changes の Double Audit は 2 回まとめて「初回 Broad Audit」を構成し、Freeze は両 audit 完了後に発効する。凍結後の新規 P2 は runtime failure 実証時のみ blocker、新規 P3 は follow-up。broad review lane は 1 本、選択軸は「リスクの所在」（cross-layer/契約系→Contract Audit lane、UI表現系→review-checklist §9 + operator-ui skill、両方跨る場合のみ両方）
- SPEC-WF-OWNER-BUDGET: R2+ Plan Packet は Owner 介入回数 ≤3・実働 ≤30 分・relay 往復 ≤2 の既定上限を持つ（packet 単位で理由付き調整可）。超過が見込まれる場合は Coordinator が工程を簡略化し、Owner が吸収しない
- SPEC-WF-L3-ELIG: 人間 L3 対象は次の 3 条件を満たす項目に限る — (1) Windows/Tauri ネイティブでしか観測できない項目、(2) human gate 中に新規ツール導入を要しない、(3) DB lock・synthetic row 投入・設定復元のような手動故障注入級の手順を含まない（自動テスト送り）。Owner は目視 + PASS/FAIL 判定のみ行い、証跡パッケージング・PR 本文整形・waiver 文言化は agent 側の責務
- SPEC-WF-EVIDENCE: テスト件数を含む volatile evidence は tracked docs へ転記せず PR 本文/CI 出力のみを正本とする（D-038、今後の記述にのみ適用し過去 archive は遡及しない）。state-only transition commit は 1 PR あたり上限 3（plan-approval 遷移 1 + Workflow State の必須 2 遷移 `independent-review → human-confirm` / `human-confirm → ready-hosted-final` に対応、Audit #2 P2 指摘により 2→3 へ改定、他は既存の隣接遷移圧縮規定に実 content commit と同乗させる）。Post-Merge Closeout の manual check 記録は agent が行い、owner に転記させない
- SPEC-WF-ROLES: `docs/AGENT_OPERATING_MANUAL.md` §3 の役割割当はモデル slot 固定表でなく独立性制約で定義する（Writer≠Plan Reviewer、Writer≠Final Reviewer、Final Reviewer は Coordinator・Writer と fresh context、R4/workflow gate は Double audit、Human Gate は owner 限定、希少・高コスト slot は通常実装 Writer に不使用・例外は Workflow State に理由 1 行）。Fable 起用条件・design board 例外・Execution Mode 定義は model-neutral な prose として §3 内に存置し、§3.4 slot 表は非規範的用語集としてのみ残す
- SPEC-WF-PROBE: R3/R4 で不確実な外部前提（外部ライブラリ・OS/ハードウェア挙動等）が Plan に含まれる場合、Plan Gate 前に最小実験（Contract Probe）を実施し packet に 1 行記録する。既存 Impact Review Lenses「Fact check / design decision split」の拡張として位置付け、新概念として重複させない

## Trace Matrix

Required for R3/R4.

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-WF-FREEZE | DEV_WORKFLOW.md Review Rules に Findings Freeze 節を追加（Slice A） | `bash scripts/doc-consistency-check.sh`、用語 rg（TM-1/TM-2） | Double Audit との整合、早期発効による見落とし再発リスク | PR diff + Review Response |
| SPEC-WF-OWNER-BUDGET | DEV_WORKFLOW.md 新設節 + plan-packet.md テンプレ新設節（Slice A/D） | TM-1/TM-2 + 本 packet 自身の Owner 実働記録 | 上限値の妥当性、超過時の Coordinator 簡略化責務の明記 | PR diff + Implementation Results |
| SPEC-WF-L3-ELIG | DEV_WORKFLOW.md Human Visual Confirmation 節に L3 Eligibility 追加（Slice A） | TM-1/TM-2 | UI-11c L3-7/L3-8 waiver 経緯の引用が正確か | PR diff |
| SPEC-WF-EVIDENCE | DEV_WORKFLOW.md Workflow State/D-035 ブロック + Post-Merge Closeout 更新（Slice A） | TM-1 + TM-2（Evidence Ownership 用語整合） | state-only 上限 3（うち post-implementation 2）が Workflow State L95/L96 の必須遷移と整合するか | PR diff + 本 packet の Review Response 遷移履歴 |
| SPEC-WF-ROLES | AGENT_OPERATING_MANUAL.md §2/§3 全面書き換え（Slice B） | TM-3（モデル名残存 rg）+ TM-1 + TM-9（存置すべき prose 3 点の残存 rg） | §3.1〜3.3 削除 scope が pipe table のみか、prose 存置が正確か | PR diff |
| SPEC-WF-PROBE | DEV_WORKFLOW.md Plan Packet Rules + plan-packet.md テンプレ新設節（Slice A/D） | TM-1/TM-2 | 既存 Impact Review Lenses との重複がないか | PR diff |

## Data Safety

Required for R3/R4.

- 実 POS CSV / PLU export / 店舗データ / DB / backup / log / secret / `.env*` に一切触れない（docs のみの変更、`.claude/hooks/check-plan-on-exit.sh` の bugfix も店舗データ非接触）
- local-only paths（`.local/`、`docs/research/real-csv/` ほか project-profile 記載）は変更しない
- 該当する synthetic-only path なし（本変更は synthetic データを生成しない）

## Implementation Results

Fill after implementation.

## Review Response

Fill after review.
If R3 review-only sub-agent is skipped, record an explicit line beginning with `Review-only skipped because:` and the reason.
- Double Audit 2本は Draft PR 作成前に Phase: implementing の時点で先行実施（informal pre-PR gate、UI-11c の Sol integration review と同型）。正式な independent-review 遷移は L1 evidence の PR body 記録後に実体化。

### Independent Review 記録（append-only narrative）

- Double Audit（独立 fresh Sonnet subagent ×2、Reviewed HEAD 05a9a74、Draft PR 作成前の先行実施）: Audit #1 = P1:0/P2:2/P3:1、Audit #2 = P1:1/P2:2/P3:3。両 pass 完了で finding set 凍結（Findings Freeze 自主 dogfood）
- 裁定: P1/P2 全採用（Freeze 対象拡大 / state-only 上限 3 / TM-3 再 scope / SKILL.md L21 model-neutral 化）、P3 4 件も同 batch 採用。一括是正 commit be28465（drift-fix sweep 規律の初 dogfood 込み）
- closure 確認: Audit #1 = 全 closure P1/P2=0。Audit #2 = 全 closure + 例外 1 件（Self-Review 行の機械的 drift）→ f2eef1c で是正 → micro-closure で両残 commit（f2eef1c / 21867af）確認済み、P1/P2=0
- L1 local full: content candidate = Reviewed Content HEAD で PASS（start/end CLEAN、MERGE_EVIDENCE_VALID=true）。evidence SHA / ファイル名は PR body 参照（Evidence Ownership 準拠、本 packet に転記しない）
- 本 state-only commit で隣接遷移 `implementing -> local-verified -> independent-review -> human-confirm` を一括実体化（state-only commit 2/3、上限内）。残 Human Gate: owner の Ready authorization / merge
- owner が Ready を承認（2026-07-12）。docs-only + hook 1 行のため L3 項目なし（L3 Eligibility 初適用）。Ready 遷移 state-only commit（3/3、上限ちょうど）を Draft のまま作成し、この HEAD で L1 full を再実行して PR body を更新後、Ready 化 → hosted final 1 回 → 三点一致 → owner merge の順で締める
- **Post-Merge Closeout（2026-07-12）**: PR #165 を owner が squash merge、main 反映 commit = `c0dd65f`。hosted final は run 29192090291 success、live PR HEAD = PR-body L1 SHA = hosted headSha の三点一致を merge 前に確認済み（詳細は PR #165 body が正本）。packet / Test Matrix を `docs/archive/plans/` へ移動し `merge -> archive` を実体化。owner 実働は Plan 承認 / Ready 承認 / merge の 3 接点のみ（Owner Effort Budget 内、証跡整形は全 agent 側）

### Plan Gate 記録（append-only narrative）

- Plan Gate R1（独立 Plan Reviewer, fresh Sonnet subagent）: P1=0 / P2=2 / P3=3。P2-1 = Ledger/Trace Matrix の SPEC-WF-EVIDENCE 行が TM-6 誤参照、P2-2 = AC bullet 6/7 の Test Matrix 行欠如。P3 3 件（TM-9 / hook 由来記録 / TM-5 ラベル）も全採用
- 是正 commit: 4d3f5d1（Writer: Sonnet subagent、smallest safe fix、checker green）
- Plan Gate R2（同 Reviewer、closure 確認のみ = Findings Freeze 自主 dogfood）: 全 5 件 closure 確認、新規矛盾なし、**P1/P2=0**
- 本 state-only commit で隣接遷移 `plan-gate -> plan-approved -> implementing` を一括実体化（DEV_WORKFLOW.md の隣接遷移圧縮規定に準拠）。根拠: Plan Reviewer P1/P2=0 報告済み、plan-first commit e70ae30 は全実装 commit に先行

## Self-Review

7 観点セルフレビュー（承認済み改定方針の rally 3 ラウンドで P1/P2 = 0 に収束済み、本 packet 作成時点での要点のみ再掲）:

1. **目的整合**: WER 新規作成・A 群反映・要不要仕分け（変更しないもの節）・Owner hands-on 廃止・stage-gate 化・Fable 指揮 + Sonnet 実装・relay 対策のいずれも Scope または Owner Effort Budget 節に対応行がある
2. **scope 境界**: D-034 slice 2（PK4/PK5 機械強制）、`scripts/doc-consistency-check.sh` 編集、過去 archive 遡及編集を明示 Non-scope 化した。`.agents/skills/*` は `inventory-workflow-start/SKILL.md` L21 の model-neutral 化 1 行（Audit #2 P2 指摘による scope 拡大）を除き Non-scope
3. **実現可能性**: 本タスク自身が現行 R3 workflow gate ルール（Test Matrix / Ledger / Double audit / hosted required）を満たす手順で進行しており、design board 例外（MANUAL §3.1）の現行規定内で役割割当が成立する
4. **検証可能性**: Test Design Matrix の 6 行はすべて `bash` / `rg` / `git diff` で機械実行可能
5. **儀式コスト自己監査**: 新規見出しは正本側 2（`## Owner Effort Budget` in DEV_WORKFLOW / plan-packet.md）+ `## Contract Probe`（plan-packet.md）のみ。フェーズ体系（13-phase enum）は不変
6. **依存関係**: Wave 1 の並列 3 スライス（DEV_WORKFLOW / MANUAL / WER）は one-writer・非重複 file ownership で衝突なし。Wave 2（テンプレ→decision-log→WER仕上げ+Plans.md）は Wave 1 の確定語彙に依存するため逐次
7. **rollback**: docs-only 変更のため PR 単位で revert 可能。データ・コード影響なし
