# Test Design Matrix: トレーサビリティ自動生成（workflow 自走化 第1層）

## Risk

Risk: R3

## Contracts Under Test

- WF-TRACE-01: 生成物 drift を `--check` が ERROR にする（vendor-in + drift check、`generate_bindings` 同型）。
- WF-TRACE-02: phantom REQ（インベントリ外の REQ ID 使用）を ERROR にする。
- WF-TRACE-03: テスト 0 本の REQ を `[T3]` WARN として列挙する（exit 0 のまま）。
- WF-TRACE-04: REQ/UI ID 未参照の FE テストファイル数 baseline 17 を両方向で gate する。

## Failure Modes

- 生成物を手編集しても CI / pre-push が通る（drift 不検知）。
- `_req9051` のような境界外 ID が REQ-905 として誤計上される。
- multi-REQ テスト名（`_req101_req102_` 形式）の 2 個目以降が落ちる。
- `CMD-02〜05` / `CMD-07/08` の範囲・連記表記が黙って落ち、設計書リンクが欠ける。
- 生成が非決定的（走査順 / タイムスタンプ）で diff ノイズが出る。
- `--check` が worktree を書き換える。
- FE 未参照ファイルが増えても CI が通る、または減ったのに baseline 定数が据え置かれる。
- `UI-NNx-Dn` 決定 ID だけを持つ FE テストが未参照扱いになる。
- fixture の架空設計書ファイル名が doc-consistency R1 ERROR を出す（R1 に exclude 機構なし）。
- 生成物が `design_compliance_test` の未登録 .md 検出で hard fail する。
- bin が `FUNCTION_DESIGN.md` リテラルを含み doc-consistency R0 ERROR を出す。

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| WF-TRACE-01 | drift 不検知 | Rust unit (bin) | `check_mode_detects_drift` | 生成物改変後も exit 0 |
| WF-TRACE-01 | clean tree で誤 ERROR | Rust unit (bin) | `check_mode_passes_when_clean` | 生成直後の `--check` が exit 1 |
| WF-TRACE-01 | 非決定生成 | Rust unit (bin) | `generation_is_deterministic` | 2 回生成で byte 不一致 |
| WF-TRACE-02 | 境界外 ID 誤計上 | Rust unit (bin) | `req_ids_from_fn_name_rejects_req9051_boundary` | `_req9051` が REQ-905 扱いになる |
| WF-TRACE-02 | multi-REQ 欠落 | Rust unit (bin) | `req_ids_from_fn_name_extracts_multi_req` | 2 個目の REQ が落ちる |
| WF-TRACE-02 | phantom 不検知 | Rust unit (bin) | `check_mode_fails_on_phantom_req` | インベントリ外 REQ で exit 0 |
| WF-TRACE-03 | 0 本 REQ が不可視 | Rust unit (bin) + 実 repo 実行 | `summary_counts_req_with_no_tests_as_warn` | テスト 0 本 REQ が WARN に出ない |
| WF-TRACE-04 | baseline 片方向 gate | Rust unit (bin) | `check_mode_fails_on_baseline_mismatch_both_directions` | 減少方向で exit 0 のまま |
| WF-TRACE-04 | 決定 ID 誤判定 | Rust unit (bin) | `fe_presence_counts_ui_decision_ids_as_referenced` | `UI-01a-D1` のみのファイルが未参照扱い |
| 生成入力 | 範囲・連記表記欠落 | Rust unit (bin) | `index_links_parse_expands_range_and_slash_ids` | CMD-03 / CMD-08 / CMD-11 が落ちる |
| 生成入力 | インベントリ parse 欠落 | Rust unit (bin) | `inventory_parse_reads_req_rows` | REQ 行が読めない / 列がずれる |
| 配線 | CI step 欠落 | review | `ci-yml-step-review` | rust job に `--check` step がない |
| 配線 | pre-push 構文エラー | shell | `bash -n scripts/pre-push.sh` | 構文エラーで hook 全体が落ちる |
| 配線 | 実 repo で red | integration | `cargo run --bin generate_traceability -- --check` | 実 repo（clean tree）で exit 1 |

## Negative Paths

- `_req9051`（4 桁）/ 直後が英字の `_reqNNN` 風文字列は不一致。
- FE 側 `REQ-NNN` の直後が数字の場合は不一致。
- インベントリ外 REQ（fixture 内の合成 ID）で exit 1。
- 生成物 1 byte 改変で exit 1。
- FE 未参照ファイル数 baseline ±1 で exit 1。

## Boundary Checks

- REQ ID は 3 桁固定（`REQ-[0-9]{3}` + 直後数字の reject）。
- FE presence 判定は左境界付き（`GUI-12` は不一致）。
- `UI-WF-2026-05-22` は数字 2 桁が続かないため未参照扱い（baseline 17 に意図的に含める）。
- `UI-01a` の小文字 suffix / `UI-01a-D1` の決定 ID は参照済み扱い。

## Compatibility Checks

- 既存 Rust テスト 557 本 / FE テスト 43 ファイルは無変更で green。
- `design_compliance_test` は SKIP_DOCS に `90-traceability.md` 追加後 green。
- `doc-consistency-check.sh` は M2 / R0 exclude 追加後 ERROR 0。
- 既存 bindings drift check と独立に動作（同じ rust job 内で直後に実行、依存なし）。

## Data Safety Checks

- fixture は `tempfile::tempdir` 内の合成ツリーのみ。実 POS / 店舗データ非使用。
- `--check` は無書込（worktree 汚染なし）。
- DB 接続なし。

## Main Wiring / Integration Checks

- ci.yml rust job: bindings drift check 直後に `--check` step。
- pre-push: CHANGED_FILES trigger（Rust / FE テスト / 設計書 / `docs/spec/requirements.md`）+ ローカル hook refresh。
- `docs/FUNCTION_DESIGN.md` の未作成予約行を実リンク化（doc-consistency R3 で実在確認される）。

## Residual Test Gaps

- CI 上での step 実行は PR open 後に確認する（ローカルでは同一コマンドを直接実行して代替）。
- FE 17 ファイルの backfill は follow-up（baseline を下げる度に T4 が定数更新を強制する自走設計）。
- xlsx 改訂時のインベントリ追従は手動運用（v2 で自動抽出を検討）。
