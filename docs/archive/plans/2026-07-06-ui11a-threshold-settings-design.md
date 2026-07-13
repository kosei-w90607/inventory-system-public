# UI-11a 閾値設定（在庫少の基準）Design Phase

## Risk

Risk: R2

Reason:
Docs-only の Design Phase PR。将来の UI-11a 実装が従う設計判断（所有 key、検証、保存フロー、文言、L3）を source docs に固定するが、runtime コード・DB スキーマ・CMD シグネチャ・generated bindings・テストは変更しない。後続の実装 PR は route/search state と operator workflow を触るため R3 として別 packet で扱う。

## Goal

UI-11a 閾値設定画面（operator 名称「在庫少の基準」）の設計を source docs に記録し、実装 PR（Sonnet subagent 委譲）が chat 文脈なしで固定済み判断に従えるようにする。

## Scope

- `docs/function-design/69-ui-threshold-settings.md` の新規作成（UI-11a-D1〜D7）。
- `docs/FUNCTION_DESIGN.md`、`docs/SCREEN_DESIGN.md`、`Plans.md` の同期。
- 設計の事実前提（CMD-11 契約、bindings、app_settings key、navigation エントリ）の read-only 突合。

## Non-scope

- Runtime 実装（route、components、hooks、テスト、navigation active 化）→ 実装 packet（R3）で扱う。
- CMD / BIZ / IO / DB の変更。
- UI-11c 操作ログ・UI-10 棚卸し・UI-13 の設計。
- BIZ 側の閾値読み出しの防御挙動の変更（実装 PR で事実確認のみ、69 §69.3 UI-11a-D3）。

## Acceptance Criteria

- `docs/function-design/69-ui-threshold-settings.md` が存在し、目的 / Design Decisions / Route / 状態 / Command Contract / 検証 / 保存・回復 / 文言 / invalidation / テスト起点 / L3 / Non-scope を持つ。
- 所有 key 2 件限定（UI-11a-D1）が UI-11b-D6 の相互不可侵（68 §68.13 / SCREEN_DESIGN バックアップ・復元画面）と矛盾しない。
- `docs/FUNCTION_DESIGN.md` の対象モジュール・目次に UI-11a が載り、「UI 層の残り」から UI-11a が消える。
- `docs/SCREEN_DESIGN.md` の画面一覧と画面別セクションに UI-11a の設計ポインタが載る。
- `Plans.md` が Phase 4 第2スライス = UI-11a を反映する。
- `bash scripts/doc-consistency-check.sh` と `git diff --check` が green。

## Design Sources

- Requirements / spec: `docs/architecture/ui-task-specs.md` UI-11a（最小値 1・0 以下拒否・即時反映）、`docs/DB_DESIGN.md` 設計方針メモ D-4
- Architecture: `docs/ARCHITECTURE.md` UI-11a 行、CMD 層責務ルール
- Function / command / DTO: `docs/function-design/43-cmd-settings-log.md` §43.3-43.4、`src/lib/bindings.ts`（`getSettings` / `updateSetting`、PR #141）
- DB: `docs/db-design/tracking-system-tables.md` app_settings（`stock_low_threshold` = 3 / `stock_low_threshold_fabric` = 500）
- Screen / UI: `docs/SCREEN_DESIGN.md`、`docs/design-system/01-decision-rules.md`（DSR-01/03/05/06/07/08/09）、`docs/design-system/02-component-catalog.md` ④⑦、`docs/function-design/68-ui-backup-restore.md`
- Decision log / ADR: `docs/decision-log.md`（新規 D 起票なし。durable 判断は DB_DESIGN D-4 既存 + 69 のローカル ID）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | `43-cmd-settings-log.md` | existing sufficient; read-only 突合のみ |
| Command / DTO / generated binding / wire shape | `43-cmd-settings-log.md`、generated `src/lib/bindings.ts` | existing sufficient（PR #141 登録済み、新規 CMD なし） |
| DB / transaction / audit / rollback / migration | `tracking-system-tables.md` app_settings、DB_DESIGN D-4 | existing sufficient; スキーマ変更なし |
| Screen / UI / route state / Japanese wording | 新規 `69-ui-threshold-settings.md`、`SCREEN_DESIGN.md` | updated in this PR |
| CSV / TSV / report / import / export format | none | not applicable |
| Durable decision / ADR | DB_DESIGN D-4（既存）+ 69 ローカル UI-11a-D1〜D7 | existing sufficient + 69 に記録; decision-log 新規起票なし |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| QR系 / D-4 | `69-ui-threshold-settings.md` §69.3, §69.7 | UI-11a-D1, D3 | 所有 key 2 件限定と整数 1〜99999。汎用 key エディタと CMD 側業務検証を却下。 | future `ThresholdSettingsPage` + zod schema | future RTL 検証 4 系統 |
| ui-task-specs UI-11a 操作フロー | `69-ui-threshold-settings.md` §69.5, §69.8 | UI-11a-D2 | dirty key のみ順次保存 + 部分失敗の事実表示。疑似原子性を却下。 | future `useSaveThresholds` | future RTL 部分失敗 / 単一 key 保存 |
| ui-task-specs UI-11a 即時反映 | `69-ui-threshold-settings.md` §69.10 | UI-11a-D4 | BIZ は都度読みのため invalidation のみで足りる。 | future query invalidation 配線 | future RTL invalidation 発火 |
| operator UI 原則 | `69-ui-threshold-settings.md` §69.9 | UI-11a-D6 | 「閾値」を operator 文言から排し「在庫少の基準」へ。 | future navigation.ts label 変更 + h1 | future RTL 文言 assert + L3 |
| L3 方針（68 §68.12 踏襲） | `69-ui-threshold-settings.md` §69.12 | UI-11a-D7 | 実機でしか確認できない反映導線 2 項目に限定。 | future manual gate | Windows native L3-1/L3-2 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes。69 が durable home、min=1 の根拠は既存 DB_DESIGN D-4。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: なし（cross-cutting な新判断は発生せず、全て 69 のローカル ID に収まる）。
- Assumptions and constraints: `getSettings` / `updateSetting` bindings は PR #141 で登録済み（実コード確認済み）。`navigation.ts` `ui-11a` は `to: null` / pending / label「閾値設定」（実コード確認済み）。
- Deferred design gaps, risk, and follow-up target: BIZ の非数値設定値への防御挙動は実装 PR で事実確認（69 UI-11a-D3）。query key の具体名は実装 PR で既存定義に従う（69 §69.10）。
- Test Design Matrix can cite design decision IDs or source doc sections: yes。実装 packet は UI-11a-D1〜D7 と §69.7-69.11 を引用できる。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | POS/register adapter 非関与。app_settings は app core。 | none |
| Fact check / design decision split | CMD 契約・bindings・key 初期値・navigation 現状は実コード/実 docs で突合済み。UI 判断は 69 に分離。 | 69 |
| Lifecycle / retry | 取得失敗・全件失敗・部分失敗・再保存の回復経路を 69 §69.8 に明記。 | 69 §69.8 |
| Operator workflow | 非 IT operator 向け文言（「閾値」排除）、必須表示、単位常時表示を固定。 | 69 §69.9 |
| Replacement path | not applicable（外部システム非依存）。 | none |
| Data safety / evidence | 破壊的操作なし。L3 証跡に実店舗データを残さない旨を 69 §69.12 に明記。 | 69 §69.12 |
| Reporting / accounting semantics | not applicable（集計・会計非関与）。 | none |
| Manual verification | 反映導線と再起動後保持のみ L3。 | 69 §69.12 |

## Design Readiness

- Existing design docs are sufficient because: backend 側（CMD-11 契約、app_settings、D-4）は 43 / tracking-system-tables / DB_DESIGN に既存で、変更が不要。
- Source docs updated in this PR: `69-ui-threshold-settings.md`（新規）、`FUNCTION_DESIGN.md`、`SCREEN_DESIGN.md`、`Plans.md`。
- Design gaps intentionally deferred: BIZ 防御挙動の事実確認、query key 列挙、コンポーネント配置の最終確定（いずれも実装 PR、69 に明記済み）。
- Durable decisions discovered in this plan and promoted to source docs: なし（decision-log 新規起票なし。判断は 69 ローカル ID + 既存 D-4 引用で完結）。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI は generated `commands.*` のみ使用。CMD/BIZ 変更なし、検証は UI 責務（UI-11a-D3）。
- Backend function design: 変更なし。43 の既存契約を引用。
- Command / DTO / data contract: `getSettings` → `AppSetting[]`、`updateSetting({key, value})` → `null`。wire は文字列 value。
- Persistence / transaction / audit impact: app_settings upsert のみ。TX・audit・migration 影響なし。
- Operator workflow / Japanese UI wording: 69 §69.9 で固定（「在庫少の基準」）。
- Error, empty, retry, and recovery behavior: 69 §69.7-69.8 で固定（取得失敗 / 全件失敗 / 部分失敗 / 非数値既存値）。
- Testability and traceability IDs: QR系 / D-4 / UI-11a-D1〜D7 を RTL・L3 に引用可能。

## Test Plan

- targeted tests: 本 PR は docs-only のため `bash scripts/doc-consistency-check.sh` のみ。
- negative tests: docs が UI 実装済みと主張しない（現在形の実装記述は既存 CMD/bindings のみ）。
- compatibility checks: Markdown リンク先の実在（R3 check）。
- data safety checks: 実店舗データ・実 JAN・実価格を含む記述なし。
- main wiring/integration checks: not applicable（runtime 変更なし）。

## Boundary / Wire Contract

- producer: 既存 CMD-11 `get_settings` / `update_setting`（specta 生成済み、PR #141）。
- consumer: future UI-11a 画面。
- wire type: generated `commands.getSettings()` / `commands.updateSetting({ key, value })`、`AppSetting = { key, value, updated_at }`。
- internal type: `system_repo::AppSetting`（43 参照）。
- precision/range: value は文字列。UI で整数 1〜99999 に制約（UI-11a-D3）。
- round-trip path: UI -> generated command -> CMD -> system_repo（app_settings upsert）-> UI（invalidate 後再取得）。
- invalid input: UI 検証で送信前に拒否。既存の非数値値は空欄 + 回復文言（69 §69.7）。
- compatibility: 本 PR に wire 変更なし。実装 PR も既存 CMD のみ使用予定。

## Review Focus

- 69 が 43 / tracking-system-tables / bindings の既存事実を正しく引用しているか（drift がないか）。
- UI-11a-D1 の所有 key 限定が UI-11b-D6 と整合するか。
- UI-11a-D6 のラベル変更（閾値設定 → 在庫少の基準）が navigation / タイトル / h1 の 3 点で閉じているか。
- Plans.md の更新が他の active 項目を壊していないか。

## Spec Contract

R2 docs-only: not required。実装 PR（R3）で Test Design Matrix を作成し、UI-11a-D1〜D7 を引用する。

## Trace Matrix

R2 docs-only: not required（Design Intent Trace を参照）。

## Data Safety

R2 docs-only: runtime データ非接触。69 は L3 証跡に実店舗データを残さないことを明記済み。

## Implementation Results

本 packet は docs-only（設計固定のみ）。runtime 実装は後続の実装 packet（R3）で扱う。

## Review Response

- 2026-07-07 Codex CLI design レビュー（working tree 直読み、PR 作成前に実施）: **P1 / P2 / P3 = 0**。事実 drift なし、UI-11b-D6 整合・design-system 整合・DOC_STYLE_GUIDE 違反なしを確認済み（`getSettings` / `updateSetting` bindings、app_settings 初期値 3/500、navigation `ui-11a` pending / label「閾値設定」、D-4 最小値 1 の突合を含む）。確認コマンド: `doc-consistency-check.sh`（--target plan / full とも pass）、`git diff --check` pass。
- 以降の運用（owner 依頼 2026-07-07）: レビューは PR 作成後に PR 上で行う。本 design PR は上記レビュー通過済みのため、PR 上は追加確認のみ。
- Review-only skipped because this is an R2 docs-only Design Phase PR with fixed Fable decisions, no runtime code changes, and a clean pre-PR Codex CLI review (P1/P2/P3 = 0).
