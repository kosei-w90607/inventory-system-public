# トレーサビリティ自動生成 Plan Packet（workflow 自走化 第1層）

## Risk

Risk: R3

Reason:
CI rust job と pre-push hook という merge gate / workflow gate を変更し、REQ ↔ 設計書 ↔ テスト対応の機械検証を導入するため。DB / POS CSV / PLU TSV / Tauri command DTO / operator UI は触らないが、`docs/DEV_WORKFLOW.md` Risk Tiers の「merge gate changes」に該当する。

## Goal

REQ ↔ 設計書 ↔ テストの対応表を `generate_traceability` bin で自動生成し、`docs/function-design/90-traceability.md` を vendor-in + drift check 運用（`generate_bindings` → `bindings.ts` → CI drift check と同型）に載せる。手書き Trace Matrix とレビュアーの目に依存していた traceability 検証を CI / pre-push で機械化する。

## Scope

- `docs/spec/requirements.md`（REQ インベントリ 24 行: 要求仕様書 v2.1 由来 17 + 開発拡張 7）を新設する。
- `src-tauri/src/bin/generate_traceability.rs`（生成 + `--check` の 4 検証 T1〜T4）を追加する。
- `docs/function-design/90-traceability.md` を生成して vendor-in する（`docs/FUNCTION_DESIGN.md` の未作成予約行を実リンク化）。
- `.github/workflows/ci.yml` rust job の bindings drift check 直後に `cargo run --bin generate_traceability -- --check` step を配線する。
- `scripts/pre-push.sh` に CHANGED_FILES trigger block を追加し、ローカル hook を refresh する。
- `docs/DEV_WORKFLOW.md` Verification Gates / `docs/UI_TECH_STACK.md` §2補 Testing / `docs/quality/review-checklist.md` に traceability gate と FE テスト ID 規約を追記する。
- `scripts/doc-consistency-check.sh` の M2 exclude / R0 exclude と `design_compliance_test.rs` SKIP_DOCS を生成物対応させる。

## Non-scope

- FE テスト 17 ファイルへの REQ/UI ID backfill（baseline を 1 ずつ下げる follow-up で対応する）。
- SP-NNN / QR-NN / `UI-NNx-Dn` の matrix 化（v1 対象外。生成物ヘッダにも明記する）。
- xlsx からの REQ 自動抽出（v2 で検討。インベントリは手動追従）。
- PR #95（bindings test rename）/ PR #81（ci.yml 再構成）への直接変更（PR body での申し送りのみ）。
- 共有コンポーネントテストの ID 形式規定（`segmented-control.test.tsx` の `UI-WF-2026-05-22` 形式は backfill follow-up で規定する）。

## Acceptance Criteria

- `cd src-tauri && cargo run --bin generate_traceability` が `docs/function-design/90-traceability.md` を決定的に再生成する（2 回実行で byte 一致、タイムスタンプなし）。
- `cd src-tauri && cargo run --bin generate_traceability -- --check` が clean tree で exit 0、生成物改変時に exit 1（`[T1]` drift ERROR + 再生成コマンド案内）。
- インベントリ外の `_req[0-9]{3}` / `REQ-NNN` 使用（phantom REQ）で `--check` が exit 1（`[T2]` ERROR）。
- テスト 0 本の REQ（現状 REQ-403）が `[T3]` WARN として出力され、exit code は 0 のまま。
- REQ/UI ID 未参照の FE テストファイル数が baseline 17 から増減どちらに振れても `--check` が exit 1（`[T4]` ERROR、両方向）。
- `.github/workflows/ci.yml` rust job に `cargo run --bin generate_traceability -- --check` step がある。
- `scripts/pre-push.sh` が Rust / FE テスト / 設計書 / `docs/spec/requirements.md` の変更で `--check` を実行する（`bash -n scripts/pre-push.sh` 通過）。
- `cd src-tauri && cargo fmt --check && cargo clippy --all-targets --all-features -- -D warnings && cargo test` が green。
- `bash scripts/doc-consistency-check.sh` が ERROR 0。
- `npm run typecheck && npm test` が green。

## Design Sources

- Requirements / spec: `docs/inventory_system_v2.1.xlsx`（REQ 17 本の名称出典）、`docs/spec/README.md`（stable contract の home 方針、`WF-*` ラベル規約）
- Architecture: `docs/ARCHITECTURE.md` §2 タスク表（対応REQ 列の逆引きで対応タスク列を作る）
- Function / command / DTO: `docs/FUNCTION_DESIGN.md`（索引リンク = タスクID → 設計書ファイルの入力）、`docs/function-design/50-ui-product-list.md` / `docs/function-design/51-ui-product-form.md`（`> 対応仕様:` 行の先例）
- DB: 対象外（schema / migration 変更なし）
- Screen / UI: 対象外（runtime UI 変更なし）
- Decision log / ADR: `docs/research/2026-04-20-invoke-type-adr.md`（ADR-002、生成 + vendor-in + drift check の先例）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | 対象外（runtime 動作の変更なし、開発ツール bin のみ） | existing sufficient |
| Command / DTO / generated binding / wire shape | 対象外（Tauri command / binding 変更なし） | existing sufficient |
| DB / transaction / audit / rollback / migration | 対象外（schema / migration / DB 接続なし） | existing sufficient |
| Screen / UI / route state / Japanese wording | 対象外（operator UI 変更なし） | existing sufficient |
| CSV / TSV / report / import / export format | 生成物 `90-traceability.md` の入出力契約は本 packet の Boundary / Wire Contract に記録 | updated in this PR |
| Durable decision / ADR | traceability gate は `docs/DEV_WORKFLOW.md` Verification Gates、FE テスト ID 規約は `docs/UI_TECH_STACK.md` §2補 に昇格 | updated in this PR |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| WF-TRACE-01 | `docs/DEV_WORKFLOW.md` Verification Gates | WF-TRACE-D1 | vendor-in + drift check（gitignore 案は frontend が生成器を実行しない CI 構成のため不採用） | bin `--check` T1 + ci.yml step | `check_mode_detects_drift` |
| WF-TRACE-02 | `docs/spec/requirements.md` 全行 | WF-TRACE-D2 | REQ インベントリを docs/spec に新設（ARCHITECTURE 対応REQ 列は範囲表記・QR系混在・7xx/9xx 欠落でソース不適） | inventory parse + phantom 判定 | `check_mode_fails_on_phantom_req` |
| WF-TRACE-03 | `docs/spec/requirements.md` 全行 | WF-TRACE-D3 | UI フェーズ未完のため 0 本 REQ は WARN 止まり（ERROR 化は全 UI 実装後に再評価） | `--check` T3 | `summary_counts_req_with_no_tests_as_warn` |
| WF-TRACE-04 | `docs/UI_TECH_STACK.md` §2補 Testing | WF-TRACE-D4 | FE backfill は scope 膨張のため見送り、baseline 両方向 gate で自走化 | `--check` T4 + baseline 定数 | `check_mode_fails_on_baseline_mismatch_both_directions` |
| WF-TRACE-01〜04 | `docs/DEV_WORKFLOW.md` Verification Gates | WF-TRACE-D5 | チェック 4 種は bin `--check` に集約（CI docs job は ripgrep のみで Rust toolchain がないため doc-consistency 側に置けない） | rust job 配線 + pre-push trigger | `ci-yml-step-review` |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes。traceability gate は `docs/DEV_WORKFLOW.md`、FE テスト ID 規約は `docs/UI_TECH_STACK.md` §2補、REQ インベントリの位置付けは `docs/spec/README.md` + `docs/spec/requirements.md` ヘッダに昇格する。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: WF-TRACE-D1〜D5 は上記 source docs と生成物の AUTO-GENERATED ヘッダに昇格する。
- Assumptions and constraints: Rust テスト命名 `_reqNNN` 規約は既存 557 本で成立済み。npm 凍結（Mini Shai-Hulud）下で新規 install ゼロ（`regex` は既存依存、`tempfile` は既存 dev-dep）。
- Deferred design gaps, risk, and follow-up target: FE 17 ファイルの backfill、共有コンポーネントテストの ID 形式、xlsx 自動抽出（v2）、comment のみの参照で T4 を通過する既知例 `src/features/csv-import/reducer.test.ts`（describe/it への移動 = backfill follow-up 対象）。Workflow Effectiveness Review は初回 dogfood（次の UI-01c 着手）後に実施する。
- Test Design Matrix can cite design decision IDs or source doc sections: yes（WF-TRACE-01〜04 を引用）。

## Design Readiness

- Existing design docs are sufficient because: 本変更は runtime 動作・既存設計書の契約を変えない開発ツール + workflow gate 追加で、`generate_bindings` → `bindings.ts` → CI drift check の確立済み運用パターン（ADR-002）をなぞる。
- Source docs updated in this PR: `docs/spec/requirements.md`（新設）、`docs/spec/README.md`、`docs/FUNCTION_DESIGN.md`（予約行の実リンク化）、`docs/DEV_WORKFLOW.md`、`docs/UI_TECH_STACK.md`、`docs/quality/review-checklist.md`。
- Design gaps intentionally deferred: Non-scope に列挙（FE backfill / SP・QR matrix 化 / xlsx 自動抽出 / 共有コンポーネントテスト ID 形式）。
- Durable decisions discovered in this plan and promoted to source docs: FE テスト ID 規約（`docs/UI_TECH_STACK.md` §2補）、traceability gate（`docs/DEV_WORKFLOW.md` Verification Gates）。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): 対象外。開発ツール bin で、UI / CMD / BIZ / IO 層のコード変更なし。
- Backend function design: 対象外。pub API 追加なし（bin 内 private fn + `#[cfg(test)]` のみ）。
- Command / DTO / data contract: 対象外。Tauri command / DTO / generated binding 変更なし。
- Persistence / transaction / audit impact: 対象外。DB 接続なし。repo 内テキスト読み取りと生成物 1 ファイルの書き込みのみ。
- Operator workflow / Japanese UI wording: 対象外（operator 向け画面変更なし）。`--check` のエラーメッセージは開発者向け日本語で再生成コマンドを案内する。
- Error, empty, retry, and recovery behavior: `--check` 失敗時は `[T1]`〜`[T4]` ラベル付きで原因と復旧手順（再生成 / インベントリ追記 / baseline 更新）を出力する。
- Testability and traceability IDs: WF-TRACE-01〜04（bin unit tests の `// WF-TRACE-N:` コメントで対応付け、テスト関数は meta/workflow テスト既存規約に従い接頭辞なし命名）。

## Test Plan

Test Design Matrix: [test-matrices/2026-06-11-traceability-autogen.md](test-matrices/2026-06-11-traceability-autogen.md)

- targeted tests: bin unit tests（multi-REQ 抽出 / インベントリ parse / 索引リンク parse / 決定性 / drift / phantom / baseline / 0 本 REQ WARN）。
- negative tests: `_req9051` 境界不一致、`UI-WF-2026-05-22` 形式は T4 未参照扱い、生成物 1 byte 改変で `--check` exit 1。
- compatibility checks: 既存 Rust テスト 557 本・FE テスト 43 ファイルは無変更で green、`design_compliance_test` は SKIP_DOCS 追加後 green。
- data safety checks: DB / 実データ非接触。fixture は `tempfile::tempdir` 内の合成ツリーのみ。
- main wiring/integration checks: ci.yml step、pre-push trigger block（`bash -n`）、実 repo での `--check` exit 0。

## Boundary / Wire Contract

- producer: `generate_traceability` bin（Rust。パス解決は CARGO_MANIFEST_DIR + 親ディレクトリ、`design_compliance_test` 先例）。
- consumer: CI rust job / pre-push hook / レビュアー（生成物 `docs/function-design/90-traceability.md` を読む）。
- wire type: Markdown（AUTO-GENERATED ヘッダ + 再生成・検証コマンド明記。リンクは同ディレクトリ設計書のみ、コードパスは inline code）。
- internal type: REQ インベントリ行（REQ ID / 名称 / 対応タスク / 出典）、タスクID → 設計書ファイル map、REQ → テストファイル別件数 map、FE 未参照ファイル一覧。
- precision/range: REQ ID は `REQ-[0-9]{3}` 固定。Rust テスト名の `_req(\d{3})` は直後が `_` か終端のときのみ一致（`_req9051` 不一致）。FE の `REQ-(\d{3})` も直後が数字なら不一致。
- round-trip path: `docs/spec/requirements.md` + `docs/FUNCTION_DESIGN.md` 索引 + 設計書 `対応仕様:` 行 + Rust/FE テスト走査 → 生成 → `--check` が再生成結果と vendor-in 済みファイルを byte 比較。
- invalid input: インベントリ外 REQ の使用は `[T2]` ERROR。インベントリ行の形式逸脱行は取り込まれず、その REQ がテストで使用されていれば `[T2]` phantom ERROR として顕在化する。
- compatibility: 生成物は新規ファイルで既存契約に対し additive。FE baseline 17 は両方向 gate（増 = 規約違反の検知、減 = baseline 定数の更新を強制）。

## Review Focus

- T1〜T4 の判定が Spec Contract WF-TRACE-01〜04 と 1:1 で対応しているか。
- 生成が決定的か（タイムスタンプなし、全コレクション sort、trailing whitespace trim、末尾改行 1 つ）。
- `--check` が無書込か（worktree を汚さないか）。
- pre-push trigger block が既存 CHANGED_FILES 機構（block ③ の `grep -qE` 形式）と同形式か。
- fixture 内の設計書ファイル名が実在名のみか（doc-consistency R1 に exclude 機構がないため）。
- 生成物・packet・インベントリのテーブルセルに marker 語が残っていないか。

## Spec Contract

Contract ID: SPEC-WF-TRACE-2026-06-11

- WF-TRACE-01: `docs/function-design/90-traceability.md` が bin の再生成結果と一致しない場合、`--check` は ERROR（exit 1）で再生成コマンドを日本語で案内する。Test: `check_mode_detects_drift` / `check_mode_passes_when_clean` / `generation_is_deterministic`。
- WF-TRACE-02: インベントリ（`docs/spec/requirements.md`）にない REQ ID を Rust テスト名（`_reqNNN`）または FE テスト（`REQ-NNN`）が使用した場合、`--check` は ERROR（exit 1）。Test: `check_mode_fails_on_phantom_req` / `req_ids_from_fn_name_rejects_req9051_boundary`。
- WF-TRACE-03: インベントリの REQ でテスト 0 本のものは `[T3]` WARN として列挙する（exit 0 のまま。UI フェーズ未完のため ERROR にしない）。Test: `summary_counts_req_with_no_tests_as_warn`。
- WF-TRACE-04: REQ/UI ID 未参照の FE テストファイル数が baseline 17 と一致しない場合（増減どちらも）、`--check` は ERROR（exit 1）。Test: `check_mode_fails_on_baseline_mismatch_both_directions` / `fe_presence_counts_ui_decision_ids_as_referenced`。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| WF-TRACE-01 | commit 3 bin + 生成物 vendor-in | `check_mode_detects_drift` / `check_mode_passes_when_clean` | 無書込 + byte 比較 | `--check` exit code |
| WF-TRACE-01 | commit 3 決定性 | `generation_is_deterministic` | sort + trim + 末尾改行 | 2 回生成 byte 一致 |
| WF-TRACE-01 | commit 4 CI 配線 | `ci-yml-step-review` | bindings drift check 直後 | `.github/workflows/ci.yml` |
| WF-TRACE-02 | commit 3 | `check_mode_fails_on_phantom_req` | インベントリとの突合 | exit 1 + `[T2]` 出力 |
| WF-TRACE-02 | commit 3 | `req_ids_from_fn_name_rejects_req9051_boundary` / `req_ids_from_fn_name_extracts_multi_req` | `_reqNNN` 境界（pre-push 既存 step ④ と整合） | bin unit tests |
| WF-TRACE-03 | commit 3 | `summary_counts_req_with_no_tests_as_warn` | WARN のみで exit 0 | `[T3]` WARN 出力（実 repo では REQ-403） |
| WF-TRACE-04 | commit 3 | `check_mode_fails_on_baseline_mismatch_both_directions` / `fe_presence_counts_ui_decision_ids_as_referenced` | 両方向 fail + 決定 ID 判定 | exit 1 + `[T4]` 出力 |
| WF-TRACE-04 | commit 5 規約昇格 | `ui-tech-stack-convention-review` | presence 検査と規約要請の強度差を明記 | `docs/UI_TECH_STACK.md` §2補 |
| 生成入力 | commit 3 | `index_links_parse_expands_range_and_slash_ids` / `inventory_parse_reads_req_rows` | 範囲表記を黙って落とさない | bin unit tests + 生成物目視 |

## Data Safety

- 実 POS CSV / PLU TSV / DB ファイル / backup / log / レシート画像 / secret は読まない・コミットしない。
- 書き込み先は `docs/function-design/90-traceability.md` のみ（docs 配下の新規 md）。`--check` は無書込。
- bin は DB 接続を持たず、repo 内テキストの読み取りだけを行う。
- 既存テストの削除・skip・rename はゼロ。
- fixture は `tempfile::tempdir` 内の合成ツリーのみ（実 repo 非依存）。

## Implementation Results

- commits（branch `feat/traceability-autogen`、main `f3e5185` 起点、線形 6 本）:
  1. `e1059ba` docs(plan): traceability 自動生成の Plan Packet
  2. `3d2c89d` docs(spec): REQ インベントリ requirements.md を新設
  3. `8dac67a` feat(tooling): generate_traceability bin + 90-traceability.md vendor-in（TDD: Red 4 件 → Green 11 件）
  4. `653d660` chore(ci): traceability check を CI と pre-push に配線
  5. `475f163` docs(workflow): Verification Gates に traceability 行 + FE テスト ID 規約
  6. 本 commit: Implementation Results 記入 + plan archive（hash は `git log` 参照、self-trace 回避）
- gates（いずれも green）: `cargo fmt --check` / `cargo clippy --all-targets --all-features -- -D warnings` / `cargo test`（578 本 = 既存 557 + bin 11 + architecture 1 + design_compliance 1 + seed 8）/ `bash scripts/doc-consistency-check.sh` ERROR 0 / `bash -n scripts/pre-push.sh` / `npm run typecheck` / `npm test`。
- 実 repo の `cargo run --bin generate_traceability -- --check`: exit 0、`[T3]` WARN 1 件（REQ-403 テスト 0 本 = 設計どおり）。
- 生成物サマリ: REQ 24 行 = covered 4（REQ-301 / REQ-302 / REQ-501 / REQ-502）/ rust-only 19 / fe-only 0 / no-test 1（REQ-403）。FE 未参照 baseline 17。
- 計画からの逸脱: ローカル hook refresh（`cp scripts/pre-push.sh .git/hooks/pre-push`）は sandbox の `.git/hooks` read-only mount で実行不可。user が sandbox 外 terminal で `cp scripts/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push` を実施する。
- PR body への申し送り: PR #81（ci.yml 再構成）と commit 4 が conflict し得る（後 merge 側 rebase）。PR #95 の `test_normalize_generated_bindings_trims_trailing_whitespace` は hook refresh 後に pre-push step ④ で fail する latent 違反のため、PR #95 側で `test_` prefix を外す 1 行 rename が必要。ローカル hook は 4/12 の stale copy だった（step ④〜⑥ 不在）。
- Workflow Effectiveness Review: 初回 dogfood 対象 = 次の UI-01c 着手。

## Review Response

PR open 後の review（R3 review-only sub-agent + Codex）の指摘と対応をここに記録する。本 packet 段階では記入事項なし。
