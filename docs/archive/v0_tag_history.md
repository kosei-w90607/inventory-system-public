# Tag Guarantees & Test Count — v0.1.0 〜 v0.5.0 アーカイブ

> **親文書**: [Plans.md](../../Plans.md)
> **目的**: v0.1.0-db-layer 〜 v0.5.0 の Tag Guarantees と対応する Test Count を Plans.md から切り出して履歴保存
> **アーカイブ日**: 2026-04-16（Plans.md 200行上限対応）
> **対象範囲**: バックエンド段階的実装（第1〜第5段階）。v0.6.0 以降は Plans.md 本体を参照

---

## Tag Guarantees

### v0.1.0-db-layer
- IO-01 DB初期化 + MNT-03 マイグレーション（18テーブル、CHECK制約、10インデックス、初期データ）
- テスト10本全パス

### v0.2.0-product-crud
- IO層: product_repo（11関数）, inventory_repo（insert_movement）, stocktake_repo（2関数）, system_repo（1関数）, migration
- BIZ層: product_service — create_product / update_product / toggle_discontinue / search_products / generate_custom_code
- テスト92本全パス、clippy警告ゼロ、fmt準拠
- CMD層・UI層は未実装（バックエンドのみ）

### v0.3.0-inventory-backend
- IO層: inventory_repo分割（8ファイル）, receiving/return/manual_sale/disposal_repo, sales_repo, migration v2
- BIZ層: inventory_service — apply_stock_change + 4業務関数（入庫/返品/手動販売/廃棄）+ 冪等性 + 整合性テスト
- テスト205本全パス、clippy警告ゼロ、fmt準拠
- 第3段階（入出庫+在庫照会）バックエンド完了

### v0.4.0-pos-integration
- IO層: z004_parser（IO-02）, plu_formatter（IO-04）, csv_import_repo
- BIZ層: csv_import_service（BIZ-03: 4関数+15型）, plu_export_service（BIZ-04）
- CMD層: csv_import_cmd（CMD-07: 4コマンド）, plu_export_cmd（CMD-08: 2コマンド）, AppState + CmdError
- テスト320本全パス、clippy警告ゼロ、fmt準拠
- 第4段階（POS連携）バックエンド完了

### v0.5.0
- IO層: product_csv_importer（IO-03: ParsedRow対応）
- BIZ層: sales_service（BIZ-05）, stocktake_service（BIZ-06）, integrity_service（BIZ-07）, product_service拡張（一括インポート+D-2統合）
- CMD層: product_cmd（CMD-01: 7コマンド）, sales_cmd（CMD-09: 2コマンド）, stocktake_cmd（CMD-10: 4コマンド）, integrity_cmd（CMD-11部分: 2コマンド）
- テスト448本全パス、clippy警告ゼロ、fmt準拠
- 第5段階（レポート+棚卸し+一括インポート+CMD層）完了

---

## Test Count（v0.5.0 時点まで、累計448本）

| PR | 新規テスト | 累計 |
|----|-----------|------|
| Phase 5 (DB基盤) | 10 | 10 |
| PR #1 (product_repo) | 35 | 45 |
| PR #2 (support repos) | 16 | 61 |
| PR #3 (BIZ層) | 31 | 92 |
| PR #4 (FUNCTION_DESIGN分割) | 0 | 92 |
| PR #5 (IO層 入出庫) | 57 | 149 |
| PR #6 (inventory_repo分割) | 0 | 149 |
| PR #7 (BIZ-02 在庫変動) | 56 | 205 |
| PR #8 (inventory_service分割) | 0 | 205 |
| PR #9 (関数設計書) | 0 | 205 |
| PR #10 (共有土台) | 3 | 208 |
| 突合テスト (L1+L2) | 2 | 210 |
| PR #12 (IO-04+BIZ-04) | 28 | 238 |
| PR #13 (IO-02+csv_import_repo) | 38 | 276 |
| PR #14 (BIZ-03 CSV取込み) | 35 | 311 |
| PR #15 (CMD層 CMD-07/08) | 9 | 320 |
| PR #19 (IO-03 商品CSVインポーター) | 12 | 332 |
| PR #20 (BIZ-05 売上集計) | 22 | 354 |
| PR-4 (BIZ-06 棚卸し+DB拡張) | 51 | 405 |
| PR-5 (BIZ-07整合性+BIZ-01 Import+D-2) | 35 | 440 |
| PR-6 (CMD層一括 CMD-01/09/10/11部分) | 6 | 446 |
| design_compliance_test 調整 | 2 | 448 |

**v0.5.0 タグ時点の累計**: 448本 / clippy警告ゼロ / fmt準拠

---

## Progress Tracker（第1〜第6段階 + CMD-02〜06 補完 + 横断整備）

> **アーカイブ日**: 2026-04-19（Plans.md 200行上限対応 2回目）
> **対象**: バックエンド完了分。v0.6.0 タグ (2026-04-18) までの全 progress を本ファイルに集約

### 第1段階: DB基盤（完了）
- [x] IO-01 + MNT-03, テスト10本, `v0.1.0-db-layer` タグ

### 第2段階: 商品管理ロジック（完了）
- [x] PR #1: product_repo + 型定義 — マージ済み
- [x] PR #2: サポートリポジトリ群 — マージ済み
- [x] PR #3: BIZ層 product_service — マージ済み（Codexレビュー通過）
- [x] `v0.2.0-product-crud` タグ打ち完了

### 第3段階: 入出庫 + 在庫照会（バックエンド完了）
- [x] FUNCTION_DESIGN.md に在庫ドメイン不変条件（INV-1〜5）+ BIZ-02関数設計を追記
- [x] FUNCTION_DESIGN.md を9ファイルに分割（PR #4 マージ済み）
- [x] PR #5: IO層（migration v2 + 入出庫repos + sales_repo + 共通型）— マージ済み
- [x] PR #6: inventory_repo 分割リファクタ — マージ済み
- [x] PR #7: BIZ-02 実装（apply_stock_change + 4業務関数 + 冪等性 + 整合性テスト）— マージ済み
- [x] PR #8: inventory_service.rs 分割リファクタ（8ファイル構成）— マージ済み

### 第4段階: POS連携（完了）
- [x] 関数設計: IO-02, BIZ-03, BIZ-04, CMD-07/08, CSV取込みリポジトリ（PR #9 マージ済み）
- [x] E-4仕様調査: オンライン調査で確定（2026-04-08）。TSV形式、CP932、課税方式テキスト分類
- [x] PR #10: 共有土台 + E-4契約固定 + IO-04設計 + 品質ツール — マージ済み
- [x] PR #11: 設計-コード突合テスト導入 — マージ済み（`docs/plans/code-compliance/`）
- [x] PR #12: PLUレーン完走（IO-04 + BIZ-04）— マージ済み
- [x] PR #13: CSV IO層（IO-02 + csv_import_repo）— マージ済み
- [x] PR #14: BIZ-03（CSV取込みパイプライン）— マージ済み
- [x] PR #15: CMD層（CMD-07/08 + AppState）— マージ済み

### 第5.5段階: 診断ログ基盤（完了）
- [x] 要求仕様書（REQ-700）、タスク設計（MNT-04）、関数設計書作成
- [x] 実装コミット済み（`feat/mnt04-diagnostic-log` ブランチ、457テスト）
- [x] PR #25 (private archive) — 作成→レビュー対応5件→マージ済み、Issue #24 自動Close

### 第6段階: 保守+仕上げ（完了）
- [x] 関数設計書: 71-mnt-backup.md, 72-mnt-log-manager.md, 27-io-report-csv-exporter.md, 28-io-image-manager.md, 43-cmd-settings-log.md
- [x] 既存設計書更新: 20-io-product-repo.md §2.8, FUNCTION_DESIGN.md 目次
- [x] PR-2: IO-05/06 + system_repo拡張
- [x] PR-3: MNT-02 操作ログ管理
- [x] PR-4: MNT-01 バックアップ・リストア
- [x] PR-5: CMD-11 コマンド群

### CMD-02〜06 補完（完了）
- [x] 関数設計書: 44-cmd-inventory.md（CMD-02〜06全10コマンド + IO層3関数 + BIZ層listラッパー）
- [x] CMD-02〜05 実装（入庫/返品/手動販売/廃棄、7コマンド + BIZ list 3関数）
- [x] CMD-06 実装（在庫照会: stock_detail/low_stock/movements、IO3+BIZ3+CMD3）

### 横断整備（完了）
- [x] PR #40 (private archive): auto-memory ハーネス導入（hooks + rules + CLAUDE.md 記憶運用）— マージ済み
- [x] PR #41 (private archive): 第7段階（UI基盤）着手準備 — UI_TECH_STACK.md 策定 + UI-00/UI-13 追加 — マージ済み
- [x] commit `f7ac1b7` (2026-04-19): CLAUDE.md を 101→50 行に圧縮し安全規則を settings.json deny に移行。機械強制可能ルール (rm -rf/sudo/git push/git reset --hard) を permissions に寄せる三層分離原則を適用（memory: `claude-md-layering-principle.md`）
- [x] commit `775b712` (2026-04-19): settings.json に sandbox Phase 1 構成を追加。bubblewrap ベース OS レベル隔離の準備
- [x] 2026-04-19: permissions/sandbox 多層防御整備（Phase A-D1、global deny 38件、ask 10件、allow 67件、memory 3件記録）
