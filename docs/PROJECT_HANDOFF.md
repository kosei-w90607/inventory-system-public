# 在庫管理システム プロジェクト引き継ぎドキュメント

> **このファイルの目的**: Claudeとの新しい会話でこのファイルを冒頭に渡すことで、プロジェクトの全文脈を復元し、中断した地点から再開できるようにする。
>
> **更新ルール**: 会話で進展があるたびにこのファイルを更新する。各セクションは最新の状態を反映し、過去の経緯は「経緯ログ」セクションに蓄積する。
>
> **最終更新**: 2026-07-14 / public 化・初回 hosted CI green・学びのPublic同期まで完了。Public PR #1 squash merge（`713bdfc`）。次はCI `synchronize` trigger修正を独立R3 changeとして扱う（現在状態は `Plans.md` を優先）

---

## 1. プロジェクト概要

### 何を作るか
小規模な実店舗向けの在庫管理システム。日常業務を止めず、商品・在庫・入出庫・POS 由来データ・売上確認を一つの運用へまとめる。

### 関係者
- **owner / operator**: 店舗業務と採否判断を担う。非 IT 利用者が単独で継続運用できることを品質条件とする
- **developer / maintainer**: 要求の仕様化、実装、検証、保守手順の整備を担う
- 開発者と利用者の役割が異なるため、業務事実と製品判断を分離し、公開仕様へ抽象化して残す

### 開発方針
- 「要求を仕様化する技術」（清水吉男著）のUSDM手法に基づく
- NotebookLMに同書をスキャンして投入し、技術的エッセンスを抽出済み
- ヒアリング→要求仕様書→設計→実装の順で進行

---

## 2. 現在地（ここから再開）

### フェーズ
**Phase 2 の日常利用 UI 5 画面は code-complete / route active で、PR #75 closeout merge `f44f99a` に `v0.8.0-ui-daily` tag を作成済み。AI Quality Workflow は PR #87 `ef0fd73` で Design Phase を導入済み。Phase 3 商品マスタ UI は完了済み。Phase 4 は UI-11b / UI-11a / UI-10 棚卸し / UI-11c 操作ログが完了し、残りは UI-13。最新のライブ状態は `Plans.md` を優先する。**

### 直近の作業状態
- **バックエンド**: 18テーブル DB / 5層分割（UI/CMD/BIZ/IO/MNT）/ Tauri Commands / 業務ロジック / バックアップ / 操作ログ / 診断ログ全て実装完了。テスト 561 本通過、clippy 警告ゼロ、fmt 準拠
- **フロントエンド基盤**: React 19 + TypeScript + Tauri 2 + TanStack Router + TanStack Query + Tailwind CSS 4 + shadcn/ui + lefthook + ESLint 9 + tauri-specta 採用、UI-12 共通レイアウト + invoke ラッパ完成。Phase 1 残 follow-up: 7-6 Storybook / 7-7b axe or hooks coverage / 7-8a Error Boundary / 7-8b 横断UI / 7-8c unsaved changes
- **直近 PR**: Public #1（Phase B goal-drift WER / D-045 / dashboard同期、merge `713bdfc`）
- **現在の参照先**: このファイルには Phase 2 初期の詳細が残っている。最新の進行状態、次アクション、ブロッカーは [Plans.md](../Plans.md) を優先する。
- **直近完了**: public 化 Phase AとPhase Bを完了した。sanitized parentless snapshotをPublic repositoryへ移行し、public-writer cloneを通常開発用、旧private cloneをhistory-view専用として分離した。Public visibilityと初回hosted CI greenを確認済み。実行中のgoal driftと再発防止判断はPublic PR #1 squash merge（`713bdfc`）で [D-045](decision-log.md)、[WER](archive/plans/2026-07-14-public-repo-phase-b-goal-drift-workflow-effectiveness-review.md)、[archived Packet](archive/plans/2026-07-14-public-migration-learning-sync.md)へ同期した。次はCI `synchronize` trigger修正を独立R3 changeとして扱う。
- **直近完了**: UI-03 返品・交換 implementation は PR #107 squash merge 済み（`1c8ff66`、2026-06-27 JST）。`/inventory/return` route、generated `createReturn` / `listReturns` / `saveReceiptImage`、返品/交換 BIZ validation、商品検索、レシート画像 preview/drop/delete、冪等 retry、recent list、query invalidation、Windows native L3 feedback 対応まで完了した。
- **直近完了**: Post UI-03 warning cleanup は PR #108 squash merge 済み（`a3e775a`、2026-06-27 JST）。`npm run build` の 500kB chunk warning と traceability `REQ-403` no-test WARN は既存系の修正として片付け済み。
- **直近完了**: UI-05 廃棄・破損 implementation は PR #110 squash merge 済み（`0794342`、2026-06-27 JST）。`/inventory/disposal` route、generated `createDisposal` / `listDisposals`、商品検索、明細入力、保存結果、recent list、query invalidation、review-only sub-agent、Windows native L3 feedback 対応まで完了。理由入力 focus loss は L3 で発見し同 PR で修正済み。
- **直近完了**: 入出庫記録・在庫変動追跡の完成形 Design Phase は PR #111 squash merge 済み（`5fee926`、2026-06-27 JST）。REQ-206/207/208 補足要求、業務記録 / inventory_movements / operation_logs の役割分担、取消/訂正、一覧/詳細、CSV出力/印刷/画像添付、実装スライスを source docs に定義した。
- **直近完了**: DB/BIZ/CMD traceability foundation は PR #112 squash merge 済み（`3f9c4b1`、2026-06-27 JST）。`inventory_movements.reference_type/reference_id` から元業務記録の表示ラベルと遷移先を `MovementRecord.source` として返す backend contract を追加した。review-only sub-agent は P1/P2 なし。
- **直近完了**: UI-06c 商品別在庫変動履歴は PR #113 squash merge 済み（`f175e74`、2026-06-27 JST）。在庫照会詳細から `/stock/$code/movements` へ遷移し、商品別 movement、日付/種別 filter、pagination、元記録 link 表示、`source=null` の「元記録なし」表示まで完了。元記録詳細 route は後続スライス。
- **直近完了**: 入出庫履歴ハブ + 廃棄・破損詳細（REQ-206 / REQ-204）は PR #114 squash merge 済み（`97811b7`、2026-06-27 JST）。`/inventory/records`、`/inventory/disposal/records/$recordId`、UI-05 recent list 導線、UI-06c movement から detail への `returnTo` 付き導線を追加した。L3 で見つかった商品検索 IME 入力崩れ、stale routeTree、`/inventory/disposal` 親 route の `<Outlet />` 不足による detail link 不達、一覧 detail から戻る際の filter state 欠落、recent detail button の押せる感不足、Ready化後の full-diff review-only sub-agent P2（廃棄保存後の入出庫履歴 cache invalidation 漏れ）は同 PR で修正済み。
- **直近完了**: 入庫 / 返品・交換 / 手動販売の業務記録詳細横展開は PR #115 squash merge 済み（`c3a4e9d`、2026-06-28 JST）。`/inventory/records` を4種横断化し、3種の read-only detail route、generated `getReceivingRecord` / `getReturnRecord` / `getManualSaleRecord`、UI-02/03 recent detail 導線、UI-04 保存結果 detail 導線を実装した。Windows native L3 で発見した3種詳細 route が親作成画面へ吸われる問題は、親 route を `<Outlet />` layout + index route に分離して修正済み。入庫 / 返品・交換の直近セクションに `すべての履歴を見る` が無い問題は、種別 filter 付き `/inventory/records` 導線を追加して修正済み。Windows native L3 は owner 確認で全項目 OK。review-only sub-agent `Cicero` / final full-diff `Euclid` は P1/P2 なし。
- **直近完了**: 手動販売出庫にも保存直後確認用の recent list を追加する follow-up は PR #116 squash merge 済み（`145330b`、2026-06-28 JST）。UI-04 に `直近の手動販売出庫`、`すべての履歴を見る`、`詳細を見る` を追加し、L3 feedback として UI-02/03/04/05 の保存成功/PLU確認待ち/command 失敗時のページトップスクロールも実装した。Windows native L3 は全項目 OK、GitHub CI 3 jobs green。review-only `Ohm` / `Chandrasekhar` の指摘は同 PR で対応済み。
- **直近完了**: UI-03 返品・交換の備考 visibility follow-up は PR #117 squash merge 済み（`06bcc37`、2026-06-30 JST）。備考入力を複数行化し、保存結果 / recent list / 返品・交換詳細で備考を独立表示、未入力時は `備考なし` fallback を表示する。GitHub CI 3 jobs green。fresh review-only sub-agent `Tesla` は P1/P2 なし、P3 1 件は同 PR で対応済み。Owner OK により merge 済み。
- **直近完了**: UI-08前 field-check impact / POS adapter boundary / Impact Review Lenses は PR #118 squash merge 済み（`7fd888c`、2026-06-30 JST）。現店舗の日報主入力を `Z001`/`Z002`/`Z005`、`Z004` を PLU(商品) / 商品別トラックとして source docs に反映し、D-022/D-023/D-024 を記録した。fresh review-only sub-agent `Parfit` / `Singer` / `Plato` の P2/P3 は同 PR で対応済み。GitHub CI 3 jobs green。
- **直近完了**: REQ-401 SALES daily report design は PR #119 squash merge 済み（`92e4592`、2026-07-01 JST）。`Z001`/`Z002`/`Z005` 日報取込みを daily_report_* モデルに分離し、既存Z004商品別CSV取込みはPLU後トラックとして残す方針を D-025、IO-07/BIZ-08/CMD-12、日次/月次レポート設計へ反映した。active plan / test matrix は `docs/archive/plans/2026-06-30-sales-daily-report-design.md` と `docs/archive/plans/test-matrices/2026-06-30-sales-daily-report-design.md` へ archive 済み。
- **直近完了**: CI gate optimization は PR #120 squash merge 済み（`773d93c`、2026-07-01 JST）。PR #119 の hosted runner 容量不足を受け、CIを changed-area routing に整理し、Rust gate を fmt/clippy・tests・generated drift に分割、`Env safety` を独立化、旧 `Rust (fmt + clippy + test)` check 名を aggregate として維持、`docs/ci.md` を薄いCI仕様入口として追加した。active plan / test matrix は `docs/archive/plans/2026-07-01-ci-gate-optimization.md` と `docs/archive/plans/test-matrices/2026-07-01-ci-gate-optimization.md` へ archive 済み。docs-only skip behavior は workflow/script 差分なしの次docs-only PRまたはpost-merge runで確認する。
- **直近完了**: UI-08 PLU design readiness は PR #121 squash merge 済み（`49ca55b`、2026-07-01 JST）。D-027 として PLUファイル生成とアプリ側の書出し済み確認を分離し、`prepare_plu_export` はDBを更新せず、保存後に利用者が確認した exact product_code set だけを `confirm_plu_export_saved` で未反映解除する方針に更新した。fresh review-only sub-agent `Gibbs` は P1/P2 なし、P3 1件を同PRで修正済み。active plan / test matrix は `docs/archive/plans/2026-07-01-ui08-plu-design-readiness.md` と `docs/archive/plans/test-matrices/2026-07-01-ui08-plu-design-readiness.md` へ archive 済み。
- **直近完了**: UI-08 implementation は PR #122 squash merge 済み（`a0e11d6`、2026-07-03 JST）。`prepare_plu_export` / `confirm_plu_export_saved` 二段階契約、generated binding、`/products/plu-export` route、native save dialog、保存後確認、query invalidation、保存済み未確認状態の復帰導線、JAN列表示、13桁EAN demo seed を実装した。CV17 1.1.1 profile（`PLU_{YYYYMMDD}.txt`、11列、13桁JAN/EAN-13必須、`入力桁制限=無し`、通常PLU216枠使用時217始まり / 4,784件上限）へ修正済み。2026-07-03 field gate で `CV17 TXT import -> PC tool SD settings write -> SR-S4000 設定読み -> barcode/register behavior confirmation` の成功手順を確認し、承認済み field file とアプリformatterの構造一致を external gate として受容した。最新アプリ生成 `.txt` のフル実機再確認、実売上発生、Z004 評価は Post-PLU follow-up。
- **直近完了**: UI-10 棚卸し implementation は PR #159 squash merge 済み（`16b3dc6`、2026-07-08 JST）。`/stocktake` route（開始 / 検索・スキャンでのカウント入力 / 一覧フィルタ / 常時確認の確定 / 結果表示）を実装し、CMD-10 既存4本 + 新規3本（`get_active_stocktake` / `find_stocktake_item` / `get_last_completed_stocktake`）を specta 化した。Fable・Codex の複数ラウンドのレビュー・独立契約監査を経て、73 に明記済みだった契約（連続 HID スキャン用フォーカス管理、商品名検索フォールバック）の実装漏れと、確定後の前回比較差し替わりバグ等の重大な見落としを複数発見・是正した。根本原因（Plan Packet が実装コミットと同一コミットで事後作成されたこと）と一連の見落としの時系列・発見経路は [Workflow Effectiveness Review](archive/plans/2026-07-08-ui10-stocktake-workflow-effectiveness-review.md) に記録。Windows native L3 全7項目 owner 確認 OK。archived packet は [docs/archive/plans/2026-07-07-ui10-stocktake-implementation.md](archive/plans/2026-07-07-ui10-stocktake-implementation.md)。
- **直近完了**: CI予算逼迫対策は PR #160 squash merge 済み（`25e945b9`、2026-07-10 JST）。D-033に基づき、L0 pre-push / L1 `scripts/local-ci.sh` / L2 hosted finalへ検証責務を再配置し、Draft pushと`push: main`の自動実行を廃止、Ready eventまたはmanual dispatchだけでhosted CIを実行する。ownerがCIをEnableし、main manual dispatch run 29091831468 (private archive Actions evidence 29091831468) はmerge SHA `25e945b9`でsuccess。active Plan Packet / Test Matrix は本closeoutでarchiveへ移動し、最初のR3 dogfood後にWERを実施する。
- **直近完了**: workflow model-neutral implementation slice 1は PR #163 squash merge 済み（`ab03a20c`、2026-07-11 JST）。canonical entry、idempotent start/resume、R0/R1 no-Plan route、Workflow State / Contract Audit artifacts、D-035 `Reviewed Content HEAD` / PR-body exact-HEAD evidence分離をskills/templatesへ実装した。Ready-event hosted final run 29124260732 (private archive Actions evidence 29124260732) はPR HEAD `98a4318`でsuccessし、local evidence / hosted `headSha` / live PR HEADの三点一致を確認。継続実装のためactive残置していたpacket / Matrixはcloseoutでarchive済み。WERは [2026-07-11 workflow model-neutral redesign effectiveness review](archive/plans/2026-07-11-workflow-model-neutral-redesign-effectiveness-review.md)。次はUI-11cまたはmechanical workflow slice 2 Design Phase。
- **直近完了**: UI-11c 操作ログ画面は PR #164 squash merge `94421a7`（2026-07-12 JST）。期間・種別filter、URL state、detail JSON安全表示、関連記録リンク、pagination/empty/error/retryを実装し、Finding Closure P1/P2=0、Windows native L3-1〜6 PASS、L3-7/L3-8 manual waiverとowner residual-risk acceptanceを記録した。final HEAD `d7fe410`でlocal fullとhosted run 29168080505 (private archive Actions evidence 29168080505)がsuccessし、三点SHA一致を確認。packet / Matrixはarchive済み。次はmechanical workflow slice 2 Design Phase。
- **書類整備完了**: Phase 2 UI-00 着手前の natural break で 2 PR 体制で書類同期完了（PR-A #53: SCREEN_DESIGN + PROJECT_HANDOFF / PR-B #54: DEV_SETUP_CHECKLIST.md 書き直し）。プラン archive: [docs/archive/plans/2026-05-08-pre-phase-2-docs-sync.md](archive/plans/2026-05-08-pre-phase-2-docs-sync.md)
- **Phase 2 daily 5 画面**: UI-00 / UI-07 / UI-09a / UI-06a / UI-09b は実装・merge 済み。navigation も 5 route active。
- **Tauri 2 on Linux 制約**: 日本語 IME インライン入力未対応（tauri#11412）のため、operator-facing L3 は Windows native で実施する。Phase 2 着手時の Windows native 移行は実施済み。
- **要求仕様書 / 詳細設計**: 全完了（USDM 約130本要求、20 画面モックアップ、18 テーブル定義、37 タスク、1 関数設計）

### 次にやるべきこと（優先度 E〜H）

**優先度A〜D: 要求仕様 / 詳細設計 → 全完了**（A: DB / B: CSV取込み / C: 独自コード・マスタ / D: 設計送り項目）

**優先度E: 開発準備 → 全完了**
- [x] E-1. Tauri開発環境構築（WSL2 直接開発、Docker は退役、`memory/dev-environment-policy.md`）
- [x] E-2. プロジェクトスキャフォールド（Tauri 2.0 + React 19 + TypeScript + SQLite）
- [x] E-3. データ初期投入計画（PR #52 で `seed-demo-data` binary 整備、本番投入は REQ-104 一括インポート）
- [ ] E-4. PLU書出しフォーマット/実機反映確認（オンライン調査で CV17 Ver.2.0.1 仕様を確認 2026-04-08。2026-07-02 field gate で CV17 1.1.1 import profile は `.txt` / 11列 / PLU総枠5000共有へ修正済み。2026-07-03 field gate で承認済み CV17 `.txt` の CV17取込み、SD書出し、SR-S4000設定読み、代表商品呼出しは通過。PR #122 は構造一致で gate 受容し merge 済み。最新アプリ生成 `.txt` の同手順再確認は Post-UI-08 follow-up）

**優先度F: バックエンド全層実装 → 全完了**
- [x] F-1〜F-6. v0.1.0-db-layer 〜 v0.6.0（IO/BIZ/CMD/MNT 全層）。詳細は [docs/archive/v0_tag_history.md](archive/v0_tag_history.md)

**優先度G: UI 基盤 Phase 1（残 follow-up あり）**
- [x] G-1〜G-5. Tailwind CSS 4 / shadcn/ui / Preflight 4/4 (7-2.5) / TanStack Router / tauri-specta / TanStack Query / UI-12 / invoke ラッパ / seed / env（PR #50 / #52）
- [ ] G-6. Phase 1 残 follow-up: 7-6 Storybook / 7-7b axe or hooks coverage / 7-8a Error Boundary / 7-8b 横断UI / 7-8c unsaved changes（Phase 2 completion gate ではない）。`plugin-dialog` foundation は UI-08 前提として PR #106 で導入済み。

**優先度H: Phase 2 毎日使う5画面（完了 / `v0.8.0-ui-daily` tag 済み）**
- [x] H-1. UI-00 ホーム画面（PR #56、`e6da3d8`）
- [x] H-2. UI-07 CSV 取込み（PR #62、`b8db619`）
- [x] H-3. UI-09a 日次売上（PR #65、`8c2be51`）
- [x] H-4. UI-06a 在庫照会（PR #67 `cf89082` + PR #74 `ae0c68f`）
- [x] H-5. UI-09b 月次売上（PR #66 `caf7d57` + PR #70 `aeeee2a`）
- [x] H-6. **利用者デモ（必須 gate）**: 5画面実機操作フロー合意。商品コードは小さいが、他の視認性問題はなし。商品コード readability は表示スケール option follow-up PR #77 で対応済み。
- [x] H-7. **8-9 Phase 2 完了時判定**: E2E / visual regression は Phase 2 tag gate にしない。Vitest + React Testing Library と Windows native H-6 を完了判断の証跡とし、smoke E2E / visual regression は横断 UI 変更や Phase 3 / Phase 4 の regression 状況で再評価。
- [x] H-8. **Phase 2 closeout tag**: PR #75 closeout merge `f44f99a` に `v0.8.0-ui-daily` tag を作成・push 済み。

詳細は [Plans.md](../Plans.md) / [docs/archive/plans/2026-05-08-pre-phase-2-docs-sync.md](archive/plans/2026-05-08-pre-phase-2-docs-sync.md) / [docs/archive/plans/2026-05-09-phase-2-ui-00.md](archive/plans/2026-05-09-phase-2-ui-00.md) を参照。

---

## 3. 成果物一覧

### 設計ドキュメント
| ファイル名 | 版数 | 内容 |
|---|---|---|
| [spec/requirements.md](spec/requirements.md) | current | REQ inventory と traceability policy |
| [spec/requirements-coverage.md](spec/requirements-coverage.md) | current | 公開要求全 ID の要約・定義先・状態・差分理由 |
| PROJECT_HANDOFF.md | - | 本ドキュメント（プロジェクト引き継ぎ） |
| screen_mockups.html | - | 全20画面モックアップHTML（ナビ付き、ブラウザで閲覧可） |
| SCREEN_DESIGN.md | - | 画面設計ドキュメント（設計判断ログ・気付き・未決事項） |
| DEMO_SCRIPT.md | - | 利用者向けデモ台本（5シナリオ＋確認ポイント） |
| DB_DESIGN.md | - | テーブル定義書（既存18テーブル + REQ-401日報取込み `daily_report_*` tables、設計意図・困りそうなケース付き）＋B-1/B-2パース仕様 |
| ARCHITECTURE.md | - | アーキテクチャ設計書（5層分割、POS adapter boundary、IO-07/BIZ-08/CMD-12 planned、実装順序） |
| FUNCTION_DESIGN.md | - | 関数設計書（第1〜第4段階 + 第7/8段階 UI、REQ-401日報取込みDesign Phase追加） |
| **UI_TECH_STACK.md** | - | **UI 技術スタック決定書（React 19 + Tauri 2 + shadcn/ui + TanStack + Tailwind stone系）+ デザイン哲学4本柱 + env 設計原則 §6.9 + ADR-001/002/003 (TanStack Router / tauri-specta / Query キャッシュ戦略)** |
| **DEV_SETUP_CHECKLIST.md** | - | **開発環境構築手順（WSL2 直接開発を現運用として明記、Docker 完結方針は §A.1 退役記録へ移動、Phase 1〜7 進捗統合済）** |
| **DOC_STYLE_GUIDE.md** | - | **ドキュメント書き方ガイド（参照形式、テンプレート、禁止事項、自動チェック 19 項目）** |
| docs/research/preflight-2026-04-20.md | - | Phase 1 P0 検証着手前 preflight 結果（4/4 OK） |
| docs/research/2026-04-20-invoke-wrapper-adr.md | - | ADR-004 invoke ラッパ設計（C 案 期限付き運用、`v0.8.0-ui-daily` タグ gate で typedInvoke 撤去済み） |
| Plans.md | - | プロジェクト現在地・タスク・進捗の SSOT。詳細なタグ履歴は必要に応じて `docs/archive/v0_tag_history.md` と併用 |

### POS CSV サンプル
| ファイル名 | 内容 |
|---|---|
| Z001_260313.CSV | POS CSV: 日計サマリ（サンプル） |
| Z002_260313.CSV | POS CSV: キー操作集計（サンプル） |
| Z004_260311PLU_商品_.CSV | POS CSV: PLU商品別売上（サンプル）★設計に重要 |
| Z005_260313.CSV | POS CSV: 部門別売上（サンプル） |
| hearing_sheet_v1.0.docx | 旧Word版ヒアリングシート（参考保管） |

### 実装成果物
| 領域 | 内容 |
|---|---|
| バックエンド | `src-tauri/src/{db,biz,cmd,mnt}` 全層実装完了。リポジトリ 5 種（product / inventory / sales / stocktake / system）+ BIZ-01〜08 + CMD-01〜12 + MNT-01〜04。REQ-401 第1スライスとして日報取込み `daily_report_*` 系を追加中 |
| フロントエンド基盤 | `src/` に config/navigation / components/layout / lib/{invoke,utils,env} / styles/globals.css / routes/__root.tsx + index.tsx |
| Tauri capability | `src-tauri/capabilities/default.json` で `core:window:allow-set-title` 等を許可 |
| CI / 静的検査 | D-033 の L0 pre-push / L1 `scripts/local-ci.sh` / L2 hosted final。shared classifier と shell fixtures、`scripts/{doc-consistency-check,check-env-safety}.sh`、lefthook。CI workflow は owner Enable 済み、main初回dispatch success。Draft/Ready eventのdogfoodと2026-08-01再評価がfollow-up |
| デモデータ | `src-tauri/src/bin/seed_demo_data.rs` + `src-tauri/src/seed_demo.rs`（rand seed 固定 `StdRng::seed_from_u64(42)`、冪等 `ON CONFLICT DO NOTHING` + `--reset` flag） |

### ヒアリングシートの構造
- 7列構成: No. / カテゴリ / 確認項目 / 質問内容 / 回答 / 開発者メモ / ステータス
- 番号体系: A=発注, B=入庫, C=販売出庫, D=仕入先, E=経理, Q=品質, P=優先度（10刻み）
- バージョン管理: メジャー(X.0)=構造変更 / マイナー(X.Y)=内容更新
- 書式ルール: 凡例シートに定義済み
- 更新方式: Claudeが挿入位置と内容を指示、マスターがスプレッドシートで直接作業

---

## 4. 確定した設計判断

### 大方針（セッション#1で確定した最重要判断）
- **PLU一括登録方式を採用。ただし 2026-07-02 field gate でCV17 1.1.1形式を更新**: 商品マスタからPLU登録用 `.txt` を生成→カシオPCツール経由でレジに一括書込み、という REQ-402 方針は維持する。CV17 1.1.1向けは `.txt` / 11列 / 13桁JAN必須で、PLU総枠5000を通常PLUとスキャニングPLUで共有する。現地profileでは通常PLU216枠使用によりスキャニングPLU217始まり。CV17 import成功だけでは完了扱いにしない。PR #122 では承認済み field file とアプリformatterの構造一致を external gate として受容し、最新アプリ生成 `.txt` の実機再確認は Post-UI-08 follow-up に残す。一方、現店舗の日報主入力は `Z001`/`Z002`/`Z005` であり、日次の SALES 取込みを Z004 単独前提で進めない。Z004 は PLU登録後の商品別売上・在庫引落し候補として再評価する。
- **会計フローは変更しない**: 利用者は今まで通りレジでバーコードスキャン→精算→レシート発行。レジ側の操作は一切変えない
- **システムは日次バッチ更新**: 精算後にSDカード→PC→CSV取込みの流れ。リアルタイム連携はしない
- **レジ移行を前提とした設計**: POS連携は抽象化インターフェース（アダプタパターン）。レジが変わってもパーサーモジュールの差替えだけで済む構造
- **商品の物理削除は行わない**: 不要な商品は廃番フラグで管理
- **生地はcm整数管理**: 在庫数をセンチメートルの整数で保持。表示時にcm/m切替可能（Q13確認済み）
- **技術スタック**: Tauri 2.0（デスクトップアプリ） + React(TypeScript)（フロントエンド） + SQLite（ローカルDB）
- **Z004に返品がマイナス値で出力される（2026-03-24実機検証済み）**: 戻モードでの返品処理はZ004にPLU別で個数マイナス・金額マイナスで出力される。CSV取込みで返品の在庫戻しは自動処理される
- **返品・交換画面の役割限定**: レジ戻し済みの返品はCSV取込みで在庫自動反映。返品・交換画面は帳面記録（レシート添付＋印刷）がメイン。レジ未処理（色交換等）の場合のみシステム側で在庫増減
- **棚卸し中もCSV取込み可能（SP-205-09修正）**: 棚卸し中のCSV取込み禁止→許可に変更。差異は最新システム在庫で動的計算。紙の棚卸しの「売れたら都度訂正」をシステムが自動化
- **取引先名・ブランド名はマスタ化**: 自由入力→サジェスト付き選択（入力揺れ防止）。新規追加リンク付き

### 商品マスタのキー設計（A30/A40/A42/A46/A47から導出）
- **JANコードあり商品** → JANコード(13桁)単位で個別管理
- **JANコードなし・生地系** → カテゴリ単位（6区分: 2m生地/50cm生地/パッチワーク生地/1m生地/キルト生地/その他生地）。数量はメートル単位
- **JANコードなし・生地以外（ヘア雑貨等）** → 独自コード（カテゴリ接頭辞＋連番: F-0001, H-0001等）を発番して個別管理
- 独自コードはアルファベット始まりでJANコード（数字のみ）と絶対に衝突しない設計

### 商品マスタのフィールド（B60のリスト構造から導出）
JANコード/独自コード（キー）、商品名、売価、原価、カテゴリ/部門、消費税率、メーカー品番（任意）、取引先名/ブランド名（任意）、廃番フラグ、在庫数、数量単位（個 or cm）

### システム化の範囲
- **対象**: 商品マスタ管理、入出庫管理、在庫照会、売上レポート、POS連携（双方向）
- **対象外**: 発注操作そのもの（FAX/サイト/現地）→ 発注記録・管理のみ対象（A72確定）
- **別システム**: 経理・確定申告ツール（E30）

### POS連携の設計方針
- SR-S4000は2025年6月販売終了、2032年6月サポート終了
- POS連携は双方向: 取込み（現店舗の日報主入力は `Z001`/`Z002`/`Z005` として再設計）+ 書出し（システム→CV17 1.1.1向けPLU登録 `.txt`）
- Z004 parser は既存実装として維持するが、2026-06-30 field-check 後は current SALES workflow 全体を表すものではなく、PLU登録後の商品別売上・在庫引落し候補として再評価する
- CSVパーサー内でJANコード末尾のアルファベット（カシオ固有識別子E等）を除去し、13桁/8桁に正規化してからシステム本体に渡す方針は Z004 track の既存前提として保持する。`Z001`/`Z002`/`Z005` の取込みでは別途 SALES design で項目・正規化・DB保存先を決める
- レジ変更時はパーサーモジュール＋PLU書出しフォーマッターの差替えのみで済む構造を目指すが、`Z001`/`Z002`/`Z005` 日報入力は先に current register 向けに再設計する

---

## 5. 要求仕様書の全体像（約130本の仕様）

### REQ-100系: 商品マスタ管理（30本）
- **REQ-101**: 商品新規登録（8本）- JANスキャン/手入力、独自コード自動発番、必須項目、在庫初期値、生地はcm単位
- **REQ-102**: 商品情報修正（8本）- キー以外の全項目修正、価格履歴記録、廃番フラグ切替、物理削除禁止、**PLU書出し通知**、**一括売価変更**
- **REQ-103**: 商品検索・一覧表示（8本）- スキャン/名前/カテゴリ検索、廃番視覚区別、並替え、修正画面遷移、**生地のcm/m表示切替**
- **REQ-104**: 商品マスタ一括インポート（7本）- CSV取込み、プレビュー、エラー検出、上書き/スキップ選択、テンプレート

### REQ-200系: 入出庫管理（32本）
- **REQ-201**: 仕入入庫記録（7本）- 複数商品一括、数量入力(生地はcm整数)、取引先記録、在庫加算、未登録商品→新規登録遷移。備考「PLU書出し前の新商品はREQ-203で手動出庫対応」
- **REQ-202**: 返品・交換入庫（5本）- 返品/交換種別、**レジ戻し済みフラグ（済み→帳面記録のみ/未処理→在庫増減）**、履歴記録、レシート添付＋印刷
- **REQ-203**: 手動販売出庫（5本）- CSV取込みで拾えない販売の補完、記録元フラグ(手動)、備考欄。**生地カテゴリの販売出庫もここで手動記録**
- **REQ-204**: 廃棄・破損出庫（6本）- 廃棄/破損/その他種別、理由記録、ロス実績一覧
- **REQ-205**: 棚卸し補正（9本）- 実カウント入力、差異自動計算、部門絞込み、中断再開、一括上書き、仕入原価総額算出、**棚卸し中もCSV取込み可能（差異は動的計算）**

### REQ-300系: 在庫照会（11本）
- **REQ-301**: 商品別在庫照会（3本）- スキャン/検索、在庫数+売価+原価+最終入庫日+最終販売日、部門一覧
- **REQ-302**: 在庫切れ・在庫少一覧（4本）- 在庫ゼロ一覧、閾値設定、廃番除外
- **REQ-303**: 在庫変動履歴（4本）- 商品別の全変動を時系列表示、変動種別、期間・種別絞込み

### REQ-400系: POS連携（27本）
- **REQ-401**: POS売上データ取込み（16本）- 2026-06-30 field-check 後は current SALES 取込みを `Z001`/`Z002`/`Z005` 日報入力として再設計する。既存の Z004 パース / JAN正規化 / 在庫減算設計は PLU登録後の商品別売上 track として保持し、日報主入力と混同しない
- **REQ-402**: PLU登録データ書出し（7本）- 商品マスタ→CV17 1.1.1向けPLUファイル生成、廃番除外、JAN/EAN-13スキャニングコード、PLU総枠5000から通常PLU使用数を除いた上限チェック、全件/差分書出し。現場ツール CV17 1.1.1 取込み、SD書出し、SR-S4000読込み、代表商品の呼出し確認は承認済み field file で通過し、PR #122 ではアプリformatterとの構造一致を manual gate として受容して merge 済み。最新アプリ生成 `.txt` の同手順再確認は Post-UI-08 follow-up
- **REQ-403**: 整合性検証（6本）- Z005部門別とシステム売上の突合、差異検出、原因候補提示（推奨機能、レジ移行時廃止可能）

### REQ-500系: 売上レポート（13本）
- **REQ-501**: 日次売上一覧（7本）- 日付指定、JAN+商品名+数量+金額、部門小計、記録元区別、並替え、CSV/印刷出力
- **REQ-502**: 月次売上集計（6本）- 月指定、商品別/部門別集計、ランキング、前月比較、絞込み、CSV/印刷出力

### QR系: 品質・制約条件（14本）
- **QR-01**: 金額小数点対応（既存）
- **QR-02**: 開発者不在時の単独運用＋マニュアル（既存）
- **QR-03**: 消費税率変更対応（既存）
- **QR-04**: 3日分バックアップ保持（既存）
- **QR-05**: バックアップ自動実行・復元（6本）- 日次自動、3日保持+自動削除、利用者アクセス可能フォルダ、復元UI、状況確認
- **QR-06**: 操作ログ記録・出力（4本）- 主要操作を日時付き記録、検索閲覧、CSV出力、1年保持+アーカイブ

---

## 6. 利用者の業務フロー概要

### 主要フロー（システム導入後の想定）
```
在庫目視確認＋システムで在庫照会(REQ-301/302) → 発注判断
→ 取引先に発注（方法は取引先で異なる、システム化対象外）
→ 商品＋伝票到着 → 検品 → システムで入庫記録(REQ-201) → 値付け → 品出し
→ 販売（レジでバーコードスキャン→精算→レシート。フロー変更なし）
→ 閉店後精算 → SDカード→PC→日次CSV取込み(REQ-401)
→ 売上レポート確認(REQ-501) → 年末棚卸し(REQ-205)
```

### POS 連携の運用境界
- 店舗の既存 POS と精算フローは変更せず、アプリは PC ツール経由のファイル連携境界で接続する
- 商品別集計に必要なコードは PLU 一括登録で供給し、保存確認後だけアプリ側の出力状態を更新する
- 媒体から PC への取込みと POS への書戻しは operator の明示操作とし、アプリは元ファイルを破壊しない
- 機種固有の形式・容量・文字コードは adapter 契約へ閉じ込め、core の在庫・売上責務へ漏らさない

### POS CSV 出力の公開設計前提
- POS は日計、決済手段、商品別、部門別の異なるデータ集合を出力する。取込みは bundle 単位の検証と、商品別 track の検証を分ける
- 商品別データは固定幅コード、未使用枠、機種由来のパディングを含むため、parse・normalize・validate を IO adapter 内で完結させる
- 文字コード、改行、メタ行、ヘッダ位置はファイル種別や実機 layout で異なり得る。自動推測で確定せず、既知 layout として判定して不明形状は安全に停止する
- 部門別データは POS 集計との照合材料であり、在庫整合性の自動修正には使用しない

## 履歴境界（public snapshot）

- public repository の履歴境界日は、Phase B で作成する parent を持たない初期 commit の author date とする
- 境界日以前を指す PR 番号、issue 番号、commit SHA は、owner が保管する private archive の証跡として読み替える。private archive の URL や repository 識別子は公開文書へ記載しない
- 日常開発は public repository だけを持つ書込み専用 clone で行い、archive remote、旧 object、replace ref を置かない
- 境界を越えた履歴参照が必要な場合は、public repository への push-capable remote を持たない履歴閲覧専用 clone を使う。private archive から旧 main ancestry を取得した後、`git replace --graft <public-init> <archive-main-head>` をローカルで再適用する
- replace ref は clone や通常 push では共有されない。新しい履歴閲覧 clone と履歴閲覧用途の Windows 同期 clone では、役割分離を確認してから同じ手順を再適用する


## 7. 最重要ニーズ（P30）

**「その日と1ヶ月に売れたものがJANコード・商品名付きで、いくらの何が何個売れたの一覧表が出てくると傾向がつかみやすい。やりたいけどできない部分」**

**実現方法（2026-06-30 field-check 後の実行順）**: まず現店舗の日報主入力である `Z001`/`Z002`/`Z005` を REQ-401 SALES redesign で扱い、日次・月次レポートを成立させる。並行して PLU一括登録（REQ-402）により商品別売上 track を整え、PLU登録後に Z004 を商品別売上・在庫引落しへ使えるか再評価する。

---

## 8. 未解決事項・保留事項

### ~~利用者への確認事項~~ → 回収済み
- ~~**C65**: 日次CSV取込みの運用フロー~~ → OK（確認済み）
- ~~**Q13**: 生地の在庫管理単位~~ → cm整数管理でOK（確認済み）

### システム設計後に再確認
- **Q40**: 障害時の対応。システム具体像が見えてから

### 開発環境の既知事項
- **WSL2 直接開発に移行済み（2026-04 以降）**: 当初 Docker 完結（案 C）で開始したが、UI 実装フェーズで GUI 確認頻度が上がり WSL2 直接開発（案 A）に切替済み。Docker は退役（`memory/dev-environment-policy.md`）。詳細経緯は `docs/DOCKER_REPAIR_LOG.md` 参照。PR-B #54 (private archive) で `docs/DEV_SETUP_CHECKLIST.md` に WSL2 ベース転換を正式反映済み（§A.1 退役記録に Docker 完結方針を移動）
- **Tauri 2 on Linux 日本語 IME 制約**: tauri#11412 OPEN（WSL2 固有でなく Ubuntu ネイティブでも再現）。Phase 1 P0 IPC 疎通は英字入力で検証完了。Phase 2 以降の operator-facing L3 は Windows native ビルドで実施する（`memory/tauri2-linux-ime-limitation.md`）

### 設計フェーズの懸案 → 全解消
A〜D 群（A: DB / B: CSV取込み / C: 独自コード・マスタ / D: 設計送り 5 項目）は全て確定済み。要求仕様 130 本 / 18 テーブル / 5 層 37 タスク / 関数設計（第 1〜4 + 第 7 段階 UI 基盤）は実装に反映済。Q40（障害時対応）のみ Phase 4 UI-13 整合性検証画面実装時に具体化予定（`Plans.md` Backlog 参照）

---

## 9. 経緯ログ

### セッション#N（2026-06-07）

詳細は [Plans.md](../Plans.md) を優先する。要点のみ記述。

- PR #74 在庫照会 高視認性 follow-up を merge（merge `ae0c68f`）。状態列の `Badge + icon + 日本語ラベル` 表示、Tauri 初期ウィンドウ拡大、Windows native L3 通過、外部レビュー P3 docs nit 2 件対応済み。
- Codex local execution policy を後処理。`.codex/config.toml` は `workspace-write + on-request` を通常作業モードにし、`.codex/execpolicy.rules` / `.codex/rules/default.rules` は repo-relative safe wrapper、direct WSL verification commands、Codex diagnostics を許可。destructive command と git / GitHub mutation は forbidden / prompt を維持。

### セッション#4〜#N（2026-04-04 〜 2026-05-08）

詳細は [Plans.md](../Plans.md) と [docs/archive/v0_tag_history.md](archive/v0_tag_history.md) に集約済み（個別 PR プランは `docs/archive/plans/` 配下）。要点のみ記述。

**バックエンド全層実装フェーズ（04-04〜04-13）**
- v0.1.0-db-layer (IO-01 + MNT-03): 18テーブル + マイグレーション
- v0.2.0-product-crud (BIZ-01 + CMD-01 + UI-01a/b): 商品 CRUD
- v0.3.0-inventory-backend (BIZ-02 + CMD-02-05): 入出庫
- v0.4.0-pos-integration (BIZ-03/04 + CMD-07/08 + IO-02/04): POS連携、E-4 PLU フォーマット仕様確定 (CV17 / 2026-04-08)
- v0.5.0 (BIZ-05/06/07 + CMD-09/10/11 部分 + IO-03): 売上集計 / 棚卸し / 整合性 / 一括インポート
- v0.6.0 (MNT-01/02/04 + IO-05/06 + CMD-11 残り + CMD-02-06 補完): 保守機能 + 仕上げ。バックエンド全層完了
- 第 5.5 段階で MNT-04 診断ログ（tracing 基盤）を導入し、第 6 段階以降の実装で活用
- テスト累計 546 本、全テスト通過、clippy 警告ゼロ

**UI 基盤 Phase 1 構築フェーズ（04-14〜04-22）**
- UI 技術スタック決定（[UI_TECH_STACK.md](UI_TECH_STACK.md)）: React 19 + Tauri 2 + shadcn/ui + TanStack + Tailwind stone系 + ウォーム系パレット。デザイン哲学 4 本柱（refactoring-ui / ux-principles / GOV.UK / IBM Carbon）+ 補助 3 原則 + japanese-webdesign 観点借用
- Phase B-1 フロント CI 品質基盤 3 PR（#44 Prettier + editorconfig / #45 ESLint 9 flat config + typescript-eslint strict-type-checked / #46 lefthook + npm audit + Node 24 actions）
- 7-1 Tailwind CSS 4 / 7-2 shadcn/ui 18 components（commit `9747545` / `abf587c`）/ 7-2.5 Task 0 Preflight 4/4 OK（`f0cab79`）
- 7-3 UI-12 共通レイアウト PR #50 (private archive)（merge `d512d01`）: navigation 4 エリア × 19 項目 + RootLayout / Sidebar 系 5 components + ウィンドウタイトル動的更新（Tauri `core:window:allow-set-title` capability）
- 7-4 ルーティング [ADR-001](UI_TECH_STACK.md) (TanStack Router) / 7-5a invoke 型定義 [ADR-002](UI_TECH_STACK.md) (tauri-specta) / 7-5b TanStack Query キャッシュ戦略 [ADR-003](UI_TECH_STACK.md) 確定
- 7-5c invoke ラッパ PR #48 (private archive)（merge `c5f3786`）: [ADR-004](research/2026-04-20-invoke-wrapper-adr.md) C 案 期限付き運用。Phase 2 closeout で `typedInvoke` fallback は撤去済み
- 7-9 seed-demo-data + 7-10 env 設計原則 PR #52 (private archive)（merge `0ed76ca`）: 6 部門 × uniform 100 商品 / suppliers 5 / sale_records 300 / inventory_movements 400 + env ファイル 4 本 + check-env-safety.sh + UI_TECH_STACK §6.9
- テスト累計 561 本

**Phase 2 着手前 書類整備フェーズ（05-08）**
- 引継ぎ書類 5 週間放置を natural break で同期（PR-A: SCREEN_DESIGN + PROJECT_HANDOFF / PR-B: DEV_SETUP_CHECKLIST.md 書き直し）
- プラン: [docs/archive/plans/2026-05-08-pre-phase-2-docs-sync.md](archive/plans/2026-05-08-pre-phase-2-docs-sync.md)
- Phase 2 8-1 UI-00 ホーム画面実装プラン: [docs/archive/plans/2026-05-09-phase-2-ui-00.md](archive/plans/2026-05-09-phase-2-ui-00.md)（critic subagent レビューで P1 × 3 / P2 × 8 潰し込み済、ユーザー判断 3 件確定）

### セッション#3（2026-04-02〜2026-04-03）

**フェーズ8: 開発準備（04-02〜04-03）**
38. 開発継続用の記憶レイヤー整備: project-memory.md / decision-log.md / current-status.md を追加し、AGENTS.md から参照する構成に整理
39. WSL側 ~/.codex を整備: CodexCLI 用の AGENTS.md と config.toml を配置し、repo-local docs を起点に再開できる形にした
40. DEV_SETUP_CHECKLIST の Step 4/5 を実施: Dockerfile / docker-compose.yml / .dockerignore 作成、Tauri + React + TypeScript scaffold を既存 repo に安全統合
41. Step 5 検証完了: 
pm install / 
pm run build / src-tauri cargo check 成功
42. WSL上のDocker不具合を切り分け: docker.sock 不在が起点で、contextずれ・sudo 実行・credential helper 参照不整合・~/.docker ownership崩れが連鎖したことを確認
43. 恒久対策を実施: WSLに socat を導入し、systemd service docker-desktop-socat.service で /run/docker.sock を常設。~/.docker ownership も修復し、通常ユーザーで docker info / docker compose build が通る状態へ復旧
### セッション#2（2026-03-21〜2026-03-27）

**フェーズ5: 画面設計（03-21〜03-22）**
24. 画面遷移図作成（全20画面の構造と利用者の1日の動線）
25. 全20画面のHTMLモックアップ作成（screen_mockups.html）
    - 毎日の業務: ホーム/CSV取込み/日次売上/在庫照会/月次売上
    - 入出庫系: 入庫記録/返品交換/手動出庫/廃棄破損
    - 商品管理系: 商品一覧/商品登録(JAN)/商品登録(独自)/商品修正/一括インポート
    - 在庫補正系: 棚卸し/在庫変動履歴
    - POS連携系: レジ登録データ作成/整合性検証
    - システム管理系: バックアップ/操作ログ/設定
26. 画面設計引き継ぎドキュメント作成（SCREEN_DESIGN.md）- 全画面の設計判断ログ＋気付き・未決事項
27. 設計中の気付き多数: 表記統一（JANコード→商品コード）、独自コードの認知負荷、取引先マスタ化、PLU書出し遷移タイミング、デスクトップアプリのレイアウト（2カラム構成）、技術用語の利用者向け表現変更

**フェーズ6: 利用者合意形成（03-23〜03-25）**
28. デモ台本作成（DEMO_SCRIPT.md）- 5シナリオ＋確認ポイント
29. 利用者への対面デモ実施、大筋OK
30. 利用者からの質問: 返品・交換時のレシートデータと在庫反映の関係
31. レジの返品オペレーション詳細をヒアリング: 戻モード使用、5つの返品パターンを整理
32. **Z004実機検証（03-24）**: 戻モードの返品がZ004にマイナス値（個数-1/金額-385）で出力されることを確認
33. 返品・交換画面の仕様変更: レジ戻し済みフラグ追加、在庫増減はCSV取込みに任せる設計
34. SP-205-09修正: 棚卸し中CSV取込み禁止→許可（差異は動的計算）
35. POS/在庫管理の責任分離の設計方針をレジ変更時の影響範囲として再確認

**フェーズ7: 詳細設計フェーズ準備（03-27）**
36. 詳細設計タスクリスト作成（A〜E、19タスク）
37. PROJECT_HANDOFF.md更新（現在地・成果物・設計判断・経緯ログ）

### セッション#1（2026-03-13〜2026-03-19）

**フェーズ1: ヒアリング（03-13〜03-15）**
1. 「要求を仕様化する技術」をNotebookLMに投入し、USDM等8手法を抽出
2. ヒアリングシート作成（Word v1.0→v1.3→Excel v2.0→v2.1）
3. 書式ルールをUXガイドライン調査の上で策定
4. A47確定（生地はカテゴリ単位6区分、生地以外は個別管理）
5. ヒアリングフェーズ完了判定

**フェーズ2: POS実機検証（03-15）**
6. カシオPCツール経由でCSV出力検証完了（Z001/Z002/Z004/Z005）
7. Z004分析: PLU登録929品は全て化粧品系。手芸用品はPLU未登録
8. CSV出力経路の確定: PCツール経由のみ（ECR+ Premium終了済み）

**フェーズ3: 要求仕様書作成（03-15〜03-19）**
9. P30実現方法の検討: 案A(二重運用)/案B(システム主導)/案C(PLU拡充)を比較
10. 会計フロー議論: パターン1(システム先行)→パターン3(完全置換)→レシート問題発覚
11. **PLU一括登録方式に到達**: 商品マスタ→PLU登録CSV→PCツール→レジ。会計フロー変更なし
12. REQ-400系を3本に再構成: 401(取込み)/402(PLU書出し)/403(整合性検証)
13. 動詞抽出でREQ-101〜502の全仕様を記述（122本）
14. 第三者視点レビュー: 4項目の抜け検出→REQ-104(一括インポート)/REQ-303(変動履歴)/QR-05(バックアップ)/QR-06(操作ログ)を追加
15. 引き継ぎドキュメント更新

**フェーズ4: 矛盾・漏れチェック＋技術選定（03-19〜03-20）**
16. 利用者確認事項回収: C65(日次CSV取込みフロー)OK、Q13(生地cm整数管理)OK
17. 生地の在庫管理をcm整数に変更。関連仕様(SP-101-05/SP-201-03/SP-205-02)更新、SP-103-08(cm/m表示切替)追加
18. 本書の手法に基づく矛盾・漏れチェック（MECE、時系列分割、状態分割、動詞の不成功パターン）
19. 11件の問題を検出: 発見1-6は仕様に反映（PLU書出し通知、在庫マイナス警告、棚卸し中CSV禁止、CSV異常系等）、発見7-11は設計送り
20. SP-102-07/08追加（PLU書出し通知＋一括売価変更）、SP-205-09追加（棚卸し中CSV取込み禁止）、SP-401に4本追加（在庫マイナス警告/巻き戻し/空ファイルエラー/形式検証/生地除外）
21. 要求TMの列追加（設計箇所・テストケースID）
22. 技術スタック確定: **Tauri 2.0 + React(TypeScript) + SQLite** — デスクトップアプリ、軽量高速、レジ移行にも耐える設計
23. 引き継ぎドキュメント更新

**フェーズ5: 詳細設計 — DB設計＋CSV取込みロジック（03-28〜03-29）**
24. 技術的認知負荷の軽減方針を合意: Claudeは根拠＋困りそうなケースをセットで出す、マスターは業務シナリオで検証
25. DB設計完了: 18テーブル（products, departments, suppliers, receiving_records/items, return_records/items, manual_sales/items, disposal_records/items, csv_imports, csv_import_errors, sale_records, inventory_movements, price_history, stocktakes/items, operation_logs, app_settings）
26. DB設計レビュー24件対応（採用11件、不採用5件、既対応1件、一部採用3件、追加修正4件）
27. 利用者ヒアリング: グループコード問題→productsにjan_codeカラム追加、布の管理5パターン整理
28. 利用者ヒアリング: レジ外販売は実質ゼロ→手動販売出庫の用途をPLU未登録新商品のみに限定、二重減算対策確定
29. CSV取込みロジック確定: Parse→Validate→Preview→Commitの4段階パイプライン、csv_import_errorsテーブル新設、status 3値（completed/completed_partial/rolled_back）、B-1パース仕様＋B-4エラーハンドリング確定
30. C群完了: 独自コード接頭辞ルール確定（全部門2文字統一、11部門にprefix割当）、全21部門の初期データ確定、廃番特価は売価変更＋PLU書出しの既存フローで対処
31. D群完了: 一括インポートのエンコーディング自動判定（BOM→UTF-8/それ以外→CP932）＋プレビュー必須、PLU dirty/exported_atの更新タイミング明文化、CSV取込み排他制御（Preview〜Commit/Cancelまでロック）、在庫少閾値初期値（3個/500cm）、操作ログ365日保持＋アプリ起動時自動削除

**フェーズ6: アーキテクチャ設計＋関数設計（03-31）**
32. ARCHITECTURE.md作成: 5層分割（UI/CMD/BIZ/IO/MNT）、37タスク一覧、全タスクのデータ構造・処理構造・制御構造を記述、6段階実装順序を定義
33. FUNCTION_DESIGN.md作成: 第1〜2段階分の関数設計（IO-01: 12関数、MNT-03: 2関数、BIZ-01: 5関数、CMD-01: 5コマンド、UI-01a/01b: 2ページコンポーネント）
34. テスト・要求TM運用ルール合意: 実装とテスト同時作成、テストに仕様ID紐付け、要求TMは各段階完了時に更新

---

## 10. Claudeへの指示

### コミュニケーションスタイル
- マスターとはカジュアルなトーンでやり取りする
- 技術的な判断は根拠を示す。調べてから答える
- ドキュメント更新は挿入位置と内容を指示し、マスターがスプレッドシートで直接作業する形式
- ファイル生成が必要な場合は構造変更（メジャーバージョン）時のみスクリプト再生成

### 技術的認知負荷の軽減方針（2026-03-28 合意）

**背景**: マスターはシステム思考・業務フロー構造化に強いが、DB設計やフレームワーク固有の知識など技術的な部分は学習中。Claudeの提案の妥当性を技術的に検証する力が弱めになるという課題がある。

**Claudeの責務（技術的妥当性の検証は俺が持つ）**:
- 設計判断を出すときは「なぜこうしたか」「他にどんな案があって、なぜ捨てたか」を毎回セットで出す
- 「この設計で困りそうなケース」を自分でセルフレビューして先に挙げる
- 「将来こう変わったとき、この設計で対応できるか」も自分で確認する
- 技術的な見落としがあればClaude側が先に指摘する責任を負う

**マスターの責務（業務的妥当性の検証はマスターが持つ）**:
- 技術的な正しさを検証するのではなく、業務シナリオでぶつける
- 「この設計で、利用者のあの操作はちゃんと記録できる？」と業務の実態で検証する
- 利用者の実際の運用（返品オペレーション、レジ外販売の有無等）を確認して伝える

**仕組み（設計レビューチェックリスト）**:
- Claudeは各設計判断に対して「この操作をしたとき、どのテーブルに何が書き込まれるか」の具体例を出す
- Claudeは「この設計で困るケース」を自分で挙げる（セルフレビュー）
- Claudeは「将来こう変わったとき対応できるか」を確認する
- マスターは具体例が業務の実態と合っているかを判断する

**実装フェーズでの検証**:
- テストコードが機械的に検証する（「毛糸を3個入庫→1個返品→在庫が2になること」等）
- テストが通れば設計が正しく実装されていることが保証される
- マスターが目視で技術的正しさを確認する必要がなくなる

### テスト・要求TM運用ルール（2026-03-31 合意）

**ルール1: 関数実装とテストは同時に書く**
- 1関数または1ユースケース単位で、実装と同時にテストを書く。「後でまとめて」にしない
- 正常系・異常系・境界値のテストを最低限カバーする

**ルール2: テストに仕様IDを必ず紐付ける**
- テスト関数名にREQ番号を含める（例: `test_create_product_req101_normal`）
- テスト関数内にもコメントで仕様IDを記載（例: `// REQ-101-01: JANコード入力で商品登録`）

**ルール3: 要求TMは各段階の完了時に更新する**
- 第1段階完了時: IO-01, MNT-03の設計箇所・テストケースIDを要求TMに記入
- 第2段階完了時: BIZ-01, CMD-01, UI-01a, UI-01bの設計箇所・テストケースIDを記入
- 以降、各段階完了時に同様に更新
- 「全部終わってからまとめて」は禁止。段階ごとに確実に埋める

### 参照すべき外部知識
- 「要求を仕様化する技術」（清水吉男）のUSDM手法 → NotebookLMに投入済み
- カシオ SR-S4000: PCツール経由CSV出力/PLU一括登録、5000PLU、20部門、2032年サポート終了
- ヒアリング由来の原文・書式ルール → owner が repo 外で保管する要求原典（公開文書へ転載しない）
- POS CSVサンプル → Z001/Z002/Z004/Z005。CP932、NEL改行（Z001のみCRLF）
- 要求仕様 → `docs/spec/requirements.md` + `docs/spec/requirements-coverage.md` + 各行からリンクする design docs
- Tauri 2.0公式ドキュメント → https://v2.tauri.app/

