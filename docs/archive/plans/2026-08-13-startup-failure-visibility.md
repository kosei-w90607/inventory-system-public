# Plan Packet — 起動時 setup 失敗の operator 可視化（MNT-03-D4 拡張、v1.0 前）

## Workflow State

Use the field definitions, enums, transition evidence, packet-selection rule, and fail-closed behavior from `docs/DEV_WORKFLOW.md` `Workflow State`. Keep exactly one `- Key: value` line per field.

- Phase: archive
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: cfceb91
- Amendments: none
- Coordinator: Fable (main thread)
- Writer: Codex（発注書は Coordinator 起草、owner relay。worktree isolation、Coordinator は発注提示前に本体 tree を branch から外す）
- Plan Reviewer: Sonnet subagent（独立 context、rally 天井 3）
- Final Reviewer: Sonnet subagent（独立 context）
- Reviewed Content HEAD: f12bade
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: none

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 2（+ Writer 停止条件発動分）
- Plan Review round 天井: 3（既定 3）

承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
起動 sequence（operator workflow の入口）の挙動変更 + 設計正本 22-mnt-migration.md §12.4 の契約改訂（MNT-03-D4 の scope 拡張）を含む。DB / wire shape は不変だが、fail-closed 起動中止の operator 可視化という stable contract に触れるため R3。

## Goal

Goal Invariant:

### 最小完了条件

- release build（`windows_subsystem = "windows"`）で setup 失敗が発生したとき、operator が「アプリが起動しない」以外の情報（原因区分の平易な日本語 + 対処誘導）を dialog で得られる。対象は既存 3 経路 = `app_data_dir` 取得失敗（`create_dir_all` 失敗含む）/ `init_database`（`DatabaseInit`）失敗 / `.run()` 失敗（guard plugin init 失敗の合流含む）。

### 失敗定義

- いずれかの経路が引き続き無言クラッシュになる。既存の MNT-03-D4 経路（RestoreReconcile / LegacyMigration の dialog）が退行する。正常起動の速度・挙動が変わる。

### 非目的

- 起動失敗からの自動回復・リトライ。診断ログ機構自体の再設計。`tauri_plugin_dialog` の採用（§12.4 が main-thread 制約で不採用を確定済み）。フロントエンド変更。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- **SPEC-SFV-D1（合流点の単一化）**: `.run(...).expect(...)`（`lib.rs:814`）を `unwrap_or_else` へ置換し、`show_pre_window_fatal`（既存 helper、`lib.rs:149-178`、app handle 非依存）で dialog 表示後に非 0 exit する。setup closure 内の 3 箇所（`app_data_dir?` / `create_dir_all?` / `DatabaseInit`）は Err 伝搬前に同 helper を呼ぶ（既存 RestoreReconcile / LegacyMigration の呼び出し形と同型）。
- **SPEC-SFV-D2（ログ未初期化経路の扱い）**: `app_data_dir` / `create_dir_all` 失敗は診断ログ初期化前のため「dialog のみ・ログなし」を許容する（ログ初期化の先送り再試行は行わない — 失敗原因が filesystem 由来のとき再帰的に失敗し複雑化するため）。dialog 文言はこの 2 経路に限り診断ログ誘導を含めない。
- **SPEC-SFV-D3（DatabaseInit の operator 文言）**: `StartupDatabaseError::DatabaseInit` の `operator_message()` を `None` から具体文言へ変更（利用者向け日本語、既存 2 variant の文言 style に整合）。`lib.rs:56-57` の「本PRのscope外」コメントを削除し、`22-mnt-migration.md` §12.4 の前提事実記述（219 行の「既存3経路は無言クラッシュ」）を本 change 完了形へ改訂。
- **SPEC-SFV-D4（L3 用 simulation hook）**: `.run()` 失敗 handler の実機確認用に、`#[cfg(debug_assertions)]` 限定の起動失敗 simulation（環境変数 trigger、名称は Writer 採番）を追加する。release バイナリには一切含まれない（escape hatch を debug build に封じ込め、`cargo check --release` と Final Review の cfg 検分で担保）。owner L3 項目 2 は `npm run tauri dev`（debug）+ 本 hook で dialog 表示を確認する — MessageBoxW が post-event-loop の `unwrap_or_else` 文脈で動作するかという未検証前提の機構は debug/release で不変のため、debug での確認で足りる（windows_subsystem は console 有無のみの差）。
- **文言契約**: 各経路の dialog 文言は「何が起きたか（平易）+ 対処 + 繰り返し失敗時の管理者連絡誘導 + 末尾に raw error detail（`\n{details}`、既存 2 variant と同型 — Plan Review round 1 P2-2 是正。ログ未初期化経路では dialog 内 detail が唯一の診断手がかり）+（ログ初期化後の経路のみ）診断ログの所在」。確定文言は Test Design Matrix の T 行で固定する。エスカレーション語彙は既存 style の「管理者へ連絡してください」に統一（P2-1 是正）。
- 設計正本改訂: `22-mnt-migration.md` §12.4 へ SPEC-SFV-D1〜D3 を MNT-03-D4 の拡張として追記（新 D-ID は 22 側の連番規約に従い Writer が採番、packet の SPEC-SFV-* と対応表を残す）。
- tests: [Test Design Matrix](test-matrices/2026-08-13-startup-failure-visibility.md) 参照。既存 b6/b9/b10/b11 起動系 test は無改変維持（DatabaseInit の `operator_message() == None` を assert する既存 test が実在する場合のみ、契約更新として期待値変更を許可 — 削除・無効化は不可）。

## Non-scope

- 起動失敗の自動リカバリ / リトライ UI。
- restore 遅延成功の起動通知（別 backlog、優先度低のまま）。
- 非 Windows（開発環境 Linux）の dialog 化（現行 `eprintln!` fallback を維持）。
- フロントエンド・route・DTO・DB の変更。

## Acceptance Criteria

- AC1: `app_data_dir` / `create_dir_all` 失敗経路で `show_pre_window_fatal` が呼ばれることが test で固定される（文言区分含む。観測 = 呼出し記録 or 文言生成関数の unit test、Matrix T1/T2）。
- AC2: `DatabaseInit` の `operator_message()` が具体文言を返す（Matrix T3、`rg "scope外" src-tauri/src/lib.rs` が 0 hit）。
- AC3: `.run()` 失敗 handler が dialog 表示 + 非 0 exit する構造であることが test 可能な形（handler 関数の抽出等）で固定される（Matrix T4）。
- AC4: 既存起動系 test（`test_startup_req901_b6_fail_closed_reconcile_is_operator_visible_before_init` ほか b9/b10/b11 の 4 関数）が無改変のまま `cargo test` で pass する（Matrix T5、無改変は `git diff` の当該関数 0 差分で検分）。
- AC5: `22-mnt-migration.md` §12.4 が拡張後の契約を記述し、`./scripts/doc-consistency-check.sh` + design_compliance 系 test 全通過（Matrix T6）。
- AC6: `cargo check --release` pass（L3 前提の Writer 完了条件）+ L1 full pass。
- AC7: mutation X1〜X4 を各注入した `cargo test` が対応 T 行の test fail（exit code 非 0）になることを Writer 実測 + Coordinator 独立再実測で確認し、復元後の `git status` clean を記録する。
- AC8: owner L3 項目 2（SPEC-SFV-D4 hook による `.run()` 失敗 dialog の実機確認）の PASS が PR body に記録される — これをもって Contract Probe 第 2 項を close する（L3 FAIL / hook 不成立の場合は fail-closed で design 再検討）。hook が実 `.run()` Err 経路を通す方式であること（handler 直接呼出しでないこと）は Final Review の code 検分対象。

## Design Sources

- Requirements / spec: REQ-901 系（起動 fail-closed）、Plans.md backlog「起動時 setup 失敗の operator 可視化」（2026-07-17 起票、優先度条項「v1.0 配布前に再評価」= owner 方針 2026-08-13「v1.0 前にやり切る」で着手確定）
- Architecture: `docs/ARCHITECTURE.md`（MNT 層責務）
- Function / command / DTO: `docs/function-design/22-mnt-migration.md` §12.4「lib.rs 起動契約（MNT-03-D4）」（本 change で改訂）
- DB: 変更なし
- Screen / UI: 画面変更なし（pre-window dialog のみ）
- Decision log / ADR: [設計 packet 2026-07-17](2026-07-17-backup-migration-failure-contract-design.md) / [実装 PR1 packet 2026-07-18](2026-07-18-backup-migration-failure-contract-impl-pr1.md)（Contract Probe #1 = MessageBoxW 方式の実機確定）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | 22-mnt-migration.md §12.4 | updated in this PR（MNT-03-D4 拡張） |
| Command / DTO / generated binding / wire shape | 該当なし | — |
| DB / transaction / audit / rollback / migration | 該当なし（起動時 DB 初期化の失敗「後」の可視化のみ） | existing sufficient |
| Screen / UI / route state / Japanese wording | dialog 文言（操作画面外） | updated in this PR（文言契約を Matrix で固定） |
| CSV / TSV / report / import / export format | 該当なし | — |
| Durable decision / ADR | 22 §12.4 改訂に含める（decision-log 新設 entry は不要 — MNT-03-D4 の既存決定枠の拡張） | updated in this PR |

## Registration / Generation Obligations

該当なし（Tauri command / route / 画面 / function-design doc の新設なし。REQ token を含む test 追加が発生する場合のみ `cargo run --bin generate_traceability` で 90-traceability.md を再生成 — Writer 完了条件に `--check` clean を含む）。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-901 系 | 22 §12.4 | SPEC-SFV-D1 | 合流点 `.run().expect()` の置換 + setup 内 3 箇所への既存 helper 適用。tauri_plugin_dialog は main-thread 制約で不採用済み（§12.4:217）、新規機構を作らず実機 probe 済みの MessageBoxW helper を流用 | lib.rs 起動 sequence | Matrix T1/T2/T4/T5 |
| 同上 | 22 §12.4 | SPEC-SFV-D2 | ログ未初期化 2 経路は dialog のみ許容。ログ初期化の先送り再試行は filesystem 起因失敗で再帰しうるため不採用 | lib.rs setup closure 前半 | Matrix T1/T2（文言に診断ログ誘導を含めない） |
| 同上 | 22 §12.4 | SPEC-SFV-D3 | DatabaseInit の operator_message を具体化し「scope外」残置を解消。既存 2 variant と同一の文言 style / 生成箇所 | lib.rs `StartupDatabaseError` | Matrix T3 |

## Design Intent Audit

- Source docs can answer what is being built and why: 22 §12.4 が MNT-03-D4 の既存契約と「既存 3 経路は scope 外」の前提を明記済み。本 change はその前提を解消する拡張で、改訂後の §12.4 が単独で全経路の契約を語る。
- Plan-only durable decisions promoted: SPEC-SFV-D1〜D3 を §12.4 へ昇格（Writer が 22 側 D-ID を採番）。
- Assumptions and constraints: `show_pre_window_fatal` は app handle 非依存で setup closure 内どこからでも呼べる（Coordinator 調査 2026-08-13、lib.rs:149-178 実読）。MessageBoxW の pre-window 実機挙動は PR1 Contract Probe #1 で確定済み（再 probe 不要）。診断ログ初期化前の 2 経路は tracing が silent drop になる（lib.rs:692-703 実読）。
- Deferred design gaps: 非 Windows の dialog 化（開発環境のみ、eprintln 維持）。restore 遅延成功の起動通知（別 backlog）。
- Test Design Matrix cites design decision IDs: yes（SPEC-SFV-D1〜D3）。
- Absolute guarantee / escape hatch self-check: fail-closed 挙動（起動中止）は不変 — 可視化を足すのみで、いかなる失敗も起動続行へ変えない。唯一の新設 escape hatch は SPEC-SFV-D4 の simulation hook で、`#[cfg(debug_assertions)]` により release バイナリから構造的に排除される（Final Review が cfg 検分、互換性 = release 挙動に影響なし）。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable — 層構造変更なし | — |
| Fact check / design decision split | 「3 経路が単一 sink `.run().expect()` に合流」「helper が app handle 非依存」を Coordinator 実読で確認済み。tauri_plugin_dialog 前提の backlog 文言は誤りで、正 = 生 Win32（§12.4 明記） | 本 packet Design Intent Audit |
| Lifecycle / retry | 失敗時は dialog → 非 0 exit の一方向。リトライなし（非目的） | — |
| Operator workflow | 「アプリが起動しない」への一次回答を operator に与える。文言は非 IT operator 向け平易日本語 | Matrix T1-T4 文言行 |
| Replacement path | `.expect()` → `unwrap_or_else` の置換 1 箇所。panic 依存の既存挙動（stderr 不可視）を dialog + exit へ置換 | Matrix T4 |
| Data safety / evidence | DB / backup への書込み変更なし。失敗時に DB を触らない現行 fail-closed を維持 | — |
| Reporting / accounting semantics | not applicable | — |
| Manual verification | L3 2 項目 = 正常起動確認（退行検知）+ SPEC-SFV-D4 hook による `.run()` 失敗 dialog の実機確認（AC8。round 1 P1-1 是正後の確定形 — 本行は是正時の sweep 漏れを Writer P3 指摘で追随、Coordinator 是正） | Human Gate / AC8 |
| 環境・再現性 | Windows 固有 code は `#[cfg(windows)]` 既存構造を踏襲、新規環境依存なし | — |

## Design Readiness

- Existing design docs are sufficient because: §12.4 が方式（MessageBoxW worker thread + join）と制約（main-thread 禁止）を確定済み。本 change は適用範囲の拡張。
- Source docs updated in this PR: 22-mnt-migration.md §12.4。
- Design gaps intentionally deferred: 非 Windows dialog / 起動通知系（Non-scope 参照）。
- Durable decisions discovered and promoted: SPEC-SFV-D1〜D3 → §12.4。

Minimum design checks: Layer ownership = MNT/起動層のみ / backend function design = §12.4 改訂 / DTO 変更なし / 永続化影響なし / operator 文言 = Matrix 固定 / エラー挙動 = fail-closed 不変 + 可視化追加 / traceability = REQ-901 系 token（追加 test に含む場合は再生成）。

## Contract Probe

- MessageBoxW の pre-window（setup 段階）表示可否: **既存 evidence 流用** — PR1 Contract Probe #1（[archived packet](2026-07-18-backup-migration-failure-contract-impl-pr1.md)）で Windows 実機確定済み。本 change は同一 helper の適用範囲拡張のため再 probe 不要（適用時点がより早くなる `app_data_dir` 失敗経路も app handle 非依存性〈lib.rs:149-178 実読〉により同条件）。
- `.run()` Err 時の process 状態（unwrap_or_else 内で MessageBoxW worker thread + join が動作するか）: 未検証の外部前提。**probe = owner L3 項目 2**（SPEC-SFV-D4 の debug 限定 simulation hook、AC8 で closure を拘束）。Writer への実機確認委任は行わない — CI は全 job ubuntu-latest で Windows runner 不在（`.github/workflows/ci.yml` 実査）、L3 実機確認は owner 専任（AGENT_OPERATING_MANUAL §2 Human Gate 定義）。Plan Review round 1 P1-1 是正。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| SPEC-SFV-D1（3 経路 + `.run()` の dialog 化） | lib.rs 起動 sequence | T1/T2/T4 | L3 は正常起動退行のみ |
| SPEC-SFV-D2（ログ未初期化経路 = dialog のみ） | lib.rs setup closure 前半 | T1/T2（文言差分） | non-scope（ログ再試行なし） |
| SPEC-SFV-D3（DatabaseInit operator_message 具体化） | lib.rs StartupDatabaseError | T3 | — |
| SPEC-SFV-D4（debug 限定 simulation hook） | lib.rs `.run()` handler 手前 | cfg 構造の code review（Final Review 検分） | L3 項目 2（AC8） |
| MNT-03-D4 既存契約の不退行 | lib.rs:715 既存呼出し | T5（b6 ほか無改変 green） | — |
| §12.4 doc 整合 | 22-mnt-migration.md | T6（doc check + design compliance） | — |

## Test Plan

[Test Design Matrix](test-matrices/2026-08-13-startup-failure-visibility.md) 参照（T1〜T6 + mutation X1〜X4）。

- targeted tests: 文言生成 / handler 抽出関数の unit test（T1〜T4）、既存起動系回帰（T5）、doc gates（T6）。
- negative tests: 正常起動で dialog が出ないこと（T5 に含む）。
- compatibility checks: `cargo check --release`（L3 前提）、L1 full。
- data safety checks: 失敗経路で DB 書込みが発生しないこと（既存 fail-closed test の維持で担保）。
- main wiring/integration checks: `.run()` handler 置換の synthetic 失敗確認（Contract Probe 第 2 項）。

## Boundary / Wire Contract

not applicable — wire / DTO / API / DB 変更なし。dialog 文言は operator 向け表示のみで機械消費されない。

## Review Focus

- 4 失敗点（app_data_dir / create_dir_all / DatabaseInit / `.run()`）の全数カバーと、setup closure 内外の非対称の吸収方法。
- ログ未初期化経路の文言に診断ログ誘導が混入していないか（SPEC-SFV-D2）。
- 既存 MNT-03-D4 経路（RestoreReconcile / LegacyMigration）の不退行。
- `.expect()` 置換後も fail-closed（起動続行しない）が全経路で維持されるか。
- §12.4 改訂が「既存 3 経路は scope 外」の旧前提を全箇所で解消しているか（doc 内 sweep）。

## Spec Contract

Contract ID: SPEC-SFV

- SPEC-SFV-D1: release build の setup 失敗 3 経路 + `.run()` 失敗は、`show_pre_window_fatal`（MessageBoxW worker thread + join）による dialog 表示後に非 0 exit する。無言クラッシュ経路を残さない。
- SPEC-SFV-D2: 診断ログ初期化前の失敗（`app_data_dir` / `create_dir_all`）は dialog のみとし、ログ初期化の先送り再試行を行わない。当該文言は診断ログ誘導を含まない。
- SPEC-SFV-D3: `StartupDatabaseError::DatabaseInit` は具体的な operator 向け日本語文言を返す。「scope外」注記は code / doc の両方から除去する。`operator_message()` の `Option<String>` signature は維持する（全 variant が Some になった後も、既存 test（b6 の `.unwrap()` 呼出し等）の無改変維持〈T5〉を優先する意図的判断。`lib.rs:716-718` の else 分岐は defensive fallback として残し、その旨のコメントを付す — Plan Review round 1 P3-2 disposition）。
- SPEC-SFV-D4: `.run()` 失敗経路の L3 実機確認用 simulation hook を `#[cfg(debug_assertions)]` 限定で追加する。release バイナリに含まれないことを構造（cfg）で保証し、escape hatch を debug build に封じ込める。**hook は `.run()` の Result を実際に Err にする方式（plugin init 失敗の誘発等）とし、fatal handler 関数の直接呼出しによる代替は不可** — Probe #2 の検証対象は「`.run()` 失敗 → unwrap_or_else → MessageBoxW worker spawn → join」の実経路である（Plan Review round 2 P2 是正）。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-SFV-D1 | helper 適用 + `.expect()` 置換 | T1/T2/T4/X1/X2 | 全数カバー / fail-closed 維持 | PR diff + Matrix 実測 |
| SPEC-SFV-D2 | 文言分岐 | T1/T2/X3 | 診断ログ誘導の混入なし | 同上 |
| SPEC-SFV-D3 | operator_message 具体化 | T3/X4 | 文言 style 整合 / Option 維持理由 | 同上 |
| SPEC-SFV-D4 | debug 限定 hook | L3 項目 2（AC8） | release 非混入（cfg 検分） | PR body L3 記録 |
| MNT-03-D4 不退行 | 既存呼出し維持 | T5 | b6 ほか無改変 | 同上 |

## Data Safety

- 実店舗 DB / backup / log を test に使わない（synthetic のみ）。
- dialog 文言・test fixture に実店舗情報を含めない。
- 失敗経路で新規のファイル書込みを追加しない（ログ初期化済み経路の tracing 出力は既存機構のみ）。

## Implementation Results

- Writer implementation: completed — SPEC-SFV-D1〜D4 の起動失敗 dialog 配線、固定文言、debug 限定の実 `.run()` Err simulation hook、T1〜T5、MNT-03-D5〜D8 の設計同期を実装した。
- Verification: Rust test / format / clippy / release check、doc consistency、traceability、clean content commit の L1 full が pass。mutation X1〜X4 は全件 kill 後に復元し、clean tree を確認した（implementing → local-verified の遷移根拠）。
- PR: 未作成（Coordinator が Final Review 後に作成する契約）。

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

- R3 review-only sub-agent: P1×0 / P2×2 / P3×2。P2（setup 実配線の mutation 感度不足、`.run()` handler の非 0 exit 配線不足）は test と injectable handler の補強で解消した。P3 のうち Plans の stale status / backlog は本 state-only 遷移で同期し、packet 内 Impact Review Manual の D4 / L3 要約不整合は契約変更を避けて Coordinator の gated amendment 判断へ残した。
If R3 review-only sub-agent is skipped, record an explicit line beginning with `Review-only skipped because:` and the reason.
- Findings Freeze: not yet frozen; post-freeze exceptions: none.

### Plan Review（独立 Sonnet、rally 天井 3、単調収束 P1+P2: 4→1→0）

- round 1（対象 `4e1f13f`）: NOT CLOSED — P1×1（Contract Probe #2 の Writer 委任が Human Gate 定義〈owner 専任〉+ Windows CI runner 不在と矛盾）/ P2×3（「担当者」vs 既存「管理者」語彙 / raw error detail `\n{details}` の欠落 — ログ皆無経路では dialog 内 detail が唯一の診断手がかり / 再起動対象の無記録な相違）/ P3×2（70-mnt サンプル陳腐化 = backlog 起票 / operator_message Option 維持理由の明記）。packet の事実主張 3 点（経路全数・helper 非依存性・silent drop）は reviewer 実読で全件一致。全 findings 修正案添付。Coordinator が CI 構成・manual・既存文言の 3 点を実読裏取りのうえ全件 accept、是正 `7e2fcb1`（SPEC-SFV-D4 新設 + AC8 + 文言統一）。
- round 2（対象 `7e2fcb1`）: disposition 5 件 OK + 新規 P2×1（D4 hook が実 `.run()` Err 経路を通す明文要求の欠如 — handler 直呼びの低忠実度実装が AC8 を素通りし得る）。新設事実主張（windows_subsystem = console 有無のみ）は reviewer が main.rs:2 実読で正当性確認。是正 `cfceb91`。
- round 3（対象 `cfceb91`）: **CLOSED（P1/P2 = 0）** — 実経路担保の明文化と AC8 の Final Review gate 接続を確認。

### Writer 実装後の付随裁定

- Writer P3（Impact Lenses Manual 行の L3 記述が round 1 是正の sweep 漏れで stale）: accept、Coordinator 是正 `f12bade`。Writer が packet 契約を勝手に直さず Coordinator 裁定へ残した正規手順。
- Coordinator mutation 独立再実測（AC7）: X1〜X4 を Matrix から記録非参照で独自導出・注入し、対応 T 行のみ red（X1→T1 / X2→T4 / X3→T1 / X4→T3）を実測、全復元後 clean 5/5 green。

### Final Review（独立 Sonnet、R3 Contract Audit、対象 = Reviewed Content HEAD `f12bade`）: CLOSED（P1/P2/P3 = 0）

- Ledger 6 行を実 code / 実 doc で全数照合 — SPEC-SFV-D1 の 4 配線実読 / D2 の文言検分 / D3 の Option 維持 + defensive else / **D4 の cfg(debug_assertions) 封じ込め（`cargo check --release` で除外を実測 corroborate）と実 `.run()` Err 経路方式（plugin `.setup()` Err 返却、handler 直呼びでない）の精読確認** / MNT-03-D4 不退行 / §12.4 1:1 対応。
- 文言 Matrix 完全一致 / 既存 b6・b9・b10・b11 の 4 関数 0 差分 + 実行 green / anchor 一意性は実 newline 版の出現数検証で素通し設計でないことを確認（combined-anchor 類型の回避）/ mutation X2 の三者目独立注入で T4 red → 復元 clean / 旧前提 rg 0 hit / packet 記録と git 実況の完全一致。
- 付記: FR 後に IDE の stale 診断（mutant 注入中の dead_code 残像）が観測されたが、Coordinator が現 tree で `cargo clippy -- -D warnings` exit 0 を実測し偽陽性と確定。
- 遷移記録: local-verified → independent-review（FR 従事）→ human-confirm（P1/P2 = 0 確定、Reviewed Content HEAD = `f12bade`）。本遷移は content commit（本記録）同乗。次 = PR open → owner L3 2 項目（AC8 = Probe #2 close）→ Ready。

### owner L3（2026-08-13、Windows native、HEAD `162bc28`）: 2 項目とも PASS — Human Gate 完了、AC8 close

- 項目 1（通常起動の退行検知）: PASS（owner 確認「通常起動も問題なし」）。
- 項目 2（`.run()` 失敗 dialog）: PASS — `INVENTORY_SIMULATE_RUN_FAILURE=1` + `npm run tauri dev` で「Inventory startup error」dialog を実機確認（T4 固定文言 + 末尾 raw detail `failed to initialize plugin 'startup-run-failure-simulation': …`、exit code 1。screenshot evidence = 会話記録 + PR body 参照）。**Contract Probe #2（MessageBoxW の post-event-loop `unwrap_or_else` 文脈での動作）を実機で close（AC8 成立）**。
- 遷移記録: human-confirm → ready-hosted-final（L3 PASS。本遷移は L3 記録 content commit 同乗）。次 = hosted CI green 確認 → owner merge 承認（介入 3/3）→ merge → archive closeout。
