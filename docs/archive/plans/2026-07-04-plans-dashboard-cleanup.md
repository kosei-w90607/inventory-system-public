# Archived Plans Dashboard Snapshot (2026-07-04)

This file preserves the pre-cleanup `docs/Plans.md` content verbatim as of main `22afc6e` (2026-07-04, before the D-028 R3 implementation acceptance). Links inside the snapshot keep their original `docs/Plans.md` relative paths and are intentionally fenced so markdown link checks do not reinterpret them from `docs/archive/plans/`.

Predecessor snapshot: [2026-06-06-plans-dashboard-cleanup.md](2026-06-06-plans-dashboard-cleanup.md)

```md
# Plans.md

> 現在のフェーズ、進行中の作業、ブロッカー、次の行動を追うためのライブダッシュボード。完了済みの詳細履歴は archive に移す。

## 現在のフェーズ

- 製品フェーズ: Phase 2 の日常利用 UI 5 画面は code-complete / route active。H-6 Windows native 5 画面通し利用者確認、8-9 E2E / visual regression 採否判断、`typedInvoke` fallback 撤去、`v0.8.0-ui-daily` tag 作成まで完了。
- 現在の基準: GitHub `main` / ローカル `main` は PR #123 squash merge `e558abf`（D-028 JANなし商品のPLU対象扱い設計）まで取り込み済み。`v0.8.0-ui-daily` tag は `f44f99a`。
- 2026-06-30 UI-08前フィールド確認により、現店舗の日報主入力は `Z001` / `Z002` / `Z005`、`Z004` は PLU(商品) / 商品別トラックとして扱う方針に更新した。詳細は [plu-export-and-real-csv-verification.md](plu-export-and-real-csv-verification.md) と archived plan [archive/plans/2026-06-30-ui08-field-check-impact-plan.md](archive/plans/2026-06-30-ui08-field-check-impact-plan.md)。
- 進行中: UI-08 PLU implementation は PR #122 (private archive)、JANなし商品のPLU対象扱い設計（D-028）は PR #123 (private archive) でmerge済み。次の主作業は D-028 の R3 実装（plu_target / migration v3 / 三分バケット、実装は Codex 委譲）と REQ-401 SALES implementation（`Z001` / `Z002` / `Z005` 日報取込みの DB/IO/BIZ/CMD/UI 実装）。Post-UI-08 follow-up の残りは最新アプリ生成 `.txt` の実機再確認。
- Phase 2 実装証跡:
  - UI-00 ホーム: PR #56 (`e6da3d8`)
  - UI-07 CSV 取込み: PR #62 (`b8db619`)
  - UI-09a 日次売上: PR #65 (`8c2be51`)
  - UI-06a 在庫照会: PR #67 (`cf89082`) + 高視認性 follow-up PR #74 (`ae0c68f`)
  - UI-09b 月次売上: PR #66 (`caf7d57`) + seed / card overflow follow-up PR #70 (`aeeee2a`)
  - Phase 2 closeout: PR #75 (`f44f99a`) + tag `v0.8.0-ui-daily`
  - 商品コード readability / 表示スケール follow-up: PR #77 (`62b851b`)
  - selection-tone 横断統一 follow-up: PR #80 (`67fa62a`、selection-tone + SegmentedControl)
- 利用者確認: H-6 Windows native 5 画面通し確認は通過済み。PR #74 scope の状態列視認性 OK に加え、5 画面全体で商品コード以外の視認性問題はなし。商品コードが小さい点は Phase 2 blocker ではなく、PR #77 の商品コード readability / 表示スケール option follow-up で対応済み。
- workflow 基準線: AI Quality Workflow retrofit は PR #72 (private archive) で merge 済み。
- 旧 verbose dashboard の archive: [archive/plans/2026-06-06-plans-dashboard-cleanup.md](archive/plans/2026-06-06-plans-dashboard-cleanup.md)。

## 残作業分類

| 区分 | 判断 | 項目 |
|---|---|---|
| merge gate | なし | Phase 2 daily 5 画面の実装 PR と closeout PR #75 は merge 済み。`main` は `v0.8.0-ui-daily` tag 後の状態。 |
| Phase 2 completion / tag gate | 完了 | `typedInvoke` fallback は撤去済み。8-9 の結果、E2E / visual regression は Phase 2 tag gate にしない。`v0.8.0-ui-daily` は `f44f99a` に作成済み。 |
| follow-up | 完了 | UI-03 merge 後の warning cleanup（Vite build chunk warning、traceability REQ-403 WARN）は PR #108 (`a3e775a`) で完了。商品コード readability / 表示スケール option は PR #77 (`62b851b`)、selection-tone 横断統一は PR #80 (`67fa62a`) で merge 済み。Plan Packet 昇格漏れ棚卸しは 2026-06-08 に実施（gap 軽微 = C-1/C-2 dangling reference のみ、本 dashboard へ反映済み）。E2E / visual regression は [UI_TECH_STACK §7.2](UI_TECH_STACK.md) の評価タイミングで再評価。UI-06a `per_page` 上限契約 WARN は PR #85 で解消。 |
| backlog | 後回し | Vite audit / markdownlint update、command drift detection、Node 22 build target、TanStack Router generation settings、UI-09a/b 将来設計、`SortableHeader` 共通化、bindings whitespace、Storybook / Error Boundary / unsaved changes、Phase 3/4 画面群、PLUスロット永続割当の恒久設計（CV17 import が メモリNo. merge のため現行再採番と衝突。[2026-07-03 packet](archive/plans/2026-07-03-post-ui08-janless-plu-target-design.md) D-6 参照）。 |

## 進行中・直近完了した作業

- [ ] D-028 JANなし商品のPLU対象扱い実装（R3、実装は Codex 委譲）:
  - scope: migration v3（plu_target + backfill）、IO クエリ条件、BIZ-01 / BIZ-04（三分バケット・dedup・excluded）、CMD + bindings、seed 三分バケット demo 商品、UI-08 excluded 表示 + full-only 文言、UI-01b フォーム plu_target。詳細は packet と Test Matrix。
  - status: Plan Packet + Test Matrix 起草済み（`8e14bd9`）。rally 4 round（R1: P1 4 / P2 3 / P3 2 = UI-01b 実装済みの事実誤認検出ほか。R2-R4 の型波及クラスは orchestrator 網羅 grep + 【クラス一括】行で打ち切り収束、判断は packet §Rally Record）。次アクション: Codex への実装指示手渡し（経路A）→ 実装 → Sonnet review-only → Draft PR。
  - active plan: [plans/2026-07-03-d028-janless-plu-implementation.md](plans/2026-07-03-d028-janless-plu-implementation.md)
  - test matrix: [plans/test-matrices/2026-07-03-d028-janless-plu-implementation.md](plans/test-matrices/2026-07-03-d028-janless-plu-implementation.md)
- [x] Post-UI-08 JANなし商品のPLU対象扱い設計（Design Phase、docs-only）:
  - scope: JANなし・グループコード・スポット商品を含む実データで PLU書出しが破綻しないよう、三分バケット（対象/対象外/要修正）、`plu_target` 明示フラグ（migration v3）、plu_dirty 意味の限定、同一JAN dedup を設計確定し source docs へ昇格する。2026-07-03 検証の adapter facts（Z004 二態、CV17 import の メモリNo. merge 仕様、PLU総枠5,000=通常216+スキャニング4,784 の工場出荷時配分を SR-S4000 取説で仕様確認）を固定する。
  - status: PR #123 (private archive) squash merge 済み（`e558abf`、2026-07-03 JST）。Plan Packet rally 3 round 収束、Sonnet review-only P2 3 件対応、Codex CLI R1「P2 修正後 merge 可」（P2 3 件 + P3 1 件を実証裏取りのうえ対応: Full-only 回復文言の全箇所統一 / `PluExportPrepareResponse.excluded` wire shape 一致 / migration v3 の 13 桁判定を sqlite3 実証済み `NOT GLOB '*[^0-9]*'` へ修正）→ R2「merge 可」（P1 0 / P2 0）で収束。decision-log D-028 起票。CV17 import merge 仕様による Diff 投入上書きギャップは暫定ガード（CV17 投入は Full のみ = UI-08-D9）として設計固定。GitHub CI docs-only routing で 3 jobs green。次アクション: R3 実装 packet の起票（実装は Codex 委譲、新ワークフロー初適用）。
  - archived plan: [archive/plans/2026-07-03-post-ui08-janless-plu-target-design.md](archive/plans/2026-07-03-post-ui08-janless-plu-target-design.md)
- [x] UI-08 PLU implementation:
  - scope: `prepare_plu_export` / `confirm_plu_export_saved` 二段階BIZ/CMD契約、generated binding、`/products/plu-export` route、native save dialog、ホーム/ナビ導線、保存後確認、query invalidation、fresh review-only sub-agent、Draft PR を実装する。PLUファイル保存では未反映を解除せず、保存後に利用者が確認した exact product_code set のみを app-side exported として確定する。
  - status: PR #122 squash merge 済み（`a0e11d6`、2026-07-03 JST）。実装 / automated gates / review-only / Windows native L3 / owner external gate deferral decision 完了。CV17 1.1.1 profile（`.txt` / 11列 / 13桁JAN必須 / 通常PLU216枠使用時217始まり / 4,784件上限）へ更新し、保存済み未確認復帰、JAN列表示、13桁EAN demo seedも同PRで対応した。承認済み field file とアプリformatterの構造一致を根拠に external gate は受容済み。最新アプリ生成 `.txt` の実機再確認と JANなし商品のPLU対象扱いは Post-UI-08 follow-up。
  - archived plan: [archive/plans/2026-07-01-ui08-plu-implementation.md](archive/plans/2026-07-01-ui08-plu-implementation.md)
  - archived test matrix: [archive/plans/test-matrices/2026-07-01-ui08-plu-implementation.md](archive/plans/test-matrices/2026-07-01-ui08-plu-implementation.md)
  - WER: [archive/plans/2026-07-01-ui08-plu-implementation-workflow-effectiveness-review.md](archive/plans/2026-07-01-ui08-plu-implementation-workflow-effectiveness-review.md)
- [x] UI-08 PLU design readiness:
  - scope: CV17 1.1.1 の PLUファイル受理条件、PCツール投入失敗時の再書出し、`plu_dirty` / `plu_exported_at` 更新タイミング、UI-08 の operator-facing flow を source docs に落とす。実PLUファイル、register backup、店舗データは repo に入れない。
  - status: PR #121 squash merge 済み（`49ca55b`、2026-07-01 JST）。Design Phase / Plan Packet / Test Matrix 完了。D-027 として「PLUファイル生成」と「アプリ側の書出し済み確認」を分離し、`prepare_plu_export` はDBを更新せず、保存後に利用者が確認した exact product_code set だけを `confirm_plu_export_saved` で未反映解除する方針に更新した。fresh review-only sub-agent `Gibbs` は P1/P2 なし、P3 1件（旧 `exportPlu(mode)` 参照）を同作業で修正済み。GitHub CI green（Design doc consistency / Rust generated drift / aggregate Rust check）。
  - archived plan: [archive/plans/2026-07-01-ui08-plu-design-readiness.md](archive/plans/2026-07-01-ui08-plu-design-readiness.md)
  - archived test matrix: [archive/plans/test-matrices/2026-07-01-ui08-plu-design-readiness.md](archive/plans/test-matrices/2026-07-01-ui08-plu-design-readiness.md)
- [x] CI gate optimization:
  - scope: PR #119 の GitHub hosted runner 容量不足を踏まえ、docs-only 変更で重い Rust/frontend jobs を省き、Rust gate を fmt/clippy・test・generated drift に分割し、runner 容量監視を入れる。旧 `Rust (fmt + clippy + test)` check 名は aggregate として残す。
  - status: PR #120 squash merge 済み（`773d93c`、2026-07-01 JST）。`Detect changed areas`、Rust fmt/clippy・tests・generated drift 分割、`Env safety` 独立化、aggregate `Rust (fmt + clippy + test)`、disk telemetry、薄いCI仕様 `docs/ci.md` を追加した。GitHub CI run #527 green。docs-only skip behavior は workflow/script 差分を含まない次のdocs-only PRまたはpost-merge runで確認する。
  - archived plan: [archive/plans/2026-07-01-ci-gate-optimization.md](archive/plans/2026-07-01-ci-gate-optimization.md)
  - archived test matrix: [archive/plans/test-matrices/2026-07-01-ci-gate-optimization.md](archive/plans/test-matrices/2026-07-01-ci-gate-optimization.md)
- [x] REQ-401 SALES daily report design:
  - scope: current operation の `Z001`/`Z002`/`Z005` 日報取込みを、既存Z004商品別CSV取込みから分離してDB/IO/BIZ/CMD/UI/report/rollback設計に落とす。日報集計を `sale_records` / `inventory_movements` へ擬似展開しない。実CSV本文、JAN、商品名、売上金額、Excel cell values、register backup は repo に入れない。
  - status: PR #119 squash merge 済み（`92e4592`、2026-07-01 JST）。Source docs updated with D-025, IO-07, BIZ-08, CMD-12, daily_report_* tables, UI-07 daily report main path, daily/monthly report semantic split. Fresh review-only sub-agent `Helmholtz` P2 findings were accepted/fixed. GitHub hosted runner の容量不足でRust drift checkが落ちたため、CIに `cargo clean` step を追加して3 jobs green。
  - archived plan: [archive/plans/2026-06-30-sales-daily-report-design.md](archive/plans/2026-06-30-sales-daily-report-design.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-30-sales-daily-report-design.md](archive/plans/test-matrices/2026-06-30-sales-daily-report-design.md)
- [x] UI-08前 PLU/実機確認調査の波及整理:
  - scope: `/home/kosei/Downloads/inventory-field-check` の承認済み summary を根拠に、現店舗の日報主入力が `Z001`/`Z002`/`Z005` であること、`Z004` は PLU(商品) / 商品別トラックとして分離すべきこと、CV17 1.1.1 と既存 Ver.2.0.1 PLUファイル設計の差異候補を source docs に反映する。実CSV本文、JAN、商品名、売上金額、Excel cell values、register backup は repo に入れない。
  - status: PR #118 squash merge 済み（`7fd888c`、2026-06-30 JST）。D-022/D-023 を source docs に昇格し、SALES track と PLU track を分離した。fresh review-only sub-agent `Parfit` / `Singer` / `Plato` の P2/P3 は同 PR で対応済み。GitHub CI 3 jobs green。
  - archived plan: [archive/plans/2026-06-30-ui08-field-check-impact-plan.md](archive/plans/2026-06-30-ui08-field-check-impact-plan.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-30-ui08-field-check-impact-plan.md](archive/plans/test-matrices/2026-06-30-ui08-field-check-impact-plan.md)
- [x] Impact Review Lenses workflow hardening:
  - scope: field-check / 実機確認 / 外部連携 / operator workflow discovery のたびに、adapter/core境界、事実確認と設計判断、lifecycle/retry、operator workflow、replacement path、data safety/evidence、reporting/accounting semantics、manual verification を Design Phase と Plan Packet で拾う通り道を作る。
  - status: PR #118 squash merge 済み（`7fd888c`、2026-06-30 JST）。`DEV_WORKFLOW.md` を canonical source、`inventory-workflow-start` を起動条件、Plan Packet template / review-only packet を証跡欄にした。Workflow Effectiveness Review は次の該当タスクで dogfood 後に実施する。
  - archived plan: [archive/plans/2026-06-30-impact-review-lenses-workflow.md](archive/plans/2026-06-30-impact-review-lenses-workflow.md)
- [x] UI-03 返品・交換 備考 visibility follow-up:
  - scope: 返品・交換では備考の必要性が高いが、Windows native L3 で備考が項目立てされておらず、文字が薄く内容を判別しづらいことを確認。次回 UI-03 改善で備考を独立項目として読める構成、本文色/コントラスト、保存結果・recent/detail での見え方を見直す。R3 operator-facing UI change として Design Phase / Plan Packet / Test Matrix / review-only を使う。
  - status: PR #117 squash merge 済み（`06bcc37`、2026-06-30 JST）。備考入力を複数行化し、保存結果 / recent list / 返品・交換詳細に独立表示と `備考なし` fallback を追加した。fresh review-only sub-agent `Tesla` は P1/P2 なし、P3 1 件（保存結果の空備考 fallback test 薄い）を指摘し、同 PR で対応済み。GitHub CI 3 jobs green。Owner OK により merge 済み。
  - source doc: [function-design/63-ui-return-exchange.md](function-design/63-ui-return-exchange.md)
  - archived plan: [archive/plans/2026-06-30-ui03-note-visibility.md](archive/plans/2026-06-30-ui03-note-visibility.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-30-ui03-note-visibility.md](archive/plans/test-matrices/2026-06-30-ui03-note-visibility.md)
- [x] 手動販売出庫 recent list follow-up:
  - scope: UI-04 手動販売出庫に「直近の手動販売出庫」セクションを追加し、既存 `listInventoryRecords(record_type="manual_sale")` で保存直後確認、`すべての履歴を見る`、`詳細を見る` を提供する。検索・取消・訂正は作成画面に持ち込まない。
  - status: PR #116 squash merge 済み（`145330b`、2026-06-28 JST）。Windows native L3 は owner が 1-8 とページトップスクロール再確認を完了し、全項目 OK。L3 feedback として UI-02/03/04/05 の保存成功/PLU確認待ち/command 失敗時にページ先頭へスクロールする対応を同 PR で追加済み。review-only `Ohm` は P1/P2 なし、`Chandrasekhar` は P2 1 件を指摘し同 PR で対応済み。GitHub CI 3 jobs green。
  - archived plan: [archive/plans/2026-06-27-manual-sale-recent-list.md](archive/plans/2026-06-27-manual-sale-recent-list.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-27-manual-sale-recent-list.md](archive/plans/test-matrices/2026-06-27-manual-sale-recent-list.md)
  - WER: [archive/plans/2026-06-27-manual-sale-recent-list-workflow-effectiveness-review.md](archive/plans/2026-06-27-manual-sale-recent-list-workflow-effectiveness-review.md)
- [x] 入庫 / 返品・交換 / 手動販売の業務記録詳細横展開:
  - scope: `/inventory/records` の4種横断化、`/inventory/receiving/records/$recordId`、`/inventory/return/records/$recordId`、`/inventory/manual-sale/records/$recordId`、generated `getReceivingRecord` / `getReturnRecord` / `getManualSaleRecord`、UI-02/03 recent detail 導線、UI-04 保存結果 detail 導線、UI-06c movement 元記録 link の実体化。
  - status: PR #115 squash merge 済み（`c3a4e9d`、2026-06-28 JST）。Windows native L3 は全項目 OK。親 route `<Outlet />` 不足、UI-02/03 recent list の「すべての履歴を見る」不足は同 PR で修正済み。review-only sub-agent `Cicero` / final full-diff `Euclid` は P1/P2 なし。GitHub CI 3 jobs green。手動販売出庫に recent list が無い点は現仕様どおり受容し、UX 改善 follow-up としてこの次の active item に分離。
  - archived plan: [archive/plans/2026-06-27-inventory-records-other-details.md](archive/plans/2026-06-27-inventory-records-other-details.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-27-inventory-records-other-details.md](archive/plans/test-matrices/2026-06-27-inventory-records-other-details.md)
  - WER: [archive/plans/2026-06-27-inventory-records-other-details-workflow-effectiveness-review.md](archive/plans/2026-06-27-inventory-records-other-details-workflow-effectiveness-review.md)
- [x] 入出庫履歴ハブ + 廃棄・破損 detail implementation:
  - scope: `/inventory/records` route、sidebar `入出庫履歴`、generated `listInventoryRecords` / `getDisposalRecord`、廃棄・破損詳細、UI-05 recent list から履歴/詳細導線、UI-06c movement から detail への `returnTo` 付き導線を実装する。
  - status: PR #114 squash merge 済み（`97811b7`、2026-06-27 JST）。review-only sub-agent Volta は P2 2 件 / P3 1 件、Ready化後 full-diff review-only sub-agent Meitner は P2 1 件を指摘し、いずれも同 PR で対応済み。自動ゲート、GitHub CI、Windows native L3 は通過済み。sidebar / filter 1-9、ID 3 detail、一覧 filter return、UI-05 recent list の「すべての履歴を見る」/ detail button、UI-06c `L3IR-K001` movement -> ID 3 detail -> movement return（種別 filter 保持含む）を owner 確認済み。戻り導線の仕様は `65-inventory-record-traceability.md` TRACE-D11 として source docs に昇格済み。
  - archived plan: [archive/plans/2026-06-27-inventory-records-disposal-detail.md](archive/plans/2026-06-27-inventory-records-disposal-detail.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-27-inventory-records-disposal-detail.md](archive/plans/test-matrices/2026-06-27-inventory-records-disposal-detail.md)
- [x] UI-06c 商品別在庫変動履歴 implementation:
  - scope: `/stock/$code/movements` route、`getStockDetail` + `listMovements` consumer、日付/種別/page URL state、movement table、`MovementRecord.source` 元記録リンク、在庫照会詳細カードからの導線を実装する。
  - status: PR #113 squash merge 済み（`f175e74`、2026-06-27 JST）。`/stock/$code/movements`、在庫照会詳細からの active link、movement table、`source=null` 表示、Windows native L3、CI green まで完了。元記録詳細 route は後続スライス。
  - archived plan: [archive/plans/2026-06-27-ui06c-stock-movements.md](archive/plans/2026-06-27-ui06c-stock-movements.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-27-ui06c-stock-movements.md](archive/plans/test-matrices/2026-06-27-ui06c-stock-movements.md)
- [x] DB/BIZ/CMD traceability foundation:
  - scope: `inventory_movements.reference_type/reference_id` から元業務記録の表示ラベルと遷移先を解決し、商品別 movement DTO に元記録リンク情報を返す。UI-06c 在庫変動履歴の前提になる backend contract を作る。
  - status: PR #112 squash merge 済み（`3f9c4b1`、2026-06-27 JST）。DB schema は変更せず、既存 `list_movements` の additive output contract として `source: { label, route }` を追加した。review-only sub-agent は P1/P2 なし、P3 は同 PR で対応済み。
  - archived plan: [archive/plans/2026-06-27-inventory-traceability-foundation.md](archive/plans/2026-06-27-inventory-traceability-foundation.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-27-inventory-traceability-foundation.md](archive/plans/test-matrices/2026-06-27-inventory-traceability-foundation.md)
- [x] 入出庫記録・在庫変動追跡の完成形 Design Phase:
  - scope: 入庫、返品・交換、手動販売出庫、廃棄・破損、CSV取込み、棚卸し補正をあとから追跡できる業務記録 / 在庫変動履歴 / 操作ログの役割分担を source docs に起こす。詳細確認、検索、ページング、並び替え、CSV出力、印刷、画像添付、取消/訂正、在庫変動から元記録へのリンク、元記録から在庫変動へのリンクを完成形として設計する。
  - status: PR #111 squash merge 済み（`5fee926`、2026-06-27 JST）。REQ-206/207/208 を Design Phase 補足要求として追加し、`65-inventory-record-traceability.md` で業務記録 / `inventory_movements` / `operation_logs` の役割分担、取消/訂正、一覧/詳細、CSV出力/印刷/画像添付、実装スライスを定義した。
  - archived plan: [archive/plans/2026-06-27-inventory-record-traceability-design.md](archive/plans/2026-06-27-inventory-record-traceability-design.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-27-inventory-record-traceability-design.md](archive/plans/test-matrices/2026-06-27-inventory-record-traceability-design.md)
- [x] UI-05 廃棄・破損（REQ-204）implementation:
  - status: PR #110 squash merge 済み（`0794342`、2026-06-27 JST）。`/inventory/disposal` route、generated `createDisposal` / `listDisposals`、商品検索、明細入力、保存結果、recent list、query invalidation、review-only sub-agent、Windows native L3 feedback 対応まで完了。理由入力 focus loss は L3 で発見し同 PR で修正済み。完成形から設計する workflow 原則も同 PR に含めた。
  - archived plan: [archive/plans/2026-06-27-ui05-disposal-implementation.md](archive/plans/2026-06-27-ui05-disposal-implementation.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-27-ui05-disposal-implementation.md](archive/plans/test-matrices/2026-06-27-ui05-disposal-implementation.md)
- [x] Post UI-03 warning cleanup:
  - scope: `npm run build` の 500kB chunk warning、traceability `REQ-403` no-test WARN、UI-03 active plan archive、UI-03 Workflow Effectiveness Review。
  - status: PR #108 squash merge 済み（`a3e775a`、2026-06-27 JST）。Vite manualChunks により build chunk warning は解消済み。`docs/spec/requirements.md` に `coverage=required|deferred` を追加し、未実装の REQ-403 は T3 WARN 対象外として `generate_traceability --check` WARN 0 を確認済み。
  - archived plan: [archive/plans/2026-06-27-post-ui03-warning-cleanup.md](archive/plans/2026-06-27-post-ui03-warning-cleanup.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-27-post-ui03-warning-cleanup.md](archive/plans/test-matrices/2026-06-27-post-ui03-warning-cleanup.md)
- [x] UI-03 返品・交換（REQ-202）implementation:
  - status: PR #107 squash merge 済み（`1c8ff66`、2026-06-27 JST）。`/inventory/return` route、generated `createReturn` / `listReturns` / `saveReceiptImage`、返品/交換 BIZ validation、商品検索、レシート画像 preview/drop/delete、冪等 retry、recent list、query invalidation、Windows native L3 feedback 対応まで完了。
  - archived plan: [archive/plans/2026-06-26-ui03-design-readiness.md](archive/plans/2026-06-26-ui03-design-readiness.md)、[archive/plans/2026-06-26-ui03-implementation.md](archive/plans/2026-06-26-ui03-implementation.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-26-ui03-design-readiness.md](archive/plans/test-matrices/2026-06-26-ui03-design-readiness.md)、[archive/plans/test-matrices/2026-06-26-ui03-implementation.md](archive/plans/test-matrices/2026-06-26-ui03-implementation.md)
  - WER: [archive/plans/2026-06-27-ui03-workflow-effectiveness-review.md](archive/plans/2026-06-27-ui03-workflow-effectiveness-review.md)
- [x] tooling / parallelization map + dialog plugin foundation:
  - scope: 保留 npm tooling を「導入 / 延期 / 不要」に分類し、UI-08 PLU 書出し前提の native save/open dialog foundation として `@tauri-apps/plugin-dialog` / `tauri-plugin-dialog` だけを導入する。Storybook / E2E / visual regression / axe / npm allowScripts / pnpm migration は別評価へ残す。
  - status: PR #106 squash merge 済み（`a2dceff`、2026-06-26）。`plugin-dialog` 2.7.1、`tauri-plugin-dialog` 2.7.1、`dialog:allow-open` / `dialog:allow-save` を追加。UI-07 / UI-01c の plain file input / dragdrop は置換しない。Storybook / E2E / visual regression / axe / npm allowScripts / pnpm migration は理由付きで deferred。
  - archived plan: [archive/plans/2026-06-26-tooling-parallelization-map.md](archive/plans/2026-06-26-tooling-parallelization-map.md)
- [x] npm / tooling thaw assessment:
  - scope: Mini Shai-Hulud / TanStack npm malware 後に保留していた npm/tooling 更新を、`ignore-scripts=true` 維持・affected range 回避・小さい direct package 更新で再開する。
  - status: PR #105 squash merge 済み（`8184097`、2026-06-26）。`vite` 7.x patched line、`happy-dom` patch、`markdownlint-cli2` patch に限定し、`ignore-scripts=true` を維持。`npm audit --audit-level=high` は exit 0。`npm audit fix` / install-script block 解除 / package manager migration は非 scope。
  - archived plan: [archive/plans/2026-06-26-npm-thaw-assessment.md](archive/plans/2026-06-26-npm-thaw-assessment.md)
- [x] UI-04 手動販売出庫（REQ-203）implementation:
  - scope: `/inventory/manual-sale` route、generated `createManualSale`、商品検索/スキャナ相当 Enter 追加、同一商品数量加算、数量/販売金額 validation、PLU登録済み確認、冪等キー、query invalidation、保存結果、日次売上「手動」Badge L3 を実装する。
  - status: PR #104 squash merge 済み（`32c98e0`、2026-06-26）。Windows native L3 で nav / 1件 Enter 追加 + focus return / 重複数量・販売金額加算 / 複数候補の明示追加 / 0件 recovery / validation / 保存結果 / 日次売上 link / 日次売上「手動」Badge を owner 確認済み。PLU登録済み商品の実DB目視確認は local DB に対象商品を用意できず未実施だが、BIZ tests と RTL PLU confirmation flow を証跡として受容。L3 で stale row validation error を発見し、UI-04 と同パターンの UI-02 を同 PR で修正・再確認済み。
  - archived plan: [archive/plans/2026-06-26-ui04-manual-sale-implementation.md](archive/plans/2026-06-26-ui04-manual-sale-implementation.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-26-ui04-manual-sale-implementation.md](archive/plans/test-matrices/2026-06-26-ui04-manual-sale-implementation.md)
  - WER: [archive/plans/2026-06-26-ui04-workflow-effectiveness-review.md](archive/plans/2026-06-26-ui04-workflow-effectiveness-review.md)
- [x] UI-02 入庫記録（REQ-201）implementation:
  - scope: `/inventory/receiving` route、generated `createReceiving` / `listReceivings`、商品検索/スキャナ相当 Enter 追加、取引先候補、数量/原価 validation、冪等キー、recent list、query invalidation、Windows native L3 を実装する。
  - status: PR #103 squash merge 済み（`fa34a8e`、2026-06-26）。Windows native L3 で nav / 商品追加 / 0-1-複数候補 / 重複数量加算 / validation / 保存結果 / recent list / 在庫照会戻り / 商品登録導線を owner 確認済み。pending 中の戻る導線非表示は処理が速く目視困難なため RTL pending-state test と実装ロック条件で確認済み。
  - archived plan: [archive/plans/2026-06-25-ui02-implementation.md](archive/plans/2026-06-25-ui02-implementation.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-25-ui02-implementation.md](archive/plans/test-matrices/2026-06-25-ui02-implementation.md)
  - design readiness evidence: [archive/plans/2026-06-25-ui02-design-readiness.md](archive/plans/2026-06-25-ui02-design-readiness.md)、[archive/plans/test-matrices/2026-06-25-ui02-design-readiness.md](archive/plans/test-matrices/2026-06-25-ui02-design-readiness.md)
  - WER: [archive/plans/2026-06-25-ui02-workflow-effectiveness-review.md](archive/plans/2026-06-25-ui02-workflow-effectiveness-review.md)
- [x] UI-01c 商品一括インポート（REQ-104）implementation:
  - scope: `/products/import` route、generated `previewImport` / `commitImport`、商品CSV preview / duplicate / commit UI、query invalidation、Windows native L3 を実装する。
  - status: PR #100 squash merge 済み（`6bef4b1`、2026-06-25）。Windows native L3 で route / file input / dragdrop / preview / duplicate / overwrite confirmation / result counts / return-to-list を owner 確認済み。commit-in-progress navigation hiding は処理が速く目視困難なため RTL pending-state test で確認済み。
  - archived plan: [archive/plans/2026-06-25-ui01c-implementation.md](archive/plans/2026-06-25-ui01c-implementation.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-25-ui01c-implementation.md](archive/plans/test-matrices/2026-06-25-ui01c-implementation.md)
  - WER: [archive/plans/2026-06-25-ui01c-workflow-effectiveness-review.md](archive/plans/2026-06-25-ui01c-workflow-effectiveness-review.md)
- [x] Phase 2 status / source docs sync:
  - merge gate はなし。
  - `Plans.md`、`SCREEN_DESIGN.md`、`PROJECT_HANDOFF.md`、`DEV_SETUP_CHECKLIST.md`、`project-memory.md`、navigation コメントを現在状態へ同期。
  - PR #74 の OK は stock inquiry visibility scope に限定した上で、H-6 は別途 5 画面通し確認として記録。
- [x] H-6 Windows native 5 画面通し利用者確認:
  - UI-00 / UI-07 / UI-09a / UI-06a / UI-09b を Windows native で確認済み。
  - 視認性 feedback: 商品コードは小さい。その他の視認性問題はなし。
  - disposition: 商品コードの読みやすさは Phase 2 blocker にせず、PR #77 の商品コード readability / 表示スケール option follow-up で対応済み。
- [x] 8-9 Phase 2 E2E / visual regression 採否判断:
  - E2E は Phase 2 tag gate にしない。Vitest + React Testing Library と H-6 Windows native 5 画面通し確認で代替。
  - visual regression も Phase 2 tag gate にしない。全画面横断 typography / density 変更や E2E 導入時に再評価。
- [x] Phase 2 completion / tag gates:
  - `typedInvoke` 期限付き fallback は撤去済み。`src/lib/invoke-fallback.ts`、件数 CI、eslint fallback 境界ルールを削除。
- [x] Phase 2 closeout PR / tag:
  - PR #75 は squash merge 済み（`f44f99a`）。
  - `v0.8.0-ui-daily` tag は `f44f99a` に作成・push 済み。
- [x] 商品コード readability / 表示スケール follow-up（PR #77 squash merge 済み、`62b851b`）:
  - scope: 商品コード cell / 詳細 header の `text-xs` 廃止 + Sidebar `表示サイズ`（標準 / 大きめ / 特大、`localStorage` + WebView `setZoom`）。review P2 1 件 + external P3 1 件 + L3 feedback 2 件すべて accepted/fixed、Windows native L3 通過。詳細は [archive/plans/2026-06-07-display-scale-readability.md](archive/plans/2026-06-07-display-scale-readability.md) と [test-matrices/2026-06-07-display-scale-readability.md](archive/plans/test-matrices/2026-06-07-display-scale-readability.md)。
- [x] 3 PR 進行で残った selection-tone follow-up（PR #80、squash merge `67fa62a`）。詳細は [archive/plans/2026-05-22-tone-and-nav-fix.md](archive/plans/2026-05-22-tone-and-nav-fix.md):
  - PR-1 (#69) と PR-3 (#70) は merge 済み。
  - 在庫照会 chip tone と status visibility は PR #74 (private archive) で閉じた。
  - Sidebar / sales tabs / monthly mode tabs の横断 tone 統一は PR #80 で merge 済み。shared stone selection tone を Sidebar / sales tabs / monthly mode tabs / StatusChips に同期。
  - Windows native L3: 月次売上で日次/月次と商品別ランキング/部門別構成比の二択切替を比較し、active / inactive / hover / クリック後 focus の見え方を確認済み。`SegmentedControl` 仕様は昇格済み（現正典: `docs/design-system/02-component-catalog.md` ⑤）。
- [x] Plan Packet から仕様書 / decision-log への昇格漏れ棚卸し（2026-06-08 実施、PR #82 (private archive) merged / `66e8f8f`）。分類表 + 最小更新案は [archive/plans/2026-06-08-plan-packet-backfill-audit.md](archive/plans/2026-06-08-plan-packet-backfill-audit.md):
  - 対象: active 2 本 + 直近 archive をクラスタ A（operator-UI 視認性）/ B（workflow retrofit）/ C（Phase 2 画面）で監査。
  - 結論: 大きな昇格漏れなし。クラスタ A / B は gap 0（durable は SCREEN_DESIGN / UI_TECH_STACK / review-checklist / function-design / decision-log / 各 Skill に分散昇格済み）。
  - 確定 gap = クラスタ C の 2 件（いずれも minor / dangling reference）: C-1 UI-06a pagination UI backlog、C-2 DepartmentFilter / DepartmentOption 共通化 backlog。`function-design/58-ui-stock-inquiry.md §58.13` が「Plans.md Backlog」を参照するのに転記先が空 → 本更新で Backlog へ転記済み。
  - display-scale は UI_TECH_STACK が SSOT として昇格済みのため decision-log 追加は見送り。
  - `DEV_WORKFLOW.md` Workflow Skills linkage + `CLAUDE.md` 引き継ぎ節は PR #82 commit `dd2e940`（workflow visibility sync）に同梱。
- [x] 完了済み active plan archive 移送 + Workflow Effectiveness Review:
  - 完了済み active plan 3 本（PR #77 / PR #80 / PR #82）と test matrix 2 本を `docs/archive/plans/` へ移送。
  - UI workflow / Skill dogfood の実効性評価を [archive/plans/2026-06-08-workflow-effectiveness-review.md](archive/plans/2026-06-08-workflow-effectiveness-review.md) に記録。
  - 主要判断: R3 Plan Packet / Test Matrix / review-only sub-agent は継続。goal ツールは作業整理の補助に留め、workflow source of truth は `Plans.md` と archive evidence に置く。review-only を省いた場合は PR evidence に明記する。
- [x] Design Phase workflow addition（PR #87 squash merge `ef0fd73`）:
  - 目的: 業務アプリの実装前に、仕様と Plan Packet の間で設計 docs を作る / 更新する工程を明示する。
  - archived plan: [archive/plans/2026-06-09-design-phase-workflow.md](archive/plans/2026-06-09-design-phase-workflow.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-09-design-phase-workflow.md](archive/plans/test-matrices/2026-06-09-design-phase-workflow.md)
  - result: `DEV_WORKFLOW.md` flow、Plan Packet template、review packet、workflow skills、review docs、PR template、project profile、decision-log を同期済み。Plan Packet が設計書の代用品にならないよう、Design Phase を R2+ に導入した。
- [x] UI-01a 商品検索・一覧 Design Readiness Trial（PR #88 squash merge `5680bca`）:
  - 目的: 追加した Design Phase を最初の Phase 3 候補に適用し、実装前に必要な設計成果物の選別・trace・source doc 更新を確認する。
  - archived plan: [archive/plans/2026-06-09-ui01a-design-readiness.md](archive/plans/2026-06-09-ui01a-design-readiness.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-09-ui01a-design-readiness.md](archive/plans/test-matrices/2026-06-09-ui01a-design-readiness.md)
  - WER: [archive/plans/2026-06-09-ui01a-design-readiness-workflow-effectiveness-review.md](archive/plans/2026-06-09-ui01a-design-readiness-workflow-effectiveness-review.md)
  - result: `UI-01a-D1`〜`UI-01a-D7` を source docs に昇格し、`list_departments` BIZ/CMD 設計、URL state、pagination、廃番表示、HID scanner 前提を実装前に整理。review-only sub-agent が部門フィルタ取得元の設計漏れと sort/dir enum mapping 不足を実装前に検出し、同 PR で修正済み。runtime / UI-01a 実装は非 scope。
- [x] UI-01a 商品検索・一覧 implementation planning（PR #90 squash merge `cb4a06f`）:
  - 目的: PR #88 の Design Readiness を実装 PR へ接続し、R3 Plan Packet / Test Matrix で scope、trace、tests、wire contract を確定する。
  - archived plan: [archive/plans/2026-06-09-ui01a-implementation.md](archive/plans/2026-06-09-ui01a-implementation.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-09-ui01a-implementation.md](archive/plans/test-matrices/2026-06-09-ui01a-implementation.md)
- [x] UI-01a 商品検索・一覧 implementation（PR #91 squash merge `9e8d474`）:
  - scope: `list_departments` CMD/BIZ、generated binding、`/products` route、DepartmentFilter、search pagination、URL state、廃番 mode mapping。
  - status: review-only sub-agent P1/P2 なし。P3 1 件（部門取得失敗時の表示）を同 PR で修正し、PR #91 で merge 済み。
  - evidence: [archive/plans/2026-06-09-ui01a-implementation.md](archive/plans/2026-06-09-ui01a-implementation.md) `Implementation Results`。
- [x] UI-01b 商品登録・修正 Design Readiness（PR #93 squash merge `eeb7bd0`）:
  - scope: route、generated CRUD commands、supplier候補、JANなし商品コード、edit read-only fields、cm / m defer、Windows native L3 要否を source design docs へ昇格する。
  - status: review-only sub-agent P2/P3 を同 PR で修正し、PR #93 で merge 済み。
  - evidence: [archive/plans/2026-06-09-ui01b-design-readiness.md](archive/plans/2026-06-09-ui01b-design-readiness.md)、[archive/plans/test-matrices/2026-06-09-ui01b-design-readiness.md](archive/plans/test-matrices/2026-06-09-ui01b-design-readiness.md)。
- [x] トレーサビリティ自動生成（workflow 自走化 第1層）:
  - scope: REQ インベントリ `docs/spec/requirements.md` 新設、`generate_traceability` bin（生成 + `--check` T1〜T4）、`docs/function-design/90-traceability.md` vendor-in、CI rust job / pre-push 配線、FE テスト ID 規約の昇格。
  - status: PR #96 squash merge 済み（`cda34cf`、2026-06-11）。review-only sub-agent merge 可（P1/P2 0）+ Codex CLI Round 1-3（Round 1-2 P2 各 1 件 = T4 presence 右境界対応、Round 3 全 0）。main 由来の CI fail（bindings.ts drift）は PR #95 の `89419b6` cherry-pick + meta-test 命名適合で解消済み。ローカル pre-push hook は refresh 済み（traceability check 含む全 gate 稼働確認済み）。
  - evidence: [archive/plans/2026-06-11-traceability-autogen.md](archive/plans/2026-06-11-traceability-autogen.md) `Implementation Results`、[archive/plans/test-matrices/2026-06-11-traceability-autogen.md](archive/plans/test-matrices/2026-06-11-traceability-autogen.md)。
  - 申し送り: PR #81（ci.yml 再構成）は merge 済み main に対し rebase 必要（rust job に traceability step 追加済み）。PR #95 は squash merge 済み（`539304a`、2026-06-12）。FE 未参照 17 ファイルの ID backfill は baseline 単調減 follow-up。Workflow Effectiveness Review の初回 dogfood = UI-01c 着手。
- [x] UI-01b 商品登録・修正 implementation planning（PR #94 squash merge `f3e5185`）:
  - scope: PR #93 の Design Readiness を実装 PR へ接続し、R3 Plan Packet / Test Matrix で scope、trace、tests、wire contract を確定する。
  - status: review-only sub-agent P2/P3 を同 PR で修正し、PR #94 で merge 済み。
  - evidence: [archive/plans/2026-06-09-ui01b-implementation.md](archive/plans/2026-06-09-ui01b-implementation.md)、[archive/plans/test-matrices/2026-06-09-ui01b-implementation.md](archive/plans/test-matrices/2026-06-09-ui01b-implementation.md)。
- [x] UI-01b 商品登録・修正 implementation:
  - scope: `createProduct` / `updateProduct` / `toggleDiscontinue` / `listSuppliers` generated command、`/products/new`、`/products/$code/edit`、UI-01a 導線、商品 form validation / save / recovery を実装する。
  - status: PR #95 squash merge 済み（`539304a`、2026-06-12）。Codex CLI Round 1（P2 1 件 = POS 同期自動提案の touched 汚染、accept）+ Round 2（全 0）。対応中に ProductForm lost update を追加発見・修正。CI green + owner 目視確認済み。
  - evidence: [archive/plans/2026-06-09-ui01b-implementation.md](archive/plans/2026-06-09-ui01b-implementation.md) `Implementation Results`。
- [x] UI-01b 商品登録・修正 画面デザイン polish:
  - scope: ページヘッダー規約を UI-01a / UI-01b / UI-06a で統一、一覧の廃番 badge 方針変更（状態列廃止 + 商品名セル内 badge）、フォーム 4 セクション分割 + read-only / 必須明示、廃番切替の確認ダイアログ、保存成功 toast を実装し、SCREEN_DESIGN / 51-ui-product-form / 50-ui-product-list の source docs へ昇格する。PR #95 と同 branch に追加した。
  - status: PR #95 squash merge 済み（`539304a`、2026-06-12）。backend contract / DTO / route は変更なし。Codex CLI Round 1（P2 1 件 = POS 同期自動提案の touched 汚染、accept）+ Round 2（全 0）。全 gate green（286 tests / typecheck / lint / format / doc-consistency / traceability）。CI green + owner 目視確認済み。
  - archived plan: [archive/plans/2026-06-12-ui01b-polish.md](archive/plans/2026-06-12-ui01b-polish.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-12-ui01b-polish.md](archive/plans/test-matrices/2026-06-12-ui01b-polish.md)
  - evidence: [archive/plans/2026-06-12-ui01b-polish.md](archive/plans/2026-06-12-ui01b-polish.md) `Implementation Results`。
- [x] デザインシステム構築 PR-A（docs: 明文化 + ファイル再編 + 導線）:
  - scope: `docs/design-system/` 新設（README + foundations + DSR-01〜13 + catalog 13 パターン + philosophy）、UI_TECH_STACK §4/§5.5.1/§6.1〜6.3 と SCREEN_DESIGN §6 横断規約の移設・スタブ化、AGENTS.md / operator-ui skill / DEV_WORKFLOW 導線、doc-consistency M1/M3 走査拡張。3 段 PR（A: docs / B: component 抽出 / C: 機械強制）の第 1 段。
  - status: PR #97 squash merge 済み（`24c7f6e`、2026-06-12）。Codex Round 1（P2 2 件 = 旧 §4.x live 参照張替漏れ + catalog ⑥ canonical と標準UIの矛盾、両方 accept）+ Round 2（全 0、merge 可能判定）。follow-up = `test_token_exists()` 負 glob（Backlog 登録済み）/ EmptyState 適合（PR-B 意図的差分）。
  - archived plan: [archive/plans/2026-06-12-design-system-codification.md](archive/plans/2026-06-12-design-system-codification.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-12-design-system-codification.md](archive/plans/test-matrices/2026-06-12-design-system-codification.md)
  - evidence: [archive/plans/2026-06-12-design-system-codification.md](archive/plans/2026-06-12-design-system-codification.md) `Implementation Results` / `Review Response`。
- [x] デザインシステム構築 PR-B（feat: 共通 component 抽出）:
  - scope: 6 共通 component（PageHeader / FormSection / DepartmentFilter / SummaryCard / SearchBar / EmptyState）を `src/components/patterns/` へ抽出 + 8 画面内部置換 + catalog ①②④⑥⑨ canonical 更新（② は規約書換）+ `59-ui-shared-patterns.md` 新設。意図的差分 3 クラス（IME ガード / allLabel 文言 / 空状態標準UI）は L3 gate。
  - status: PR #98 squash merge 済み（`202e128`、2026-06-13）。Codex R2（P2 = SearchBar id の DOM 不変違反 / P3 = packet AC 乖離、両方採用）+ R3（P2 = catalog ⑨ blanket 規定と live 型の矛盾 → 4 ブロック mode-aware 一括書換）+ R4（全 0、最終収束）。L3 owner 承認済み（意図的差分 3 クラスを Windows native 実機確認、月次 table-level EmptyState 2 分岐は通常到達不能のため RTL characterization で固定済み扱い）。380 tests + CI 3 jobs green。
  - archived plan: [archive/plans/2026-06-12-design-system-pr-b.md](archive/plans/2026-06-12-design-system-pr-b.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-12-design-system-pr-b.md](archive/plans/test-matrices/2026-06-12-design-system-pr-b.md)
  - evidence: [archive/plans/2026-06-12-design-system-pr-b.md](archive/plans/2026-06-12-design-system-pr-b.md) `Review Response` / PR #98 L3 コメント。
- [x] デザインシステム構築 PR-C（機械強制）:
  - scope: 色 token 移行 14 箇所（amber hue 不変 / rose→red / emerald→green = 意図的色補正）+ SortableHeader raw button 3 箇所の shadcn Button 最小置換 + eslint `no-restricted-syntax`（palette 外色 ban / 生 `<button>` ban / barrel 迂回封じ）+ doc-consistency DS1〜DS4 統合 + design-system docs 同期。3 段 PR の最終段。
  - status: PR #99 squash merge 済み（`e9acfc1`、2026-06-13）。Codex R1（P2 = 生 button lint 欠落 = 親 packet C-lint-2 の contract drift → selector 追加で claim を真にする方向で採用）+ R2（全 0、ESLint API で scope 設計再実証、最終収束）。L3 owner 承認済み（目視判別可能な絶対基準チェックリスト方式。手動 Badge は seed auto 限定 + UI-04 未実装で到達不能のため受容、UI-04 実装時 L3 でついで確認）。380 tests + CI 3 jobs green + lint/DS fail 実証 6 本。
  - archived plan: [archive/plans/2026-06-13-design-system-pr-c.md](archive/plans/2026-06-13-design-system-pr-c.md)
  - archived test matrix: [archive/plans/test-matrices/2026-06-13-design-system-pr-c.md](archive/plans/test-matrices/2026-06-13-design-system-pr-c.md)
  - evidence: [archive/plans/2026-06-13-design-system-pr-c.md](archive/plans/2026-06-13-design-system-pr-c.md) `Review Response` / PR #99 L3 コメント。
- [x] Codex local execution policy follow-up:
  - `.codex/config.toml` の通常作業モードを `workspace-write + on-request` に更新し、`untrusted` は監査用として `.codex/README.md` に位置付けた。
  - `.codex/execpolicy.rules` と `.codex/rules/default.rules` に、trusted WSL project session 向けの repo-relative safe wrapper、read-only git inspection、documented verification commands、Codex diagnostics を追加。
  - destructive command と git mutation / GitHub mutation は引き続き forbidden / prompt のまま維持。AGENTS.md には repo-relative wrapper と canonical WSL wrapper の両方を使う方針を追記。
  - 代表例は `codex execpolicy check` で確認済み: `.codex/bin/read-safe-file.sh` / `git status` / `npm test` は allow、`rm` は forbidden。

## 次の行動

1. REQ-401 SALES implementation を開始する。最初のPRは PR #119 の設計を前提に、`daily_report_imports` / `daily_report_*_lines` migration、Z001/Z002/Z005 parser/repository、BIZ import lifecycle、CMD wire contract、UI-07 daily report import path の実装範囲を Plan Packet / Test Matrix に落とす。
2. Post-UI-08 app-generated PLU real-device confirmation を別タイミングで拾う。最新アプリ生成 `.txt` を CV17 取込み、SD書出し、SR-S4000 `設定読み`、代表商品のレジ表示/呼出しまで確認し、商品情報を含まない形で結果を記録する。
3. Post-UI-08 JANなし商品のPLU対象扱い設計を別PRで扱う。
4. npm policy follow-up（`allowScripts` / `min-release-age` / pnpm migration）は feature lane と混ぜず、別 policy spike として扱う。

## 後回し Backlog の参照先

> 後回し backlog の詳細は [archive/plans/2026-06-06-plans-dashboard-cleanup.md](archive/plans/2026-06-06-plans-dashboard-cleanup.md) に残す。

- Security / tooling: Vite high-severity CVE と markdownlint-cli2 first thaw は PR #105 (`8184097`) で対応済み。残る moderate / low audit は `eslint` / `typescript-eslint`、`markdownlint-cli2` transitive、TanStack router tooling、Vite transitive に分けて別 PR で評価。
- Tooling follow-up（PR #97 Codex R2 で残リスク確認済み）: linuxbrew ripgrep 15.1.0 はネガティブ `--glob '!...'` をリテラル解釈し全マッチ 0 件を返す（memory `ripgrep-15-negative-glob-broken.md`）。`scripts/doc-consistency-check.sh` `test_token_exists()` の負 glob 除去（target/node_modules は gitignore default で既に除外のため冗長、現状は PK3 偽 WARN のみで exit code 影響なし）を別 PR で対応。検証 grep は canary 検索 + 負 glob 回避を徹底。
- Workflow / CI: `collect_commands!` と `generate_handler!` の drift detection、Node 22 build-target 評価、TanStack Router generation settings の統一。Vite build 500kB chunk warning と traceability REQ-403 no-test WARN は PR #108 (`a3e775a`) で対応済み。CI hosted-runner 容量対策 / path routing / Rust分割は PR #120 (`773d93c`) で対応済み。docs-only skip behavior は workflow/script 差分なしの次のdocs-only PRまたはpost-merge runで確認する。
- typed invoke: `typedInvoke` fallback 撤去は Phase 2 closeout で完了。stable contract は [project-profile.md](project-profile.md) にも記録済み。
- Post-UI-08 app-generated PLU real-device confirmation: PR #122 最新アプリ生成 `.txt` を保存し、CV17 1.1.1 取込み、PCツールSD書出し、SR-S4000 `設定読み`、代表商品の呼出し確認を行い、商品情報を含まない形で結果を記録する。これは PR #122 merge blocker ではなく、後から実機確認対象として拾えるように残す。
- Post-UI-08 PLU follow-up: JANなし商品は商品マスタ上許可される一方、CV17 1.1.1 スキャニングPLUには13桁JAN/EAN-13が必須。UI-08とは別PRで、JANなし商品のPLU対象外表示、通常PLU/部門売りとの関係、商品登録・一覧・PLU書出し画面での案内、差分対象から除外/ブロックのどちらを採るかをDesign Phaseで決める。
- Frontend follow-up: 表示スケール follow-up は PR #77 (`62b851b`) で merge 済み。残りは UI-09a/b の将来設計質問、`SortableHeader` 共通 component 化、bindings trailing-whitespace generation の扱い。`PageHeader` 共通 component 抽出は PR #98 で完了。手動 Badge（PR #99 で warning-soft 化）は UI-04 Windows native L3 で到達・可読性確認済み。
- UI-06a 58 §58.13 defer 転記（dangling reference 解消、2026-06-08 backfill audit C-1/C-2）: pagination UI（「すべて」50 件超の操作、Phase 4 で再評価）と `DepartmentFilter` / `DepartmentOption` の feature 間共通化（`src/components/...` への抽出、別 PR）。いずれも `function-design/58-ui-stock-inquiry.md §58.13` が参照する Backlog 転記先。
- Docs follow-up: 今後も Plan Packet は作業証跡に留め、守る設計判断は `UI_TECH_STACK.md` / `SCREEN_DESIGN.md` / `function-design/*.md` / `decision-log.md` へ昇格する。
- Phase 3 contract follow-up: 商品検索・一覧（UI-01a）着手時は、既存の `search_products` `per_page` 上限契約（上限 200、200 超は IO 層でクランプ）を前提に pagination UI を設計する。
- Workflow follow-up: Design Phase では、operator-facing filter / select の候補取得元が master data か現在結果かを明示する。PR #88 WER の lesson として `DEV_WORKFLOW.md` Design checklist に反映済み。
- UI quality follow-up: smoke E2E / visual regression は、今後の全画面横断 typography / density 変更時、Phase 3 の最初の画面横断 workflow 計画時、Phase 4 完了後の `v1.0.0` 候補前に再評価する。
- Workflow 自走化 第2層（change 単位の状態機械）: Plan Packet frontmatter or 併置 state ファイルに `phase`（kickoff/design-done/plan-approved/implementing/verified/reviewed/archived）を機械可読で持たせ、PreToolUse hook で遷移を強制する（例: R2+ スコープのソース編集を `phase >= plan-approved` でなければ deny、PR open 前に Verification Gates 実行済み確認）。`check-plan-on-exit.sh` の deny block パターンの横展開。前提 = 第1層（PR #96 で merge 済み）。UI-01c WER では「小さく設計してから導入」として deferred。
- Workflow 自走化 第3層（自走ドライバ）: 単一エントリポイント（skill）が状態ファイル群から次の dependency-ready フェーズを決定 → フェーズ実行（design/implement/verify）→ gate 通過で状態更新、を人間ゲート（L3 実機視覚確認・R4 承認・利用者デモ）に当たるまでループする。目標は「1 change = 1 プロンプト、人間ゲート間は完全自走」であり完全プロンプトレスではない（人間ゲートは意図した設計、PR #67 デモで机上判断が覆った実績が根拠）。前提 = 第2層。3 層構想の経緯と各層の設計判断は第2層着手時の Design Phase で decision-log / 設計書へ昇格する。

## ブロッカー

- 現在ブロッカーなし。UI-08 implementation は PR #122 でmerge済み。最新アプリ生成 `.txt` の CV17 / PCツール / SDカード / SR-S4000 / 代表商品呼出し再確認は Post-UI-08 follow-up。SALES track (`Z001`/`Z002`/`Z005`) の design readiness は PR #119 で完了しており、次は実装計画に進める。
- `v0.8.0-ui-daily` tag blocker は解消済み。tag は `f44f99a` に作成・push 済み。

## 注意リスト

- 既存 research ADR は `docs/research/` に残っている。当面は [adr/README.md](adr/README.md) が index する。
- 実 POS / 店舗 artifact、DB file、backup、log、receipt image、secret は commit しない。
- operator-facing UI flow の変更では、Windows native L3 verification が引き続き必要。今回の在庫照会高視認性 follow-up の実利用者 L3 は通過済み。
- 画面を新規作成または大きく変更した PR は、CI / review-only が clean でも owner 目視確認パートを merge 前に設ける。

## 最近の archive

- [2026-06-06 Plans dashboard cleanup](archive/plans/2026-06-06-plans-dashboard-cleanup.md)
- PR #70 demo seed stockout/low + SummaryCards truncate (private archive) merged as `aeeee2a`
- [2026-06-06 AI Quality Workflow retrofit](archive/plans/2026-06-06-ai-workflow-retrofit.md)
- [2026-06-07 business-app UI Skill survey](archive/plans/2026-06-07-business-app-ui-skill-survey.md)
- [2026-06-07 inventory operator UI guidance](archive/plans/2026-06-07-inventory-operator-ui-guidance.md)
- PR #74 stock inquiry high visibility (private archive) merged as `ae0c68f`
- PR #75 Phase 2 closeout (private archive) merged as `f44f99a`; tag `v0.8.0-ui-daily`
- PR #77 display scale readability controls (private archive) merged as `62b851b`
- PR #80 unify active selection tone (private archive) merged as `67fa62a`
- PR #83 PR #82 post-merge dashboard sync (private archive) merged as `1aa903f`
- PR #84 agmsg sandbox setup notes (private archive) merged as `67cd30f`
- PR #85 stock search pagination limit (private archive) merged as `9ce1637`
- PR #86 archive completed plans and review workflow (private archive) merged as `2ca84f5`
- PR #87 Design Phase before planning (private archive) merged as `ef0fd73`
- PR #88 UI-01a Design Readiness Trial (private archive) merged as `5680bca`
- PR #89 PR #88 post-merge workflow sync (private archive) merged as `4425fa1`
- PR #90 UI-01a implementation planning (private archive) merged as `cb4a06f`
- PR #91 UI-01a 商品検索・一覧 implementation (private archive) merged as `9e8d474`
- PR #93 UI-01b 商品登録・修正 Design Readiness (private archive) merged as `eeb7bd0`
- PR #95 UI-01b 商品登録・修正 implementation + 画面デザイン polish (private archive) merged as `539304a`
- PR #100 UI-01c 商品一括インポート implementation (private archive) merged as `6bef4b1`
- PR #102 UI-02 入庫記録 Design Readiness (private archive) merged as `4f25cde`
- PR #103 UI-02 入庫記録 implementation (private archive) merged as `fa34a8e`
- PR #104 UI-04 手動販売出庫 implementation (private archive) merged as `32c98e0`
- PR #105 npm/tooling first thaw (private archive) merged as `8184097`
- PR #106 dialog plugin foundation (private archive) merged as `a2dceff`
- PR #107 UI-03 返品・交換 implementation (private archive) merged as `1c8ff66`
- PR #108 Post UI-03 warning cleanup (private archive) merged as `a3e775a`
- PR #109 Post UI-03 dashboard sync (private archive) merged as `d146c1c`
- PR #114 入出庫履歴ハブ + 廃棄・破損詳細 (private archive) merged as `97811b7`
- PR #119 REQ-401 SALES daily report design (private archive) merged as `92e4592`
- PR #120 CI gate optimization (private archive) merged as `773d93c`
- PR #121 UI-08 PLU design readiness (private archive) merged as `49ca55b`
- PR #122 UI-08 PLU implementation (private archive) merged as `a0e11d6`
- [2026-07-01 UI-08 PLU implementation plan](archive/plans/2026-07-01-ui08-plu-implementation.md)
- [2026-07-01 UI-08 PLU implementation WER](archive/plans/2026-07-01-ui08-plu-implementation-workflow-effectiveness-review.md)
- [2026-07-01 CI gate optimization plan](archive/plans/2026-07-01-ci-gate-optimization.md)
- [2026-07-01 UI-08 PLU design readiness plan](archive/plans/2026-07-01-ui08-plu-design-readiness.md)
- [2026-06-30 SALES daily report design plan](archive/plans/2026-06-30-sales-daily-report-design.md)
- [2026-06-27 入出庫履歴ハブ + 廃棄・破損詳細 plan](archive/plans/2026-06-27-inventory-records-disposal-detail.md)
- [2026-06-26 UI-03 返品・交換 Design Readiness](archive/plans/2026-06-26-ui03-design-readiness.md)
- [2026-06-26 UI-03 返品・交換 implementation](archive/plans/2026-06-26-ui03-implementation.md)
- [2026-06-27 UI-03 Workflow Effectiveness Review](archive/plans/2026-06-27-ui03-workflow-effectiveness-review.md)
- [2026-06-26 npm/tooling thaw assessment plan](archive/plans/2026-06-26-npm-thaw-assessment.md)
- [2026-06-26 tooling / parallelization map](archive/plans/2026-06-26-tooling-parallelization-map.md)
- [2026-06-25 UI-02 入庫記録 Design Readiness plan](archive/plans/2026-06-25-ui02-design-readiness.md)
- [2026-06-25 UI-02 入庫記録 implementation plan](archive/plans/2026-06-25-ui02-implementation.md)
- [2026-06-25 UI-02 Workflow Effectiveness Review](archive/plans/2026-06-25-ui02-workflow-effectiveness-review.md)
- [2026-06-26 UI-04 手動販売出庫 implementation plan](archive/plans/2026-06-26-ui04-manual-sale-implementation.md)
- [2026-06-26 UI-04 Workflow Effectiveness Review](archive/plans/2026-06-26-ui04-workflow-effectiveness-review.md)
- [2026-06-25 UI-01c 商品一括インポート implementation plan](archive/plans/2026-06-25-ui01c-implementation.md)
- [2026-06-25 UI-01c Workflow Effectiveness Review](archive/plans/2026-06-25-ui01c-workflow-effectiveness-review.md)
- [2026-06-09 UI-01b Design Readiness plan](archive/plans/2026-06-09-ui01b-design-readiness.md)
- [2026-06-09 UI-01b implementation plan](archive/plans/2026-06-09-ui01b-implementation.md)
- [2026-06-12 UI-01b polish plan](archive/plans/2026-06-12-ui01b-polish.md)
- [2026-06-09 UI-01a implementation plan](archive/plans/2026-06-09-ui01a-implementation.md)
- [2026-06-09 Design Phase workflow](archive/plans/2026-06-09-design-phase-workflow.md)
- [2026-06-09 UI-01a Design Readiness Trial](archive/plans/2026-06-09-ui01a-design-readiness.md)
- [2026-06-09 UI-01a Design Readiness WER](archive/plans/2026-06-09-ui01a-design-readiness-workflow-effectiveness-review.md)
- [2026-05-22 tone and nav fix plan](archive/plans/2026-05-22-tone-and-nav-fix.md)
- [2026-06-07 display scale readability plan](archive/plans/2026-06-07-display-scale-readability.md)
- [2026-06-08 plan packet backfill audit](archive/plans/2026-06-08-plan-packet-backfill-audit.md)
- [2026-06-11 traceability 自動生成 plan](archive/plans/2026-06-11-traceability-autogen.md)
- [2026-06-08 workflow effectiveness review](archive/plans/2026-06-08-workflow-effectiveness-review.md)
- [v0 tag history](archive/v0_tag_history.md)
```
