# UI-10 棚卸し Design Phase

## Risk

Risk: R2

Reason:
Docs-only の Design Phase PR。将来の UI-10 実装が従う設計判断（開始/再開、カウント主動線、確定フロー、前回比較、channel 採否、specta 化方針、文言、L3）を source docs に固定するが、runtime コード・DB スキーマ・generated bindings・テストは変更しない。後続の実装 PR は route / operator workflow / 新規 CMD 2 本 + specta 化（Rust 接触）を伴うため R3 として別 packet で扱う。

## Goal

UI-10 棚卸し画面の設計を source docs に記録し、実装 PR が chat 文脈なしで固定済み判断に従えるようにする。設計の一次入力は棚卸し運用ヒアリング（issue #135 Stage 5、2026-07-07 消化 + 同日の価値提案訂正コメント）とヒアリングシート C60/B60/Q12/Q13/Q20。

## Scope

- `docs/function-design/73-ui-stocktake.md` の新規作成（UI-10-D1〜D9。UI 番号 50〜69 は使用済みのため次の連番 73 を使用。MNT 70〜72 と衝突しない）。
- `docs/function-design/35-biz-stocktake-service.md` §20.7 の drift 最小修正（明細一覧取得は CMD 直ラップではなく BIZ `get_stocktake_items` 経由が実態。2026-04-13 `882cec6` で BIZ wrapper 追加済み、42-cmd 側には追記済みだが 35 本体が未更新）。
- `docs/FUNCTION_DESIGN.md`、`docs/SCREEN_DESIGN.md`、`Plans.md` の同期。
- 設計の事実前提（BIZ-06 / CMD-10 契約、stocktakes / stocktake_items スキーマ、specta 未対応、部門フィルタ、進行中 1 件制約、新規商品自動追加）の read-only 突合 — Explore agent 収集結果を 73 に反映し、実装 packet で再突合する。

## Non-scope

- Runtime 実装（route、components、hooks、テスト、specta 属性追加、新規 CMD 実装）→ 実装 packet（R3）。
- BIZ-06 の確定ロジック変更（counted_at 以降の在庫変動の自動織り込み等）。現運用（部門キー売り、商品単位のレジ販売反映なし）では織り込むべき per-product データ自体が存在しないため、都度訂正は operator の再入力で扱う（UI-10-D2）。将来 Z004/PLU 運用が始まった場合の再検討トリガとして 73 に注記。
- 棚卸しの中止（途中破棄）機能（BIZ-06 §20.7 非目的の踏襲）。
- UI-11c / UI-13 の設計。

## Acceptance Criteria

- `docs/function-design/73-ui-stocktake.md` が存在し、目的 / Design Decisions（UI-10-D1〜D9）/ Route / 状態 / Command Contract（既存 4 + 新規 2 の設計）/ カウント導線 / 確定フロー / 文言 / エラー・回復 / テスト起点 / L3 / Non-scope を持つ。
- 73 の Command Contract が実コード（stocktake_cmd.rs / stocktake_service.rs / stocktake_repo.rs）の関数名・DTO と一致する（drift なし）。
- 35-biz §20.7 の記述が実装（BIZ 経由の一覧取得）と一致する。
- UI_TECH_STACK §7.2 の 10-4a 判定（IPC channel）が「不採用」で閉じる。
- `docs/FUNCTION_DESIGN.md` の対象モジュール・目次に UI-10 が載り、「UI 層の残り」から UI-10 が消える。
- `docs/SCREEN_DESIGN.md` の画面一覧に UI-10 の設計ポインタが載る。
- `bash scripts/doc-consistency-check.sh` と `git diff --check` が green。

## Design Decisions（73 へ固定する内容の要約）

- **UI-10-D1（開始/再開の同一画面自動判別）**: `/stocktake` 到達時に in_progress があれば継続表示（開始日・進捗）、なければ開始 CTA。明示的な resume コマンドは存在しない（BIZ 実態の踏襲）。中止機能なし。
- **UI-10-D2（カウント主動線と都度訂正）**: 主動線 = 検索/HID スキャンで商品特定 → 数量入力 → 1 件即保存（`update_count`、autocommit が中断再開の実体）。商品特定は新規 CMD `find_stocktake_item({ stocktake_id, code })`（商品コード/JAN 完全一致の 1 発解決）で行う — `get_stocktake_items` に検索パラメータがなく、クライアント側マップ方式は `update_count` ごとの invalidation で数千件再取得が反復するため却下（Fable 裁定）。counted 済み行の再入力（上書き）を同一導線で常時許可する。根拠: 現運用は部門キー売りでレジ販売が商品単位在庫に反映されないため、カウント後に売れた分の訂正はシステムでも operator 作業として残る（issue #135 訂正コメント 2026-07-07）。プレカウント専用機能は作らない（上書き入力で代替）。
- **UI-10-D3（一覧は進捗管理用）**: 部門フィルタ + 未入力のみ toggle（`counted_only=false`）+ 進捗表示（counted/total）。並びは既存 `ORDER BY si.id ASC` のまま（IO 変更なし。棚の物理順はアプリが知り得ず、主動線が検索/スキャンのため一覧順序の業務的意味は薄い — 73 に設計判断として記録）。
- **UI-10-D4（確定フロー）**: 確定 CTA → **常に**確認ダイアログ（未入力 N 件なら force_fill 説明文言、全件入力済みなら「確定後は取り消せません」文言。確定取消 API が BIZ-06 に存在せず、誤タップの損失 = 数週間分の再カウントと非対称に大きいため、確認なし直確定は Fable 裁定で却下）→ 確定結果画面 = `total_cost`（税理士報告値、主役）+ 差異一覧（`adjusted_items`）+ 整合性チェック結果（`integrity_result` None 時のフォールバック文言含む）。
- **UI-10-D5（前回比較）**: 確定結果と開始前画面に前回完了棚卸しの `total_cost` / `completed_at` を併記（ヒアリング⑥「合計が前年と極端に違わないか見る」のシステム化）。新規 CMD `get_last_completed_stocktake()`（IO query + BIZ 薄 wrapper + CMD + specta、戻り値 `Option<LastStocktakeSummary>`）を 73 で設計。
- **UI-10-D6（IPC channel 不採用 = 10-4a 判定確定）**: `complete_stocktake` は単一 TX で channel の進捗粒度が存在しない。spinner + ボタン disabled で足りる。UI-07 判定（UI_TECH_STACK §7.2）と同根拠。§7.2 の再検討トリガ「UI-10 で channel 採用が決まったら CSV 取込みへ展開」は不成立として閉じる。
- **UI-10-D7（specta 化）**: 既存 4 コマンド（start/get_items/update_count/complete）+ 新規 2（find_stocktake_item / get_last_completed_stocktake）の計 6 本の specta 属性追加と bindings 再生成を実装 PR で実施。生 invoke 直呼び禁止を維持。
- **UI-10-D8（エラー専用ハンドリング）**: CmdError kind `stocktake_in_progress` → 進行中の継続表示へ誘導、`stocktake_not_in_progress` → 完了済み/未開始表示への切替。ValidationFailed（負数・未入力件数）は FieldError / ダイアログで回復。
- **UI-10-D9（カウント中の明細増加）**: 商品登録・一括インポートによる進行中棚卸しへの自動追加（BIZ-01 実装済み）は query invalidation / 再取得で自然反映。専用通知は出さない。L3 で 1 項目確認。
- **文言**: operator 名称は「棚卸し」を維持（店の用語と一致、ヒアリングシート C60）。

## Design Sources

- Requirements / spec: `docs/architecture/ui-task-specs.md` UI-10 節、REQ-205、ヒアリングシート C60/B60/Q12/Q13/Q20
- 運用一次入力: issue #135 Stage 5 ヒアリング (private archive) + 同訂正コメント (private archive issue #135)（2026-07-07）
- Function / command / DTO: `docs/function-design/35-biz-stocktake-service.md`、`docs/function-design/42-cmd-sales-stocktake.md` §22.5、実コード（stocktake_cmd.rs / stocktake_service.rs / stocktake_repo.rs）
- DB: `docs/db-design/tracking-system-tables.md` §16-17（stocktakes / stocktake_items）
- Screen / UI: `docs/SCREEN_DESIGN.md`、`docs/design-system/01-decision-rules.md`、`02-component-catalog.md`、直近 UI 設計書（68/69）の構成
- IPC 判定: `docs/UI_TECH_STACK.md` §7.2（10-4a）
- Decision log / ADR: D-025（日報は商品単位展開しない）が UI-10-D2 の根拠。新規 decision-log 起票なし（判断は 73 ローカル ID で完結、cross-cutting な新契約は D-025 の帰結）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | `35-biz-stocktake-service.md`（§20.7 drift 修正）、`42-cmd-sales-stocktake.md` | updated in this PR（drift 修正）/ existing sufficient |
| Command / DTO / generated binding / wire shape | 新規 CMD 設計は `73-ui-stocktake.md` に記載。specta 化は実装 PR | designed in this PR、実装は R3 |
| DB / transaction / audit / rollback / migration | `tracking-system-tables.md` §16-17 | existing sufficient（スキーマ変更なし） |
| Screen / UI / route state / Japanese wording | 新規 `73-ui-stocktake.md`、`SCREEN_DESIGN.md` | updated in this PR |
| CSV / TSV / report / import / export format | none | not applicable |
| Durable decision / ADR | D-025 既存 + 73 ローカル UI-10-D1〜D9 | existing sufficient + 73 に記録 |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-205 開始/中断再開 | 73 §Route/状態 | UI-10-D1 | status ベース自動判別。明示 resume API 追加を却下（BIZ 実態踏襲） | future StocktakePage | future RTL 継続表示 |
| ヒアリング③⑤ + D-025 | 73 §カウント導線 | UI-10-D2 | 上書き再入力で都度訂正。BIZ 確定ロジック変更（counted_at 織り込み）は per-product データ不在のため却下 | future カウント入力 hook | future RTL 上書き保存 |
| ヒアリング②（棚順） | 73 §一覧 | UI-10-D3 | 検索/スキャン主動線のため一覧 sort 追加を却下（IO 変更なし） | future 一覧 + フィルタ | future RTL フィルタ |
| REQ-205 確定 + ヒアリング④ | 73 §確定フロー | UI-10-D4 | force_fill 確認ダイアログ。集計 3 日 → total_cost 自動計算 | future 確定フロー | future RTL 確定 4 状態 |
| ヒアリング⑥（前年比較） | 73 §Command Contract | UI-10-D5 | 新規軽量 CMD。棚卸し履歴一覧画面は過剰として却下 | future get_last_completed_stocktake | future RTL 前回値表示 |
| 10-4a（UI_TECH_STACK §7.2） | 73 §確定フロー | UI-10-D6 | channel 不採用で判定を閉じる（単一 TX に進捗粒度なし） | spinner のみ | future RTL pending 状態 |
| ADR-004 / 生 invoke 禁止 | 73 §Command Contract | UI-10-D7 | specta 化 6 本。手動 invoke 型付けを却下 | 実装 PR の Rust 差分 | bindings 生成 + typecheck |
| BIZ-06 エラー契約 | 73 §エラー・回復 | UI-10-D8 | kind 別専用ハンドリング | future error 分岐 | future RTL 2 kind |
| BIZ-01 自動追加 | 73 §一覧 | UI-10-D9 | invalidation で自然反映、通知なし | future query 設計 | future RTL + L3 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history: yes（73 が durable home、運用根拠は issue #135 の 2 コメント、business 根拠はヒアリングシート ID を 73 が引用）。
- Plan-only durable decisions found and promoted: なし（D-025 既存の帰結 + 73 ローカル ID で完結）。
- Assumptions and constraints: BIZ-06/CMD-10 契約・specta 未対応・部門フィルタ・自動追加は Explore agent が実コード突合済み（本 packet Scope に記載）。実装 packet で再突合する。
- Deferred design gaps: 一覧のソート追加・棚卸し履歴一覧・counted_at 織り込み確定ロジックは将来トリガ付きで 73 に注記（Z004/PLU 運用開始時に再評価）。
- Test Design Matrix can cite design decision IDs: yes（実装 packet が UI-10-D1〜D9 を引用）。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | POS adapter 非関与（棚卸しは app core 完結）。D-025 境界を D2 の根拠として引用のみ。 | 73 |
| Fact check / design decision split | BIZ/CMD/IO 契約・specta 状態は実コード突合済み。UI 判断は 73 に分離。 | 73 |
| Lifecycle / retry | 開始→カウント（中断再開）→確定→結果の全経路と、エラー 2 kind + force_fill 回復を 73 に明記。 | 73 |
| Operator workflow | 一人運用・年 1 回・数週間スパン・都度訂正残存を前提に文言と導線を固定。 | 73 |
| Replacement path | レジ換装非依存。将来 Z004/PLU 運用開始が D2 の再検討トリガ。 | 73 注記 |
| Data safety / evidence | 棚卸し確定は在庫を書き換えるが既存 BIZ-06 契約内。L3 証跡に実店舗データを残さない。 | 73 §L3 |
| Reporting / accounting semantics | total_cost = 税理士報告の仕入原価総額。valuation_cost_price の確定時点コピー仕様を 73 が引用（変更しない）。 | 73 |
| Manual verification | 開始→カウント→確定の一連 + 自動追加反映の L3 軽量項目に限定。 | 73 §L3 |

## Design Readiness

- Existing design docs are sufficient because: backend 側（BIZ-06/CMD-10/DB）は 35/42/tracking-system-tables に既存で、35 §20.7 の drift 修正以外は変更不要。
- Source docs updated in this PR: `73-ui-stocktake.md`（新規）、`35-biz-stocktake-service.md`（§20.7 最小修正）、`FUNCTION_DESIGN.md`、`SCREEN_DESIGN.md`、`Plans.md`。
- Design gaps intentionally deferred: specta 化・新規 CMD 実装・実測性能（complete の所要時間）は実装 PR。
- Durable decisions discovered and promoted: なし（decision-log 新規起票なし）。

Minimum design checks for business-app work:

- Layer ownership: UI は generated `commands.*` のみ（specta 化後）。新規 CMD も薄いラッパー原則に従い、業務ルールを CMD に置かない（wrapper は BIZ、query は IO。42-cmd §22.5 の CMD-10 原則）。
- Backend function design: 既存契約引用 + 新規 `find_stocktake_item` / `get_last_completed_stocktake` を 73 で設計（IO query + BIZ 薄 wrapper + CMD）。
- Command / DTO / data contract: 既存 4 DTO は実コード突合済み。新規 2 は 73 に定義。
- Persistence / transaction / audit impact: 既存 BIZ-06 契約内（update_count autocommit / complete 単一 TX + 差異 movement + integrity check）。変更なし。
- Operator workflow / Japanese UI wording: 73 で固定（「棚卸し」、確定ダイアログ、進捗、前回比較の文言）。
- Error, empty, retry, and recovery behavior: 73 で固定（2 kind + ValidationFailed + integrity None フォールバック）。
- Testability and traceability IDs: REQ-205 / UI-10-D1〜D9 を RTL・L3 に引用可能。

## Test Plan

- targeted tests: 本 PR は docs-only のため `bash scripts/doc-consistency-check.sh` のみ。
- negative tests: docs が UI 実装済み・specta 化済みと主張しない（未実装契約は future 表記で分離）。
- compatibility checks: Markdown リンク先の実在（R3 check）、35 §20.7 修正が 42-cmd の既存追記と矛盾しない。
- data safety checks: 実店舗データ・実 JAN・実価格を含む記述なし（ヒアリング内容は運用手順の記述のみ）。
- main wiring/integration checks: not applicable（runtime 変更なし）。

## Boundary / Wire Contract

- producer: 既存 CMD-10 4 コマンド（specta 未対応 → 実装 PR で属性追加）+ 新規 `find_stocktake_item` / `get_last_completed_stocktake`（設計のみ）。
- consumer: future UI-10 画面。
- wire type: 実装後は generated `commands.*`。`StocktakeItemListResponse { items, progress, total_count, page, per_page }` ほか実コード突合済み DTO。
- precision/range: actual_count は 0 以上の整数（CMD 防御チェック済み）。per_page は IO 側 200 クランプ。
- invalid input: 負数は CMD validation、未入力確定は force_fill フローで回復。
- compatibility: 本 PR に wire 変更なし。実装 PR の specta 化は TS 側新規生成のみで既存 bindings に破壊的変更なし。

## Review Focus

- 73 の Command Contract / DTO / エラー kind が実コードと一致するか（drift がないか）。
- UI-10-D2 の根拠（部門キー運用でレジ販売が商品単位在庫に反映されない）が D-025 / issue #135 の記録と整合するか。
- 35 §20.7 修正が最小で、42-cmd 側の既存記述と矛盾しないか。
- 10-4a 判定の閉じ方が UI_TECH_STACK §7.2 の再検討トリガ記述と整合するか。
- Plans.md の更新が他の active 項目を壊していないか。

## Spec Contract

R2 docs-only: not required。実装 packet（R3）で Test Design Matrix を作成し、UI-10-D1〜D9 を引用する。

## Trace Matrix

R2 docs-only: not required（Design Intent Trace を参照）。

## Data Safety

R2 docs-only: runtime データ非接触。73 は L3 証跡に実店舗データを残さないことを明記する。

## Implementation Results

本 packet は docs-only（設計固定のみ）。runtime 実装は後続の実装 packet（R3）で扱う。

## Review Response

2026-07-07 Codex CLI レビュー（owner 外部端末実行、PR #158）+ Fable 実証裁定完了:

- P1 = 0、P2 = 2、P3 = 1。全件 accept、同 PR で修正。
- P2-1（accept・修正済み）: 新規 CMD 2 本を「BIZ を挟まず CMD → IO 直呼び」と設計していた。project-profile の層原則（CMD = 型変換 + BIZ 呼出し + エラー変換のみ）、42-cmd §22.5 の CMD-10 原則、`get_stocktake_items` の CMD 直ラップ → BIZ wrapper 修正履歴（`882cec6`、本 PR で 35 §20.7 に自ら記録した経緯）と衝突。BIZ 薄 wrapper（`stocktake_service::find_stocktake_item` / `get_last_completed_stocktake`）を設計に追加し、CMD は BIZ 呼出しのみに修正。CMD-11 settings 系の IO 直呼び前例を別 domain に流用した設計ミスで、同 domain 内の修正履歴を優先すべきだった。
- P2-2（accept・修正済み）: 73 §73.10 の DSR-07 行が「未入力がある場合のみ表示」のままで、UI-10-D4 常時確認の裁定と同一文書内矛盾。「常に表示し文言のみ分岐」に統一。
- P3（accept・修正済み）: packet Design Intent Trace の specta 化本数 5 → 6。
- あわせて層記述の残存 drift を repo grep で追加修正（73 D2 Rejected / D5 決定、packet D5 / Layer ownership の「業務ルールは BIZ/IO に置かない」逆向き誤記 / Backend function design）。
