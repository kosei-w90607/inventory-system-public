# Test Design Matrix: UI-13 在庫整合性検証画面

> Design Phase 出典: [active plan](../2026-07-15-ui13-integrity-check.md)、`docs/architecture/ui-task-specs.md` UI-13 節、`docs/function-design/75-ui-integrity-check.md`（本 PR で新設予定）
> 本 Matrix は Design Phase 完了時点で作成する。実装は禁止（Rust/React コード変更なし）。実装 PR がこの Matrix に沿ってテストを追加する。

## Risk

Risk: R3

## Contracts Under Test

- UI-13-D1: route `/settings/integrity`、URL search state なし、画面表示時 idle
- UI-13-D2: 直近確認日時の operation_logs 導出（`list_logs` type=`integrity_check` 最新 1 件、0 件時は非表示/未実施文言）
- UI-13-D3: 行ごと「補正する」checkbox、select-all 不在、未選択時確定 disabled、確認ダイアログに選択行の内訳列挙、confirm 時のみ `fixIntegrity` 発火（引数 = 選択 product_code 集合）
- UI-13-D4: running 中の画面内オーバーレイ + 他操作抑止、二重実行防止
- UI-13-D5: fix 成功後は自動再チェックしない。`IntegrityFixResult` summary 表示 + 補正済み badge + 手動「再度チェック」導線
- UI-13-D6: CmdError の日本語表示、retry で選択状態保持、`skipped_count > 0` の非埋没警告
- UI-13-D7: bindings 経由のみ（手書き invoke 禁止）、specta `collect_commands` 登録差分空
- UI-13-D8: 状態の非色依存表示（色 + 文言）、operator 向け日本語文言
- spec: 差異一覧 100 件/ページ client-side paging
- spec: 差異列（商品コード / 名前 / DB の stock_quantity / SUM(movements) / 差異数）表示

## Failure Modes

- リロードや再訪で古いチェック結果が復元されて見える（ephemeral 契約違反、route unmount → remount で state 残留）
- 差異あり結果の表示中に再度チェックを実行すると、旧結果・旧選択状態が新結果に混入する（restart 不整合）
- 直近確認日時が「チェック実行」以外のログ（補正ログ等）から誤導出される
- select-all 相当が存在し全差異を 1 操作で補正できてしまう
- 確認ダイアログを経ずに `fixIntegrity` が発火する、または引数に未選択行が混入する
- running 中に実行ボタン再押下で二重実行される
- fix 成功が暗黙の再チェックを起動し、重い処理が利用者の意図なく走る
- `skipped_count > 0` が成功メッセージに埋没し、利用者が未補正に気付けない
- error 後の retry で選択状態が破棄され、利用者が選び直しを強いられる
- 101 件以上の差異でページングが壊れる（表示欠落・重複）
- 差異の正負（DB が多い / movements が多い）が色のみで区別され文言がない
- bindings 再生成漏れ・手書き invoke 混入で wire 型が実装と乖離する

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-13-D1 | 初期状態が idle でない | component (vitest) | `test_integrity_page_req904_initial_idle_only_run_button` | 初期表示に実行ボタン以外の結果 UI が出る |
| UI-13-D1 | 再訪で state 残留 | component (vitest, mount→結果表示→unmount→remount) | `test_integrity_page_req904_remount_resets_to_idle` | remount 後に前回の結果・選択状態が表示される |
| UI-13-D1 / D3 | restart 不整合 | component (vitest) | `test_integrity_page_req904_rerun_replaces_result_and_clears_selection` | 差異表示中の再実行で旧結果が残る、または旧選択が新結果に引き継がれる |
| UI-13-D2 | 確認日時の誤導出 | component (vitest, list_logs mock) | `test_integrity_page_req904_last_checked_from_integrity_check_log` | type=`integrity_check` 以外のログ日時を表示する / 0 件時に日時を捏造する |
| UI-13-D3 | ダイアログ迂回 / 引数混入 | component (vitest, commands mock) | `test_integrity_page_req904_fix_requires_confirm_and_selected_codes_only` | confirm 前に `fixIntegrity` が呼ばれる、または引数が選択集合と不一致 |
| UI-13-D3 | select-all 存在 / 未選択確定 | component (vitest) | `test_integrity_page_req904_no_select_all_and_disabled_when_none_selected` | 全選択 UI が存在する、または未選択で確定が押せる |
| UI-13-D3 | ダイアログ内訳欠落 | component (vitest) | `test_integrity_page_req904_confirm_dialog_lists_selected_adjustments` | 選択行の product_code / 現在値 → 補正後値がダイアログに列挙されない |
| UI-13-D4 | 二重実行 / 操作抑止漏れ | component (vitest) | `test_integrity_page_req904_running_overlay_blocks_actions` | running 中に実行/確定が再発火する、オーバーレイが出ない |
| UI-13-D5 | 暗黙再チェック | component (vitest) | `test_integrity_page_req904_fix_success_no_auto_recheck_shows_summary` | fix 成功後に `runIntegrityCheck` が自動発火する / summary（fixed_count・内訳）が出ない |
| UI-13-D5 | 補正済み表示欠落 | component (vitest) | `test_integrity_page_req904_fixed_rows_badged_and_recheck_affordance` | 補正済み行の badge / 「再度チェック」導線がない |
| UI-13-D6 | skipped 埋没 | component (vitest) | `test_integrity_page_req904_skipped_count_warning_visible` | `skipped_count > 0` で警告文言が表示されない |
| UI-13-D6 | error 表示 / retry 状態破棄 | component (vitest) | `test_integrity_page_req904_cmderror_japanese_message_retry_keeps_selection` | CmdError で日本語 message が出ない、retry で選択が消える |
| spec paging | ページング破損 | component (vitest, 101 件 mock) | `test_integrity_page_req904_pagination_100_per_page` | 2 ページに分割されない、行が欠落/重複する |
| spec 差異列 | 列欠落 | component (vitest) | `test_integrity_page_req904_mismatch_columns_complete` | 5 列（code/名前/DB値/SUM/差異）のいずれかが表示されない |
| UI-13-D8 | 色のみ状態表現 | component (vitest) | `test_integrity_page_req904_state_labels_not_color_only` | 差異あり/なし・補正済みの文言 label が DOM に存在しない。差異の正負（DB が多い / movements が多い）の区別文言もこのテストで assert する |
| UI-13-D7 | 登録漏れ / 手書き invoke | 検査 (rg + diff、CI/レビュー手順) | Scope 記載の突合手順（テスト関数ではない） | `rg "invoke\(" src/features/integrity-check/` が hit する、specta/handler 差分が非空 |

## L3（Windows native、synthetic データ）

| 項目 | 手順 | 期待 |
|---|---|---|
| L3-1 実行→差異なし | synthetic DB（アプリ内正規操作で構築）でチェック実行 | 緑の成功表示 + 直近確認日時更新 |
| L3-2 overlay 実機挙動 | 実行直後に他操作を試みる | オーバーレイで抑止される |
| L3-3 owner visual confirmation | 画面全体の文言・可読性を owner が確認（idle / running / 差異なしの各状態） | 非 IT operator 視点で理解可能（UI-13-D8） |

L3 Eligibility: 上記 3 項目は Windows native 限定 / 新ツール不要 / fault-injection 級手順不要 — 3 条件充足。

**L3 対象外の明示**: 「差異あり → 選択補正」の実機確認は L3 に含めない。正規のアプリ内操作では stock_quantity と movements の乖離を作れない（`create_product` は初期在庫を movement として記録する設計。BIZ-07 は crash/bug 由来 drift の検出用）ため、差異注入は DB 直接操作 = fault-injection 級手順となり L3 Eligibility 条件③に違反する（UI-11c L3-7/L3-8 waiver と同型）。差異あり flow は component test（commands mock）+ 既存 BIZ 統合テスト（`test_run_integrity_check_req904_mismatch_detected` / `test_fix_integrity_*`、実 SQLite）で担保する。
