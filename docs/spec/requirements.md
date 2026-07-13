# REQ インベントリ

> **親文書**: [README.md](README.md)（spec index）
> **出典**: owner が repo 外で保管する要求原典の REQ 17 本 + 開発拡張 ID 7 本（コードコメント由来。docs 未定着だったテスト命名用 ID をここで定着させる）+ Design Phase 補足 ID 3 本。公開要求の全 ID 対応と状態は [requirements-coverage.md](requirements-coverage.md) を正とする
> **役割**: `generate_traceability` bin（`cargo run --bin generate_traceability -- --check`）の T2 phantom REQ 判定 / T3 テスト 0 本 WARN の判定基盤。本表にない REQ ID をテストが使うと CI / pre-push が ERROR になる
> **coverage**: `required` はテスト 0 本なら T3 WARN、`deferred` は未実装要求として T3 WARN 対象外。実装着手時に `required` へ戻す。
> **更新規約**: owner 保管原典の変更を採用するときは、本表、[requirements-coverage.md](requirements-coverage.md)、対応 design、traceability を同じ変更で同期する。原典の文面や機微な業務事実は公開 repository へ転記しない

## REQ 一覧（27 行）

| REQ ID | 名称 | 対応タスク | 出典 | coverage |
|---|---|---|---|---|
| REQ-101 | 商品を新規登録できること | UI-01b, BIZ-01 | 要求仕様書 v2.1 | required |
| REQ-102 | 商品情報を修正できること | UI-01b, BIZ-01 | 要求仕様書 v2.1 | required |
| REQ-103 | 商品を検索・一覧表示できること | UI-01a, BIZ-01 | 要求仕様書 v2.1 | required |
| REQ-104 | 商品マスタをCSVから一括インポートできること | UI-01c, BIZ-01 | 要求仕様書 v2.1 | required |
| REQ-201 | 仕入れによる入庫を記録できること | UI-02, BIZ-02 | 要求仕様書 v2.1 | required |
| REQ-202 | 顧客返品・交換による入庫を記録できること | UI-03, BIZ-02 | 要求仕様書 v2.1 | required |
| REQ-203 | CSV取込みで記録されない販売出庫を手動で記録できること | UI-04, BIZ-02 | 要求仕様書 v2.1 | required |
| REQ-204 | 廃棄・破損による出庫を記録できること | UI-05, BIZ-02 | 要求仕様書 v2.1 | required |
| REQ-205 | 棚卸しによる在庫数の補正ができること | UI-10, BIZ-06 | 要求仕様書 v2.1 | required |
| REQ-206 | 入出庫系の業務記録を後から一覧・詳細で追跡できること | UI-02b, UI-03b, UI-04b, UI-05b, UI-07b, UI-10b | Design Phase 補足 2026-06-27 | deferred |
| REQ-207 | 在庫変動履歴から元業務記録へ相互参照できること | UI-06c, BIZ-02 | Design Phase 補足 2026-06-27 | deferred |
| REQ-208 | 入出庫系の業務記録を物理削除せず取消・訂正できること | UI-02b, UI-03b, UI-04b, UI-05b, BIZ-02 | Design Phase 補足 2026-06-27 | deferred |
| REQ-301 | 商品別の在庫数を照会できること | UI-00, UI-06a | 要求仕様書 v2.1 | required |
| REQ-302 | 在庫切れ・在庫少の商品を一覧表示できること | UI-00, UI-06b | 要求仕様書 v2.1 | required |
| REQ-303 | 商品ごとの在庫変動履歴を時系列で参照できること | UI-06c, BIZ-02 | 要求仕様書 v2.1 | required |
| REQ-401 | POS売上データの取込み（current SALES は Z001/Z002/Z005 日報取込み。既存Z004は商品別取込み） | UI-07, IO-07, BIZ-08, CMD-12, BIZ-03 | 要求仕様書 v2.1 + D-022 + D-025 | required |
| REQ-402 | 商品マスタからPLU登録用データを生成し、レジに書き出せること | UI-08, BIZ-04 | 要求仕様書 v2.1 | required |
| REQ-403 | POS CSVの部門別集計とシステムの売上記録を突合し、整合性を検証できること | 未割当（UI-13/REQ-904とは別） | owner 保管原典 | deferred |
| REQ-501 | 日次の売上一覧をJANコード・商品名・個数・金額付きで表示できること | UI-09a, BIZ-05 | 要求仕様書 v2.1 | required |
| REQ-502 | 月次の売上集計・傾向を表示できること | UI-09b, BIZ-05 | 要求仕様書 v2.1 | required |
| REQ-700 | 診断ログ | MNT-04 | 開発拡張 | required |
| REQ-901 | バックアップ | MNT-01 | 開発拡張 | required |
| REQ-902 | ログ管理（操作ログ記録/一覧/自動削除） | MNT-02 | 開発拡張 | required |
| REQ-903 | マイグレーション/DB基盤（初期化/スキーマ更新） | MNT-03, IO-01 | 開発拡張 | required |
| REQ-904 | 整合性チェック（在庫数突合/修復） | BIZ-07, UI-13 | 開発拡張 | required |
| REQ-905 | 設定管理（設定CRUD/エラー変換） | CMD-11, UI-11a | 開発拡張 | required |
| REQ-906 | 画像管理（レシート画像保存） | IO-06 | 開発拡張 | required |

## 補足

- 開発拡張 ID（REQ-700, REQ-901〜906）は owner 保管原典の ID 集合には含まれない。保守・診断系タスクのテスト命名規約 `_reqNNN` を満たすために実装時に導入され、コードコメント（`// REQ-NNN: 名称`）で一貫使用されている名称を転記した。
- Design Phase 補足 ID（REQ-206〜208）は REQ-201〜205 / REQ-303 / QR-06 の実装時に露出した横断要件である。公開複合正本の拡張候補として管理し、実装着手までは `coverage=deferred` とする。
- REQ-403 は POS 部門別売上照合として `coverage=deferred` とし、`--check` の `[T3]` WARN 対象外にする。UI-13 / REQ-904 の在庫整合性とは別契約であり、専用 task の Design Phase と実装着手時に `required` へ戻す。
- SP-NNN / QR-NN / `UI-NNx-Dn`（設計決定 ID）は本表の対象外（traceability v1 の Non-scope）。
