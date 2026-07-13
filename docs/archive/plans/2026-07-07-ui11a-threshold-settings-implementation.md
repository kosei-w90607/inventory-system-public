# UI-11a 閾値設定（在庫少の基準）implementation

> Design Phase は [2026-07-06-ui11a-threshold-settings-design.md](2026-07-06-ui11a-threshold-settings-design.md)（PR #151、Codex CLI 事前レビュー P1/P2/P3 = 0）。本 packet は実装スライス。owner 運用（2026-07-07）: 実装完了後に PR を先に open し、レビューコメントは PR 上で行う。

## Risk

Risk: R3

Reason:
新規 route `/settings/thresholds`（route/search state）、navigation ラベル変更、operator workflow（在庫少基準の変更・保存・反映導線）を実装するため。CMD / BIZ / IO / DB / generated bindings は変更しない（既存 CMD-11 のみ使用）ため wire contract 変更はない。

## Goal

[69-ui-threshold-settings.md](../../function-design/69-ui-threshold-settings.md) の設計（UI-11a-D1〜D7）どおりに UI-11a を実装し、RTL テストと CI green、merge 前 Windows native L3 まで到達する。

## Scope

- `/settings/thresholds` route + `ThresholdSettingsPage`（PageHeader + FormSection + 保存ボタン）。
- `useThresholdSettings` / `useSaveThresholds` hooks、`extract-thresholds` 純関数。
- zod 検証（既存フォームパターン = useState + `safeParse`、整数 1〜99999、文言は 69 §69.7）。
- 保存フロー: dirty key のみ順次 `updateSetting` + 部分失敗表示（69 §69.8）。
- 保存成功時の query invalidation（settings + 在庫少系、69 §69.10）。
- `src/config/navigation.ts` の `ui-11a` active 化 + label / title「在庫少の基準」（UI-11a-D6）。
- RTL テスト T1〜T12（下記 Test Plan）。
- 事実確認: BIZ `list_low_stock` の非数値設定値への防御挙動（結果を Implementation Results に記録、変更はしない）。
- `Plans.md` 同期。

## Non-scope

- CMD / BIZ / IO / DB / generated bindings の変更。
- BIZ 側防御挙動の変更（確認のみ。防御がなければ backlog 起票）。
- design docs の変更（実装中に drift を発見した場合のみ最小修正し、PR で明示）。
- 未保存変更の離脱ガード（7-8c backlog）、商品個別閾値（D-4 将来拡張）。

## Acceptance Criteria

- sidebar「在庫少の基準」→ `/settings/thresholds` で 2 基準値の表示・編集・保存ができる（evidence: RTL + L3-1）。
- 検証 4 系統（空欄 / 非整数 / 0 / 100000）で保存が拒否され、69 §69.7 の文言で FieldError が出る（evidence: T1〜T4）。
- 片方のみ編集して保存した場合 `updateSetting` が該当 key のみ 1 回呼ばれる（evidence: T6 mock call 検証）。
- 部分失敗時に失敗フィールド名を含む Alert + 保存済み分の事実表示（evidence: T8）。
- 保存成功で成功 toast（保存値入り、id `threshold-save-success`）+ settings / 在庫少系 query invalidation（evidence: T7）。
- navigation / ウィンドウタイトル / h1 が「在庫少の基準」で一致（evidence: T12 + L3-1）。
- `npm run lint` / `npm run typecheck` / `npm test` green、`cargo fmt --check` / `clippy` / `test` green（Rust 非接触の回帰確認）、`bash scripts/doc-consistency-check.sh` green、`git diff --check` clean（evidence: PR CI checks）。
- Windows native L3-1 / L3-2（69 §69.12）を owner が merge 前に確認（evidence: PR コメント）。

## Design Sources

- 設計の正典: `docs/function-design/69-ui-threshold-settings.md`（UI-11a-D1〜D7、PR #151）
- 実装の視覚・構造基準: `docs/function-design/68-ui-backup-restore.md` と UI-11b 実装（`src/features/backup-restore/` 配下、PR #144。当初 `features/settings/` と記載していたが Codex レビュー P3 指摘で実配置に訂正）
- Command / DTO: `docs/function-design/43-cmd-settings-log.md` §43.3-43.4、`src/lib/bindings.ts`
- design-system: `docs/design-system/01-decision-rules.md` DSR-01/03/05/06/07/08/09、`02-component-catalog.md` ④⑦

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | `43-cmd-settings-log.md` | existing sufficient |
| Command / DTO / generated binding / wire shape | generated `src/lib/bindings.ts` | existing sufficient（変更なし） |
| DB / transaction / audit / rollback / migration | app_settings 既存定義 | existing sufficient（変更なし） |
| Screen / UI / route state / Japanese wording | `69-ui-threshold-settings.md`（PR #151） | existing sufficient（本 packet の直前で固定済み） |
| CSV / TSV / report / import / export format | none | not applicable |
| Durable decision / ADR | DB_DESIGN D-4 + UI-11a-D1〜D7 | existing sufficient |

## Design Intent Trace

Design packet の Design Intent Trace を引き継ぐ（[2026-07-06-ui11a-threshold-settings-design.md](2026-07-06-ui11a-threshold-settings-design.md)）。実装 target / test target は本 packet の Test Plan T1〜T12 に具体化した。

## Design Intent Audit

- Source docs can answer what is being built and why: yes（69 が正典、PR #151 でレビュー済み）。
- Plan-only durable decisions: なし。
- Assumptions and constraints: bindings / navigation の現状は design packet で実コード突合済み。
- Deferred design gaps: BIZ 防御挙動の事実確認（本 packet Scope 内）。
- Test Design Matrix cites design IDs: yes（下記）。

## Impact Review Lenses

Design packet と同一（POS adapter / replacement path / accounting semantics は not applicable、operator workflow と manual verification が主レンズ）。実装で新たな lens 発見があれば Implementation Results に記録する。

## Design Readiness

- Existing design docs are sufficient because: 69 が検証・保存・文言・invalidation・L3 を実装可能な粒度で固定済み（PR #151 レビュー通過）。
- Source docs updated in this PR: なし（drift 発見時のみ最小修正）。
- Design gaps intentionally deferred: なし。
- Durable decisions discovered: 発生時に Implementation Results へ記録し、必要なら 69 / decision-log へ昇格。

Minimum design checks for business-app work: design packet の記載を引き継ぐ（Layer ownership: UI は generated `commands.*` のみ / wire 変更なし / 文言・回復は 69 §69.7-69.9）。

## Test Design Matrix

RTL、synthetic 値のみ。テスト名に `ui11a` とケース種別を含める:

| # | 対象 | ケース | 期待 | 引用 |
|---|---|---|---|---|
| T1 | 検証 | 空欄で保存 | FieldError「入力してください」、`updateSetting` 未呼出 | §69.7 |
| T2 | 検証 | 小数 / 文字で保存 | FieldError「1以上の整数を入力してください」、未呼出 | §69.7 / D-4 |
| T3 | 検証 | 0 で保存 | FieldError「1以上の整数を入力してください」、未呼出 | §69.7 / D-4 |
| T4 | 検証 | 100000 で保存 | FieldError「99999以下で入力してください」、未呼出 | UI-11a-D3 |
| T5 | 保存 | pristine → 編集 | 保存ボタン disabled → enabled | §69.5 |
| T6 | 保存 | 片方のみ編集して保存 | `updateSetting` が該当 key のみ 1 回 | UI-11a-D2 |
| T7 | 保存 | 2 key 編集して保存成功 | 成功 toast（保存値入り）+ settings / 在庫少系 invalidation 発火 | §69.9-69.10 / UI-11a-D4 |
| T8 | 回復 | 2 key 目の `updateSetting` 失敗 | 失敗フィールド名を含む Alert + 保存済み分の事実表示 | §69.8 / UI-11a-D2 |
| T9 | 回復 | `getSettings` 失敗 | 上部 destructive Alert + 再試行 | §69.8 |
| T10 | 回復 | 既存値が非数値 | 空欄 + 回復文言 FieldError | §69.7 |
| T11 | 純関数 | `extractThresholds` の抽出 / 欠落 key | 2 key 抽出、他 key 無視 | UI-11a-D1 |
| T12 | 文言 | h1 / ラベル / 必須表示 | text / role assertion（色 class のみ不可） | §69.9 / UI-11a-D6 |

## Test Plan

- targeted tests: T1〜T12 + 既存全テスト回帰（`npm test`）。
- negative tests: T1〜T4, T8〜T10。
- compatibility checks: routeTree 再生成後に既存 route が壊れない（typecheck + 既存テスト green）。
- data safety checks: fixture / L3 証跡に実店舗データを含めない。
- main wiring/integration checks: sidebar 遷移、保存 → invalidation（T7）、L3-1 / L3-2。

## Boundary / Wire Contract

Design packet と同一（wire 変更なし）: producer = 既存 CMD-11、consumer = 本 PR の UI、value は文字列、UI で整数 1〜99999 に制約、invalid input は送信前拒否。

## Review Focus

- 69 の設計判断と実装の一致（部分失敗表示・dirty key のみ送信・文言・toast id）。
- navigation / タイトル / h1 の「在庫少の基準」3 点一致。
- invalidation 対象が §69.10 と一致（settings + ホームサマリ在庫少 + 在庫照会在庫少）。
- テストが text / role / value assertion か（色 class snapshot 依存の禁止）。

## Spec Contract

Contract ID: SPEC-UI-11A-THRESHOLD-SETTINGS-2026-07-07

- 在庫少基準は `app_settings` の `stock_low_threshold` / `stock_low_threshold_fabric` のみを UI-11a が読み書きする（Test: T6, T11）。
- 入力は整数 1〜99999 のみ保存可能。範囲外・非整数・空欄は送信前に拒否する（Test: T1〜T4）。
- 保存は変更 key のみ順次送信し、部分失敗は失敗 key 名と保存済み分を事実どおり表示する（Test: T6, T8）。
- 保存成功後、settings query と在庫少系 query を invalidate し、次の取得から新基準が使われる（Test: T7、L3-1）。
- operator 向け表示名は「在庫少の基準」で、navigation / ウィンドウタイトル / h1 が一致する（Test: T12、L3-1）。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| QR系 / D-4（最小値 1） | zod 検証実装 | T1〜T3 | 検証文言と拒否 | RTL green |
| UI-11a-D3（上限 99999） | zod 検証実装 | T4 | sanity bound | RTL green |
| UI-11a-D1（所有 2 key） | `extract-thresholds` + 保存配線 | T6, T11 | 他 key 非接触 | RTL green |
| UI-11a-D2（順次保存・部分失敗） | `useSaveThresholds` | T6, T8 | 失敗表示の事実性 | RTL green |
| UI-11a-D4（即時反映） | invalidation 配線 | T7 | invalidate 対象 | RTL green + L3-1 |
| UI-11a-D6（名称 3 点一致） | navigation + h1 | T12 | 文言 assert | RTL green + L3-1 |
| UI-11a-D7（L3 軽量 2 項目） | manual gate | L3-1 / L3-2 | owner 目視 | PR コメント |

## Data Safety

- 実店舗 DB・実 JAN・実商品名・実価格・実売上をテスト fixture / L3 証跡 / PR に含めない（synthetic 値のみ）。
- 破壊的操作なし（app_settings の 2 key upsert のみ、既存 CMD 経由）。
- L3 は owner の Windows native 環境で実施し、スクリーンショットを repo に commit しない。

## Implementation Results

2026-07-07 Sonnet subagent 実装完了（Codex 側不具合による owner 承認済み fallback）、orchestrator 裁定済み:

- 変更: `src/features/threshold-settings/`（Page + hooks 2 + 純関数 + zod schema + テスト 2 ファイル）、`src/routes/settings/thresholds.tsx`、`src/config/navigation.ts`（ui-11a active 化 + label/title「在庫少の基準」）、`src/lib/query-keys.ts`（invalidation 対象追加）。
- テスト: 新規 16 本（T1〜T12 対応 + edge case。`ThresholdSettingsPage.test.tsx` 11 本 + `extract-thresholds.test.ts` 5 本）、`npm test` 566/566 green（回帰ゼロ）。orchestrator が新規 2 ファイルの独立実行（16/16 green）と navigation diff を裏取り済み。当初「20 本」と記載していたが一次レビュー P3 指摘を受け実測 16 本に訂正（2026-07-07）。
- lint / typecheck / prettier: pass。Rust 非接触。
- 裁定 accept した実装判断: ①実配置 `features/threshold-settings/`（69 の `features/settings/` 前提が事実誤りだったため 69 側を修正）②フォームは既存パターン（useState + zod `safeParse`。RHF は repo 全体で不使用のため導入せず、69 側を修正）③保存は最初の失敗 key で停止し「保存済み」表示を事実に限定 ④成功 toast は両方の現在値を常に表示（§69.9 の単一テンプレートどおり）。
- BIZ 防御挙動の事実確認（read-only）: `src-tauri/src/biz/product_service.rs` `list_low_stock` は非数値の設定値を `parse().ok()` + `unwrap_or(3 / 500)` で **無警告 fallback** する。ログ・operation_logs 記録なし。69 UI-11a-D3 の方針どおり backlog へ起票済み（Plans.md Backlog「在庫少閾値の非数値 fallback 可視化」）。

## Review Response

2026-07-07 Sonnet 一次レビュー（独立 context、観点 A〜F = Spec Contract / 正しさ / テスト品質 / レイヤー規律 / operator UI / 69 drift 修正妥当性）+ Fable 裁定完了:

- P1 = 0、P2 = 0、P3 = 1。
- P3（accept、本 packet で修正済み）: Implementation Results のテスト本数「20 本」が実測 16 本と不一致（`ThresholdSettingsPage.test.tsx` 11 本 + `extract-thresholds.test.ts` 5 本、`npx vitest run src/features/threshold-settings` 16/16 green で裏取り）。コード非接触の記載訂正のみ。
- 確認済み（findings 0）: 所有 2 key 限定 / 整数 1〜99999 送信前拒否 / dirty key のみ順次送信 + 最初の失敗で停止 / invalidation 3 対象が §69.10 と一致（実 queryKey 突合済み）/「在庫少の基準」3 点一致 / 二重送信ガード / T1〜T12 全対応 + text・role・value assertion / generated `commands.*` のみ使用 / `Label htmlFor` 関連付け + `role="alert"` / 69 drift 修正 2 件は repo 実態と整合。
- 裁定: マージブロッカーなし。残 gate は Codex レビュー（任意）+ Windows native L3-1 / L3-2 のみ。

2026-07-07 Codex CLI レビュー（owner 外部端末実行）+ Fable 実証裁定完了:

- P1 = 0、P2 = 1、P3 = 1。両方 accept、同 PR で修正。
- P2（accept・修正済み）: 検証は trim 済み値、保存は raw 値の不一致。`" 5 "` が UI 検証を通って raw 保存され、BIZ `list_low_stock` の `parse::<i64>()`（trim なし）が失敗して既定値 3/500 に無警告 fallback → Spec Contract「整数 1〜99999 のみ保存可能」違反。Fable が schema（transform なし）/ Page `values[field]` raw 送信 / Rust `parse::<i64>` の空白非許容を実コードで裏取りして accept。修正: `handleSubmit` で schema 通過後に trim 済み `submittedValues` を生成し、dirty 判定・entries・保存済み値・toast・入力表示を統一。RTL 追加 1 本（`" 5 "` 入力 → `updateSetting` が `"5"` で呼ばれる + 入力欄正規化）。テスト 17/17 → 全体 567/567 green。
- P3（accept・修正済み）: 本 packet Design Sources の UI-11b 参照 `src/features/settings/` が stale（実体 `features/backup-restore/`）。repo 全体 grep で残存 3 箇所を確認し、経緯記録の 2 箇所（packet 裁定記録・69 更新履歴)は保持、事実として引く 1 箇所のみ訂正。
