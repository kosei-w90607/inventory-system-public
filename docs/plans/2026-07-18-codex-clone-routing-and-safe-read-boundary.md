# Plan Packet — `.codex/` clone routing + safe-read boundary 是正

## Workflow State

Use the field definitions, enums, transition evidence, packet-selection rule, and fail-closed behavior from `docs/DEV_WORKFLOW.md` `Workflow State`. Keep exactly one `- Key: value` line per field.

If a state-only commit materializes multiple phases, list the complete adjacent forward sequence and the pre-existing evidence for every intermediate transition in an append-only review/evidence record. Recording compression never permits a gate skip.

- Phase: implementing
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: 6dbdf1b
- Amendments: none
- Coordinator: Fable 5（Claude Code main thread）
- Writer: Codex（owner 外部端末、public-writer clone に cwd pin）
- Plan Reviewer: Sonnet subagent（independent、Writer と別）
- Final Reviewer: Sonnet review-only subagent（workflow gate change のため Contract Audit Double Audit ×2 独立 context）+ Fable 5 裁定
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: 発注起動（owner 外部端末）/ Ready 承認 / merge

### 遷移記録（append-only）

- plan-first commit が kickoff → spec-check → design → plan-draft → plan-gate を圧縮 materialize する。根拠: task scope と Risk R3 は本 packet `Risk` 節に記録（kickoff → spec-check）。design 更新の要否は Design Phase で判定し、design 出力 = `docs/decision-log.md` D-049 を同一 plan-first change に含める（spec-check → design → plan-draft）。packet + Test Design Matrix は同 commit で committed（plan-draft → plan-gate）。
- state-only 遷移 commit が plan-gate → plan-approved → implementing を圧縮 materialize する。根拠: 独立 Plan Reviewer（Sonnet subagent、Writer と別）が 3 round（R1: P1×1/P2×5/P3×4 全件是正 → R2: P2×1/P3×1 是正 → R3: 新規 0）で **P1/P2 = 0・収束**を報告（plan-gate → plan-approved。Review Response 節参照）。Plan Commit = 6dbdf1b（初回 plan-first commit、実装 commit ゼロの時点で設定 = 全実装 commit に先行）。実装は Codex 発注で開始（plan-approved → implementing）。

## Owner Effort Budget

- 介入回数上限: 3（発注起動 / Ready 承認 / merge）
- 実働時間上限: 30分
- relay 往復上限: 3（Codex 実装発注 1 + 相互修正案 rally 2。既定 2 からの変更理由: Writer が外部端末の Codex であり、レビュー rally が owner relay を経由するため）

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Risk

Risk: R3

Reason:
当初 backlog では R2（clone routing の path 更新のみ）だったが、2026-07-18 の Codex read-only 棚卸しで `search-safe-files.sh` / `list-safe-files.sh` に realpath containment がなく `docs/../../../` traversal で repo 外（global Skill 実体）を読めることが実証された（Coordinator が再現済み）。safe wrapper は Codex execpolicy の auto-allow 対象であり、この境界は data safety boundary かつ workflow gate。DEV_WORKFLOW Risk Tiers の「R2/R3 で迷う場合、data safety boundary / workflow gate に触れるなら R3」に該当し、owner が 2026-07-18 に R3 一括を承認した。workflow gate change のため Contract Audit は Double Audit、hosted CI required、subagent 上限 3。

## Goal

Goal Invariant:

### 最小完了条件

- public clone の `.codex/bin` wrapper 5 本を public cwd から実行すると、`CODEX_INVENTORY_REPO` 未設定でも常に public repo に着地する（owner alias 補償が不要になる）。
- safe-files 3 本（read / search / list）すべてが canonicalize 後の root containment + allowlist 再判定を強制し、traversal / symlink で repo 外を読めない。
- execpolicy 2 mirror・AGENTS.md・README・Claude hooks・現行 setup docs の旧 clone 参照（棚卸し B 群）が public 実体に同期される。

### 失敗定義

- 是正後も alias 非経由の wrapper 実行が旧 clone に着地する。
- search / list で `docs/../../../` 系 traversal または symlink 経由で repo 外 file が読める。
- history-view 用の意図参照・archive（棚卸し A 群）を書き換えて履歴を改変する。

### 非目的

- 旧 clone 側 working tree の是正・追随（dirty 状態の証拠保全を維持、read も write もしない）。
- repo 外設定（`~/.zshrc` / `~/.codex/config.toml` / `~/.claude/hooks` copy）の変更 — owner 環境 follow-up として記録のみ。
- safe-files allowlist の対象集合の拡大・縮小（既存集合を維持）。
- 製品名 / package 名としての `inventory-system` 字面（棚卸し C 群「clone を選ばない字面」）の変更。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。AC や証跡作業が Goal Invariant を前進させない場合は、Goal を置き換えず簡略化・defer・削除する。

## Scope

1. `.codex/bin/codex-inventory` / `codex-inventory-bar`: `REPO` default を SCRIPT_DIR 起点の動的解決（`git -C "$SCRIPT_DIR" rev-parse --show-toplevel`）に変更。`CODEX_INVENTORY_REPO` 明示 override は維持。T9 / T10 検証用の dry-run 出口を用意する（`codex-inventory` は既存 `--debug` を活用、`-bar` は `--debug` 相当の追加または root 解決部の関数分離。tmux / codex 本体を起動しないこと）。
2. `.codex/bin/read-safe-file.sh` / `search-safe-files.sh` / `list-safe-files.sh`: `REPO_ROOT` を script 所属 repo に動的解決。search / list に read-safe-file.sh と同等の canonicalize（`realpath`）+ root containment を追加し、**canonical 相対 path に対して** sensitive 判定と allowlist を再判定する（read-safe-file.sh の既存順序 = canonicalize → containment → sensitive → allowlist に 3 script 統一）。allowlist 再判定後に rg / find へ渡す値も canonical 相対 path とする。fail-closed: canonicalize 失敗・root 解決失敗・root 外・sensitive・allowlist 不一致はすべて明示メッセージ付き非 0 exit で拒否し、`set -e` の暗黙 abort に依存しない。
3. `.codex/execpolicy.rules` + `.codex/rules/default.rules`: 旧 clone absolute path 28 参照は**全件 path token の単純置換**（`--cd` / `--exec` / 絶対 pattern 内の旧 path → public path。旧 token と新 token を並存させない）。history-view 専用の独立 rule は存在しないことを実読確認済みのため、除去のみで置換を欠く対応は誤り。2 file の byte-identical mirror を維持。
4. `AGENTS.md` Workspace Access（:42/:44）の canonical path を public に是正。
5. `.codex/README.md` の B 行（36 / 101 / 157 / 171–176 / 206）を現行実体に同期（:101 は実際の `~/.zshrc` public override 手順と一致させる）。
6. `docs/TOOLING_SKILL_COMMANDS.md:4` の調査対象 repo を public に是正。
7. `.claude/commands/plan-rally.md:30` の docs/plans path を public に是正。
8. `.claude/hooks` 6 script（check-plan-on-exit.sh:187 / memory-capture-feedback.sh:25 / memory-precompact-scan.sh:10 / audit-trigger-phase.sh:26 / audit-trigger-plan.sh:25 / audit-safety-net.sh:8,29）の旧 /tmp log path・旧 auto-memory namespace を public namespace（`-home-kosei-Projects-inventory-system-public`）に是正。
9. `CLAUDE.md:27` の auto-memory 格納場所を public namespace に是正。
10. `docs/DEV_SETUP_CHECKLIST.md` の B 行（138 / 149 / 156–157 / 240）を現行値に是正（履歴節の A 行は非変更）。
11. adversarial regression test 新設: `scripts/tests/codex-safe-wrappers.test.sh`（相対 / 絶対 / symlink / `..` traversal / global Skill / sensitive path / option-like / root 動的解決 / mirror 同一性の系列）。`scripts/local-ci.sh` への `run_required` 明示登録を含む。
12. `docs/decision-log.md` D-049（plan-first commit に含める、Design Phase 出力）。

## Non-scope

- 棚卸し A 群全件: `docs/archive/plans/**` の全 occurrence（27 files）、`docs/Plans.md` のメタ参照（:24/:28/:33/:87 相当）、`docs/research/audit-2026-07/00-order.md:60`（fail-closed 指示）、`docs/DEV_SETUP_CHECKLIST.md` 履歴節（:86/:92–93/:248/:251/:261/:283/:291）、`.codex/status-bar/README.md:132`（C 裁定 → 過去証跡として非変更 = A 扱い）。
- repo 外: `~/.zshrc:78`（補償設定、是正後も有害でないため owner 判断で存置可）、`~/.codex/config.toml` の旧 clone trust / hooks hash（history-view 用に維持可）、`~/.claude/hooks/memory-capture-feedback.sh` global copy（発火元特定は owner 環境 follow-up）。PR body に「owner 環境 follow-up」欄として記録する。
- 旧 clone（`/home/kosei/Projects/inventory-system`）内の file 一切。本 PR の diff は public repo 内で閉じる。
- safe-files allowlist の対象集合・sensitive 判定パターン集合の変更（`is_sensitive_path` のパターン自体は不変。C6 が変えるのは判定に渡す入力の正規化 = canonical 相対 path 化のみで、これは Scope 2 の是正対象）。

## Acceptance Criteria

- `./.codex/bin/search-safe-files.sh "^name:" "docs/../../../.claude/skills"` が非 0 exit で拒否し、repo 外内容を出力しない（現状: global Skill の `name:` 行を返す。T1）。
- `./.codex/bin/list-safe-files.sh` への同系 traversal 引数が非 0 exit で拒否される（T2）。
- `./.codex/bin/read-safe-file.sh "docs/../../../.claude/skills/..."` の既存拒否（`refusing path outside repository`）が維持される（T3）。
- `CODEX_INVENTORY_REPO` 未設定で public copy の 5 script が public root に解決される。検証は tmux / codex 本体を起動しない手段（dry-run flag または root 解決部の関数化）で行う（T9 / T10）。
- `cmp .codex/execpolicy.rules .codex/rules/default.rules` が一致 exit 0、かつ両 file への `rg -n "Projects/inventory-system($|[^-])"` が 0 hit（rg exit 1。T12 と同一正規表現。検査 grep は explicit file list で行い、負 glob は使わない — ripgrep 15.1.0 の負 glob 不具合既知）（T11）。
- `rg -n "Projects/inventory-system($|[^-])" <Scope 4–10 の explicit file list>` が 0 hit（rg exit 1）。全件非変更の A 群 file（`docs/archive/plans/**`、`docs/research/audit-2026-07/00-order.md`、`.codex/status-bar/README.md`）が `git diff --stat main` に現れず、行単位 A の file（`docs/DEV_SETUP_CHECKLIST.md` 履歴節、`docs/Plans.md` の旧 clone メタ参照行）はその A 行を書き換えない（T12 + review）。
- 新規 drift test が `scripts/local-ci.sh` に `run_required` 登録され、L1 `local-ci.sh full` CLEAN green（evidence は PR body）。
- `bash scripts/doc-consistency-check.sh --target plan` ERROR 0。

## Design Sources

- Requirements / spec: 該当なし（製品要求非接触。開発 workflow tooling のみ）
- Architecture: `docs/DEV_WORKFLOW.md`（Risk Tiers / Verification Gates / Review Rules）、`AGENTS.md` Workspace Access（本 PR で是正対象）
- Function / command / DTO: 該当なし
- DB: 該当なし
- Screen / UI: 該当なし
- Decision log / ADR: `docs/decision-log.md` D-040（clone 役割分離: public-writer / history-view）、D-049（本 change の boundary 契約、plan-first commit で追加）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 該当なし | — |
| Command / DTO / generated binding / wire shape | 該当なし | — |
| DB / transaction / audit / rollback / migration | 該当なし | — |
| Screen / UI / route state / Japanese wording | 該当なし | — |
| CSV / TSV / report / import / export format | 該当なし | — |
| Durable decision / ADR | `docs/decision-log.md` D-049（wrapper root = script 所属 repo / containment 契約 / 旧 clone rule 混在禁止） | updated in this PR（plan-first commit） |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| `scripts/tests/codex-safe-wrappers.test.sh` | `scripts/local-ci.sh` の `run_required` 明示登録（runner は glob 収集ではない — local-ci.sh:205–212 実測）。hosted CI workflow 側で同 test 群が実行される job routing の確認も Writer が行い、PR body に記録 |

Tauri command / route / REQ coverage / operator 画面の各義務は該当なし。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-CODEX-SAFE-BOUNDARY-2026-07-18 | `docs/decision-log.md` D-049 | D-049 | 動的 root 解決（案1）採用。2-root allowlist 案は mixed authority 温存、専用 wrapper 新設案は二系列保守のため却下 | `.codex/bin` 5 script / execpolicy 2 mirror / B 群 docs・hooks | T1–T15 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: D-049 が契約・理由・却下代替案・revisit 条件を保持。棚卸し裁定の要約は本 packet 付録に記録
- Plan-only durable decisions found and promoted: root 解決・containment・rule 混在禁止の 3 契約を D-049 へ昇格済み
- Assumptions and constraints: `git -C <script dir> rev-parse --show-toplevel` が通常 clone で repo root を返す（Contract Probe で確認済み）。旧 clone 側 copy は本 PR 非接触のため旧挙動のまま（意図どおり）
- Deferred design gaps, risk, and follow-up target: owner 環境 follow-up（zshrc / 旧 trust / global hook copy 発火元）は PR body 記録のみ。Codex execpolicy の static token match 制約（runtime 解決不可）は D-049 revisit 条件
- Test Design Matrix can cite design decision IDs: 全行が SPEC-CODEX-SAFE-BOUNDARY C1–C7 を参照

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | wrapper family = Codex Desktop 統合の adapter。安定契約は C1（root = script 所属 repo）/ C2（containment）で、D-049 が正本 | decision-log D-049 |
| Fact check / design decision split | 観測事実 = traversal 再現・mirror cmp・line 実読（Contract Probe 節）。設計判断 = 案1 採用・A 群非変更・rule 分離（D-049） | 本 packet / D-049 |
| Lifecycle / retry | not applicable — read-only tooling で状態遷移・再試行系なし | — |
| Operator workflow | not applicable — 店舗 operator 非接触、開発 workflow のみ | — |
| Replacement path | Codex CLI の execpolicy DSL 変更時は rules 2 mirror のみ差し替え。wrapper は git のみに依存 | D-049 revisit |
| Data safety / evidence | traversal 再現は Contract Probe に記録。secrets / 実店舗データ非接触、fixture は synthetic のみ | Data Safety 節 |
| Reporting / accounting semantics | not applicable | — |
| Manual verification | 自動テスト外は owner 環境 follow-up（zshrc / 旧 trust / global hook copy）のみで、merge gate 外の checklist として PR body に記録 | PR body |

## Design Readiness

- Existing design docs are sufficient because: 本 change の設計は D-049（同一 plan-first change で追加）+ DEV_WORKFLOW 既存規範で完結し、製品設計 docs には非接触
- Source docs updated in this PR: `docs/decision-log.md` D-049（plan-first commit）、`AGENTS.md` Workspace Access / `.codex/README.md` / `docs/TOOLING_SKILL_COMMANDS.md` / `docs/DEV_SETUP_CHECKLIST.md` 現行値行（実装 commit）
- Design gaps intentionally deferred: なし（owner 環境 follow-up は設計 gap ではなく環境作業）
- Durable decisions discovered in this plan and promoted: D-049

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): 非接触（tooling のみ）
- Backend function design: 非接触
- Command / DTO / data contract: 非接触
- Persistence / transaction / audit impact: 非接触
- Operator workflow / Japanese UI wording: 非接触
- Error, empty, retry, and recovery behavior: wrapper の fail-closed 拒否経路は C2 契約 + T1–T8 で担保
- Testability and traceability IDs: SPEC-CODEX-SAFE-BOUNDARY-2026-07-18 C1–C7 を test に付記

## Contract Probe

- search-safe-files.sh の traversal 迂回: `./.codex/bin/search-safe-files.sh "^name:" "docs/../../../.claude/skills"` → global Skill の `name:` 行を返却（exit 0）。境界欠陥を実証（2026-07-18、Coordinator 再現）
- read-safe-file.sh の realpath 拒否: 同 traversal → `refusing path outside repository`。既存実装の containment を確認
- execpolicy mirror: `cmp .codex/execpolicy.rules .codex/rules/default.rules` → 一致。旧 clone 参照 28 行を確認
- wrapper defaults: `.codex/bin` 5 script の line 4 に旧 clone hardcode を実読確認
- SCRIPT_DIR 起点の root 解決: `git -C /home/kosei/Projects/inventory-system-public/.codex/bin rev-parse --show-toplevel` → `/home/kosei/Projects/inventory-system-public`。動的解決の前提成立を確認

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| C1（D-049）: safe-files 3 script + launcher 2 本の root = script 所属 repo | `.codex/bin` 5 script | T9 / T10 | — |
| C2（D-049）: canonicalize 後 root containment + allowlist 再判定、fail-closed（失敗時も明示拒否） | read / search / list 3 script | T1–T6 / T8 / T15 | — |
| C3（D-049）: `CODEX_INVENTORY_REPO` 明示 override 維持 | codex-inventory / -bar | T10 | — |
| C4（D-049）: public execpolicy は public path のみ auto-allow、旧 clone rule 混在禁止、2 mirror byte-identical | execpolicy.rules / rules/default.rules | T11 | — |
| C5（D-049）: A 群（history-view / archive / メタ参照）非変更 | diff scope 全体 | T12（B 群 grep）+ review（A 群 diff 非混入） | review |
| C6: sensitive path 拒否（canonical 相対 path 判定に統一）・option-like 拒否維持 | 3 script | T7 / T8 / T14 | — |
| C7: B 群 docs / hooks の参照が public 実体と一致（AGENTS / README / TOOLING / plan-rally / hooks 6 本 / CLAUDE.md / DEV_SETUP 現行行） | Scope 4–10 | T12 / T13 | — |

## Test Plan

Test Design Matrix: [test-matrices/2026-07-18-codex-clone-routing-and-safe-read-boundary.md](test-matrices/2026-07-18-codex-clone-routing-and-safe-read-boundary.md)

- targeted tests: `bash scripts/tests/codex-safe-wrappers.test.sh`（新設、T1–T15）
- negative tests: traversal / symlink / 絶対 path / sensitive / option-like の拒否系列（T1–T3 / T5–T8）
- compatibility checks: execpolicy 2 mirror `cmp` 一致（T11）、既存 allowlist 内 path の read/search/list 成功維持（T4）
- data safety checks: fixture は `$TMPDIR` 合成 repo のみ、global Skill 実体・secrets を fixture 化しない
- main wiring/integration checks: `scripts/local-ci.sh` への `run_required` 登録 + L1 full green

## Boundary / Wire Contract

- producer: `.codex/execpolicy.rules` / `.codex/rules/default.rules`（repo 管理の rule DSL）
- consumer: Codex CLI execpolicy engine（起動時の static token match。runtime path 解決なし）
- wire type: rule DSL 内の絶対 path token（WSL 形式）
- internal type: 該当なし（JSON / DTO 非接触）
- precision/range: 該当なし
- round-trip path: 該当なし
- invalid input: 旧 clone path token が残ると public command が auto-allow されない（matchedRules: [] — 棚卸しで実測済み）。同期漏れは T11 で検出
- compatibility: 旧 clone 側 policy は旧 clone repo 内 file で独立しており、本 PR は public repo 内で diff が閉じるため旧 clone の挙動は不変

## Review Focus

- containment 実装が 3 script で同一 semantics か（read-safe-file.sh 既存実装との統一、fail-closed 網羅: canonicalize 失敗 / root 外 / allowlist 不一致 / symlink）
- A 群 file の diff 混入がないか（archive / メタ参照 / 履歴節 / status-bar README:132）
- execpolicy の旧 clone rule 除去が public 用 rule の同等置換として過不足ないか + mirror 同一性
- 検査 grep が explicit file list で書かれ負 glob を使っていないか（ripgrep 15.1.0 既知不具合）
- 新規 test の runner 登録（local-ci.sh + hosted routing）

## Spec Contract

Contract ID: SPEC-CODEX-SAFE-BOUNDARY-2026-07-18

- C1: safe-files 3 script と launcher 2 本の repo root は script 所属 repo に動的解決される（`git -C "$SCRIPT_DIR" rev-parse --show-toplevel`）
- C2: safe-files 3 script は各 path 引数を canonicalize し、root containment と canonical 相対 path での allowlist 再判定を満たさない限り拒否する（fail-closed）
- C3: `codex-inventory` / `-bar` の `CODEX_INVENTORY_REPO` 明示 override は維持される
- C4: public execpolicy 2 mirror は byte-identical を維持し、public clone path のみを auto-allow する（旧 clone rule 混在禁止）
- C5: 棚卸し A 群（history-view 意図参照・archive・メタ参照）は変更されない
- C6: sensitive path 拒否・option-like 引数拒否は維持され、sensitive 判定は canonicalize 後の canonical 相対 path に対して行う（read-safe-file.sh 既存実装と 3 script 統一。生引数のみの判定は symlink alias で迂回されるため不可）
- C7: 棚卸し B 群の docs / hooks 参照は public 実体（path / namespace / 手順）と一致する

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| C1 | Scope 1–2 | T9 / T10 | root 解決の統一 | drift test 出力 |
| C2 | Scope 2 | T1–T6 / T8 / T15 | fail-closed 網羅 | drift test 出力 |
| C3 | Scope 1 | T10 | override 尊重 | drift test 出力 |
| C4 | Scope 3 | T11 | rule 同等置換 + mirror | cmp / grep 出力 |
| C5 | Non-scope | T12 + review | A 群 diff 非混入 | PR diff |
| C6 | Scope 2 | T7 / T8 / T14 | canonical 判定への統一 | drift test 出力 |
| C7 | Scope 4–10 | T12 / T13 | B 群同期の過不足 | grep 出力 |

## Data Safety

- 実店舗データ・secrets への接触なし。`~/.codex/auth.json`・credential 系 file は probe / test とも read しない
- 旧 clone working tree（dirty、証拠保全状態）へは read も write もしない。本 PR の diff は public repo 内で閉じる
- test fixture は `$TMPDIR` の合成 repo / 合成 symlink のみ。global Skill 実体や実在の repo 外 file 内容を fixture にコピーしない（存在・拒否の検査は合成 target で行う）
- 役割分離: AC 1 条の traversal repro（実環境 `~/.claude/skills` 対象）は実装時の手動確認・PR body 証跡であり、常設自動テスト（T1）は合成 fixture で同系列を検査する

## 棚卸し裁定記録（2026-07-18、付録）

Codex read-only 棚卸し（inventory-system-public を除く字面 342 occurrence / 66 files、preflight 合格・無編集）を Coordinator（Fable 5）が実証裏取りの上で裁定した。

- B（移行漏れ・是正対象）= 本 packet Scope 1–10。実証 5 点: wrapper line 4 hardcode 実読 / traversal 再現 / read-safe-file.sh realpath 拒否確認 / execpolicy mirror cmp 一致 + 旧参照 28 行 / CLAUDE.md 旧 namespace は当日 hook の誤指示として live 確認
- A（意図参照・履歴、非変更）= Non-scope 記載の全件。archive 27 files を含む
- C 裁定: `.codex/status-bar/README.md:132` は過去証跡として非変更（A 扱い）。製品名字面は非対象。repo 外 4 項目は owner 環境 follow-up として PR body に記録
- 是正案: 案1（SCRIPT_DIR 起点の動的 root 解決)を採用（D-049。案2 = 2-root allowlist、案3 = public 専用 wrapper 新設は却下）
- scope 裁定: owner が R3 一括を承認（R2 分割案・R4 並行案を却下、2026-07-18）

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

- Plan Gate R1（2026-07-18、独立 Plan Reviewer = Sonnet subagent、Coordinator = Fable 5 が現物突合で裁定）: P1 = 1 / P2 = 5 / P3 = 4、**全件 accept・本 commit で是正**。P1-1 = C6「既存挙動維持」が search/list の sensitivity 判定を生引数のままとする解釈を許し、symlink alias（allowlist 適合名 → sensitive 実体）で迂回可能だった → C6 を canonical 相対 path 判定に統一（read-safe-file.sh :53-54 の既存実装を正とする、T14 追加）。P2 = dry-run 出口の Scope 明記（`--debug` 実在確認済み）/ canonicalize 失敗系列の明示拒否 + T15 / rg・find へ渡す値の canonical 統一 / execpolicy 28 参照は全件単純置換と一本化（実読で history-view 専用 rule 非存在を確認）/ T4 に無引数デフォルト一覧の回帰を追加。P3 = 誤字（上復→上限）/ T11 正規表現の明示 / Data Safety と AC の役割分離 / A 群書き分け。
- Plan Gate R2（2026-07-18、同 Plan Reviewer による収束確認）: R1 全 10 件の反映を確認。新規 P1 = 0 / P2 = 1 / P3 = 1、**両方 accept・是正済み**（9451a82）。P2 = Non-scope の「sensitive path 判定の変更」宣言が C6 是正と矛盾して読める → パターン集合不変・入力正規化のみ Scope と限定注記。P3 = Matrix fixture 導入文に T14/T15 系列を追記。
- Plan Gate R3（2026-07-18、同 Plan Reviewer による最終収束確認）: R2 是正 2 箇所の解消を確認、新規 finding なし。**P1 = 0 / P2 = 0 / P3 = 0、収束** → plan-gate 通過。
- Findings Freeze: not yet frozen; post-freeze exceptions: none.
