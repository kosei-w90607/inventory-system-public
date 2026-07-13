# UI-10 棚卸し implementation

> Design Phase は [2026-07-07-ui10-stocktake-design.md](2026-07-07-ui10-stocktake-design.md)（PR #158、Codex レビュー P1/P2/P3 = 0/2/1 全件対応済み、squash merge `11ba93b`）。本 packet は実装スライス。owner 運用: 実装完了後に PR を先に open し、レビューコメントは PR 上で行う。実装は Codex（owner 外部端末）。Plans.md の「#158 merge 済み」反映は本実装 PR の Plans.md 同期に含める。
>
> **事後記録の注記（2026-07-08）**: 本 packet の Scope / Acceptance Criteria / Test Design Matrix（T1〜T15、T-R1〜T-R5）は、Codex による実装コード（`StocktakePage.tsx` 等）と同一コミット（`4114d85`）で新規作成されたことが判明している。つまり実装着手前の独立レビューを経ていない。フォーカス管理契約（UI-10-D11、73 §73.5 に Design Phase 初版から明記済みだった）が実装から丸ごと漏れ、その後の Fable・Codex 計4回の PR レビューでも検出されず、owner の運用質問で発覚した直接の原因はこれ。今後の Plan Packet 作成タイミングの規律は `docs/DEV_WORKFLOW.md` Plan Packet Rules（「Scope と Test Design Matrix を実装コミットと別に先にコミットする」）を参照。T16 以降・Implementation Results・Review Response は実装完了後に実際に起きたことの記録であり、この注記の対象外。

## Risk

Risk: R3

Reason:
新規 route `/stocktake`（route/search state）、operator workflow（棚卸しの開始・カウント・確定導線）に加え、Rust 接触あり: 新規 IO query 1 本（`find_active_stocktake` は既存流用）+ BIZ 薄 wrapper 3 本 + CMD 3 本 + 既存 4 コマンド含む specta 化 7 本 + bindings 再生成。DB スキーマ変更・BIZ-06 確定ロジック変更はなし。

## Goal

[73-ui-stocktake.md](../../function-design/73-ui-stocktake.md) の設計（UI-10-D1〜D9）どおりに UI-10 を実装し、Rust + RTL テストと CI green、merge 前 Windows native L3（73 §73.13 の 5 項目）まで到達する。今年の棚卸しサイクル（10月準備開始）前の完成が目標。

## Scope

- Rust（73 §73.8 の契約どおり）:
  - `stocktake_repo::find_stocktake_item_by_code`（code = 商品コード/JAN 完全一致、`ORDER BY si.id ASC LIMIT 1`）と `stocktake_repo::find_last_completed_stocktake`。`find_active_stocktake` は既存関数をそのまま流用（新規 IO 追加なし）
  - `stocktake_service::get_active_stocktake` / `find_stocktake_item` / `get_last_completed_stocktake`（業務ルールを持たない BIZ 薄 wrapper 3 本）
  - `stocktake_cmd` に CMD 3 本（`get_active_stocktake` / `find_stocktake_item` / `get_last_completed_stocktake`、`state.db.lock()` → BIZ 呼出し → `BizError`→`CmdError` 変換のみ）+ `collect_commands!` 登録
  - 既存 4（start/get_items/update_count/complete）+ 新規 3 の計 7 本へ `#[specta::specta]` 付与、bindings 再生成（UI-10-D7）
- UI: `/stocktake` route（validateSearch: `dept` / `counted_only` / `page`、zod 4）、`src/features/stocktake/` の components + hooks 構成（73 §73.4）、状態遷移 7 状態、カウント導線（§73.5）、確定フロー（§73.7、常時確認 + force_fill 文言分岐）、文言（§73.10）、invalidation（§73.11）。
- `src/config/navigation.ts` の `ui-10` active 化（label / title「棚卸し」）。
- テスト: Rust T-R1〜T-R5（REQ-205 命名）+ RTL T1〜T16（下記 Test Design Matrix）。
- traceability 再生成（REQ-205 のテスト対応反映）。
- `Plans.md` 同期（design PR #158 merge 済み `11ba93b` の反映 + 実装 PR 番号）。
- 73 の drift を実装中に発見した場合のみ最小修正し、PR で明示。
- **差し戻し対応（2026-07-08）**: PR #159 Fable レビュー P1 是正。`useStocktakeStatus` の `localStorage` 依存実装（`src/features/stocktake/types.ts` の `STOCKTAKE_ACTIVE_ID_STORAGE_KEY`、`StocktakePage.tsx` の `extractStocktakeId`）を削除し、新規 CMD `get_active_stocktake()` による DB 問い合わせに置き換える。P2（`test_get_last_completed_stocktake_req205_cmd_option_contract` が実質何もテストしていない）も同時に修正する。

## Non-scope

- 棚卸しの中止（途中破棄）・明示 resume（UI-10-D1）。
- BIZ-06 確定ロジックの変更（counted_at 織り込み等、UI-10-D2）。
- 一覧のソート追加（UI-10-D3）、棚卸し履歴一覧画面（UI-10-D5）。
- IPC channel（UI-10-D6 で不採用確定）。
- DB スキーマ変更、新規 npm 依存の追加（必要が生じた場合は実装を止めて owner 確認）。
- UI-11c / UI-13。

## Acceptance Criteria

- sidebar「棚卸し」→ `/stocktake` で開始 → 検索/スキャンでカウント → counted 済み上書き → 確定 → 結果表示の一連が動く（evidence: RTL + L3-1〜L3-4）。
- `find_stocktake_item` が商品コード/JAN 完全一致で明細を解決し、対象外コードは回復文言で次の入力を受け付ける（evidence: T4/T5 + T-R1）。
- 確定 CTA 押下で常に確認ダイアログが表示され、未入力有無で文言が分岐して表示される（UI-10-D4、evidence: T9/T10 の RTL green）。
- 結果画面に `total_cost`（主役）/ `adjusted_items` / `integrity_result` フォールバック / 前回完了棚卸し比較が表示される（evidence: T11/T12）。
- 進行中棚卸しがある状態での画面再訪は、新規 CMD `get_active_stocktake()` の DB 問い合わせにより継続表示になる。`localStorage` やエラーメッセージパースに依存しない。`stocktake_in_progress` / `stocktake_not_in_progress` は kind 別に回復する（evidence: T1/T13、UI-10-D1）。
- 新規 CMD 3 本が IO query + BIZ 薄 wrapper + CMD 変換のみの層構成であり、いずれも実際に CMD 関数を呼び出す形でテストされている（evidence: T-R3/T-R4/T-R5 + architecture_test / design_compliance_test green）。
- `cargo fmt --check` / `clippy -D warnings` / `cargo test` green、`npm test` / `typecheck` / `lint` green、`bash scripts/doc-consistency-check.sh` green、traceability 再生成済み（evidence: PR CI checks）。
- Windows native L3-1〜L3-5（`73-ui-stocktake.md` §73.13）を owner が merge 前に目視確認し、合否を PR コメントに記録する（evidence: PR コメントの合格記録）。

## Design Sources

- 設計の正典: `docs/function-design/73-ui-stocktake.md`（UI-10-D1〜D9、PR #158）
- Backend 契約: `docs/function-design/35-biz-stocktake-service.md`、`docs/function-design/42-cmd-sales-stocktake.md` §22.5、実コード（stocktake_cmd.rs / stocktake_service.rs / stocktake_repo.rs）
- DB: `docs/db-design/tracking-system-tables.md` §16-17（スキーマ変更なし）
- 実装の視覚・構造基準: `src/features/threshold-settings/`（UI-11a、PR #152）と `src/features/backup-restore/`（UI-11b、PR #144）
- design-system: `docs/design-system/01-decision-rules.md` DSR-01/03/06/07/08、`02-component-catalog.md`（Progress は既存採用 3 例目）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | `73-ui-stocktake.md` §73.8 + `35-biz` / `42-cmd` | existing sufficient（PR #158 で固定済み） |
| Command / DTO / generated binding / wire shape | 73 §73.8（新規 3 本の契約）+ specta 再生成 | designed; 本 PR で生成 |
| DB / transaction / audit / rollback / migration | tracking-system-tables §16-17 | existing sufficient（変更なし） |
| Screen / UI / route state / Japanese wording | `73-ui-stocktake.md` §73.4-73.10 + SCREEN_DESIGN 同期済み | existing sufficient |
| CSV / TSV / report / import / export format | none | not applicable |
| Durable decision / ADR | UI-10-D1〜D9 + D-025 引用 | existing sufficient |

## Design Intent Trace

Design packet の Design Intent Trace を引き継ぐ（[2026-07-07-ui10-stocktake-design.md](2026-07-07-ui10-stocktake-design.md)）。実装 target / test target は本 packet の Test Design Matrix に具体化した。

## Design Intent Audit

- Source docs can answer what is being built and why: yes（73 が正典、PR #158 でレビュー済み）。
- Plan-only durable decisions: なし。
- Assumptions and constraints: 既存 4 コマンドの specta 未対応・DTO・エラー kind・インデックス前提は design phase + Codex レビューで実コード突合済み。
- Deferred design gaps: query key の具体名は実装時に既存命名規約（UI-06a/UI-09a 等）へ従う（73 §73.11）。
- Test Design Matrix cites design IDs: yes（下記）。

## Impact Review Lenses

Design packet と同一（POS adapter / replacement path は not applicable。operator workflow・data safety・manual verification が主レンズ。complete_stocktake は在庫を書き換えるが既存 BIZ-06 契約内で変更しない）。

## Design Readiness

- Existing design docs are sufficient because: 73 が契約・導線・文言・エラー回復・L3 を実装可能な粒度で固定済み（PR #158 レビュー通過、層構成は P2-1 対応で BIZ wrapper 込みに確定）。
- Source docs updated in this PR: なし（drift 発見時のみ最小修正）。
- Design gaps intentionally deferred: なし。
- Durable decisions discovered: 発生時に Implementation Results へ記録し、必要なら 73 / decision-log へ昇格。

Minimum design checks for business-app work: 73 §73.8 の層構成（UI は generated `commands.*` のみ / CMD は BIZ 呼出しと変換のみ / query は IO）を実装でそのまま反映する。

## Test Design Matrix

RTL は synthetic 値のみ、text / role / value assertion（色 class snapshot 禁止）。Rust テスト名に REQ 番号（`test_..._req205_...`）:

| # | 対象 | ケース | 期待 | 引用 |
|---|---|---|---|---|
| T1 | 状態判別 | `get_active_stocktake` が None / Some | 開始 CTA + 前回サマリ / 継続表示（開始日時・進捗）。localStorage 不使用を mock の戻り値のみで実証する | UI-10-D1 |
| T2 | 開始 | 開始 CTA 押下 | `start_stocktake` 1 回 → カウント画面へ | UI-10-D1 |
| T3 | 一覧 | 部門フィルタ / 未入力のみ toggle | `get_stocktake_items` のパラメータが変わる | UI-10-D3 |
| T4 | カウント | コード/JAN 入力で解決 → 数量 → 保存 | `find_stocktake_item` → `update_count` が該当 id で 1 回 | UI-10-D2 |
| T5 | カウント | 対象外コード入力 | 回復文言表示、`update_count` 未呼出 | UI-10-D2 / §73.9 |
| T6 | カウント | counted 済みへ上書き | 確認なしで `update_count` が呼ばれる | UI-10-D2 |
| T7 | 進捗 | counted/total 表示 | `progress` の値と一致 | §73.6 |
| T8 | 検証 | 負数入力 | FieldError「0以上の数値を入力してください」、未送信 | §73.9 |
| T9 | 確定 | 未入力 0 件 | 「確定後は取り消せません」ダイアログ → `force_fill: false` | UI-10-D4 |
| T10 | 確定 | 未入力 N 件 | 件数入りダイアログ → 確認後 `force_fill: true` | UI-10-D4 |
| T11 | 結果 | 確定成功 | `total_cost` / `adjusted_items` / 前回比較の表示 | UI-10-D5 |
| T12 | 結果 | `integrity_result: null` | 「整合性チェックは実行できませんでした」 | §73.9 |
| T13 | 回復 | `stocktake_in_progress` / `stocktake_not_in_progress` | kind 別の表示切替。`stocktake_in_progress` はエラーメッセージをパースせず `get_active_stocktake` の invalidate/再取得で復旧すること（§73.9 の回復表どおり） | UI-10-D8 |
| T14 | 実行中 | `complete_stocktake` pending | spinner + 全操作 disabled | UI-10-D6 |
| T15 | 自動追加 | invalidation 後の一覧再取得 | 明細件数が増える、専用通知なし | UI-10-D9 |
| T16 | 一覧 | 差異・最終カウント列（`system_stock !== current_stock` のケース含む） | 表示される在庫値は `current_stock`（差異の計算根拠と同一）、未入力行は差異・最終カウントとも「—」 | UI-10-D10 |
| T17 | フォーカス | 連続 HID スキャン（mount 時・解決成功後・保存成功後） | 検索欄→数量欄→検索欄のフォーカス遷移、Enter 経路で検証 | UI-10-D11 |
| T18 | 回復 | `complete_stocktake` の `stocktake_not_in_progress` | UI 固定文言 + 状態 query invalidate/再取得で `not_started` 表示へ | UI-10-D8、契約監査 |
| T19 | 結果 | `complete_stocktake` 成功後の `lastCompleted` invalidate/再取得 | 確定直前にスナップショットした前回棚卸しを表示し続け、再取得値（今確定した棚卸し自身）には差し替わらない | UI-10-D5/D10、Codex 契約監査 P2 |
| T20 | 回復 | `complete_stocktake` の `validation`（force_fill 未入力超過） | バックエンドのメッセージ表示 + 一覧 query invalidate/再取得（次回確定操作での実質的な再試行導線） | UI-10-D8、owner 指摘起因 |
| T-R1 | IO | `find_stocktake_item_by_code`: コード一致 / JAN 一致 / 不一致 / 同一 JAN 複数 | 該当明細 / None / `si.id` 最小の決定的 1 件 | §73.8 |
| T-R2 | IO | `find_last_completed_stocktake`: completed 複数 / 0 件 | 最新 1 件 / None | §73.8 |
| T-R3 | BIZ | wrapper 3 本（`get_active_stocktake` / `find_stocktake_item` / `get_last_completed_stocktake`）の透過と `DbError`→`BizError` 変換 | IO 結果がそのまま返る | §73.8 |
| T-R4 | CMD | 新規 3 本それぞれについて実際に CMD 関数を呼び出し、DTO / エラー変換を検証する（`Ok(None)` を自作して assert するだけの空テストは禁止） | `CmdError` kind 変換 + architecture_test / design_compliance_test green | §73.8 |
| T-R5 | BIZ | `get_active_stocktake`: 進行中あり（`start_stocktake` の内部チェックと同じ `find_active_stocktake` を経由） / なし | `Some(Stocktake)` / `None` | §73.8, UI-10-D1 |

## Test Plan

- targeted tests: T1〜T16 + T-R1〜T-R5 + 既存全テスト回帰（`cargo test` / `npm test`）。
- negative tests: T5 / T8 / T10 / T12 / T13 / T-R1 不一致系。
- compatibility checks: bindings 再生成後に既存 route / 既存 commands 利用箇所が壊れない（typecheck + 既存テスト green）。specta 追加は TS 側新規生成のみで既存 wire に破壊的変更なし。
- data safety checks: fixture / L3 証跡に実店舗データを含めない（synthetic のみ）。
- main wiring/integration checks: sidebar 遷移、開始→カウント→確定→結果の一連、invalidation（T15）、L3-1〜L3-5。

## Boundary / Wire Contract

- producer: CMD-10 既存 4 + 新規 3（specta 化後は generated `commands.*` が wire）。
- consumer: 本 PR の UI-10 画面。
- 層構成: UI → CMD（型変換 + BIZ 呼出し + エラー変換のみ）→ BIZ（薄 wrapper、業務ルールなし）→ IO（query）。73 §73.8 で固定済み。
- precision/range: `actual_count` は 0 以上の整数、`per_page` は IO 側 200 クランプ。
- invalid input: 負数は送信前拒否（CMD 側の防御的二重チェックあり）、対象外コードは None 回復。
- compatibility: 既存 4 コマンドの specta 化は TS 型の新規生成のみ。既存 UI への影響なし。

## Review Focus

- 73 の設計判断と実装の一致（常時確認ダイアログ + 文言分岐 / 上書き再入力の無確認 / invalidation 対象 / §73.10 文言 / 1 件保存で toast を出さない）。
- 層規律: CMD 3 本に業務ルール・SQL が漏れていないか、BIZ wrapper が透過か。
- `find_stocktake_item_by_code` の SQL が 73 §73.8 と一致するか（ORDER BY si.id ASC LIMIT 1 の決定性）。
- **`useStocktakeStatus` が `localStorage` を一切使わず `get_active_stocktake` のみで進行中判定を行っているか。`extractStocktakeId` およびエラーメッセージパースに依存するコードパスが残っていないか（PR #159 P1 是正の中心）。**
- **T-R4/T-R5 の新規 CMD テストが `Ok(None)` を自作するだけの空テストになっていないか（PR #159 P2 是正）。**
- テストの assertion が text / role / value ベースか、mock が実配線（`UpdateCountRequest` 等の実 shape）を隠していないか。
- traceability の REQ-205 反映と既存テストの非退行。

## Spec Contract

Contract ID: SPEC-UI-10-STOCKTAKE-2026-07-07

- 開始/再開は `/stocktake` 到達時の、新規 CMD `get_active_stocktake()` による **DB 問い合わせのみ**で行い、`localStorage` やエラーメッセージパースを判定に使わない。明示 resume・中止機能を持たない（Test: T1, T2, T-R5、L3-1）。
- カウントは商品コード/JAN 完全一致の 1 発解決 → 1 件即保存で、counted 済みへの上書きを確認なしで常時許可する（Test: T4〜T6、L3-2/L3-3）。
- 確定は常時確認ダイアログを経由し、未入力有無で文言と `force_fill` を分岐する。結果画面は `total_cost` を主役に差異一覧・整合性フォールバック・前回比較を表示する（Test: T9〜T12、L3-4）。
- 新規 CMD 3 本（`get_active_stocktake` / `find_stocktake_item` / `get_last_completed_stocktake`）は IO query + BIZ 薄 wrapper + CMD 変換のみの層構成とし、CMD に業務ルールを置かない（Test: T-R1〜T-R5）。
- specta 化は計 7 本で、UI は generated `commands.*` のみを使用する（Test: typecheck + 生 invoke 不在の確認）。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-205 / UI-10-D1 | 状態判別（新規 CMD `get_active_stocktake`）+ 開始配線 | T1, T2, T-R5 | 継続表示の再現、localStorage 不使用 | RTL + cargo green + L3-1 |
| UI-10-D2（解決 + 上書き） | Rust 解決 CMD + カウント導線 | T4〜T6, T-R1 | 無確認上書き | RTL + cargo green + L3-2/3 |
| UI-10-D3（進捗管理一覧） | 一覧 + フィルタ | T3, T7 | パラメータ透過 | RTL green |
| UI-10-D4（常時確認確定） | 確定フロー | T9, T10 | 文言分岐 | RTL green + L3-4 |
| UI-10-D5（前回比較） | Rust 前回 CMD + 結果画面 | T11, T-R2 | 表示と None 回復 | RTL + cargo green |
| UI-10-D6（channel 不採用） | spinner 実装 | T14 | disabled 範囲 | RTL green |
| UI-10-D7（specta 6 本） | 属性付与 + 再生成 | typecheck | 生 invoke 不在 | CI green |
| UI-10-D8（kind 別回復） | エラー分岐 | T13 | 回復表との一致 | RTL green |
| UI-10-D9（自動追加） | invalidation 配線 | T15 | 通知なし | RTL green + L3-5 |

## Data Safety

- 実店舗 DB・実 JAN・実商品名・実価格・実売上をテスト fixture / L3 証跡 / PR に含めない（synthetic 値のみ）。
- 破壊的操作は `complete_stocktake`（在庫書き換え + 差異 movement）のみで、既存 BIZ-06 契約の呼び出しに限定。BIZ ロジック変更なし。
- L3 は owner の Windows native 環境の test DB で実施し、スクリーンショットを repo に commit しない。

## Implementation Results

- 2026-07-08 Codex 実装完了、PR #159 (private archive) open。CMD-10 既存 4 本 + 新規 `find_stocktake_item` / `get_last_completed_stocktake` の計 6 本を specta 化し、bindings を再生成した。
- `stocktake_repo` / `stocktake_service` / `stocktake_cmd` は 73 §73.8 の層構成どおり、IO query + BIZ 薄 wrapper + CMD 変換に限定した。`find_stocktake_item_by_code` は `ORDER BY si.id ASC LIMIT 1` の決定性を維持。
- `/stocktake` route と `src/features/stocktake/` を追加し、開始、カウント、部門/未入力フィルタ、常時確認の確定、結果表示、REQ-205 RTL T1〜T15 を実装した（T16 は下記 2026-07-08 Fable 直接実装で追加）。UI は generated `commands.*` のみを使用し、生 `invoke()` は使っていない。
- 設計との差分（Codex が自己申告済み）: 73 §73.8 が新規 CMD を 2 本に限定していたため、初回表示時の進行中判定を `localStorage` の active id と `start_stocktake` の `stocktake_in_progress` 回復で扱っていた。DB に対する active-stocktake 専用 CMD は追加しなかった。
- 差し戻し対応で CMD 層の実コマンド呼び出しを `AppState` 付きでテストするため、`tauri::test` を使えるよう `[dev-dependencies]` に `tauri = { version = "2", features = ["test"] }` を追加した。
- Verification: `cargo fmt --check` / `cargo clippy --all-targets --all-features -- -D warnings` / `cargo test` / `npm test` / `npm run typecheck` / `npm run lint` / `bash scripts/doc-consistency-check.sh` / `cd src-tauri && cargo run --bin generate_traceability` green。

2026-07-08 Fable 直接実装（owner 依頼、UI-10-D10 追記に基づく。Windows native L3 実機観察と実コード確認から視認性・情報設計の改善点を洗い出し、Artifact による Before/After 比較で owner 合意後に実装）:

- `src/features/stocktake/lib/stocktake-formatters.ts`（新規）: `computeListDifference`（`current_stock - actual_count`、`update_count` の `current_difference` と同一計算式）、`formatListDifference`（符号付き文字列、未入力は「—」）、`formatCountedAt`（`formatMovementDateTime` と同じ `T`→スペース変換、null は「—」）。テスト 10 本追加。
- `StocktakePage.tsx`: 一覧に「差異」「最終カウント」列を追加（色分けなし、結果画面 `adjusted_items` テーブルと表現統一）。進捗表示に `Progress` バーを追加。確定確認ダイアログのタイトルを常に「棚卸しを確定します（取り消せません）」に統一し、本文のみ未入力有無で分岐（`RestoreConfirmDialog` の確立パターンに倣う。warning Alert のネストは不採用、理由は 73 UI-10-D10 参照）。結果画面の前回比較を総額カードから独立カードへ分離。
- 副次的に発見・修正: `src/components/ui/progress.tsx` の既存バグ（`value` prop が `ProgressPrimitive.Root` に渡されておらず `aria-valuenow` が設定されない、`data-state="indeterminate"` のまま）を修正。影響範囲は `DepartmentTable.tsx`（月次売上）1 箇所のみで、既存テスト 4 本 green を確認済み。
- テスト: 新規 T16（差異・最終カウント列の表示、未入力行は「—」。Codex レビュー P2 是正で `system_stock: 10` / `current_stock: 12` を意図的に食い違わせ、表示される在庫値が `current_stock`（12）であり `system_stock`（10）ではないことを明示検証）追加、T7 拡張（`Progress` の `aria-valuenow` 検証）、T9/T10/T11 を新文言・新構造に合わせて更新。
- Verification: `npm test` 594 件 green（stocktake 関連 26 件 = formatters 10 + StocktakePage 16）、`npm run typecheck` / `npm run lint` / `npm run format:check` green、`bash scripts/doc-consistency-check.sh` 全通過、traceability 再生成済み（`stocktake-formatters.test.ts` 追加反映）。Rust 側は変更なし。

## Review Response

2026-07-08 Fable 直接レビュー（PR 全体を通読、Sonnet 一次レビューを介さず実施）+ PR コメント投稿済み（comment (private archive PR #159)）:

- P1 = 1、P2 = 1。両方 accept。
- **P1（accept・73 側の設計追記で是正、Codex へ差し戻し）**: 進行中判定の `localStorage` + エラーメッセージパース実装は、73 の Spec Contract「status 自動判別」を満たさず、①バックエンドの人間可読エラー文言をプログラム契約としてパースする脆弱性、②別端末/localStorage 消失時に進行中棚卸し（数週間規模の作業）へ即座に到達できないリスクを持つ。根本原因は Design Phase（73/PR #158）側で「新規 CMD は 2 本に限定」という制約を課した際、進行中棚卸し自体を取得する CMD が存在しないことを見落としていたこと（Fable の設計ミス）。是正として 73 に新規 CMD `get_active_stocktake()` を追記した（UI-10-D1 更新、§73.8 に契約追加、specta 化本数を 6→7 本に更新）。既存 IO 層 `find_active_stocktake` をそのまま BIZ wrapper 経由で公開するだけなので実装コストは小さい。
- **P2（accept、差し戻しに含める）**: `test_get_last_completed_stocktake_req205_cmd_option_contract` が `Ok(None)` を自作して assert するだけの空テスト。T-R4/T-R5 として実際に CMD 関数の変換ロジックを検証する形に直すよう本 packet の Test Design Matrix / Review Focus に明記した。
- 確認済み（findings なし）: レイヤー境界（IO→BIZ wrapper→CMD 変換、PR #158 P2-1 裁定どおり）、`find_stocktake_item_by_code` の SQL 決定性、`products.department_id` NOT NULL による JOIN 漏れなし、確定フロー・カウント上書き・toast 抑制の設計判断一致、specta 化・bindings 生成・traceability 反映、テスト assertion 品質。
- 次: Codex に差し戻し（新規 CMD `get_active_stocktake` 追加 + `localStorage`/`extractStocktakeId` 削除 + T-R4/T-R5 テスト是正）→ 再レビュー → Windows native L3 → merge。

2026-07-08 Fable 再レビュー（差し戻し対応 commit `0478e3e`、PR コメント (private archive PR #159)）:

- P1 = 0、P2 = 0、P3 = 2。P1/P2 是正を確認: `localStorage`/`extractStocktakeId` は完全撤去され `useStocktakeStatus` が `get_active_stocktake()` の `useQuery` に一本化（`rg` で残存参照 0 件を確認）。CMD テストは `tauri::test::mock_builder` + `app.state::<AppState>()` で実際に CMD 関数を呼ぶ形に是正。
- 品質 gate を Fable が自ら全実行して確認: `cargo fmt/clippy` green、`cargo test` 689 件 pass、`npm test` 582 件 pass、`typecheck`/`lint`/`doc-consistency-check.sh`/traceability drift すべて green。
- P3-1（同 PR で修正推奨）: `find_stocktake_item` の CMD テストが差し戻しの機会に是正されず、実際の CMD 関数を呼ばない空疎パターンのまま残存（`stocktake_cmd.rs:290`）。
- P3-2（記録推奨）: `Cargo.toml` `[dev-dependencies]` に `tauri = { features = ["test"] }` が無断追加（`tauri::test` 導入のため。実害なし、Non-scope の新規依存 owner 確認の精神に照らし理由記録を推奨）。
- 裁定: マージブロッカーなし。P3 2 件を同 PR で軽微修正してから merge を推奨。

2026-07-08 Codex レビュー（owner 実行、UI-10-D10 実装分、PR コメント (private archive PR #159)）+ Fable 実証裁定完了:

- P1 = 0、P2 = 1、P3 = 1。両方 accept。
- **P2（accept・修正済み）**: 一覧の在庫列が `item.system_stock` 表示のまま、追加した差異列は `computeListDifference()`（`current_stock - actual_count`）で計算していたため、両者の値ソースが一致していなかった。35-biz §20.4「差異は system_stock ではなく現在の stock_quantity を使って動的に計算する」（棚卸し中に在庫が動く前提）を実コードで裏取りし、accept。一覧・カウント入力欄選択商品情報の在庫列を `current_stock` に統一し、列名「システム在庫」→「現在在庫」に変更。T16 に `system_stock !== current_stock` ケースで表示される在庫値が `current_stock` であり `system_stock` ではないことを検証する assertion を追加。73 UI-10-D10 に是正内容と Why を追記。
- **P3（accept・修正済み）**: `StocktakePage.test.tsx` 冒頭コメントと本 packet の Test Design Matrix が T16 追加後も T1〜T15 表記のまま。テストコメントを T1〜T15 + T16 に修正、Test Design Matrix に T16 行を追加。
- 確認済み（findings なし）: レイヤー境界（generated `commands.*` のみ使用、生 invoke なし）、DSR-08（差異はテキストのみ、色分けなし）、確定ダイアログの title/description 分離が `RestoreConfirmDialog` パターンと一致。
- Verification: `npx vitest run src/features/stocktake` 26 件 green、`npm test` 593 件 green、typecheck/lint/format/doc-consistency 全通過。
- 裁定: マージブロッカーなし。修正完了、Codex 再レビュー → Windows native L3 → merge へ進む。

2026-07-08 Codex 再レビュー（owner 実行、`fa1b1de` 対象、PR コメント (private archive PR #159)）+ Fable 実証裁定完了:

- P1 = 0、P2 = 0（前回 P2 是正を確認済み: `現在在庫` 表示・T16 の `system_stock !== current_stock` 検証・73 UI-10-D10 の是正記録、いずれも実コード突合済み）、P3 = 1、accept。
- **P3（accept・修正済み）**: packet 内 4 箇所（Scope・Test Plan・Implementation Results 2 箇所）が T16 追加後も summary 表記として `T1〜T15` のまま残っていた（実行可能なテストと 73 の契約は正しく、blocker ではない）。Scope・Test Plan は現状の範囲を示す記述のため `T1〜T16` に更新。Implementation Results の Codex 実装ログ（T16 追加以前の記録）は史実として `T1〜T15` のまま保持しつつ、「T16 は後続の Fable 実装で追加」の注記を添えて読み手の誤解を防ぐ。T16 の説明文に `system_stock !== current_stock` 検証の意図を明記。
- Verification: `npm test -- src/features/stocktake` 26 件 green（Codex 実行確認）。
- 裁定: マージブロッカーなし。次は Windows native L3 → merge。

2026-07-08 owner フィードバックによる確定ダイアログ再変更（UI-10-D10 更新、Fable 直接実装）:

- owner が Before/After 比較 Artifact の warning Alert ネスト版のスクリーンショットを提示し、一次是正版（タイトル強調のみ）より視認性が高いとして明示的にこちらを支持。実装時に「`RestoreConfirmDialog` に前例がない」という理由で Rejected にしていた判断を訂正し、73 UI-10-D10 の Decision/Why/Rejected/Revisit trigger を書き換え。
- `StocktakeCompleteDialog`: `AlertDialogTitle` を未入力有無で状態を示す文言に戻す（未入力あり「未入力の商品があります」/ なし「棚卸しの確定」）。`AlertDialogContent` 直下に `Alert`（`border-warning bg-warning-soft text-warning-strong` + `AlertTriangle`、`BackupRestorePage.tsx` の warning Alert と同じクラス構成）を常時ネストし、`AlertTitle`「確定すると取り消せません」+ `AlertDescription`（未入力有無で分岐、本文から「システム在庫」表記を削除し「現在の在庫数」に統一）で不可逆性を伝える。
- アクセシビリティ: Radix `AlertDialogDescription` が空だと `aria-describedby` 未設定の開発警告が出るため、`AlertDialogDescription className="sr-only"` に本文と同じテキストを残し、視覚的な本文は `Alert` 内の `AlertDescription` が担う（テキスト重複を避けるため `bodyText` 変数を共有）。
- テスト: T9/T10 を新タイトル・新構造に更新。`screen.getByRole("alert")` + `within(...).getByText(...)` で warning Alert 内のテキストを検証（sr-only description と同一テキストが 2 箇所に存在するため `within` でスコープを絞る必要があった）。
- Verification: `npx vitest run src/features/stocktake` 26/26 green、`npm test` 593 件 green、typecheck/lint/format/doc-consistency 全通過。Radix の aria-describedby 開発警告は出ていないことを確認済み。
- 次: Codex レビュー → Windows native L3 → merge。

2026-07-08 Codex レビュー（owner 実行、`c0e0351` 対象、依頼文で観点指定）+ Fable 実証裁定完了:

- P1 = 0、P2 = 1（accept・修正済み）、P3 = 0。
- **P2**: `AlertDialogDescription`（`sr-only`）が `bodyText` のみで、warning Alert の最重要 title「確定すると取り消せません」を含んでいなかった。視覚ユーザーには `AlertTriangle` + 太字 `AlertTitle` で不可逆性が伝わるが、`AlertDialogDescription` は Radix の `aria-describedby` に紐付く dialog の accessible description であり、スクリーンリーダーの初期 dialog announcement（title + description）から不可逆性の警告が欠落する。Codex 提案どおり `warningTitle` 変数を切り出し、sr-only description を `${warningTitle}。${bodyText}` の結合テキストに変更。T9/T10 に `screen.getByRole("alertdialog")` の `aria-describedby` を辿って sr-only description の全文を検証する assertion を追加。73 UI-10-D10 の §73.7 手順・73.10 Wording・更新履歴に反映。
- 確認済み（findings なし）: DSR-08、`BackupRestorePage.tsx` との class 構成一致、T9/T10 の Alert 内 assertion、73 UI-10-D10 との整合。
- Verification: `npx vitest run src/features/stocktake` 26/26 green、`npm test` 593 件 green、typecheck/lint/format/doc-consistency 全通過。
- 裁定: マージブロッカーなし。次は Windows native L3 → merge。

2026-07-08 owner 確認質問による実装漏れの発覚・是正（UI-10-D11 追加、Fable 直接実装）:

- owner が「他の画面のようにカーソルを置いたまま連続スキャンできるのか」と確認した際に実装を確認したところ、73 §73.5 が既に定めていた「解決できたら数量入力欄にフォーカスを移す」契約が実装に反映されておらず、初期フォーカス・保存後のフォーカス復帰も未実装だったことが判明（Codex 2 回のレビューでも未検出）。
- `StocktakeCountEntry`（`StocktakePage.tsx`）に `codeInputRef` / `quantityInputRef`（`useRef<HTMLInputElement>`）を追加し、`ReceivingPage.tsx`（UI-02）で確立済みの `window.setTimeout(() => ref.current?.focus(), 0)` パターンを踏襲。
  1. mount 時に検索/スキャン欄へ自動フォーカス（`useEffect`、空 deps）
  2. `find_stocktake_item` 解決成功時に数量入力欄へ自動フォーカス
  3. `update_count` 成功時に検索/スキャン欄へ自動フォーカスを戻す
  4. 数量入力欄に `onKeyDown` の Enter ハンドラを追加（`saveCount` を呼ぶ、キーボード操作の対称性のため）
- テスト: T17 新規（`toHaveFocus` で 3 段階のフォーカス遷移 + Enter 保存を検証、`ReceivingPage.test.tsx` の `toHaveFocus` 利用実績に倣う）。
- 73 UI-10-D11 追加、§73.12 テスト設計に反映。
- Verification: `npx vitest run src/features/stocktake` 27/27 green、`npm test` 594 件 green、typecheck/lint/format/doc-consistency 全通過、traceability 再生成（差分なし）。
- 次: Codex レビュー → Windows native L3（フォーカス遷移の実機確認を追加）→ merge。

2026-07-08 Codex レビュー（owner 実行、`f246375` 対象、依頼文で観点指定）+ Fable 実証裁定完了:

- P1 = 0、P2 = 1（accept・修正済み）、P3 = 1（accept・修正済み）。
- **P2**: T17 が「continuous HID scanning」を謳いながら、検索欄では `user.type` の後に「対象を確認」ボタンを click しており、HID スキャナが実際に送る「コード文字列 + Enter」の経路を通っていなかった。`user.type(..., "4900000000001{Enter}")` に変更し、実際のスキャン経路（検索欄Enter→数量欄フォーカス→数量Enter保存→検索欄フォーカス復帰）を通しで検証する形に修正。
- **P3**: 73 UI-10-D11 が「3 箇所すべて `window.setTimeout` パターンを踏襲する」と読める書き方だったが、実装では mount 時の初期フォーカスだけ `useEffect` で直接 `.focus()` を呼んでいた（`window.setTimeout` 不要、mount 後の `useEffect` は DOM コミット後に実行されるため）。Codex の指摘どおり、実装（技術的に正しい使い分け）はそのままに、73 の記述を「mount 時は直接 `.focus()`、state 更新後の 2 箇所は `window.setTimeout` パターン」と明確化。
- 確認済み（findings なし）: `codeInputRef`/`quantityInputRef` 追加方針、数量欄 Enter ハンドラの一貫性、`update_count` 成功後のクリア+フォーカス復帰、UI-10-D11 全体の整合。
- Verification: `npx vitest run src/features/stocktake` 27/27 green、`npm test` 594 件 green、typecheck/lint/format/doc-consistency 全通過。
- 裁定: マージブロッカーなし。次は Windows native L3 → merge。

2026-07-08 Fable 契約監査（owner 依頼、73 全体を実装コードと1行ずつ突き合わせ。UI-10-D11 のフォーカス管理漏れが Codex 4回のレビューでも検出されなかったことを受けて実施）:

- 73（`docs/function-design/73-ui-stocktake.md`）全 359 行と `StocktakePage.tsx`（当時 768 行）を通しで突き合わせ、以下を発見・是正:
  1. **【重大】継続表示ヘッダが「開始日時」（UI-10-F1・UI-10-D1・73.10 Wording が明記）ではなく内部 `stocktake_id` を表示していた**。バックエンド（`get_active_stocktake`）は `started_at` を返しているのに、`useStocktakeStatus` フックも `StocktakeProgressHeader` もこれを一切参照していなかった。`棚卸し中（ID: {stocktakeId}）` → `棚卸し中（開始日: {formatCountedAt(started_at)}）` に修正。既存テスト10箇所の文言依存を一括修正。
  2. **【中】`stocktake_not_in_progress` が `update_count` / `complete_stocktake` 経路で kind 判定・invalidate 未実装**。`get_stocktake_items`（一覧取得）のみ実装されており、カウント保存・確定では汎用エラー表示のまま画面が完了済み状態に固まる実質的な UX バグだった。加えて表示文言もバックエンドのエラーメッセージ文字列をそのまま出しており、たまたま UI 側の想定文言と一致していたため既存テスト（T13）では検出できていなかった。共通ヘルパー `isStocktakeNotInProgressError` + UI 固定文言 `STOCKTAKE_NOT_IN_PROGRESS_MESSAGE` で3箇所（一覧取得・カウント保存・確定）を統一。T18 新規追加（`complete_stocktake` 経路の検証）。
  3. **【見送り】`complete_stocktake` の force_fill 未入力超過 validation エラー時の再試行導線**: 73.9 は「force_fill で確定する」再試行導線を求めていたが、`CmdError.kind` は `validation` 共通で `actual_count` 負数と区別できず、専用導線を作るには message 文字列で判別する必要がある。これは UI-10-D1 で明示的に却下した「バックエンドの人間可読エラーメッセージをプログラム契約として利用する」アンチパターンに該当するため実装しない。73 の記述をこの判断に合わせて明確化。
  4. **【false positive】EmptyState のフィルタ解除導線**: 他画面（`StockInquiryPage.tsx`、`ReceivingPage.tsx`）の `EmptyState` 実装パターンを確認したところ、いずれも `title` + `description` の説明文のみでアクションボタンは持たない。棚卸し画面の実装（`description="部門フィルタまたは未入力のみ表示を解除してください"`）は既存パターンと一致しており、見落としではなかった。
- 73 UI-10-D1 / UI-10-D8 に契約監査追記、§73.9 エラーテーブル・§73.12 テスト設計を更新。
- Verification: `npx vitest run src/features/stocktake` 28/28 green、`npm test` 595 件 green、typecheck/lint/format/doc-consistency 全通過。
- 次: 独立した視点でのダブルチェックとして Codex にも同様の契約監査（73 全体 vs 実装コードの突き合わせ）を別途依頼する。

2026-07-08 Codex 契約監査（owner 依頼、`d034f78` 対象、独立した73全体 vs 実装コード突き合わせ）+ Fable 実証裁定完了:

- P1 = 0、P2 = 1（accept・修正済み）、P3 = 1（accept・修正済み）。
- **P2（重大、Fable の監査でも見落としていた）**: `complete_stocktake` 成功後、§73.11 の契約どおり `lastCompleted` query を invalidate すると、確定処理が先に `stocktakes.status` を `completed` にしているため、`get_last_completed_stocktake()`（`ORDER BY completed_at DESC, id DESC LIMIT 1`）は「今確定した棚卸し自身」を返す。結果画面はその再取得後の値をそのまま `lastStocktake` に渡していたため、「前回の棚卸し」カードが今回確定した棚卸し自身に置き換わるバグがあった。既存 T11 は `mockGetLast` が常に同一値を返すモックだったため、この差し替わりを検出できていなかった。`handleCompleteConfirm` で `complete_stocktake` 呼び出し直後・invalidate 前の `lastCompletedQuery.data` を local state（`lastStocktakeSnapshot`）にスナップショットし、結果画面にはそのスナップショットを渡す形に修正（invalidate 自体は次の未開始画面表示のために維持）。T19 新規追加（`mockGetLast` を invalidate 前後で異なる値に設定し、結果画面がスナップショット値を表示し続けることを検証）。
- **P3**: §73.12 の確定ダイアログ title 記述が旧「棚卸しを確定します（取り消せません）」表記のままで、UI-10-D10 で確定済みの現行構造（title 分岐 + warning Alert）と矛盾していた。テスト冒頭コメントも T1〜T16 のままで T17/T18 が未反映だった。両方修正。
- 確認済み（findings なし）: DB 由来の進行中判定・開始日時ヘッダ表示、検索/HID スキャン→数量欄フォーカス→Enter保存→検索欄フォーカス復帰、`current_stock` 表示・差異計算・最終カウント表示、kind 別エラー回復（開始・一覧・update・complete 経路）、force_fill 再試行導線の見送り判断。
- Verification: `npx vitest run src/features/stocktake` 29/29 green、`npm test` 596 件 green、typecheck/lint/format/doc-consistency 全通過。
- 裁定: マージブロッカーなし。P2 は結果画面の主要機能（前回比較）が意味をなさなくなる重大なバグであり、Fable 単独の契約監査では見落としていた。Codex への独立監査依頼が正しい判断だったことの実例。次は Windows native L3 → merge。

2026-07-08 owner 指摘による force_fill 対処 + L3 チェックリスト刷新（Fable 直接実装）:

- owner から「force_fill 未入力超過は本当に一人・一台で起きないのか」と再検討を求められ、`useStocktakeItems` の `staleTime: 0` と商品登録画面（`ProductFormPage.tsx`）の invalidate 範囲（自身の商品一覧クエリのみ、棚卸し関連クエリには触れない）を確認した結果、「確定直前に新商品登録を挟み、棚卸し画面へ戻った直後・自動再取得完了前に確定 CTA を押す」という限定的なタイミングでは到達しうることが判明。
- kind 判別不能という制約（`validation` が `actual_count` 負数と共有）は変わらないため、message パースを使う専用再試行ボタンは作らない。代わりに `handleCompleteConfirm` の `validation` エラー catch に `itemsRoot` invalidate を追加。バックエンドのエラーメッセージには元々「force_fill=true で確定するには」という案内が含まれているため、これにより次回の確定操作が実質的な再試行導線として機能する。T20 新規追加。
- L3 チェックリスト（§73.13）を全面刷新。PR 本文には「Windows native L3-1〜L3-5 は owner 実施」の1行しかなく、73.13 自体も今回の一連の変更（開始日時表示、フォーカス遷移、確定ダイアログ title 分岐、前回比較の差し替わり修正）を反映していなかった。memory `feedback-l3-checklist-eye-observable-absolute` の「画面/到達手順/観測可能な合格基準」形式に合わせて全面更新、L3-4/5/6 を新規追加（旧5項目→6項目）。実機再現が難しいエラー経路（stocktake_not_in_progress、force_fill validation）は L3 対象外とし自動テストで担保する旨を明記。
- Verification: `npx vitest run src/features/stocktake` 30/30 green、`npm test` 597 件 green、typecheck/lint/format/doc-consistency 全通過。
- PR 本文を `gh pr edit --body-file` で全面的に書き直し、L3 チェックリスト（6項目）・現行 Test Matrix（T1〜T20 + T-R1〜T-R5）・Design Note（localStorage 記述の削除）を展開した。

2026-07-08 owner の L3 実機観察（開始前画面スクリーンショット）で発見・是正（Fable 直接実装）:

- owner が「棚卸しの開始」画面を見て「前回の棚卸し（2026-07-08T06:37:14）」の `T` 区切りが見づらいと指摘。確認したところ、今回の一連の作業で確立した `formatCountedAt`（`T`→スペース変換）が、開始前画面の「前回サマリ」（`formatLastStocktake`）と結果画面の「前回比較カード」の2箇所には適用されていなかった（継続表示ヘッダには UI-10-D1 是正で適用済みだったが、既存の前回比較表示 2 箇所は見落とし）。
- `formatLastStocktake` 内と結果画面の `lastStocktake.completed_at` 表示に `formatCountedAt` を適用。既存テスト4箇所の文言依存を更新。
- 73.10 Wording の該当行（前回サマリ・前回比較カードラベル・継続表示ヘッダ）を `formatCountedAt` 適用済みである旨に統一。
- Verification: `npx vitest run src/features/stocktake` 30/30 green、`npm test` 597 件 green、typecheck/lint/format/doc-consistency 全通過。
- 次: Codex レビュー → Windows native L3 → merge。

2026-07-08 owner Windows native L3 実施中の発見・是正（Fable 直接実装）:

- owner が Windows native L3-1〜L3-5 を実施し全て pass。並行して「カウント中に商品登録画面で新商品を登録し、棚卸し画面に戻ってその商品を棚卸ししようとする」という実運用フローを試したところ、一覧には UI-10-D9 の自動追加で新商品が正しく表示されているのに、検索欄にその商品名を入力すると「この商品は棚卸しの対象にありません」というエラーになる不具合を発見。
- 原因: §73.5 が Design Phase 初版から明記していた「商品名で探したい場合は既存の商品検索（`commands.searchProducts`）で候補から選ぶ」フォールバック導線が、実装（`resolveItem`）に丸ごと実装されていなかった。`find_stocktake_item` は商品コード/JAN の完全一致でしか解決しないため、商品名入力は必ず `None` になっていた。今回の一連の契約監査（Fable・Codex 双方）でも発見できていなかった見落とし。
- `resolveItem` を拡張し、`find_stocktake_item` が `None` を返した場合に `commands.searchProducts`（`ReceivingPage.tsx` の商品名検索と同じクエリ）へフォールバックするよう修正。0件は既存の「対象にありません」文言、1件は自動的にその `product_code` で再解決して選択、複数件は候補テーブル（商品コード/商品名/部門 + 選択ボタン、`ReceivingPage.tsx` の候補表示パターンを踏襲）を表示する。検索欄に placeholder「商品コード・JAN・商品名を入力」を追加。
- テスト: T21（1件一致で自動選択）、T22（複数件一致で候補テーブル表示→選択）を新規追加。`vi.mock` に `searchProducts` が含まれていなかったため追加。
- 73 UI-10-D2 に契約監査追記、§73.5 処理ステップ・§73.10 Wording・§73.13 L3-7 を更新。
- Verification: `npx vitest run src/features/stocktake` 32/32 green、`npm test` 599 件 green、typecheck/lint/format/doc-consistency 全通過。
- PR 本文の L3 チェックリストに L3-7 を追加済み。
- **Windows native L3 全項目完了**（owner 実施、2026-07-08）: L3-1〜L3-7 全て pass。L3-6（商品登録による自動追加）は前段の owner スクリーンショットで pass 確認済み。L3-7（商品名検索フォールバック）は本修正後に owner が再確認し pass（「前回やったことそのままなぞってやってみたらちゃんと商品名受け付けた」）。
- 次: Codex レビュー → merge 判断。

2026-07-08 Codex レビュー（owner 実行、`b004b81` 対象、商品名検索フォールバック分）+ Fable 実証裁定完了:

- P1 = 0、P2 = 1（accept・修正済み）、P3 = 0。
- **P2**: 商品名検索欄の Enter 処理に `event.nativeEvent.isComposing` guard がなく、日本語 IME の変換確定 Enter でも検索が発火していた。`ReceivingPage.tsx` の商品検索欄には既にこの guard があり、今回追加した商品名検索フォールバックが「Receiving と同じパターン」を謳う以上、この点でも一致させる必要があった。検索欄・数量入力欄の両方の `onKeyDown` に guard を追加（数量欄は `inputMode="numeric"` だが全角数字入力等の IME 経由ケースへの防御として追加）。T23 新規追加（`fireEvent.keyDown` に `isComposing: true` を渡し、`find_stocktake_item`/`update_count` が呼ばれないことを検証）。
- 確認済み（findings なし）: `resolveItem` の拡張方針、`selectCandidate` の再解決ロジック、T21/T22 のユーザー操作フロー検証、`vi.mock` の `searchProducts` デフォルトモックが他テストに影響していないこと、73 UI-10-D2 との整合。
- Verification: `npx vitest run src/features/stocktake` 33/33 green、`npm test` 600 件 green、typecheck/lint/format/doc-consistency 全通過。
- 裁定: マージブロッカーなし。これで PR #159 の Codex レビューサイクルは完了。

2026-07-08 owner との振り返りを受けて Workflow Effectiveness Review を作成（Fable）:

- owner が「プランの存在を忘れかけていた」「これは過去に一度是正したのに再発したインシデント」と振り返り、「後からこの PR のやらかしを追えるようにしたい、それは memory より docs に書く方が後で分析しやすい」と要望。
- [2026-07-08-ui10-stocktake-workflow-effectiveness-review.md](2026-07-08-ui10-stocktake-workflow-effectiveness-review.md) を作成（`docs/templates/workflow-effectiveness-review.md` 準拠）。PR merge を待たず先に作成したため、既存の WER 実例と同じく `docs/archive/plans/` に直接配置（`docs/plans/` は Plan Packet 専用で `Risk: Rn` 行必須のため、WER をそこに置くと doc-consistency-check の PK1 で fail する）。
- 内容: 根本原因（Plan Packet が実装コミットと同一コミットで事後作成されたこと）、そこから派生した 15 件の見落としの時系列と発見経路、契約書き忘れ/機械的レビューの原理的限界/横展開漏れの3パターン分類、Applied/Deferred Workflow Changes。
- 次: PR merge 時、実装 packet 本体を `docs/plans/` から `docs/archive/plans/` へ移動する際、WER 内の相対リンクを同ディレクトリ参照に戻す（現在は `docs/plans/` に残る packet を `../../plans/` で参照する暫定リンク）。
