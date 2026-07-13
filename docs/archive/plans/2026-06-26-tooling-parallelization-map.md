# tooling / parallelization map

## Risk

Risk: R2

Reason:
開発 workflow と依存関係の整理が主で、DB / CMD DTO / CSV 形式 / operator workflow の runtime 契約は変更しない。ただし Tauri plugin を導入する場合は npm package、Rust crate、capability を触るため、小 PR に分離して full frontend / Rust wiring gate を通す。

## Goal

Mini Shai-Hulud / TanStack npm malware 後に保留していた tooling を、今すぐ導入するもの、延期するもの、不要なものへ分類する。最初に導入する tooling は UI-08 PLU 書出しの save dialog 前提になる `@tauri-apps/plugin-dialog` に絞る。

## Scope

- `workflow/parallelization-map` と npm/tooling の棚卸しを記録する。
- `@tauri-apps/plugin-dialog` / `tauri-plugin-dialog` を foundation として導入する。
- `.npmrc ignore-scripts=true` を維持する。
- UI-08 の本体実装前に、dialog plugin の registration / capability / package lock だけを通す。

## Non-scope

- UI-08 PLU 書出し画面の実装。
- UI-07 / UI-01c の plain file input / dragdrop を置き換えること。
- Storybook / E2E / visual regression の導入。
- npm `ignore-scripts=true` の解除、`npm audit fix`、pnpm migration。
- 実 POS / SD カード実機確認。

## Acceptance Criteria

- `@tauri-apps/plugin-dialog` と `tauri-plugin-dialog` が v2 系で追加される。
- Tauri `Builder` に `tauri_plugin_dialog::init()` が登録される。
- main window capability に `dialog:allow-open` / `dialog:allow-save` が追加され、`dialog:default` は使わない。
- `.npmrc ignore-scripts=true` が残る。
- `npm run typecheck` / `npm run lint` / `npm test` / `npm run build` が pass する。
- `cargo fmt --check` / `cargo clippy --all-targets --all-features -- -D warnings` / `cargo test` が pass する。
- docs check が pass する。

## Design Sources

- Requirements / spec: `docs/spec/requirements.md` REQ-402
- Architecture: `docs/architecture/ui-task-specs.md` UI-08、`docs/architecture/io-task-specs.md` IO-04
- Function / command / DTO: `docs/function-design/33-biz-plu-export-service.md`、`docs/function-design/41-cmd-pos.md`
- DB: なし
- Screen / UI: `docs/UI_TECH_STACK.md` §6.5.4、`docs/SCREEN_DESIGN.md` UI-08
- Decision log / ADR: `docs/decision-log.md` D-019
- External docs: Tauri v2 dialog plugin docs（Context7 `/websites/v2_tauri_app`、source: `https://v2.tauri.app/plugin/dialog`）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | なし | existing sufficient |
| Command / DTO / generated binding / wire shape | なし | existing sufficient |
| DB / transaction / audit / rollback / migration | なし | existing sufficient |
| Screen / UI / route state / Japanese wording | `docs/UI_TECH_STACK.md` §6.5.4 | updated in this PR |
| CSV / TSV / report / import / export format | `docs/function-design/25-io-plu-formatter.md` / `33-biz-plu-export-service.md` | existing sufficient |
| Durable decision / ADR | `docs/decision-log.md` D-019 | existing sufficient |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-402 | `docs/UI_TECH_STACK.md` §6.5.4 | TOOL-DIALOG-D1 | UI-08 PLU TSV は operator が保存先を選ぶ file export なので native save dialog を前提にする。UI 本体と同時に初導入すると、画面実装・レジ運用確認・npm/cargo 依存追加が混ざるため foundation PR に切る。 | package / Cargo / capability / Builder plugin registration | frontend gates、Rust gates、docs checks |
| workflow | `Plans.md` 次の行動 | TOOL-MAP-D1 | 並列実装は「依存しない feature lane の設計・レビュー」を並列にできるが、同じ source docs / navigation / shared UI を触る実装は衝突しやすい。まず map を作り、1 PR 1 lane を維持する。 | docs plan / Plans.md | doc-consistency |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes。UI_TECH_STACK §6.5.4 に native dialog 方針と暫定例外がある。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: `plugin-dialog` foundation 導入タイミングは UI_TECH_STACK へ反映する。
- Assumptions and constraints: npm install は `ignore-scripts=true` 維持、明示 package のみ、lock diff を確認する。
- Deferred design gaps, risk, and follow-up target: UI-08 の save path UX / SD カード確認 / PLU 書出し L3 は UI-08 Design Phase に残す。
- Test Design Matrix can cite design decision IDs or source doc sections: R2 のため matrix は作らない。verification gate で代替する。

## Design Readiness

- Existing design docs are sufficient because: BIZ/CMD/IO の PLU TSV 生成契約は既に存在し、今回の変更は native dialog foundation の導入だけ。
- Source docs updated in this PR: `docs/UI_TECH_STACK.md` §6.5.4、`Plans.md`。
- Design gaps intentionally deferred: UI-08 operator flow と SD カード実機確認。
- Durable decisions discovered in this plan and promoted to source docs: `plugin-dialog` を UI-08 前の foundation として入れる判断。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI の保存先選択だけを plugin-dialog が担う。BIZ/CMD は bytes / filename 契約のまま。
- Backend function design: 変更なし。
- Command / DTO / data contract: 変更なし。
- Persistence / transaction / audit impact: 変更なし。
- Operator workflow / Japanese UI wording: UI-08 実装時に確定する。
- Error, empty, retry, and recovery behavior: UI-08 実装時に確定する。
- Testability and traceability IDs: REQ-402 / TOOL-DIALOG-D1。

## Tooling Classification

| Candidate | Decision | Reason | Follow-up |
|---|---|---|---|
| `@tauri-apps/plugin-dialog` / `tauri-plugin-dialog` | introduce now | UI-08 PLU TSV export、売上 CSV export、backup/restore、receipt image で共通になる。初導入だけを先に切ると UI-08 implementation の risk が下がる。permission は `dialog:allow-open` / `dialog:allow-save` に限定し、message は許可しない。 | 本 PR |
| Storybook | defer | design-system docs と RTL が既に機能している。導入 dependency が大きく、今の operator workflow 実装を止めるほどの効果は薄い。 | UI-12 / components がさらに増えた時に再評価 |
| E2E / visual regression | defer | D-015 で Phase 2 tag gate から外した。Phase 3 初の cross-screen regression、横断 typography / density 変更、v1.0.0 候補前が再評価タイミング。 | `docs/UI_TECH_STACK.md` §7.2 |
| `@axe-core/react` | defer | `eslint-plugin-jsx-a11y` と RTL が先に入っている。runtime dev-only axe は false positive / 開発雑音もあるため、hooks/components test 拡張と同時に検討する。 | 7-7b follow-up |
| npm `allowScripts` / `strict-allow-scripts` | defer | npm v11 系 policy と team local Node/npm を揃える必要がある。現行は blanket `ignore-scripts=true` が安全側。 | 別 policy spike |
| npm `min-release-age` | defer | PR #105 で `happy-dom@20.10.6` に対して date-filter 由来の `ETARGET` が出た。まず挙動検証が必要。 | 別 policy spike |
| pnpm migration | defer | `approve-builds` / `minimumReleaseAge` は魅力があるが package manager migration 自体が大きい。 | npm policy spike 後 |

## Parallelization Map

| Lane | Can run in parallel? | Notes |
|---|---|---|
| Tooling foundation (`plugin-dialog`) | yes, isolated | feature UI と分離可能。ただし dependency / lockfile は 1 PR に閉じる。 |
| UI-03 返品・交換 | yes with design-only parallelism | UI-04 と近い inventory movement だが route / BIZ/CMD は別。shared search/add component を触る場合は UI-05 と衝突する。 |
| UI-05 廃棄・破損 | yes with design-only parallelism | UI-02/UI-04 の明細入力 pattern を再利用。実装は 1 lane に絞る。 |
| UI-08 PLU書出し | depends on plugin-dialog foundation | file save / SD card L3 を Design Phase で切る。plugin-dialog が先に入ると進めやすい。 |

## Test Plan

- targeted tests: なし（runtime behavior はまだ増やさない）
- negative tests: `.npmrc ignore-scripts=true` 維持、`npm audit --audit-level=high`
- compatibility checks: Tauri plugin registration が Rust build / tests を壊さないこと
- data safety checks: `bash scripts/check-env-safety.sh`
- main wiring/integration checks: frontend gates、Rust gates、docs checks

## Boundary / Wire Contract

- producer: Tauri plugin registry / capability config
- consumer: future UI-08 frontend code
- wire type: native dialog permission only
- internal type: なし
- precision/range: なし
- round-trip path: future `@tauri-apps/plugin-dialog` `save/open` call
- invalid input: future UI-08 で扱う
- compatibility: existing browser file input flows remain unchanged

## Review Focus

- `ignore-scripts=true` が維持されているか。
- `plugin-dialog` 導入が UI-08 本体や既存 file input 置換に膨らんでいないか。
- capability permission が `dialog:allow-open` / `dialog:allow-save` に限定され、`dialog:default` で過剰になっていないか。
- dependency / lock diff が direct package 追加に見合う範囲か。

## Implementation Results

- Added `@tauri-apps/plugin-dialog` `2.7.1` to `package.json` / `package-lock.json`.
- The npm lock also moved `@tauri-apps/api` from `2.10.1` to `2.11.1` because `@tauri-apps/plugin-dialog@2.7.1` depends on `@tauri-apps/api@^2.11.0`.
- Added `tauri-plugin-dialog` `2.7.1` to `src-tauri/Cargo.toml` / `Cargo.lock`.
- Registered `tauri_plugin_dialog::init()` in `src-tauri/src/lib.rs`.
- Added only `dialog:allow-open` and `dialog:allow-save` to `src-tauri/capabilities/default.json`; did not use `dialog:default`.
- Updated `docs/UI_TECH_STACK.md` §6.5.4 to state that dialog plugin is now a foundation for UI-08+ and that UI-07 / UI-01c plain file input flows remain unchanged.

Verification:

- `npm audit --audit-level=high`: pass, exit 0; remaining advisories are low/moderate only.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm test`: pass, 66 files / 420 tests.
- `npm run build`: pass; existing Vite 500k chunk warning remains.
- `cargo fmt --check`: pass.
- `cargo clippy --all-targets --all-features -- -D warnings`: pass.
- `cargo test`: pass, 560 lib tests + 13 traceability bin tests + 1 architecture + 1 design compliance + 8 seed tests.
- `bash scripts/doc-consistency-check.sh --target plan`: pass.
- `bash scripts/doc-consistency-check.sh`: pass.
- `bash scripts/check-env-safety.sh`: pass.
- `cargo run --bin generate_traceability -- --check`: OK, ERROR 0 / WARN 1 (`REQ-403` has 0 tests; pre-existing).

## Review Response

Review-only skipped because: R2 foundation/tooling change with no operator-facing runtime behavior, no DB/CMD DTO/schema/CSV contract changes, and full local gates passed. A separate review-only sub-agent is not required by the workflow for this R2 scope.
